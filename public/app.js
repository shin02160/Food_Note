import {normalizeCategory,restaurantRegion,groupRegionCards,summarize,periodRecords,galleryEntries,favoriteShops,groupPlaces,isWish,isShopping,groupBrands,brandSummary,searchPlace,rankStatPlaces,placeCategory,operatingLabels,usageLabels} from './statistics.js';
const $=id=>document.getElementById(id);const el=(tag,text,cls)=>{const e=document.createElement(tag);if(text!=null)e.textContent=text;if(cls)e.className=cls;return e};
let lastCompleteAt=null;
let loading=false,sharingEnabled=false,privateView=false,selectedRegion='',shareIds=[];
let activeTab='records',galleryPhotos=[],lightboxPhotos=[],galleryLightbox=false;
let categoryFilter='';
const browseTabs=['records','favorites','wishlist'];
const browseStates=new Map();
let statsSnapshot;
const openStats=new Set(),selectedStats=new Map(),statQueries=new Map();
let extraPhotos=[],records=[],shops=[],selected=new Set(),selecting=false,shared=false,list=true,brandView=true;
const api=async(action,data)=>{const r=await fetch('/api/index?action='+action,{method:data===undefined?'GET':'POST',cache:'no-store',...(data===undefined?{}:{headers:{'Content-Type':'application/json'},body:JSON.stringify(data)})});const j=await r.json();if(!r.ok)throw Error(j.error||'연결 오류');return j};
const symbols={home:'<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"/>',heart:'<path d="M20.8 8.6c0 4.1-8.8 9.9-8.8 9.9S3.2 12.7 3.2 8.6a4.6 4.6 0 0 1 8.8-1.9 4.6 4.6 0 0 1 8.8 1.9z"/>',images:'<rect x="5" y="3" width="16" height="16" rx="3"/><path d="M3 7v12a2 2 0 0 0 2 2h12M5 15l5-5 4 4 3-3 4 4"/><circle cx="15.5" cy="7.5" r="1.5"/>',chart:'<path d="M4 20h16M6 16V9m6 7V4m6 12v-5"/>',back:'<path d="m15 5-7 7 7 7"/>',chevron:'<path d="m9 5 7 7-7 7"/>',utensils:'<path d="M5 3v6a3 3 0 0 0 6 0V3M8 3v18M19 3c-3 2-4 5-4 9h4m0-9v18"/>',pot:'<path d="M4 9h16v8a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3zM2 12h2m16 0h2M3 7h18M10 4h4"/>',soup:'<path d="M3 12h18a9 9 0 0 1-18 0zm5 9h8M7 3c-2 2 2 4 0 6m5-6c-2 2 2 4 0 6m5-6c-2 2 2 4 0 6"/>',pizza:'<path d="M12 21 3 5c5-4 13-4 18 0zM5 9a13 13 0 0 1 14 0"/><circle cx="10" cy="12" r="1"/><circle cx="14" cy="9" r="1"/>',coffee:'<path d="M4 8h13v6a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5zM17 9h2a3 3 0 0 1 0 6h-2M3 22h16M8 2v3m5-3v3"/>',bread:'<path d="M3 17c-1-4 1-7 5-9 2-4 6-4 8 0 4 2 6 5 5 9-3 2-6 1-9-2-3 3-6 4-9 2zM8 8l4 7 4-7"/>',cake:'<path d="M3 12 16 4l5 8v8H3zM3 12h18M3 16h18M15 4V2"/>',salad:'<path d="M3 13h18a9 9 0 0 1-18 0zM8 21h8M8 12C3 9 5 5 8 4c3 2 4 5 3 8m2 0c-1-5 2-9 7-9 0 5-2 8-5 9"/>'};
function svgIcon(name){const span=el('span',null,'line-icon');span.setAttribute('aria-hidden','true');span.innerHTML=`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${symbols[name]||symbols.utensils}</svg>`;return span;}
symbols.bookmark='<path d="M6 3h12v18l-6-4-6 4z"/>';symbols.bag='<path d="M4 7h16l1 14H3zM9 7V5a3 3 0 0 1 6 0v2"/>';symbols.pin='<path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0z"/><circle cx="12" cy="10" r="2.5"/>';
const category=r=>isShopping(r)?'shopping':r.placeType==='기타 장소'?'other':({'한식':'korean','중식':'chinese','일식':'japanese','양식':'western','카페':'cafe','베이커리':'bakery','디저트':'dessert'}[r.type]||'other');
const icon=r=>isShopping(r)?'bag':r.placeType==='기타 장소'?'pin':({'한식':'utensils','중식':'pot','일식':'soup','양식':'pizza','카페':'coffee','베이커리':'bread','디저트':'cake'}[r.type]||'salad');
function placeholder(r){const d=el('div',null,'placeholder cat-'+category(r));d.append(svgIcon(icon(r)));return d;}
function photo(r,index=0){const url=r.photos?.[index]?.url;if(url){const im=el('img',null,'photo');im.src=url;im.alt=r.name+' 방문 사진';im.loading='lazy';im.referrerPolicy='no-referrer';im.addEventListener('error',()=>im.replaceWith(placeholder(r)),{once:true});return im;}return placeholder(r);}
for(const x of document.querySelectorAll('[data-icon]'))x.append(svgIcon(x.dataset.icon));
let currentRecord=null,photoIndex=0,returnScroll=0,hasDetailHistory=false,ready=false;
const route=()=>new URLSearchParams(location.hash.slice(1));
function routeUrl(id){const p=route();if(id)p.set('record',id);else p.delete('record');return p.size?'#'+p.toString():location.href.split('#')[0];}
function naverRestaurantLink(record){
  if(record.naverPlace)return ['네이버 플레이스',record.naverPlace];
  const name=record.name?.trim();
  if(!name)return ['네이버에서 식당 검색',''];
  const location=[record.region,record.area].map(value=>value?.trim()).filter(Boolean).join(' ');
  const url=new URL('https://search.naver.com/search.naver');
  url.searchParams.set('query',[name,location||record.address].filter(Boolean).join(' '));
  return ['네이버에서 식당 검색',url.href];
}
function section(title){const d=el('section',null,'detail-section');d.append(el('h2',title));return d;}
function field(label,value){const d=el('div',null,'detail-field');d.append(el('span',label),el('strong',value||'미기록'));return d;}
function showPhoto(i,entries=null,fromGallery=false){if(entries){lightboxPhotos=entries;galleryLightbox=fromGallery;}const urls=lightboxPhotos;if(!urls.length)return;photoIndex=(i+urls.length)%urls.length;const item=urls[photoIndex],im=$('largePhoto');im.referrerPolicy='no-referrer';im.src=item.url;im.alt=(item.name||currentRecord?.name||'방문')+' 사진 '+(photoIndex+1);$('photoPosition').textContent=`${photoIndex+1} / ${urls.length}`;$('photoCaption').textContent=[item.name,item.date].filter(Boolean).join(' · ');$('photoDetail').hidden=!galleryLightbox;$('prevPhoto').disabled=$('nextPhoto').disabled=urls.length<2;if(!$('lightbox').open)$('lightbox').showModal();}
$('photoDetail').onclick=()=>{const shop=shops.find(x=>x.id===lightboxPhotos[photoIndex]?.shopId);if(shop){$('lightbox').close();detail(shop);}};
function detail(record,trigger=document.activeElement){
  if(!currentRecord)returnScroll=window.scrollY;
  const scope=trigger?.closest('.stat-results, #cards, #detailContent, #galleryGrid');
  const placeId=trigger?.dataset.placeId;
  const opener=scope?.id&&placeId?{scope:scope.id,placeId}:null;
  const browse=browseTabs.includes(activeTab)?{tab:activeTab,region:selectedRegion}:null;
  const regionStep=history.state?.regionStep&&history.state.browse?.tab===activeTab&&history.state.browse.region===selectedRegion;
  history.replaceState({...history.state,opener,browse,regionStep},'');
  hasDetailHistory=true;
  history.pushState({foodDetail:true},'',routeUrl(record.id));
  renderRoute();
}

function restoreOpener(){
  const opener=history.state?.opener;
  if(!opener)return false;
  const target=Array.from($(opener.scope)?.querySelectorAll('[data-place-id]')||[])
    .find(button=>button.dataset.placeId===opener.placeId&&button.getClientRects().length);
  if(!target)return false;
  target.focus({preventScroll:true});
  return true;
}

function focusDetailHeading(heading,restore){
  heading.tabIndex=-1;
  if(!restore||!restoreOpener())heading.focus({preventScroll:true});
}
function renderRoute(preserveDetail=false,restore=false){if(!ready||route().get('share')!==initialShareToken)return;const wasDetail=!$('detailPage').hidden;const id=route().get('record');const brand=!shared&&id?.startsWith('brand:')?groupBrands(shops).find(x=>x.id===id):null;const r=brand||shops.find(x=>x.id===id||x.visits.some(v=>v.id===id));const active=Boolean(id);$('detailPage').hidden=!active;$('archive').hidden=active;$('hero').hidden=active;document.body.classList.toggle('detail-active',active);if(!active){currentRecord=null;document.title='Place Notes · 나만의 장소 컬렉션';if($('lightbox').open)$('lightbox').close();if(wasDetail){window.scrollTo(0,returnScroll);if(!restoreOpener())$(activeTab==='stats'?'statsTab':activeTab==='gallery'?'galleryTab':'search').focus({preventScroll:true});}return;}
const c=$('detailContent');
const keepPosition=preserveDetail&&wasDetail&&r?.id===currentRecord?.id;
const scroll=keepPosition?window.scrollY:0;
const openVisits=keepPosition?new Set(Array.from(c.querySelectorAll('.visit-item[open]'),visit=>visit.dataset.visitId)):null;
currentRecord=r||null;c.replaceChildren();$('detailShare').hidden=shared||!sharingEnabled||!r||!r.visitCount||!!brand;if(!r){const heading=el('h1','기록을 찾을 수 없어요');c.append(heading,el('p','삭제되었거나 접근할 수 없는 기록입니다.'));window.scrollTo(0,0);if(!keepPosition)focusDetailHeading(heading,restore);return;}
const hero=el('div',null,'detail-hero cat-'+category(r));
const heading=el('h1',r.name),identity=el('div',null,'detail-identity');
const emblem=el('div',null,'detail-emblem');emblem.append(svgIcon(icon(r)));
const title=el('div',null,'detail-title');
title.append(el('span',r.placeType||r.type||'장소','type-tag'),heading,el('p',[r.region,r.area].filter(Boolean).join(' · '),'detail-location'));
identity.append(emblem,title);hero.append(identity);
if(r.cover){const cover=el('div',null,'detail-cover');cover.append(photo({...r,photos:[r.cover]}));hero.append(cover);}
if(brand&&r.branchCount>1)hero.append(el('p',r.branchCount+'개 등록 지점 · '+r.visitedBranchCount+'개 이용 지점','visit-summary'));
hero.append(el('p',r.visitCount?'총 '+r.visitCount+'회 이용 · 최근 '+(r.date||'미기록'):'아직 방문하지 않았어요.','visit-summary'));
const statusRow=el('div',null,'row-tags detail-status-chips');
statusRow.append(visitStatusChip(r));if(r.revisit)statusRow.append(revisitChip(r.revisit));
if(r.wishlist)statusRow.append(el('span','위시리스트','tag'));
const operating=operatingBadge(brand&&r.branches.length===1?r.branches[0]:r);if(operating)statusRow.append(operating);
hero.append(statusRow);c.append(hero);document.title=r.name+' · Place Notes';
if(brand){if(r.branches.length===1)c.append(placeInformation(r.branches[0]));renderBrandDetail(c,brand,openVisits);window.scrollTo(0,scroll);if(!keepPosition)focusDetailHeading(heading,restore);return;}
if(!shared&&r.brandId&&r.brandName){const link=el('button',r.brandName+' ›','map-link');link.onclick=()=>{const group=groupBrands(shops).find(item=>item.id==='brand:'+r.brandId);if(group)detail(group);};hero.append(link);}
c.append(placeInformation(r));if(privateView&&!shared&&(r.reference||r.wishes?.length||r.travelIds?.length||r.checklistIds?.length)){const w=section('위시리스트 · 참고 정보');if(r.reference){const a=el('a','참고 링크','map-link');a.href=r.reference;a.target='_blank';a.rel='noopener noreferrer';w.append(a);}for(const item of r.wishes||[]){const d=el('div',null,'wish-item');d.append(el('strong',item.name),el('p',[item.kind,item.status,item.note].filter(Boolean).join(' · ')));if(item.reference){const a=el('a','상품·메뉴 참고','map-link');a.href=item.reference;a.target='_blank';a.rel='noopener noreferrer';d.append(a);}if(item.photos?.length){const grid=el('div',null,'photo-grid');item.photos.forEach((ph,i)=>{const b=el('button',null,'photo-tile');b.append(photo({...r,photos:[ph]}));b.onclick=()=>showPhoto(i,item.photos.map(p=>({...p,name:item.name})),false);grid.append(b)});d.append(grid);}w.append(d);}for(const id of [...(r.travelIds||[]),...(r.checklistIds||[]),...(r.wishes||[]).flatMap(w=>w.checklistIds||[])]){if(!/^[0-9a-f-]{32,36}$/i.test(id))continue;const a=el('a','연결된 여행 계획 열기','map-link');a.href='https://www.notion.so/'+id.replaceAll('-','');a.target='_blank';a.rel='noopener noreferrer';w.append(a);}c.append(w);}
if(!shared){const map=section('매장 위치');map.append(el('p',r.address||'주소 미기록','full-text'));const links=el('div',null,'map-actions');for(const [label,url] of [naverRestaurantLink(r),['Google Maps',r.googleMap]]){if(url){const a=el('a',label+' ↗','map-link');a.href=url;a.target='_blank';a.rel='noopener noreferrer';links.append(a);}}if(links.childElementCount)map.append(links);c.append(map);}
const historySection=section('방문 이력');historySection.firstChild.append(el('span',`총 ${r.visitCount}회`,'photo-count'));let offset=0;r.visits.forEach((v,i)=>{const base=offset;offset+=v.photos?.length||0;const d=el('details',null,'visit-item');d.dataset.visitId=v.id;d.open=openVisits?openVisits.has(v.id):i===0;const head=el('summary');head.append(el('strong',v.date?.replaceAll('-','.')||'날짜 미기록'));if(!shared)head.append(el('span','이용 방식: '+(usageLabels[v.usageMode]||'미확인'),'usage-label'));head.append(el('span',v.menu||v.purchases||'내용 미기록','visit-menu'));d.append(head);const inside=el('div',null,'visit-body');if(v.menu||(!v.purchases&&!isShopping(r)))inside.append(el('h3','주문 메뉴'),el('p',v.menu||'미기록','full-text'));if(v.menuCategories?.length)inside.append(el('p',v.menuCategories.join(' · '),'type-tag'));if(isShopping(r)||v.purchases)inside.append(el('h3','구매품'),el('p',v.purchases||'미기록','full-text'));if(v.purchaseCategories?.length)inside.append(el('p',v.purchaseCategories.join(' · '),'type-tag'));if(privateView&&!shared&&v.review)inside.append(el('h3','간단 후기'),el('p',v.review,'full-text'));if(v.revisit)inside.append(el('span',v.revisit,'tag'));inside.append(el('h3',`사진 ${v.photos?.length||0}장`));if(v.photos?.length){const grid=el('div',null,'photo-grid');v.photos.forEach((_,j)=>{const b=el('button',null,'photo-tile');b.setAttribute('aria-label',`${v.date} 사진 ${j+1} 확대`);b.append(photo(v,j));b.onclick=()=>showPhoto(base+j,r.visits.flatMap(v=>(v.photos||[]).map(p=>({...p,name:r.name,date:v.date}))),false);grid.append(b);});inside.append(grid);}else inside.append(el('p',shared?'공유 기록에는 사진이 포함되지 않습니다.':'아직 등록된 사진이 없어요.','photo-empty'));d.append(inside);historySection.append(d);});if(!r.visits.length)historySection.append(el('p','첫 방문 후 기록을 추가해 주세요.'));c.append(historySection);if(!shared){const extras=extraPhotos.filter(x=>x.shopId===r.id);if(extras.length){const sec=section('참고 · 상품 사진'),grid=el('div',null,'photo-grid');extras.forEach((ph,i)=>{const b=el('button',null,'photo-tile');b.append(photo({...r,photos:[ph]}));b.onclick=()=>showPhoto(i,extras,false);grid.append(b)});sec.append(grid);c.append(sec);}}window.scrollTo(0,scroll);if(!keepPosition)focusDetailHeading(heading,restore);}
function appendInterest(container,place){
  if(shared||!place.interest?.trim())return;
  const block=el('div',null,'place-interest');
  block.append(el('h3','추천·관심 정보'),el('p',place.interest,'full-text'));
  container.append(block);
}
function placeInformation(place){
  const info=section('장소 정보'),fields=el('div',null,'detail-fields');
  fields.append(field('최초 방문일',place.firstDate?.replaceAll('-','.')),field('최근 방문일',place.date?.replaceAll('-','.')),field('장소 유형',place.placeType||place.type),field('지역',[place.region,place.area].filter(Boolean).join(' · ')));
  if(place.type)fields.append(field('음식 종류',place.type));
  if(!shared){fields.append(field('영업 상태',operatingLabels[place.operatingStatus]||'미확인'));if(place.operatingStatusCheckedAt)fields.append(field('영업 상태 확인일',place.operatingStatusCheckedAt));if(place.plannedDate)fields.append(field('방문 예정일',place.plannedDate));}
  info.append(fields);appendInterest(info,place);return info;
}
function renderBrandDetail(c,r,openVisits){const panel=section('지점별 정보 · 전체 지점');for(const b of r.branches){const row=el('div',null,'brand-branch');row.append(placeCard(b));if(r.branches.length>1)appendInterest(row,b);if(b.address)row.append(el('p',b.address,'meta'));for(const v of b.visits){const visit=el('button',null,'brand-visit-link');visit.append(el('strong',v.date||'날짜 미기록'),el('span',v.menu||v.purchases||'내용 미기록'));visit.onclick=()=>detail(b);row.append(visit);}panel.append(row);}c.append(panel);const timeline=section('전체 방문 이력');for(const v of r.visits){const branch=r.branches.find(b=>b.id===v.shopId);const d=el('details',null,'visit-item');d.dataset.visitId=v.id;d.open=openVisits?.has(v.id)??false;const h=el('summary');h.append(el('strong',v.date||'날짜 미기록'),el('span',branch?.name||v.name,'visit-menu'),el('span','이용 방식: '+(usageLabels[v.usageMode]||'미확인'),'usage-label'));d.append(h);const body=el('div',null,'visit-body');body.append(el('p',v.menu||v.purchases||'내용 미기록'));if(privateView&&!shared&&v.review)body.append(el('p',v.review));if(v.revisit)body.append(el('span',v.revisit,'tag'));if(v.photos?.length){const grid=el('div',null,'photo-grid');v.photos.forEach((p,i)=>{const b=el('button',null,'photo-tile');b.append(photo(v,i));b.onclick=()=>showPhoto(i,v.photos.map(p=>({...p,name:v.name,date:v.date})),false);grid.append(b)});body.append(grid);}if(branch){const b=el('button','지점 상세 보기','map-link');b.onclick=()=>detail(branch);body.append(b);}d.append(body);timeline.append(d);}if(!r.visits.length)timeline.append(el('p','아직 방문 기록이 없어요.'));c.append(timeline);
const menus=summarize(r.visits).byMenu;
if(menus.length){const menu=section('주문 메뉴 기록');for(const item of menus){const row=el('details',null,'visit-item');row.append(el('summary',item.label+' · '+item.count+'회 기록'));for(const visit of item.visits){const branch=r.branches.find(branch=>branch.id===visit.shopId);if(branch){const link=el('button',[visit.date,branch.name].filter(Boolean).join(' · '),'map-link');link.onclick=()=>detail(branch);row.append(link);}}menu.append(row);}c.append(menu);}
}
function closeDetail(){if(history.state?.foodDetail&&hasDetailHistory)history.back();else{history.replaceState({},'',routeUrl(null));renderRoute();}}
history.scrollRestoration='manual';
window.addEventListener('popstate',()=>{
  const context=history.state?.browse;
  const wasDetail=!$('detailPage').hidden;
  if(context&&!route().has('record')&&!shared){
    if(activeTab!==context.tab)tab(context.tab);
    if(selectedRegion!==context.region){selectedRegion=context.region;render();}
  }
  renderRoute(false,true);
  if(context&&!wasDetail&&!route().has('record'))focusBrowseRegion();
});
window.addEventListener('hashchange',()=>{
  if(route().get('share')!==initialShareToken)location.reload();
});
const initialShareToken=route().get('share');
$('closePhoto').onclick=()=>$('lightbox').close();$('prevPhoto').onclick=()=>showPhoto(photoIndex-1);$('nextPhoto').onclick=()=>showPhoto(photoIndex+1);$('lightbox').addEventListener('keydown',e=>{if(e.key==='ArrowLeft')showPhoto(photoIndex-1);if(e.key==='ArrowRight')showPhoto(photoIndex+1);});$('largePhoto').addEventListener('error',()=>{$('photoPosition').textContent='사진을 불러오지 못했습니다. 목록에서 새로고침해 주세요.';});
function openShare(ids){shareIds=ids;$('shareResult').hidden=true;$('shareError').textContent='';$('sharing').showModal();}
$('detailShare').onclick=()=>{if(currentRecord)openShare([currentRecord.id]);};
function options(id,label,values){const select=$(id),old=select.value;select.replaceChildren(new Option(label,''),...([...new Set(values.map(normalizeCategory).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ko')).map(v=>new Option(v,v))));if(['region','type','revisit','galleryRegion','galleryType'].includes(id)&&values.some(v=>!String(v??'').trim()))select.append(new Option('미입력','__missing'));if([...select.options].some(o=>o.value===old))select.value=old;}
function renderRegionChooser(candidates,showResults){
  const chooser=$('regionChooser');
  chooser.hidden=showResults;
  $('regionSelection').hidden=shared||!selectedRegion;
  $('selectedRegion').textContent=selectedRegion;
  $('layout').hidden=!showResults;
  $('regionChoices').replaceChildren();
  if(chooser.hidden)return;
  const counts=new Map();
  for(const candidate of candidates){
    const region=restaurantRegion(candidate);
    counts.set(region,(counts.get(region)||0)+1);
  }
  for(const group of groupRegionCards(counts)){
    const section=el('section',null,'region-group');
    if(group.label!=='지역 미입력')section.append(el('h3',group.label));
    const choices=el('div',null,'region-choices');
    for(const {region,count} of group.items){
      const button=el('button',null,'region-choice');
      button.append(el('span',region),el('span',count+'곳','region-count'));
      button.onclick=()=>openRegion(region);
      choices.append(button);
    }
    section.append(choices);
    $('regionChoices').append(section);
  }
}
function focusBrowseRegion(){
  $(selectedRegion?'selectedRegion':$('search').value.trim()?'search':'regionHeading').focus();
}
function openRegion(region){
  history.replaceState({...history.state,browse:{tab:activeTab,region:''},regionStep:false},'');
  history.pushState({browse:{tab:activeTab,region},regionStep:true},'');
  selectedRegion=region;render();focusBrowseRegion();
}
$('backToRegions').onclick=()=>{
  const state=history.state;
  if(state?.regionStep&&state.browse?.tab===activeTab&&state.browse.region===selectedRegion){history.back();return;}
  selectedRegion='';render();focusBrowseRegion();
};

function visitStatusChip(place){
  const status=place.status||(place.visitCount?'방문 완료':'미방문');
  const tone=status==='방문 예정'?'planned':status==='방문 완료'?'visited':'unvisited';
  return el('span',status,'status-chip status-'+tone);
}
function revisitChip(value){
  const tone=value==='또 갈래'?'yes':value==='재방문 X'?'no':'neutral';
  return el('span',value||'평가 없음','status-chip revisit-'+tone);
}

function operatingBadge(place){
  if(place.operatingStatus==='closed')return el('span','폐업 · 재방문 불가','tag operating-status');
  if(place.operatingStatus==='temporarilyClosed')return el('span','휴업 · 이용 전 확인','tag operating-status');
  return null;
}

function placeCard(place,{visit,count=place.visitCount,matchDate,scoped=false,extraMatches=0}={}){
  const card=el('article',null,'card cat-'+category(place));
  const button=el('button',null,'record-link');
  button.dataset.placeId=place.id;
  button.setAttribute('aria-label',place.name+' 상세 보기');
  button.append(place.cover?photo({...place,photos:[place.cover]}):placeholder(place));
  const content=el('div',null,'card-content');
  content.append(el('h3',place.name));
  if(place.brandName&&place.brandName!==place.name)content.append(el('span',place.brandName,'meta'));
  const date=matchDate||place.date;
  const location=[place.region,place.area].filter(Boolean).join(' ');
  content.append(el('div',[location,date?.replaceAll('-','.')||place.plannedDate].filter(Boolean).join(' · '),'meta'));
  const menu=visit?.menu||visit?.purchases||(visit?'':place.menu||place.purchases||place.interest);
  const review=privateView&&!shared?(visit?.review||(!visit?place.review:'')):'';
  if(menu)content.append(el('div',menu,'menu card-excerpt'));
  if(review)content.append(el('p',review,'meta card-excerpt'));
  if(!scoped&&matchDate&&place.date&&matchDate!==place.date)content.append(el('div','최근 방문 '+place.date,'meta'));
  if(extraMatches)content.append(el('div','일치 방문 '+(extraMatches+1)+'회','meta'));
  const tags=el('div',null,'row-tags');
  tags.append(el('span',scoped?'조건 내 이용 '+count+'회':count?'이용 '+count+'회':place.status||'미방문','visit-count'));
  if(scoped&&count!==place.visitCount)tags.append(el('span','전체 이용 '+place.visitCount+'회','meta'));
  if(place.branches)tags.append(el('span',place.branchCount+'개 지점','type-tag'));
  if(place.placeType)tags.append(el('span',place.placeType,'type-tag'));
  if(!shared){
    const single=place.branches?.length===1?place.branches[0]:place.branches?null:place;
    if(single){tags.append(visitStatusChip(single),revisitChip(single.revisit));const status=operatingBadge(single);if(status)tags.append(status);}
    else{const closed=place.branches.filter(branch=>branch.operatingStatus==='closed').length;const paused=place.branches.filter(branch=>branch.operatingStatus==='temporarilyClosed').length;if(closed)tags.append(el('span','폐업 '+closed+'곳','tag operating-status'));if(paused)tags.append(el('span','휴업 '+paused+'곳','tag operating-status'));}
  }
  if(privateView&&isWish(place))tags.append(el('span','위시','type-tag'));
  content.append(tags);
  const chevron=el('span',null,'chevron');
  chevron.append(svgIcon('chevron'));
  button.append(content,chevron);
  button.onclick=()=>detail(place,button);
  card.append(button);
  return card;
}

function render(){
  const query=$('search').value.trim();
  const showResults=shared||Boolean(selectedRegion)||Boolean(query);
  const food=categoryFilter==='맛집'?$('type').value:'';
  $('foodFilter').hidden=categoryFilter!=='맛집';
  const scope=activeTab==='favorites'?favoriteShops(shops):activeTab==='wishlist'?shops.filter(isWish):shops;
  const evidence=new Map();
  const candidates=scope.filter(place=>{
    if(categoryFilter&&placeCategory(place)!==categoryFilter)return false;
    if(food&&(food==='__missing'?normalizeCategory(place.type):normalizeCategory(place.type)!==food))return false;
    const match=searchPlace(place,query);
    if(match.matches)evidence.set(place.id,match.visits);
    return match.matches;
  });
  renderRegionChooser(candidates,showResults);
  $('backToRegions').textContent=query?'‹ 전체 지역 검색':'‹ 지역 목록';
  const visible=selectedRegion&&!shared?candidates.filter(place=>restaurantRegion(place)===selectedRegion):candidates;
  const merged=brandView&&!selecting&&!shared;
  const display=merged?groupBrands(visible).map(group=>group.id.startsWith('brand:')?group:group.branches[0]):visible;
  $('brandToggle').hidden=shared||selecting||!showResults;
  $('brandToggle').textContent=brandView?'지점별 보기':'브랜드별 보기';
  const cards=$('cards');
  cards.hidden=!showResults;
  cards.replaceChildren();
  cards.classList.toggle('list',list);
  $('count').textContent=cards.hidden?candidates.length+'곳':visible.length+'개 지점 · 이용 '+visible.reduce((n,place)=>n+place.visitCount,0)+'회';
  $('shareMode').textContent=selecting?'공유 ('+selected.size+')':'공유 선택';
  $('notice').textContent=selecting?'방문한 장소를 최대 10곳 선택한 후 공유하세요.':(cards.hidden?candidates:visible).length?'':'조건에 맞는 장소가 없어요.';
  for(const place of display){
    const hits=(place.branches?place.branches.flatMap(branch=>evidence.get(branch.id)||[]):evidence.get(place.id)||[])
      .slice().sort((a,b)=>b.date.localeCompare(a.date)||a.id.localeCompare(b.id));
    const card=placeCard(place,{visit:hits[0],matchDate:hits[0]?.date,extraMatches:Math.max(0,hits.length-1)});
    if(selecting&&place.visitCount){
      card.classList.add('share-selectable');
      const label=el('label',null,'choose'),checkbox=el('input');
      checkbox.type='checkbox';
      checkbox.checked=selected.has(place.id);
      checkbox.setAttribute('aria-label',place.name+' 공유 선택');
      checkbox.onchange=()=>{
        if(checkbox.checked&&selected.size>=10){checkbox.checked=false;return;}
        if(checkbox.checked)selected.add(place.id);
        else selected.delete(place.id);
        $('shareMode').textContent='공유 ('+selected.size+')';
      };
      label.append(checkbox);
      card.append(label);
    }
    cards.append(card);
  }
  for(const button of $('kindChips').children)button.setAttribute('aria-pressed',String(button.dataset.kind===categoryFilter));
}

function resetDrill(){
  if(history.state?.browse?.tab===activeTab)history.replaceState({...history.state,browse:{tab:activeTab,region:''},regionStep:false},'');
  selectedRegion='';
  categoryFilter='';
  $('search').value=$('type').value='';
  render();
}
function show(data,masters=[],wishes=[],extras=[]){extraPhotos=extras;records=data.map((x,i)=>({...x,id:x.id||`shared-${i}`})).sort((a,b)=>b.date.localeCompare(a.date));shops=groupPlaces(records,masters,wishes,extras);$('login').hidden=true;$('archive').hidden=false;$('refresh').hidden=shared;$('detailRefresh').hidden=shared;$('wishlistTab').hidden=!privateView;$('shareMode').hidden=shared||!sharingEnabled;const shopIds=new Set(shops.filter(shop=>shop.visitCount).map(shop=>shop.id));for(const id of selected){if(!shopIds.has(id))selected.delete(id);}options('type','모든 음식',shops.map(x=>x.type));$('kindChips').replaceChildren();for(const [label,kind,symbol] of [['전체','','home'],['맛집','맛집','utensils'],['카페','카페','coffee'],['쇼핑','쇼핑','bag'],['관광지','관광지','images']]){const button=el('button',null,'kind-chip');button.dataset.kind=kind;button.append(svgIcon(symbol),document.createTextNode(label));button.onclick=()=>{if(categoryFilter!==kind){categoryFilter=kind;selectedRegion='';$('type').value='';}render();};$('kindChips').append(button);}$('stats').replaceChildren(...[['저장 브랜드',groupBrands(shops).length],['저장 장소',shops.length],['방문 기록',records.length],['위시리스트',shops.filter(isWish).length],['재방문 장소',shops.filter(x=>x.visitCount>1).length]].map(([label,n])=>{const d=el('div',null,'stat');d.append(el('span',label),el('strong',n));return d;}));$('archiveTabs').hidden=shared;$('stats').hidden=shared;options('galleryRegion','모든 지역',records.map(x=>x.region));options('galleryType','모든 음식',records.map(x=>x.type));options('galleryPeriod','전체 기간',records.flatMap(x=>[x.date.slice(0,4),x.date.slice(0,7)]));renderGallery();const oldPeriod=$('statsPeriod').value;options('statsPeriod','전체 기간',records.flatMap(x=>[x.date.slice(0,4),x.date.slice(0,7)]).filter(Boolean));$('statsPeriod').options[0].value='all';if([...$('statsPeriod').options].some(o=>o.value===oldPeriod))$('statsPeriod').value=oldPeriod;render();if(!shared)renderStats();ready=true;renderRoute(true);}
function updateStatus(message){
  $('mode').textContent=message;
  $('detailStatus').textContent=message;
}

async function load(){
  if(shared||loading)return;
  loading=true;
  $('refresh').disabled=$('detailRefresh').disabled=true;
  updateStatus('Notion에서 기록을 불러오는 중…');
  try{
    const result=await api('records');
    const wasPrivate=privateView;
    setPrivateView(result);
    if(wasPrivate&&!privateView){lastCompleteAt=null;browseStates.delete('wishlist');}
    if(result.partial&&lastCompleteAt){updateStatus(result.warning+' 이전 조회 기록 ('+lastCompleteAt.toLocaleString('ko-KR',{timeZone:'Asia/Seoul'})+')을 표시합니다.');return;}
    show(result.records,result.places,result.wishes,result.extraPhotos);
    if(!privateView&&activeTab==='wishlist')tab('records');
    if(!result.partial)lastCompleteAt=new Date();
    updateStatus(result.warning||'');
  }catch(error){
    updateStatus(error.message+(lastCompleteAt?' 이전 조회 기록 ('+lastCompleteAt.toLocaleString('ko-KR',{timeZone:'Asia/Seoul'})+')을 표시합니다.':''));
  }finally{
    loading=false;
    $('refresh').disabled=$('detailRefresh').disabled=false;
  }
}
$('loginForm').onsubmit=async e=>{e.preventDefault();$('loginError').textContent='';try{await api('login',{password:$('password').value});$('password').value='';location.reload();}catch(e){$('loginError').textContent=e.message;}};
$('refresh').onclick=$('detailRefresh').onclick=load;
document.addEventListener('visibilitychange',()=>{
  if(!document.hidden&&!$('refresh').hidden)load();
});
window.addEventListener('focus',()=>{
  if(!document.hidden&&!$('refresh').hidden)load();
});
window.addEventListener('pageshow',event=>{
  if(event.persisted&&!$('refresh').hidden)load();
});
$('logout').onclick=async()=>{await api('logout',{});location.reload()};$('search').oninput=$('type').onchange=render;
$('brandToggle').onclick=()=>{brandView=!brandView;render();};$('layout').onclick=()=>{list=!list;$('layout').textContent=list?'카드 보기':'목록 보기';render()};$('closeDetail').onclick=closeDetail;$('closeShare').onclick=()=>$('sharing').close();$('shareMode').onclick=()=>{if(!selecting){selecting=true;render();}else if(!selected.size){selecting=false;render();}else openShare([...selected]);};
$('makeShare').onclick=async()=>{const b=$('makeShare');b.disabled=true;try{const j=await api('share',{ids:shareIds});$('shareUrl').value=location.origin+'/#share='+j.token;$('shareResult').hidden=false;$('nativeShare').hidden=!navigator.share;}catch(e){$('shareError').textContent=e.message;}finally{b.disabled=false;}};
$('copy').onclick=async()=>{try{await navigator.clipboard.writeText($('shareUrl').value);$('copy').textContent='복사 완료';}catch{$('shareUrl').select();$('shareError').textContent='링크를 직접 복사해 주세요.';}};$('nativeShare').onclick=async()=>{try{await navigator.share({title:'Place Notes · 방문 기록',url:$('shareUrl').value});}catch{}};
async function init(){
  try{
    if(initialShareToken){
      shared=true;updateStatus('공유받은 방문 기록 · 읽기 전용');
      show((await api('shared',{token:initialShareToken})).records);return;
    }
    const status=await api('status');
    if(!status.configured){updateStatus('Notion 연동이 설정되지 않았습니다.');return;}
    sharingEnabled=status.sharingEnabled;setPrivateView(status);
    $('refresh').hidden=false;
    await load();
  }catch(error){updateStatus(error.message);}
}
function setPrivateView(status){
  privateView=Boolean(status.authenticated);
  $('privateOpen').hidden=!status.privateEnabled||privateView;
  $('logout').hidden=!privateView;
}
$('privateOpen').onclick=()=>{$('login').hidden=false;$('password').focus();};
function renderGallery(){galleryPhotos=shared?[]:galleryEntries(records,{region:$('galleryRegion').value,type:$('galleryType').value,period:$('galleryPeriod').value||'all'});if(!shared){const covered=new Set(galleryPhotos.map(p=>p.shopId));galleryPhotos.push(...extraPhotos.filter(p=>!covered.has(p.shopId)&&((!$('galleryRegion').value||p.region===$('galleryRegion').value)&&(!$('galleryType').value||p.type===$('galleryType').value)&&!$('galleryPeriod').value)).filter(p=>{if(covered.has(p.shopId))return false;covered.add(p.shopId);return true;}));} $('galleryGrid').replaceChildren();$('galleryCount').textContent=`사진 ${galleryPhotos.length}장`; $('galleryEmpty').hidden=galleryPhotos.length>0;const emptyFiltered=galleryPhotos.length===0&&galleryFilterIds.some(id=>$(id).value)&&Boolean(extraPhotos.length||records.some(record=>record.photos?.length));$('galleryNoMatches').hidden=!emptyFiltered;$('galleryNoPhotos').hidden=emptyFiltered;for(const [i,p] of galleryPhotos.entries()){const tile=el('button',null,'gallery-tile');tile.setAttribute('aria-label',`${p.name} ${p.date} 사진 확대`);tile.append(photo({...p,photos:[p]}));const info=el('div',null,'gallery-caption');info.append(el('strong',p.name),el('span',p.date));tile.append(info);tile.onclick=()=>showPhoto(i,galleryPhotos,true);$('galleryGrid').append(tile);}}
const galleryFilterIds=['galleryRegion','galleryType','galleryPeriod'];
for(const id of galleryFilterIds)$(id).onchange=renderGallery;
$('clearGalleryFilters').onclick=()=>{for(const id of galleryFilterIds)$(id).value='';renderGallery();$('galleryRegion').focus();};
function tab(name){if((shared&&name!=='records')||(name==='wishlist'&&!privateView))return;if(name==='stats'&&activeTab!=='stats'){openStats.clear();selectedStats.clear();statQueries.clear();}if(name!==activeTab){
  if(browseTabs.includes(activeTab))browseStates.set(activeTab,{region:selectedRegion,category:categoryFilter,query:$('search').value,food:$('type').value});
  activeTab=name;
  if(browseTabs.includes(name)){
    const state=browseStates.get(name)||{};
    selectedRegion=state.region||'';categoryFilter=state.category||'';$('search').value=state.query||'';$('type').value=state.food||'';
  }
}$('recordsPanel').hidden=!['records','favorites','wishlist'].includes(name);$('favoriteHeading').hidden=name!=='favorites';$('wishlistHeading').hidden=name!=='wishlist';$('statsPanel').hidden=name!=='stats';$('galleryPanel').hidden=name!=='gallery';for(const n of ['records','favorites','wishlist','gallery','stats'])$(n+'Tab').setAttribute('aria-pressed',String(name===n));if(name==='stats')renderStats();if(name==='gallery')renderGallery();if(['records','favorites','wishlist'].includes(name))render();}
function statSection(id,title,build){
  const panel=el('section',null,'chart-panel stat-section');
  const heading=el('h3'),toggle=el('button',null,'stat-toggle');
  toggle.append(el('span',title));
  const arrow=el('span',null,'stat-chevron');
  arrow.setAttribute('aria-hidden','true');
  toggle.append(arrow);
  const body=el('div');
  body.id='stat-'+id;
  toggle.setAttribute('aria-controls',body.id);
  const sync=()=>{
    body.hidden=!openStats.has(id);
    toggle.setAttribute('aria-expanded',String(!body.hidden));
    arrow.textContent=body.hidden?'⌄':'⌃';
    body.replaceChildren();
    if(!body.hidden)build(body);
  };
  toggle.onclick=()=>{
    if(openStats.delete(id))selectedStats.delete(id);
    else openStats.add(id);
    sync();
  };
  heading.append(toggle);
  panel.append(heading,body);
  sync();
  return panel;
}

function statList(id,title,rows){
  return statSection(id,title,body=>{
    if(!rows.length){body.append(el('p','기록 없음'));return;}
    const details=el('section',null,'stat-results');
    details.id='stat-result-'+id;
    const controls=[];
    const maxCount=Math.max(1,...rows.map(row=>row.visits.length));
    const update=()=>{
      details.replaceChildren();
      const label=selectedStats.get(id);
      const selection=rows.find(row=>(row.key??row.label)===label);
      for(const button of controls)button.setAttribute('aria-expanded',String(button.dataset.label===(selection?.key??selection?.label)));
      details.hidden=!selection;
      if(!selection)return;
      const matches=rankStatPlaces(selection.visits);
      details.append(el('h4',selection.label+' 이용 장소 · '+matches.length+'곳 / '+selection.visits.length+'회'));
      const list=el('div',null,'cards list');
      for(const match of matches.slice(0,20))list.append(statPlaceCard(match));
      if(matches.length>20){
        let next=20;
        const more=el('button','더 보기');
        more.onclick=()=>{
          for(const match of matches.slice(next,next+20))list.append(statPlaceCard(match));
          next+=20;
          more.hidden=next>=matches.length;
        };
        details.append(list,more);
      }else details.append(list);
    };
    for(const row of rows){
      const button=el('button',null,'menu-stat stat-row');
      button.dataset.label=row.key??row.label;
      button.setAttribute('aria-controls',details.id);
      button.append(el('span',row.label));
      const track=el('span',null,'bar-track'),fill=el('span',null,'bar-fill pastel-0');
      track.setAttribute('aria-hidden','true');
      fill.style.width=(row.visits.length/maxCount*100)+'%';
      track.append(fill);
      button.append(track,el('strong',row.caption||row.visits.length+'회'));
      button.onclick=()=>{
        if(selectedStats.get(id)===button.dataset.label)selectedStats.delete(id);
        else selectedStats.set(id,button.dataset.label);
        update();
      };
      controls.push(button);
      body.append(button);
    }
    if(id==='menu-categories'||id==='menus'){
      const search=el('input');
      search.type='search';search.placeholder='메뉴 검색';
      search.setAttribute('aria-label',title+' 검색');
      search.value=statQueries.get(id)||'';
      const filter=()=>{
        const query=search.value.normalize('NFKC').trim().toLowerCase();
        for(const button of controls)button.hidden=!button.textContent.normalize('NFKC').toLowerCase().includes(query);
        if(controls.some(button=>button.hidden&&button.dataset.label===selectedStats.get(id)))selectedStats.delete(id);
        update();
      };
      search.oninput=()=>{statQueries.set(id,search.value);filter();};
      body.prepend(search);
      filter();
    }else update();
    body.append(details);
  });
}

function statPlaceCard(match){
  const place=shops.find(shop=>shop.id===match.id)||match;
  return placeCard(place,{visit:match.visits[0],count:match.visitCount,matchDate:match.date,scoped:true});
}

function renderStats(){
  const period=$('statsPeriod').value||'all';
  const data=periodRecords(records,period);
  const fingerprint=JSON.stringify(['notion-schema-v1',period,data.map(visit=>[
    visit.id,visit.shopId,visit.brandId,visit.brandName,visit.name,visit.region,visit.area,visit.type,
    visit.placeTypeRaw,visit.placeType,visit.date,visit.revisit,visit.shopRevisit,visit.usageMode,
    visit.menu,visit.menuCategories,visit.purchases,visit.purchaseCategories,visit.review,visit.address,
  ])]);
  if(statsSnapshot?.fingerprint!==fingerprint)statsSnapshot={fingerprint,s:summarize(data),bs:brandSummary(data)};
  const {s,bs}=statsSnapshot;
  $('statsScope').textContent=(period==='all'?'전체 기간':period)+' · 이용 기록 기준 (매장 방문·포장·배달·온라인·미확인 포함)';
  const overview=statSection('overview','방문 요약',body=>{
    const grid=el('div',null,'summary-stats');
    for(const [label,value] of [
      ['이용 기록',s.visits+'회'],['이용 브랜드',bs.visitedBrands+'개'],['반복 이용 브랜드',bs.repeatBrands+'개'],
      ['이용 장소',s.places+'곳'],['이용 지역',s.regions+'개'],['또 갈래 평가',s.revisitYes+'회'],
      ['동일 지점 반복 이용',s.repeatPlaces+'곳'],['동일 지점 반복 이용률',s.places?s.repeatRate.toFixed(1)+'%':'—'],
      ['또 갈래 비율',s.visits?(s.revisitYes/s.visits*100).toFixed(1)+'%':'—'],['재방문 의사 미입력',s.revisitUnknown+'회'],
    ]){
      const item=el('div',null,'stat');
      item.append(el('span',label),el('strong',value));
      grid.append(item);
    }
    body.append(grid,el('p','동일 지점 반복 이용률은 기간 내 2회 이상 이용한 지점 수를 전체 이용 지점 수로 나눈 값입니다.'));
  });
  const topRows=items=>items.map(item=>({label:item.name,key:item.id,visits:item.visits,caption:item.visitCount+'회'+(item.visitedBranchCount?' · '+item.visitedBranchCount+'곳':'')}));
  const groups=[
    ['이용 요약',[overview,statList('revisit','재방문 의사',s.byRevisit.map(row=>({...row,caption:row.count+'회 · '+row.percent.toFixed(1)+'%'}))),statList('years','연도별 이용',s.byYear)]],
    ['장소와 지역',[statList('categories','카테고리별 이용',s.byPlaceType),statList('regions','지역별 이용',s.byRegion),statList('brands','자주 이용한 브랜드 TOP 5',topRows(bs.topBrands)),statList('places','자주 이용한 장소 TOP 5',topRows(s.topPlaces))]],
    ['메뉴와 구매',[statList('foods','음식 종류별 이용',s.byType),statList('purchases','구매 카테고리별 이용',s.byPurchaseCategory),statList('menu-categories','메뉴 카테고리별 이용',s.byMenuCategory),statList('menus','개별 주문 메뉴 통계',s.byMenu)]],
  ];
  $('charts').replaceChildren(...groups.map(([title,panels])=>{
    const group=el('section',null,'stat-group'),grid=el('div',null,'stat-group-grid');
    grid.append(...panels);group.append(el('h3',title),grid);return group;
  }));
}
$('resetFilters').onclick=resetDrill;$('recordsTab').onclick=()=>tab('records');$('statsTab').onclick=()=>tab('stats');$('favoritesTab').onclick=()=>tab('favorites');$('wishlistTab').onclick=()=>tab('wishlist');$('galleryTab').onclick=()=>tab('gallery');$('statsPeriod').onchange=renderStats;
init();
