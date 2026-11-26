const LOCK_SECONDS=3600;
const MAX_FAILURES=3;

const attemptScript=[
  'local count = tonumber(redis.call("GET", KEYS[1]) or "0")',
  'local ttl = tonumber(ARGV[3])',
  'if count >= tonumber(ARGV[2]) then',
  '  local remaining = redis.call("TTL", KEYS[1])',
  '  if remaining < 0 then redis.call("EXPIRE", KEYS[1], ttl); remaining = ttl end',
  '  return {count, math.max(1, remaining)}',
  'end',
  'if ARGV[1] == "1" then redis.call("DEL", KEYS[1]); return {0, 0} end',
  'count = redis.call("INCR", KEYS[1])',
  'if count == 1 or count == tonumber(ARGV[2]) then redis.call("EXPIRE", KEYS[1], ttl) end',
  'if count >= tonumber(ARGV[2]) then return {count, ttl} end',
  'return {count, 0}',
].join('\n');

function redisConfig(){
  const url=process.env.UPSTASH_REDIS_REST_URL;
  const token=process.env.UPSTASH_REDIS_REST_TOKEN;
  if(url&&token)return {url,token};
  return {url:process.env.KV_REST_API_URL,token:process.env.KV_REST_API_TOKEN};
}

export function loginLimitConfigured(){
  const {url,token}=redisConfig();
  return Boolean(url?.startsWith('https://')&&token);
}

export async function recordLoginAttempt(matches){
  const {url,token}=redisConfig();
  const scope=process.env.VERCEL_ENV||'local';
  const response=await fetch(url,{
    method:'POST',redirect:'error',signal:AbortSignal.timeout(4000),
    headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
    body:JSON.stringify(['EVAL',attemptScript,1,'place-notes:login:v1:'+scope,matches?'1':'0',MAX_FAILURES,LOCK_SECONDS]),
  });
  if(!response.ok)throw Error('Login storage unavailable');
  const {result}=await response.json();
  if(!Array.isArray(result)||result.length!==2||!result.every(value=>Number.isInteger(value)&&value>=0))throw Error('Invalid login state');
  const [failures,retryAfter]=result;
  return {remaining:Math.max(0,MAX_FAILURES-failures),retryAfter};
}
