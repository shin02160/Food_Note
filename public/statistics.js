const missing='미입력';
const norm=v=>String(v??'').trim().replace(/\s+/g,' ');
export {norm as normalizeCategory};
export function menuNames(menu){return [...new Set(String(menu??'').split(/[,，\n;；]/).map(norm).filter(Boolean))];}
export function periodRecords(records,period='all'){return period==='all'?records:records.filter(r=>(period.length===4?String(r.date??'').slice(0,4):String(r.date??'').slice(0,7))===period);}
function counts(records,labels,denominator=records.length){const m=new Map();for(const r of records)for(const label of labels(r)){m.set(label,(m.get(label)||0)+1);}return [...m].map(([label,count])=>({label,count,percent:denominator?100*count/denominator:0})).sort((a,b)=>b.count-a.count||a.label.localeCompare(b.label,'ko'));}
export const shopKey=r=>r.shopId||((r.group!==undefined&&r.group!==null)?`shared-shop-${r.group}`:JSON.stringify([norm(String(r.name??'').replaceAll('_',' ')),norm(r.region),norm(r.area),norm(r.address)]));
export function groupRestaurants(records){const groups=new Map();for(const r of records){const id=shopKey(r);if(!groups.has(id))groups.set(id,[]);groups.get(id).push(r);}return [...groups].map(([id,items])=>{const visits=[...items].sort((a,b)=>String(b.date??'').localeCompare(String(a.date??'')));const latest=visits[0];const dates=visits.map(v=>v.date).filter(Boolean).sort();return {...latest,id,visits,visitCount:visits.length,firstDate:dates[0]||'',date:dates.at(-1)||'',revisit:latest.shopRevisit??latest.revisit,photos:visits.flatMap(v=>v.photos||[])};}).sort((a,b)=>b.date.localeCompare(a.date)||a.name.localeCompare(b.name,'ko'));}
export function summarize(records){const shops=groupRestaurants(records);const repeat=shops.filter(s=>s.visitCount>1).length;return {visits:records.length,places:shops.length,repeatPlaces:repeat,repeatRate:shops.length?repeat/shops.length*100:0,topPlaces:shops.slice().sort((a,b)=>b.visitCount-a.visitCount||b.date.localeCompare(a.date)||a.name.localeCompare(b.name,'ko')).slice(0,5),regions:new Set(records.map(r=>norm(r.region)).filter(Boolean)).size,revisitYes:records.filter(r=>r.revisit==='또 갈래').length,revisitUnknown:records.filter(r=>!norm(r.revisit)).length,byRegion:counts(records,r=>[norm(r.region)||missing]),byType:counts(records,r=>[norm(r.type)||missing]),byRevisit:counts(records,r=>[norm(r.revisit)||missing]),byYear:counts(records,r=>[norm(r.date).slice(0,4)||missing]).filter(x=>x.label!==missing).sort((a,b)=>b.label.localeCompare(a.label)),byMonth:counts(records,r=>[norm(r.date).slice(0,7)||missing]).filter(x=>x.label!==missing).sort((a,b)=>b.label.localeCompare(a.label)),byMenu:counts(records,r=>menuNames(r.menu)),byMenuCategory:counts(records,r=>[...new Set(r.menuCategories||[])]),byPurchaseCategory:counts(records,r=>[...new Set(r.purchaseCategories||[])]),byPlaceType:counts(records,r=>[placeTypeOf(r)])};}
const matches=(actual,wanted)=>!wanted||(wanted==='__missing'?!norm(actual):norm(actual)===wanted);
export function filterRecords(records,{region='',type='',revisit='',query='',menu='',menuCategory='',purchaseCategory='',placeType='',period='all'}={}){const q=norm(query).toLowerCase();return periodRecords(records,period).filter(r=>matches(r.region,region)&&matches(r.type,type)&&matches(r.revisit,revisit)&&(!menu||menuNames(r.menu).includes(menu))&&(!menuCategory||(r.menuCategories||[]).includes(menuCategory))&&(!purchaseCategory||(r.purchaseCategories||[]).includes(purchaseCategory))&&(!placeType||r.placeType===placeType)&&(!q||[r.name,r.region,r.area,r.type,r.menu,r.review,r.purchases,(r.menuCategories||[]).join(' '),(r.purchaseCategories||[]).join(' ')].join(' ').toLowerCase().includes(q)));}

// Gallery entries keep the exact visit and shop identity, even across repeat visits.
export function restaurantRegion(restaurant){
  const region=norm(restaurant.region);
  if(!/^서울(?:특별시|시)?$/.test(region))return region||'지역 미입력';
  const area=norm(restaurant.area).replace(/^서울(?:특별시|시)?[\s.·]+/,'');
  const district=area.match(/^([^\s.·]+?)구(?:[\s.·]|$)/)?.[1]||area;
  return '서울.'+(district||'세부 지역 미입력');
}

const domesticRegions=/^(국내|한국|대한민국|서울(?:특별시|시)?|경기(?:도)?|인천(?:광역시)?|부산(?:광역시)?|대구(?:광역시)?|대전(?:광역시)?|광주(?:광역시)?|울산(?:광역시)?|세종(?:특별자치시)?|강원(?:도|특별자치도)?|충청[남북]도?|전라[남북]도?|경상[남북]도?|전북특별자치도|충[남북]|전[남북]|경[남북]|충청|전라|경상|제주(?:도|특별자치도)?)(?:[.·\s]|$)/;

export function groupRegionCards(counts){
  const groups=['국내','해외','지역 미입력'].map(label=>({label,items:[]}));
  for(const [region,count] of counts){
    const group=region==='지역 미입력'?2:domesticRegions.test(region)?0:1;
    const priority=group===0
      ? /^서울(?:[.·\s]|$)/.test(region)?0:/^경기(?:도)?(?:[.·\s]|$)/.test(region)?1:2
      : /^(일본|日本|Japan|JP)(?:[.·\s]|$)/i.test(region)?0:/^(대만|타이완|臺灣|台灣|Taiwan|TW)(?:[.·\s]|$)/i.test(region)?1:2;
    groups[group].items.push({region,count,priority});
  }
  for(const group of groups){
    group.items.sort((a,b)=>a.priority-b.priority||a.region.localeCompare(b.region,'ko'));
  }
  return groups.filter(group=>group.items.length);
}

export function galleryEntries(records,{region='',type='',period='all'}={}){
  const visits=filterRecords(records,{region,type,period}).sort((a,b)=>
    String(b.date??'').localeCompare(String(a.date??''))||String(a.id).localeCompare(String(b.id)));
  const entries=new Map();
  for(const visit of visits){
    const shopId=shopKey(visit);
    if(entries.has(shopId))continue;
    const photo=visit.photos?.find(item=>typeof item.url==='string'&&item.url.startsWith('https://'));
    if(!photo)continue;
    const {name,date,region,type}=visit;
    entries.set(shopId,{...photo,shopId,visitId:visit.id,name,date,region,type});
  }
  return [...entries.values()];
}
export function favoriteShops(shops){return shops.filter(s=>s.revisit==='또 갈래');}

export const shoppingTypes=['쇼핑몰','소품·굿즈샵','화장품','패션·잡화','마트·식료품'];
export const placeTypeOf=p=>p.placeType||(['카페','베이커리','디저트'].includes(p.type)?p.type:'맛집');
export const isShopping=p=>shoppingTypes.includes(placeTypeOf(p));
export function placeStatus(p,today=new Date().toLocaleDateString('sv-SE',{timeZone:'Asia/Seoul'})){return p.plannedDate&&p.plannedDate>=today?'방문 예정':p.visitCount>0?'방문 완료':'가고 싶어요';}
export const isWish=p=>!!p.wishlist||p.visitCount===0||placeStatus(p)==='방문 예정';
export function groupPlaces(records,masters=[],wishes=[],extras=[]){const grouped=groupRestaurants(records),map=new Map(grouped.map(x=>[x.id,x]));for(const p of masters){const g=map.get(p.id);const visits=g?.visits??[],photos=[...(g?.photos??[]),...extras.filter(x=>x.shopId===p.id)];map.set(p.id,{...p,...g,id:p.id,placeType:placeTypeOf(p),wishlist:p.wishlist,plannedDate:p.plannedDate,interest:p.interest,reference:p.reference,travelIds:p.travelIds,checklistIds:p.checklistIds,visitCount:visits.length,visits,photos,cover:p.cover??photos[0],wishes:wishes.filter(x=>x.shopId===p.id),date:g?.date??'',firstDate:g?.firstDate??'',revisit:p.revisit});}return [...map.values()].map(p=>({...p,placeType:placeTypeOf(p),status:placeStatus(p),cover:p.cover??p.photos?.[0],wishes:p.wishes??[]})).sort((a,b)=>b.date.localeCompare(a.date)||a.name.localeCompare(b.name,'ko'));}

// Group only by explicit Notion relation. Unlinked places remain distinct.
export const brandKey=p=>p.brandId?`brand:${p.brandId}`:`place:${p.id||shopKey(p)}`;
export function groupBrands(places){const groups=new Map();for(const p of places){const k=brandKey(p);if(!groups.has(k))groups.set(k,[]);groups.get(k).push(p);}return [...groups].map(([id,items])=>{const branches=[...items].sort((a,b)=>(b.date||'').localeCompare(a.date||'')||a.name.localeCompare(b.name,'ko'));const latest=branches[0],visits=branches.flatMap(b=>b.visits||[]).sort((a,b)=>(b.date||'').localeCompare(a.date||''));return {...latest,id,name:latest.brandName||latest.name,branches,branchCount:branches.length,visitedBranchCount:branches.filter(b=>b.visitCount>0).length,visitCount:visits.length,visits,photos:branches.flatMap(b=>b.photos||[]),wishes:branches.flatMap(b=>b.wishes||[]),date:visits[0]?.date||'',firstDate:visits.at(-1)?.date||'',area:[...new Set(branches.map(b=>b.area||b.region).filter(Boolean))].join(' · '),revisit:branches.length===1?latest.revisit:undefined,wishlist:branches.some(isWish),status:branches.some(b=>b.status==='방문 예정')?'방문 예정':visits.length?'방문 완료':'가고 싶어요'};}).sort((a,b)=>b.date.localeCompare(a.date)||a.name.localeCompare(b.name,'ko'));}
export function brandSummary(records){const groups=groupBrands(groupRestaurants(records));return {visitedBrands:groups.length,repeatBrands:groups.filter(g=>g.visitCount>1).length,topBrands:groups.sort((a,b)=>b.visitCount-a.visitCount||a.name.localeCompare(b.name,'ko')).slice(0,5)};}
