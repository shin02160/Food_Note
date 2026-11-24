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
