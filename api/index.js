import {createHash,randomBytes,createCipheriv,createDecipheriv} from 'node:crypto';
import {shopKey} from '../public/statistics.js';
const MASTER='4226d8c5-8de1-81e8-9ace-000b3415e595';
const DS='4226d8c5-8de1-812a-abad-000b3a03e68e';
const key=()=>createHash('sha256').update(process.env.APP_SECRET||'').digest();
const configured=()=>Boolean(process.env.NOTION_TOKEN);
const sharingEnabled=()=>Boolean(process.env.APP_SECRET?.length>=32);
export function seal(records,now=Date.now()){const iv=randomBytes(12),c=createCipheriv('aes-256-gcm',key(),iv);const data=Buffer.concat([c.update(JSON.stringify({exp:now+7*86400000,records})),c.final()]);return Buffer.concat([iv,c.getAuthTag(),data]).toString('base64url');}
export function unseal(token,now=Date.now()){const b=Buffer.from(token,'base64url');const d=createDecipheriv('aes-256-gcm',key(),b.subarray(0,12));d.setAuthTag(b.subarray(12,28));const p=JSON.parse(Buffer.concat([d.update(b.subarray(28)),d.final()]));if(p.exp<now)throw Error('만료된 공유 링크입니다.');return p.records;}
const safeMap=(value,hosts)=>{try{const u=new URL(value);return u.protocol==='https:'&&hosts.includes(u.hostname)?u.href:'';}catch{return '';}};
const txt=p=>(p?.rich_text??p?.title??[]).map(x=>x.plain_text??x.text?.content??'').join('');
export function normalize(page){const p=page.properties??{};return {id:page.id,shopId:p['식당']?.relation?.[0]?.id??'',name:txt(p['상호명']),date:p['방문 날짜']?.date?.start?.slice(0,10)??'',region:p['지역']?.select?.name??'',area:txt(p['세부 지역']),type:p['음식 종류']?.select?.name??'',menu:txt(p['주문 메뉴']),review:txt(p['간단 후기']),revisit:p['재방문 의사']?.select?.name??'',address:txt(p['주소']),naverMap:safeMap(p['네이버 지도']?.url,['map.naver.com','naver.me']),googleMap:safeMap(p['Google Maps']?.url,['www.google.com','maps.google.com','maps.app.goo.gl']),photos:(p['사진']?.files??[]).map((f,i)=>({index:i,url:f.file?.url??f.external?.url??''})).filter(f=>f.url.startsWith('https://'))};}
async function notion(path,body){const r=await fetch('https://api.notion.com/v1/'+path,{method:'POST',headers:{Authorization:`Bearer ${process.env.NOTION_TOKEN}`,'Notion-Version':'2025-09-03','Content-Type':'application/json'},body:JSON.stringify(body)});if(!r.ok){const error=new Error('Notion 조회 실패 ('+r.status+')');error.status=r.status;throw error;}return r.json();}
async function queryAll(ds,sorts){let cursor,all=[];do{const p=await notion(`data_sources/${ds}/query`,{page_size:100,...(sorts?{sorts}:{}),...(cursor?{start_cursor:cursor}:{})});all.push(...p.results.filter(x=>x.object==='page'&&!x.archived&&!x.in_trash));cursor=p.has_more?p.next_cursor:null;}while(cursor);return all;}
export function joinVisits(visits,masters){const shops=new Map(masters.map(p=>[p.id,normalize(p)]));return visits.map(p=>{const v=normalize(p),m=shops.get(v.shopId);if((p.properties?.['식당']?.relation??[]).length!==1||!m)throw Error('Notion 조회 실패: 방문 이력의 식당 연결을 확인하세요.');return {...v,name:m.name,region:m.region,area:m.area,type:m.type,address:m.address,naverMap:m.naverMap,googleMap:m.googleMap,shopRevisit:m.revisit};});}
async function records(){
  const visitSource=process.env.NOTION_VISIT_DATA_SOURCE_ID||process.env.NOTION_DATA_SOURCE_ID||DS;
  const masterSource=process.env.NOTION_RESTAURANT_DATA_SOURCE_ID||MASTER;
  const [visits,masters]=await Promise.all([
    queryAll(visitSource,[{property:'방문 날짜',direction:'descending'}]),
    queryAll(masterSource).catch(error=>{if([403,404].includes(error.status))return null;throw error;}),
  ]);
  const masterIds=new Set((masters||[]).map(page=>page.id));
  const linked=[],unlinked=[];
  for(const page of visits){
    const relations=page.properties?.['식당']?.relation??[];
    (relations.length===1&&masterIds.has(relations[0].id)?linked:unlinked).push(page);
  }
  const fallback=unlinked.map(page=>({...normalize(page),shopId:'',shopRevisit:''}));
  const warning=!masters?'식당 DB 접근 권한을 확인해 주세요. 방문 이력에 저장된 정보를 표시합니다.':unlinked.length?'식당에 연결되지 않은 방문은 방문 이력의 정보로 표시합니다.':'';
  return {records:[...joinVisits(linked,masters||[]),...fallback],...(warning?{warning}:{})};
}
async function body(req){if(req.body&&typeof req.body==='object')return req.body;if(typeof req.body==='string')return JSON.parse(req.body);let s='';for await(const chunk of req){s+=chunk;if(s.length>100000)throw Error('요청이 너무 큽니다.');}return JSON.parse(s||'{}');}
export function clean(r,group){return {group,name:r.name,date:r.date,region:r.region,area:r.area,type:r.type,menu:r.menu,review:r.review,revisit:r.revisit};}
export default async function handler(req,res){res.setHeader('Cache-Control','no-store');res.setHeader('Content-Type','application/json; charset=utf-8');const send=(status,obj)=>{res.statusCode=status;res.end(JSON.stringify(obj));};const action=new URL(req.url,'http://localhost').searchParams.get('action');try{
if(action==='status'&&req.method==='GET')return send(200,{configured:configured(),sharingEnabled:configured()&&sharingEnabled()});
if(action==='shared'&&req.method==='POST'){if(!sharingEnabled())return send(503,{error:'공유 기능이 설정되지 않았습니다.'});try{const {token}=await body(req);if(typeof token!=='string'||token.length>90000)throw Error();return send(200,{records:unseal(token)});}catch{return send(400,{error:'유효하지 않거나 만료된 공유 링크입니다.'});}}
if(action==='records'&&req.method==='GET'){if(!configured())return send(503,{error:'Notion 연동이 설정되지 않았습니다.'});return send(200,await records());}
if(action==='share'&&req.method==='POST'){if(!configured()||!sharingEnabled())return send(503,{error:'공유 기능이 설정되지 않았습니다.'});const {ids}=await body(req);if(!Array.isArray(ids)||ids.length<1||ids.length>10||ids.some(x=>typeof x!=='string'))return send(400,{error:'1~10개 기록을 선택하세요.'});const {records:all}=await records();const unique=[...new Set(ids)];const groups=new Map(unique.map((id,index)=>[id,index]));const selected=all.filter(r=>groups.has(shopKey(r))).map(r=>clean(r,groups.get(shopKey(r))));if(new Set(selected.map(r=>r.group)).size!==unique.length)return send(404,{error:'일부 식당을 찾을 수 없습니다.'});const token=seal(selected);if(token.length>24000)return send(400,{error:'공유 내용이 너무 깁니다. 선택 수를 줄여주세요.'});return send(200,{token});}
return send(404,{error:'요청을 찾을 수 없습니다.'});}catch(e){return send(502,{error:e.message.startsWith('Notion 조회 실패')?e.message:'요청 처리에 실패했습니다.'});}}
