import {createHash,createHmac,randomBytes,createCipheriv,createDecipheriv,timingSafeEqual} from 'node:crypto';
import {shopKey} from '../public/statistics.js';
const DS='4226d8c5-8de1-812a-abad-000b3a03e68e';
const PHOTO='4226d8c5-8de1-816a-97f2-000b1afe696e';
const WISH='4236d8c5-8de1-8160-8c51-000b130b7c7e';
const BRAND='4236d8c5-8de1-818f-8c47-000b21c1fbc0';
const MASTER='4226d8c5-8de1-81e8-9ace-000b3415e595';
const safeEqual=(a,b)=>timingSafeEqual(createHash('sha256').update(String(a)).digest(),createHash('sha256').update(String(b)).digest());
const key=()=>createHash('sha256').update(process.env.APP_SECRET||'').digest();
const sign=s=>createHmac('sha256',key()).update(s).digest('base64url');
const configured=()=>Boolean(process.env.NOTION_TOKEN);
const sharingEnabled=()=>Boolean(process.env.APP_SECRET?.length>=32);
const privateEnabled=()=>Boolean(configured()&&process.env.APP_PASSWORD?.length>=16&&sharingEnabled());
export function seal(records,now=Date.now()){const iv=randomBytes(12),c=createCipheriv('aes-256-gcm',key(),iv);const data=Buffer.concat([c.update(JSON.stringify({exp:now+7*86400000,records})),c.final()]);return Buffer.concat([iv,c.getAuthTag(),data]).toString('base64url');}
export function unseal(token,now=Date.now()){const b=Buffer.from(token,'base64url');const d=createDecipheriv('aes-256-gcm',key(),b.subarray(0,12));d.setAuthTag(b.subarray(12,28));const p=JSON.parse(Buffer.concat([d.update(b.subarray(28)),d.final()]));if(p.exp<now)throw Error('만료된 공유 링크입니다.');return p.records;}
const safeMap=(value,hosts)=>{try{const u=new URL(value);return u.protocol==='https:'&&hosts.includes(u.hostname)?u.href:'';}catch{return '';}};
function naverPlaceUrl(value){
  const safe=safeMap(value,['map.naver.com','m.map.naver.com','place.naver.com','m.place.naver.com','pcmap.place.naver.com']);
  if(!safe)return '';
  const url=new URL(safe);
  const place=url.pathname.match(/\/(restaurant|place)\/(\d+)(?:\/|$)/);
  const entry=url.searchParams.get('entry');
  if(place){
    const category=place[1]==='restaurant'||['map.naver.com','m.map.naver.com'].includes(url.hostname)?'restaurant':place[1];
    return 'https://m.place.naver.com/'+category+'/'+place[2]+'/home';
  }
  if(url.hostname==='map.naver.com'&&entry==='plt'){
    const id=url.searchParams.get('id');
    if(/^\d+$/.test(id??''))return 'https://m.place.naver.com/restaurant/'+id+'/home';
  }
  return '';
}
const txt=p=>(p?.rich_text??p?.title??[]).map(x=>x.plain_text??x.text?.content??'').join('');
export function normalize(page){const p=page.properties??{};return {id:page.id,shopId:p['식당']?.relation?.[0]?.id??'',name:txt(p['상호명']),date:p['방문 날짜']?.date?.start?.slice(0,10)??'',region:p['지역']?.select?.name??'',area:txt(p['세부 지역']),type:p['음식 종류']?.select?.name??'',menu:txt(p['주문 메뉴']),menuCategories:(p['메뉴 카테고리']?.multi_select??[]).map(x=>x.name),purchases:txt(p['구매품']),purchaseCategories:(p['구매 카테고리']?.multi_select??[]).map(x=>x.name),placeType:p['장소 유형']?.select?.name??'',review:txt(p['간단 후기']),revisit:p['재방문 의사']?.select?.name??'',address:txt(p['주소']),naverMap:safeMap(p['네이버 지도']?.url,['map.naver.com','naver.me']),naverPlace:naverPlaceUrl(p['네이버 지도']?.url),googleMap:safeMap(p['Google Maps']?.url,['www.google.com','maps.google.com','maps.app.goo.gl']),photos:(p['사진']?.files??[]).map((f,i)=>({index:i,name:f.name??'',url:f.file?.url??f.external?.url??''})).filter(f=>f.url.startsWith('https://'))};}
async function notion(path,body){const r=await fetch('https://api.notion.com/v1/'+path,{method:'POST',headers:{Authorization:`Bearer ${process.env.NOTION_TOKEN}`,'Notion-Version':'2025-09-03','Content-Type':'application/json'},body:JSON.stringify(body)});if(!r.ok)throw Error(`Notion 조회 실패 (${r.status})`);return r.json();}
async function queryAll(ds,sorts){let cursor,all=[];do{const p=await notion(`data_sources/${ds}/query`,{page_size:100,...(sorts?{sorts}:{}),...(cursor?{start_cursor:cursor}:{})});all.push(...p.results.filter(x=>x.object==='page'&&!x.archived&&!x.in_trash));cursor=p.has_more?p.next_cursor:null;}while(cursor);return all;}
export function joinVisits(visits,masters){const shops=new Map(masters.map(p=>[p.id,normalize(p)]));return visits.map(p=>{const v=normalize(p),m=shops.get(v.shopId);if((p.properties?.['식당']?.relation??[]).length!==1||!m)throw Error('Notion 조회 실패: 방문 이력의 식당 연결을 확인하세요.');return {...v,name:m.name,region:m.region,area:m.area,type:m.type,address:m.address,naverMap:m.naverMap,naverPlace:m.naverPlace,googleMap:m.googleMap,shopRevisit:m.revisit,placeType:placeKind(m)};});}
const placeKind=m=>m.placeType||(['카페','베이커리','디저트'].includes(m.type)?m.type:'맛집');
const relation=(p,k)=>(p[k]?.relation??[]).map(x=>x.id);
const https=value=>{try{const u=new URL(value);return u.protocol==='https:'?u.href:''}catch{return ''}};
export function normalizePlace(page){const p=page.properties??{},m=normalize(page);return {...m,shopId:page.id,placeType:placeKind(m),wishlist:!!p['위시리스트']?.checkbox,plannedDate:p['방문 예정일']?.date?.start?.slice(0,10)??'',interest:txt(p['추천·관심 정보']),reference:https(p['참고 링크']?.url),travelIds:relation(p,'여행 계획'),checklistIds:relation(p,'여행 체크리스트'),visitCount:p['방문 이력']?.relation?.length??0};}
export function normalizeBrand(page){const p=page.properties??{};return {id:page.id,name:txt(p['브랜드명']),placeIds:relation(p,'지점')};}
export function attachBrands(places,records,brandPages){const byPlace=new Map(),conflicts=new Set();for(const b of brandPages.map(normalizeBrand)){if(!b.name)continue;for(const id of b.placeIds){if(byPlace.has(id)&&byPlace.get(id).id!==b.id)conflicts.add(id);else byPlace.set(id,b);}}for(const id of conflicts)byPlace.delete(id);for(const p of [...places,...records]){const b=byPlace.get(p.shopId||p.id);if(b){p.brandId=b.id;p.brandName=b.name;}}return conflicts.size;}
export function normalizeWish(page){const p=page.properties??{};return {id:page.id,shopId:relation(p,'장소')[0]??'',name:txt(p['아이템명']),kind:p['유형']?.select?.name??'',status:p['상태']?.select?.name??'',note:txt(p['메모']),reference:https(p['참고 링크']?.url),travelIds:relation(p,'여행 계획'),checklistIds:relation(p,'여행 체크리스트'),photos:(p['상품 사진']?.files??[]).map(f=>({url:https(f.file?.url??f.external?.url),name:f.name??''})).filter(f=>f.url)};}
// A copied Notion internal file ID is not exposed in the public file object. Match the original visit + filename, never an expiring signed URL. Ambiguous names are not guessed.
export function resolvePhotos(photoPages,visits,places){const byVisit=new Map(visits.map(v=>[v.id,v])),byPlace=new Map(places.map(p=>[p.id,p])),extras=[],choices=[];for(const page of photoPages){const p=page.properties??{},visitId=relation(p,'방문 이력')[0],v=byVisit.get(visitId),shopId=relation(p,'식당')[0]??v?.shopId,place=byPlace.get(shopId);if(!place||(v&&v.shopId!==shopId))continue;const order=p['표시 순서']?.number??0,title=txt(p['사진명']),filename=title.split(' · ').at(-1),direct=(p['사진']?.files??[]).map(f=>({url:https(f.file?.url??f.external?.url),name:f.name??''})).filter(f=>f.url);const same=v?.photos.filter(f=>f.name&&f.name===filename)??[];let photo=same.length===1?same[0]:null;if(!photo&&direct.length===1){photo=direct[0];if(v){const existing=v.photos.find(f=>f.name&&f.name===photo.name);if(existing)photo=existing;else v.photos.push(photo);}else extras.push({...photo,shopId,visitId:'',date:'',name:place.name,region:place.region,type:place.type,placeType:place.placeType,photoType:p['사진 유형']?.select?.name??'참고 사진'});}
if(photo&&p['대표 사진']?.checkbox)choices.push({shopId,photo,order,visitDate:v?.date??'',id:page.id});}
choices.sort((a,b)=>b.visitDate.localeCompare(a.visitDate)||a.order-b.order||a.id.localeCompare(b.id));const chosen=new Set();for(const c of choices)if(!chosen.has(c.shopId)){byPlace.get(c.shopId).cover=c.photo;chosen.add(c.shopId);}return extras;}
async function archive(includePrivate){
  const warnings=[];
  const optional=async(id,label)=>{
    try{return await queryAll(id);}
    catch{warnings.push(label+' DB 연결 상태를 확인해 주세요.');return [];}
  };
  const [visits,masters,photos,wishes,brands]=await Promise.all([
    queryAll(process.env.NOTION_VISIT_DATA_SOURCE_ID||process.env.NOTION_DATA_SOURCE_ID||DS,[{property:'방문 날짜',direction:'descending'}]),
    optional(process.env.NOTION_PLACE_DATA_SOURCE_ID||process.env.NOTION_RESTAURANT_DATA_SOURCE_ID||MASTER,'장소'),
    optional(process.env.NOTION_PHOTO_DATA_SOURCE_ID||PHOTO,'사진'),
    includePrivate?optional(process.env.NOTION_WISH_DATA_SOURCE_ID||WISH,'위시 아이템'):[],
    optional(process.env.NOTION_BRAND_DATA_SOURCE_ID||BRAND,'브랜드'),
  ]);
  const masterIds=new Set(masters.map(page=>page.id));
  const linked=[],unlinked=[];
  for(const page of visits){
    const relation=page.properties?.['식당']?.relation??[];
    (relation.length===1&&masterIds.has(relation[0].id)?linked:unlinked).push(page);
  }
  if(unlinked.length)warnings.push('장소에 연결되지 않은 방문은 방문 이력의 정보로 표시합니다.');
  const rows=[...joinVisits(linked,masters),...unlinked.map(page=>({...normalize(page),shopId:'',shopRevisit:''}))];
  const visitedIds=new Set(linked.map(page=>normalize(page).shopId));
  const places=masters.filter(page=>includePrivate||visitedIds.has(page.id)).map(page=>{
    const place=normalizePlace(page);
    if(includePrivate)return place;
    const {wishlist,plannedDate,interest,reference,travelIds,checklistIds,photos,...publicPlace}=place;
    return publicPlace;
  });
  const photoPages=includePrivate?photos:photos.filter(page=>{
    const type=page.properties?.['사진 유형']?.select?.name;
    return (!type||type==='방문 사진')&&relation(page.properties??{},'방문 이력').some(id=>rows.some(row=>row.id===id));
  });
  const extraPhotos=resolvePhotos(photoPages,rows,places);
  if(attachBrands(places,rows,brands))warnings.push('중복 브랜드 관계가 있는 지점은 지점별로 표시합니다.');
  return {records:rows,places,wishes:wishes.map(normalizeWish),extraPhotos,warnings,warning:warnings.join(" · ")};
}
function authorized(req){const raw=(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('food_session='))?.slice(13)||'';const [exp,sig]=raw.split('.');return !!sig&&Number(exp)>Date.now()&&safeEqual(sig,sign(exp));}
async function body(req){if(req.body&&typeof req.body==='object')return req.body;if(typeof req.body==='string')return JSON.parse(req.body);let s='';for await(const chunk of req){s+=chunk;if(s.length>100000)throw Error('요청이 너무 큽니다.');}return JSON.parse(s||'{}');}
export function clean(r,group){return {group,name:r.name,date:r.date,region:r.region,area:r.area,type:r.type,placeType:r.placeType,menu:r.menu,menuCategories:r.menuCategories,purchases:r.purchases,purchaseCategories:r.purchaseCategories,review:r.review,revisit:r.revisit,};}
export default async function handler(req,res){res.setHeader('Cache-Control','no-store');res.setHeader('Content-Type','application/json; charset=utf-8');const send=(status,obj)=>{res.statusCode=status;res.end(JSON.stringify(obj));};const action=new URL(req.url,'http://localhost').searchParams.get('action');try{
if(action==='status'&&req.method==='GET')return send(200,{configured:configured(),sharingEnabled:configured()&&sharingEnabled(),privateEnabled:privateEnabled(),authenticated:privateEnabled()&&authorized(req)});
if(!configured())return send(503,{error:'Notion 및 앱 환경변수가 설정되지 않았습니다.'});
if(action==='login'&&req.method==='POST'){if(!privateEnabled())return send(404,{error:'비공개 보기가 설정되지 않았습니다.'});const b=await body(req);if(!safeEqual(b.password,process.env.APP_PASSWORD))return send(401,{error:'비밀번호가 올바르지 않습니다.'});const exp=String(Date.now()+86400000);res.setHeader('Set-Cookie',`food_session=${exp}.${sign(exp)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=86400${process.env.VERCEL?'; Secure':''}`);return send(200,{ok:true});}
if(action==='logout'&&req.method==='POST'){res.setHeader('Set-Cookie','food_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0');return send(200,{ok:true});}
if(action==='shared'&&req.method==='POST'){if(!sharingEnabled())return send(503,{error:'공유 기능이 설정되지 않았습니다.'});try{const {token}=await body(req);if(typeof token!=='string'||token.length>90000)throw Error();return send(200,{records:unseal(token)});}catch{return send(400,{error:'유효하지 않거나 만료된 공유 링크입니다.'});}}
if(action==='records'&&req.method==='GET')return send(200,await archive(privateEnabled()&&authorized(req)));
if(action==='share'&&req.method==='POST'){const {ids}=await body(req);if(!Array.isArray(ids)||ids.length<1||ids.length>10||ids.some(x=>typeof x!=='string'))return send(400,{error:'1~10개 기록을 선택하세요.'});if(!sharingEnabled())return send(503,{error:'공유 기능이 설정되지 않았습니다.'});const {records:all}=await archive(false);const unique=[...new Set(ids)];const selected=all.filter(r=>unique.includes(shopKey(r))).map(r=>clean(r,unique.indexOf(shopKey(r))));if(new Set(selected.map(r=>r.group)).size!==unique.length)return send(404,{error:'일부 기록을 찾을 수 없습니다.'});const token=seal(selected);if(token.length>24000)return send(400,{error:'공유 내용이 너무 깁니다. 선택 수를 줄여주세요.'});return send(200,{token});}
return send(404,{error:'요청을 찾을 수 없습니다.'});}catch(e){return send(502,{error:e.message.startsWith('Notion 조회 실패')?e.message:'요청 처리에 실패했습니다.'});}}
