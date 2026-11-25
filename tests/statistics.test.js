import test from 'node:test';import assert from 'node:assert/strict';import {menuNames,periodRecords,summarize,filterRecords} from '../public/statistics.js';
const data=[{name:'A',area:'센텀',region:'부산',date:'2026-11-14',type:'카페',menu:'커피, 빵, 커피',revisit:'또 갈래'},{name:'A',area:'센텀',region:'부산',date:'2026-11-15',type:'카페',menu:'커피',revisit:'보통'},{name:'B',region:'서울',date:'2026-10-01',type:'한식',menu:'국밥',revisit:''},{name:'C',region:'',date:'',type:'',menu:''}];
test('statistics distinguish unique stores from visits and include missing values',()=>{const s=summarize(data);assert.equal(s.visits,4);assert.equal(s.places,3);assert.equal(s.regions,2);assert.equal(s.revisitYes,1);assert.equal(s.revisitUnknown,2);assert.equal(s.byRevisit.find(x=>x.label==='미입력').percent,50);assert.equal(s.byRegion.find(x=>x.label==='부산').count,2);assert.equal(s.byType.find(x=>x.label==='카페').count,2);});
test('menu counts use unique names per visit, not duplicate mentions',()=>{assert.deepEqual(menuNames('커피, 빵；커피\n국밥'),['커피','빵','국밥']);assert.equal(summarize(data).byMenu.find(x=>x.label==='커피').count,2);});
test('month and drilldown filters match aggregate counts',()=>{assert.equal(periodRecords(data,'2026-11').length,2);assert.equal(filterRecords(data,{region:'부산',period:'2026-11',menu:'커피'}).length,2);assert.equal(filterRecords(data,{revisit:'__missing'}).length,2);assert.equal(filterRecords(data,{region:'__missing'}).length,1);assert.equal(filterRecords(data,{query:'국밥'}).length,1);assert.equal(filterRecords(data,{menu:'국'}).length,0);});
test('empty dataset is safe',()=>{const s=summarize([]);assert.equal(s.visits,0);assert.equal(s.places,0);assert.deepEqual(s.byMenu,[]);});
test('same shop ID merges visits, separate branches remain distinct, first/latest sorted',async()=>{const {groupRestaurants}=await import('../public/statistics.js');const rs=[{id:'old',shopId:'shop-a',name:'커피빈',region:'부산',date:'2026-11-14',menu:'커피',photos:[{url:'a'}]},{id:'other',shopId:'shop-b',name:'커피빈',region:'부산',date:'2026-11-14'},{id:'new',shopId:'shop-a',name:'커피빈',region:'부산',date:'2026-11-15',menu:'빵',photos:[{url:'b'}]}];const shops=groupRestaurants(rs);assert.equal(shops.length,2);const a=shops.find(s=>s.id==='shop-a');assert.equal(a.visitCount,2);assert.equal(a.firstDate,'2026-11-14');assert.equal(a.date,'2026-11-15');assert.deepEqual(a.visits.map(v=>v.id),['new','old']);assert.deepEqual(a.photos.map(x=>x.url),['b','a']);const s=summarize(rs);assert.equal(s.repeatPlaces,1);assert.equal(s.repeatRate,50);assert.equal(s.topPlaces[0].id,'shop-a');assert.equal(periodRecords(rs,'2026').length,3);assert.equal(periodRecords(rs,'2025').length,0);});
test('shared groups use anonymous grouping keys',async()=>{const {groupRestaurants}=await import('../public/statistics.js');assert.equal(groupRestaurants([{group:0,name:'A',date:'2026-01-01'},{group:0,name:'A',date:'2026-02-01'},{group:1,name:'A',date:'2026-01-01'}]).length,2);});
test('favorites use representative shop preference, not historical visit preference',async()=>{const {groupRestaurants,favoriteShops}=await import('../public/statistics.js');const shops=groupRestaurants([{id:'a',shopId:'A',name:'A',date:'2026-01-01',revisit:'보통',shopRevisit:'또 갈래'},{id:'b',shopId:'B',name:'B',date:'2026-01-01',revisit:'또 갈래',shopRevisit:'보통'},{id:'c',shopId:'C',name:'C',date:'2026-01-01',revisit:'또 갈래',shopRevisit:''}]);assert.deepEqual(favoriteShops(shops).map(s=>s.id),['A']);});
test('gallery selects one valid photo per shop from the latest matching visit',async()=>{
  const {galleryEntries}=await import('../public/statistics.js');
  const photo=name=>({url:'https://example.org/'+name});
  const cafe={shopId:'A',name:'Cafe',region:'서울',type:'카페'};
  const visits=[
    {...cafe,id:'old',date:'2026-01-01',photos:[photo('old')]},
    {...cafe,id:'latest',date:'2026-02-01',photos:[{url:'javascript:bad'},photo('first'),photo('second')]},
    {...cafe,id:'empty',date:'2026-03-01',photos:[]},
    {...cafe,id:'other',shopId:'B',region:'부산',date:'2026-02-02',photos:[photo('other')]},
  ];
  assert.deepEqual(galleryEntries(visits).map(entry=>[entry.visitId,entry.url]),[
    ['other',photo('other').url],['latest',photo('first').url],
  ]);
  assert.deepEqual(galleryEntries(visits,{period:'2026-01',region:'서울'}).map(entry=>entry.visitId),['old']);
  assert.deepEqual(galleryEntries(visits,{period:'2026-03'}),[]);
});

test('restaurant regions split Seoul by district and keep other regions grouped', async () => {
  const {restaurantRegion} = await import('../public/statistics.js');
  assert.equal(restaurantRegion({region:'서울',area:'종로'}),'서울.종로');
  assert.equal(restaurantRegion({region:'서울특별시',area:'서울 송파구 잠실동'}),'서울.송파');
  assert.equal(restaurantRegion({region:'서울'}),'서울.세부 지역 미입력');
  assert.equal(restaurantRegion({region:'경기',area:'성남시'}),'경기');
  assert.equal(restaurantRegion({}),'지역 미입력');
});

test('region cards prioritize Seoul, Gyeonggi, Japan and Taiwan in separate sections', async () => {
  const {groupRegionCards} = await import('../public/statistics.js');
  const counts = new Map(['미국','대만','부산','서울.송파','일본','경기도','서울.종로','지역 미입력'].map(region => [region, 1]));
  assert.deepEqual(groupRegionCards(counts).map(({label,items}) => [label,items.map(item=>item.region)]),[
    ['국내',['서울.송파','서울.종로','경기도','부산']],
    ['해외',['일본','대만','미국']],
    ['지역 미입력',['지역 미입력']],
  ]);
});

test('place masters include zero-visit wishlist and do not inflate visit statistics',async()=>{const {groupPlaces,isWish,isShopping,placeStatus}=await import('../public/statistics.js');const r=[{id:'v',shopId:'a',name:'식당',date:'2026-11-01',menuCategories:['면 요리','면 요리','국물·전골']}];const p=groupPlaces(r,[{id:'a',name:'식당',type:'일식',wishlist:true},{id:'b',name:'샵',placeType:'소품·굿즈샵',plannedDate:'2099-01-01'}],[{shopId:'b',name:'키링'}]);assert.equal(p.length,2);assert.equal(p[1].visitCount,0);assert.equal(p[1].wishes.length,1);assert.ok(p.every(isWish));assert.ok(isShopping(p[1]));assert.equal(placeStatus(p[1],'2026-11-25'),'방문 예정');assert.equal(summarize(r).places,1);assert.equal(summarize(r).byMenuCategory.find(x=>x.label==='면 요리').count,1);assert.equal(filterRecords(r,{menuCategory:'국물·전골'}).length,1);});
test('purchase category drilldown matches only actual shopping visits',()=>{const a=[{name:'shop',placeType:'쇼핑몰',purchaseCategories:['굿즈·캐릭터'],purchases:'키링',date:'2026-11-01'},{name:'shop2',placeType:'맛집',date:'2026-11-02'}];assert.equal(filterRecords(a,{purchaseCategory:'굿즈·캐릭터'}).length,1);assert.equal(summarize(a).byPurchaseCategory[0].count,1);});
test('brand grouping keeps branch visits, zero-visit wishes and unlinked names separate',async()=>{const {groupBrands,groupPlaces,brandSummary,summarize}=await import('../public/statistics.js');const records=[{id:'v1',shopId:'a',brandId:'h',brandName:'호시노 커피',name:'호시노 사카에점',region:'나고야',date:'2025-03-07'},{id:'v2',shopId:'b',brandId:'h',brandName:'호시노 커피',name:'호시노 타워즈점',region:'나고야',date:'2024-05-31'},{id:'v3',shopId:'a',brandId:'h',brandName:'호시노 커피',name:'호시노 사카에점',region:'나고야',date:'2024-05-30'},{id:'v4',shopId:'x',name:'호시노 커피',date:'2024-01-01'}];const shops=groupPlaces(records,[{id:'c',brandId:'h',brandName:'호시노 커피',name:'미방문 지점',region:'도쿄',wishlist:true}]);const groups=groupBrands(shops),h=groups.find(x=>x.id==='brand:h');assert.equal(groups.length,2);assert.equal(h.branchCount,3);assert.equal(h.visitedBranchCount,2);assert.equal(h.visitCount,3);assert.equal(h.date,'2025-03-07');assert.equal(brandSummary(records).visitedBrands,2);assert.equal(brandSummary(records).repeatBrands,1);assert.equal(summarize(records).repeatPlaces,1);assert.equal(groupBrands(shops.filter(x=>x.region==='도쿄'))[0].visitCount,0);});
test('different branches of a brand do not count as same-branch revisits',async()=>{const {brandSummary,summarize}=await import('../public/statistics.js');const r=['a','b'].map(shopId=>({shopId,brandId:'h',brandName:'호시노',name:shopId,date:'2025-01-01'}));assert.equal(brandSummary(r).repeatBrands,1);assert.equal(summarize(r).repeatPlaces,0);});

test('normalized search returns intact evidence from the matching visit', async()=>{
  const {searchPlace}=await import('../public/statistics.js');
  const place={name:'Cafe',region:'北京',visits:[{id:'new',menu:'Tea'},{id:'old',menu:'抹茶白兰',review:'좋았음'}]};
  assert.deepEqual(searchPlace(place,'ＣＡＦＥ 抹茶').visits.map(v=>v.id),['old']);
  assert.equal(searchPlace(place,'Tea 抹茶').matches,false);
  assert.equal(searchPlace(place,'北京').matches,true);
});

test('stat rows and place ranking use identical matching visits', async()=>{
  const {rankStatPlaces}=await import('../public/statistics.js');
  const rows=[
    {id:'1',shopId:'a',name:'A',date:'2026-03-01',placeType:'카페',menuCategories:['음료','음료']},
    {id:'2',shopId:'a',name:'A',date:'2026-04-01',placeType:'카페',menuCategories:['음료']},
    {id:'3',shopId:'b',name:'B',date:'2026-05-01',placeType:'카페',menuCategories:['음료']},
  ];
  const row=summarize(rows).byMenuCategory[0];
  assert.equal(row.count,3);
  assert.deepEqual(rankStatPlaces(row.visits).map(p=>[p.id,p.visitCount,p.date]),[['a',2,'2026-04-01'],['b',1,'2026-05-01']]);
});
