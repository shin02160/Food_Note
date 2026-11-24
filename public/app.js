import {summarize,periodRecords,filterRecords,normalizeCategory,groupRestaurants,shopKey,galleryEntries,favoriteShops,restaurantRegion,groupRegionCards} from './statistics.js';
const $=id=>document.getElementById(id);const el=(tag,text,cls)=>{const e=document.createElement(tag);if(text!=null)e.textContent=text;if(cls)e.className=cls;return e};
let loading=false;
let activeTab='records',galleryPhotos=[],lightboxPhotos=[],galleryLightbox=false;
let selectedRegion='';
let drillMenu='',records=[],shops=[],selected=new Set(),selecting=false,shared=false,list=true,sharingEnabled=false,shareIds=[];
const api=async(action,data)=>{const r=await fetch('/api/index?action='+action,{method:data===undefined?'GET':'POST',cache:'no-store',...(data===undefined?{}:{headers:{'Content-Type':'application/json'},body:JSON.stringify(data)})});const j=await r.json();if(!r.ok)throw Error(j.error||'연결 오류');return j};
const symbols={home:'<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"/>',heart:'<path d="M20.8 8.6c0 4.1-8.8 9.9-8.8 9.9S3.2 12.7 3.2 8.6a4.6 4.6 0 0 1 8.8-1.9 4.6 4.6 0 0 1 8.8 1.9z"/>',images:'<rect x="5" y="3" width="16" height="16" rx="3"/><path d="M3 7v12a2 2 0 0 0 2 2h12M5 15l5-5 4 4 3-3 4 4"/><circle cx="15.5" cy="7.5" r="1.5"/>',chart:'<path d="M4 20h16M6 16V9m6 7V4m6 12v-5"/>',back:'<path d="m15 5-7 7 7 7"/>',chevron:'<path d="m9 5 7 7-7 7"/>',utensils:'<path d="M5 3v6a3 3 0 0 0 6 0V3M8 3v18M19 3c-3 2-4 5-4 9h4m0-9v18"/>',pot:'<path d="M4 9h16v8a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3zM2 12h2m16 0h2M3 7h18M10 4h4"/>',soup:'<path d="M3 12h18a9 9 0 0 1-18 0zm5 9h8M7 3c-2 2 2 4 0 6m5-6c-2 2 2 4 0 6m5-6c-2 2 2 4 0 6"/>',pizza:'<path d="M12 21 3 5c5-4 13-4 18 0zM5 9a13 13 0 0 1 14 0"/><circle cx="10" cy="12" r="1"/><circle cx="14" cy="9" r="1"/>',coffee:'<path d="M4 8h13v6a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5zM17 9h2a3 3 0 0 1 0 6h-2M3 22h16M8 2v3m5-3v3"/>',bread:'<path d="M3 17c-1-4 1-7 5-9 2-4 6-4 8 0 4 2 6 5 5 9-3 2-6 1-9-2-3 3-6 4-9 2zM8 8l4 7 4-7"/>',cake:'<path d="M3 12 16 4l5 8v8H3zM3 12h18M3 16h18M15 4V2"/>',salad:'<path d="M3 13h18a9 9 0 0 1-18 0zM8 21h8M8 12C3 9 5 5 8 4c3 2 4 5 3 8m2 0c-1-5 2-9 7-9 0 5-2 8-5 9"/>'};
function svgIcon(name){const span=el('span',null,'line-icon');span.setAttribute('aria-hidden','true');span.innerHTML=`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${symbols[name]||symbols.utensils}</svg>`;return span;}
const category=r=>({'한식':'korean','중식':'chinese','일식':'japanese','양식':'western','카페':'cafe','베이커리':'bakery','디저트':'dessert'}[r.type]||'other');
const icon=r=>({'한식':'utensils','중식':'pot','일식':'soup','양식':'pizza','카페':'coffee','베이커리':'bread','디저트':'cake'}[r.type]||'salad');
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
function detail(r){returnScroll=window.scrollY;hasDetailHistory=true;history.pushState({foodDetail:true},'',routeUrl(r.id));renderRoute();}
function renderRoute(preserveDetail=false){if(!ready||route().get('share')!==initialShareToken)return;const wasDetail=!$('detailPage').hidden;const id=route().get('record');const r=shops.find(x=>x.id===id||x.visits.some(v=>v.id===id));const active=Boolean(id);$('detailPage').hidden=!active;$('archive').hidden=active;$('hero').hidden=active;document.body.classList.toggle('detail-active',active);if(!active){currentRecord=null;document.title='Food Notes · 나의 맛있는 순간들';if($('lightbox').open)$('lightbox').close();if(wasDetail)window.scrollTo(0,returnScroll);return;}
const c=$('detailContent');
const keepPosition=preserveDetail&&wasDetail&&r?.id===currentRecord?.id;
const scroll=keepPosition?window.scrollY:0;
const openVisits=keepPosition?new Set(Array.from(c.querySelectorAll('.visit-item[open]'),visit=>visit.dataset.visitId)):null;
currentRecord=r||null;c.replaceChildren();$('detailRefresh').hidden=shared;$('detailStatus').hidden=shared;$('detailShare').hidden=shared||!sharingEnabled||!r;if(!r){c.append(el('h1','기록을 찾을 수 없어요'),el('p','삭제되었거나 접근할 수 없는 기록입니다.'));window.scrollTo(0,0);return;}
const hero=el('div',null,'detail-hero cat-'+category(r));const emblem=el('div',null,'detail-emblem');emblem.append(svgIcon(icon(r)));hero.append(emblem);hero.append(el('span',r.type||'방문 기록','type-tag'),el('h1',r.name),el('p',[r.region,r.area].filter(Boolean).join(' · '),'detail-location'));hero.append(el('p',`총 ${r.visitCount}회 방문 · 최근 ${r.date||'미기록'}`,'visit-summary'));if(r.revisit){const tag=el('span',r.revisit==='또 갈래'?null:r.revisit,'tag');if(r.revisit==='또 갈래'){tag.classList.add('favorite-tag');tag.append(svgIcon('heart'),document.createTextNode('또 갈래'));}hero.append(tag);}c.append(hero);document.title=r.name+' · Food Notes';
const info=section('매장 정보'),fields=el('div',null,'detail-fields');fields.append(field('최초 방문일',r.firstDate?.replaceAll('-','.')),field('최근 방문일',r.date?.replaceAll('-','.')),field('음식 종류',r.type),field('지역',[r.region,r.area].filter(Boolean).join(' · ')));info.append(fields);c.append(info);
if(!shared){const map=section('매장 위치');map.append(el('p',r.address||'주소 미기록','full-text'));const links=el('div',null,'map-actions');for(const [label,url] of [naverRestaurantLink(r),['Google Maps',r.googleMap]]){if(url){const a=el('a',label+' ↗','map-link');a.href=url;a.target='_blank';a.rel='noopener noreferrer';links.append(a);}}if(links.childElementCount)map.append(links);c.append(map);}
const historySection=section('방문 이력');historySection.firstChild.append(el('span',`총 ${r.visitCount}회`,'photo-count'));let offset=0;r.visits.forEach((v,i)=>{const base=offset;offset+=v.photos?.length||0;const d=el('details',null,'visit-item');d.dataset.visitId=v.id;d.open=openVisits?openVisits.has(v.id):i===0;const head=el('summary');head.append(el('strong',v.date?.replaceAll('-','.')||'날짜 미기록'),el('span',v.menu||'메뉴 미기록','visit-menu'));d.append(head);const inside=el('div',null,'visit-body');inside.append(el('h3','주문 메뉴'),el('p',v.menu||'미기록','full-text'),el('h3','방문 후기'),el('p',v.review||'미기록','full-text'));if(v.revisit)inside.append(el('span',v.revisit,'tag'));inside.append(el('h3',`사진 ${v.photos?.length||0}장`));if(v.photos?.length){const grid=el('div',null,'photo-grid');v.photos.forEach((_,j)=>{const b=el('button',null,'photo-tile');b.setAttribute('aria-label',`${v.date} 사진 ${j+1} 확대`);b.append(photo(v,j));b.onclick=()=>showPhoto(base+j,r.visits.flatMap(v=>(v.photos||[]).map(p=>({...p,name:r.name,date:v.date}))),false);grid.append(b);});inside.append(grid);}else inside.append(el('p',shared?'공유 기록에는 사진이 포함되지 않습니다.':'아직 등록된 사진이 없어요.','photo-empty'));d.append(inside);historySection.append(d);});c.append(historySection);window.scrollTo(0,scroll);}
function closeDetail(){if(history.state?.foodDetail&&hasDetailHistory)history.back();else{history.replaceState({},'',routeUrl(null));renderRoute();}}
history.scrollRestoration='manual';
window.addEventListener('popstate',()=>renderRoute());
window.addEventListener('hashchange',()=>{
  if(route().get('share')!==initialShareToken)location.reload();
});
const initialShareToken=route().get('share');
$('closePhoto').onclick=()=>$('lightbox').close();$('prevPhoto').onclick=()=>showPhoto(photoIndex-1);$('nextPhoto').onclick=()=>showPhoto(photoIndex+1);$('lightbox').addEventListener('keydown',e=>{if(e.key==='ArrowLeft')showPhoto(photoIndex-1);if(e.key==='ArrowRight')showPhoto(photoIndex+1);});$('largePhoto').addEventListener('error',()=>{$('photoPosition').textContent='사진을 불러오지 못했습니다. 목록에서 새로고침해 주세요.';});
function openShare(ids){shareIds=ids;$('shareResult').hidden=true;$('shareError').textContent='';$('sharing').showModal();}
$('detailShare').onclick=()=>{if(currentRecord)openShare([currentRecord.id]);};
function options(id,label,values){const select=$(id),old=select.value;select.replaceChildren(new Option(label,''),...([...new Set(values.map(normalizeCategory).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ko')).map(v=>new Option(v,v))));if(['region','type','revisit','galleryRegion','galleryType'].includes(id)&&values.some(v=>!String(v??'').trim()))select.append(new Option('미입력','__missing'));if([...select.options].some(o=>o.value===old))select.value=old;}
function renderRegionChooser(candidates){
  const chooser=$('regionChooser');
  chooser.hidden=shared||Boolean(selectedRegion);
  $('regionSelection').hidden=shared||!selectedRegion;
  $('selectedRegion').textContent=selectedRegion;
  $('layout').hidden=!shared&&!selectedRegion;
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
      button.onclick=()=>{selectedRegion=region;render();$('selectedRegion').focus();};
      choices.append(button);
    }
    section.append(choices);
    $('regionChoices').append(section);
  }
}
$('backToRegions').onclick=()=>{selectedRegion='';render();$('regionHeading').focus();};

function render(){const q=$('search').value.trim().toLowerCase();const r=$('region').value,t=$('type').value,v=$('revisit').value;const matches=filterRecords(records,{region:r,type:t,revisit:v,query:q,menu:drillMenu,period:$('recordsPanel').dataset.period||'all'});const ids=new Set(matches.map(shopKey));const candidates=(activeTab==='favorites'?favoriteShops(shops):shops).filter(s=>ids.has(s.id));renderRegionChooser(candidates);const visible=shared?candidates:candidates.filter(shop=>selectedRegion&&restaurantRegion(shop)===selectedRegion);const visibleIds=new Set(visible.map(s=>s.id));$('cards').hidden=!shared&&!selectedRegion;$('cards').replaceChildren();$('cards').classList.toggle('list',list);$('count').textContent=!shared&&!selectedRegion?candidates.length+'곳':`${visible.length}곳 · ${matches.filter(m=>visibleIds.has(shopKey(m))).length}건 방문`; $('shareMode').textContent=selecting?`공유 (${selected.size})`:'공유 선택';$('notice').textContent=(drillMenu?`메뉴: ${drillMenu} · `:'')+($('recordsPanel').dataset.period&&$('recordsPanel').dataset.period!=='all'?`기간: ${$('recordsPanel').dataset.period} · `:'')+(selecting?'공유할 식당을 최대 10곳 선택한 후 공유 버튼을 누르세요.':(!records.length?'Notion에 방문 기록이 없어요.':(!(selectedRegion||shared?visible:candidates).length?'조건에 맞는 기록이 없어요.':'')));for(const x of visible){const card=el('article',null,'card cat-'+category(x));const b=el('button',null,'record-link');b.setAttribute('aria-label',x.name+' '+x.date+' 상세 보기');b.append(list?placeholder(x):photo(x));const c=el('div',null,'card-content');c.append(el('h3',x.name),el('div',[x.area||x.region,x.date?.replaceAll('-','.')].filter(Boolean).join(' · '),'meta'),el('div',x.menu||'메뉴 미기록','menu'));const tags=el('div',null,'row-tags');tags.append(el('span',`${x.visitCount}회 방문`,'visit-count'));if(x.type)tags.append(el('span',x.type,'type-tag'));if(x.revisit){const tag=el('span',x.revisit==='또 갈래'?null:x.revisit,'tag');if(x.revisit==='또 갈래'){tag.classList.add('favorite-tag');tag.append(svgIcon('heart'),document.createTextNode('또 갈래'));}tags.append(tag);}c.append(tags);const chevron=el('span',null,'chevron');chevron.append(svgIcon('chevron'));b.append(c,chevron);b.onclick=()=>detail(x);card.append(b);if(selecting){const label=el('label',null,'choose');const check=el('input');check.type='checkbox';check.checked=selected.has(x.id);check.setAttribute('aria-label',x.name+' 공유 선택');check.onchange=()=>{if(check.checked){if(selected.size>=10){check.checked=false;return;}selected.add(x.id);}else selected.delete(x.id);$('shareMode').textContent=`공유 (${selected.size})`;};label.append(check);card.append(label);} $('cards').append(card);}}
function show(data){records=data.map((x,i)=>({...x,id:x.id||`shared-${i}`})).sort((a,b)=>b.date.localeCompare(a.date));shops=groupRestaurants(records);const shopIds=new Set(shops.map(shop=>shop.id));for(const id of selected){if(!shopIds.has(id))selected.delete(id);}$('archive').hidden=false;$('refresh').hidden=shared;$('shareMode').hidden=shared||!sharingEnabled;options('region','모든 지역',records.map(x=>x.region));options('type','모든 음식',records.map(x=>x.type));options('revisit','모든 방문',records.map(x=>x.revisit));$('stats').replaceChildren(...[['방문 식당',shops.length],['방문 기록',records.length],['방문 지역',new Set(records.map(x=>x.region).filter(Boolean)).size],['재방문 식당',shops.filter(x=>x.visitCount>1).length]].map(([label,n])=>{const d=el('div',null,'stat');d.append(el('span',label),el('strong',n));return d;}));$('archiveTabs').hidden=shared;$('stats').hidden=shared;options('galleryRegion','모든 지역',records.map(x=>x.region));options('galleryType','모든 음식',records.map(x=>x.type));options('galleryPeriod','전체 기간',records.flatMap(x=>[x.date.slice(0,4),x.date.slice(0,7)]));renderGallery();const oldPeriod=$('statsPeriod').value;options('statsPeriod','전체 기간',records.flatMap(x=>[x.date.slice(0,4),x.date.slice(0,7)]).filter(Boolean));$('statsPeriod').options[0].value='all';if([...$('statsPeriod').options].some(o=>o.value===oldPeriod))$('statsPeriod').value=oldPeriod;render();if(!shared)renderStats();ready=true;renderRoute(true);}
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
    show(result.records);
    updateStatus(result.warning||'맛집 기록 · Notion 연결됨');
  }catch(error){
    updateStatus(error.message);
  }finally{
    loading=false;
    $('refresh').disabled=$('detailRefresh').disabled=false;
  }
}
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
for(const id of ['search','region','type','revisit'])$(id).addEventListener(id==='search'?'input':'change',()=>{drillMenu='';render();});
$('layout').onclick=()=>{list=!list;$('layout').textContent=list?'카드 보기':'목록 보기';render()};$('closeDetail').onclick=closeDetail;$('closeShare').onclick=()=>$('sharing').close();$('shareMode').onclick=()=>{if(!selecting){selecting=true;render();}else if(!selected.size){selecting=false;render();}else openShare([...selected]);};
$('makeShare').onclick=async()=>{const b=$('makeShare');b.disabled=true;try{const j=await api('share',{ids:shareIds});$('shareUrl').value=location.origin+'/#share='+j.token;$('shareResult').hidden=false;$('nativeShare').hidden=!navigator.share;}catch(e){$('shareError').textContent=e.message;}finally{b.disabled=false;}};
$('copy').onclick=async()=>{try{await navigator.clipboard.writeText($('shareUrl').value);$('copy').textContent='복사 완료';}catch{$('shareUrl').select();$('shareError').textContent='링크를 직접 복사해 주세요.';}};$('nativeShare').onclick=async()=>{try{await navigator.share({title:'Food Notes · 맛집 기록',url:$('shareUrl').value});}catch{}};
async function init(){try{const token=new URLSearchParams(location.hash.slice(1)).get('share');if(token){shared=true;$('mode').textContent='공유받은 맛집 기록 · 읽기 전용';const j=await api('shared',{token});show(j.records);return;}const status=await api('status');if(!status.configured){$('mode').textContent='Notion 연동이 설정되지 않았습니다. 서버의 NOTION_TOKEN을 설정해 주세요.';return;}sharingEnabled=status.sharingEnabled;
    $('refresh').hidden=false;
    await load();}catch(e){$('mode').textContent=e.message;}}
function renderGallery(){galleryPhotos=shared?[]:galleryEntries(records,{region:$('galleryRegion').value,type:$('galleryType').value,period:$('galleryPeriod').value||'all'});$('galleryGrid').replaceChildren();$('galleryCount').textContent=`사진 ${galleryPhotos.length}장`; $('galleryEmpty').hidden=galleryPhotos.length>0;$('galleryEmpty').querySelector('h3').textContent=records.some(r=>r.photos?.length)?'조건에 맞는 사진이 없어요.':'아직 등록된 사진이 없어요.';for(const [i,p] of galleryPhotos.entries()){const tile=el('button',null,'gallery-tile');tile.setAttribute('aria-label',`${p.name} ${p.date} 사진 확대`);tile.append(photo({...p,photos:[p]}));const info=el('div',null,'gallery-caption');info.append(el('strong',p.name),el('span',p.date));tile.append(info);tile.onclick=()=>showPhoto(i,galleryPhotos,true);$('galleryGrid').append(tile);}}
for(const id of ['galleryRegion','galleryType','galleryPeriod'])$(id).onchange=renderGallery;
function tab(name){if(shared&&name!=='records')return;activeTab=name;$('recordsPanel').hidden=!['records','favorites'].includes(name);$('favoriteHeading').hidden=name!=='favorites';$('statsPanel').hidden=name!=='stats';$('galleryPanel').hidden=name!=='gallery';for(const n of ['records','favorites','gallery','stats'])$(n+'Tab').setAttribute('aria-pressed',String(name===n));if(name==='stats')renderStats();if(name==='gallery')renderGallery();if(['records','favorites'].includes(name))render();}
function drill(key,value){selectedRegion='';$('region').value='';$('type').value='';$('revisit').value='';$('search').value='';drillMenu='';$('recordsPanel').dataset.period=$('statsPeriod').value||'all';if(key==='menu')drillMenu=value;else if(key==='month'||key==='year')$('recordsPanel').dataset.period=value;else $(key).value=value==='미입력'?'__missing':value;tab('records');render();}
function resetDrill(){selectedRegion='';drillMenu='';$('recordsPanel').dataset.period='all';$('search').value='';$('region').value='';$('type').value='';$('revisit').value='';render();}
function chart(title,rows,key){const panel=el('section',null,'chart-panel');panel.append(el('h3',title));if(!rows.length){panel.append(el('p','기록 없음'));return panel;}const max=Math.max(...rows.map(x=>x.count),1);for(const x of rows){const b=el('button',null,'bar-row');b.setAttribute('aria-label',`${x.label} ${x.count}건 기록 보기`);b.append(el('span',x.label,'bar-label'));const track=el('span',null,'bar-track'),bar=el('span',null,'bar-fill');bar.classList.add('pastel-'+(rows.indexOf(x)%6));bar.style.width=`${x.count/max*100}%`;track.append(bar);b.append(track,el('span',`${x.count}건`,'bar-count'));if(key==='revisit')b.append(el('span',`${x.percent.toFixed(1)}%`,'bar-percent'));b.onclick=()=>drill(key,x.label);panel.append(b);}return panel;}
function renderStats(){const period=$('statsPeriod').value||'all',data=periodRecords(records,period),s=summarize(data);$('statsScope').textContent=`${period==='all'?'전체 기간':period} · 선택 기간 방문 기록 기준 · 실제 재방문율 = 기간 내 2회 이상 방문한 식당 / 기간 내 방문 식당. 항목을 누르면 해당 기록으로 이동합니다.`;$('summaryStats').replaceChildren(...[['방문 기록',s.visits+'건'],['방문 매장',s.places+'곳'],['방문 지역',s.regions+'개'],['또 갈래',s.revisitYes+'건'],['재방문 식당',s.repeatPlaces+'곳'],['실제 재방문율',s.places?s.repeatRate.toFixed(1)+'%':'—'],['또 갈래 비율',s.visits?(s.revisitYes/s.visits*100).toFixed(1)+'%':'—'],['재방문 미입력',s.revisitUnknown+'건']].map(([label,value])=>{const d=el('div',null,'stat');d.append(el('span',label),el('strong',value));return d;}));const top=el('section',null,'chart-panel');top.append(el('h3','자주 방문한 맛집 TOP 5'));for(const x of s.topPlaces){const b=el('button',null,'menu-stat');b.append(el('span',x.name),el('strong',`${x.visitCount}회`));b.onclick=()=>{const shop=shops.find(y=>y.id===x.id);if(shop)detail(shop)};top.append(b);}if(!s.topPlaces.length)top.append(el('p','기록 없음'));$('charts').replaceChildren(top,chart('지역별 방문',s.byRegion,'region'),chart('음식 종류별 방문',s.byType,'type'),chart('재방문 의사',s.byRevisit,'revisit'),chart('연도별 방문',s.byYear,'year'),chart('월별 방문',s.byMonth,'month'));const q=$('menuSearch').value.trim().toLowerCase();const menus=s.byMenu.filter(x=>x.label.toLowerCase().includes(q));$('menuStats').replaceChildren();for(const m of menus){const b=el('button',null,'menu-stat');b.append(el('span',m.label),el('strong',`${m.count}건`));b.onclick=()=>drill('menu',m.label);$('menuStats').append(b);}if(!menus.length)$('menuStats').append(el('p','해당 메뉴 기록이 없어요.'));}
$('resetFilters').onclick=resetDrill;$('recordsTab').onclick=()=>{tab('records');resetDrill();};$('statsTab').onclick=()=>tab('stats');$('favoritesTab').onclick=()=>{tab('favorites');resetDrill();};$('galleryTab').onclick=()=>tab('gallery');$('statsPeriod').onchange=renderStats;$('menuSearch').oninput=renderStats;
init();
