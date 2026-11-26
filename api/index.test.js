import test from 'node:test';import assert from 'node:assert/strict';import {seal,unseal,normalize} from './index.js';
process.env.APP_SECRET='test-secret-012345678901234567890123456789';
test('share roundtrip, expiration and tampering',()=>{const input=[{name:'식당',menu:'포케'}],now=1000000,t=seal(input,now);assert.deepEqual(unseal(t,now),input);assert.throws(()=>unseal(t,now+8*86400000));const b=Buffer.from(t,'base64url');b[30]^=1;assert.throws(()=>unseal(b.toString('base64url'),now));});
test('Notion properties and privacy mapping',()=>{const r=normalize({id:'1',properties:{'상호명':{title:[{plain_text:'우키샌드위치'}]},'방문 날짜':{date:{start:'2026-11-23'}},'지역':{select:{name:'경기'}},'주문 메뉴':{rich_text:[{plain_text:'포케'}]},'일상 기록':{relation:[{id:'private'}]}}});assert.equal(r.name,'우키샌드위치');assert.equal(r.date,'2026-11-23');assert.equal(r.menu,'포케');assert.equal(r['일상 기록'],undefined);assert.deepEqual(r.photos,[]);});
test('map URLs allow only HTTPS known hosts and preserve address',()=>{const r=normalize({properties:{'주소':{rich_text:[{plain_text:'주소'}]},'네이버 지도':{url:'https://map.naver.com/p/search/test'},'Google Maps':{url:'javascript:alert(1)'}}});assert.equal(r.address,'주소');assert.equal(r.naverMap,'https://map.naver.com/p/search/test');assert.equal(r.googleMap,'');});
test('join uses master identity and current store metadata but preserves individual visit info',async()=>{const {joinVisits,clean}=await import('./index.js');const master={id:'m',properties:{'상호명':{title:[{plain_text:'새 상호'}]},'지역':{select:{name:'부산'}},'재방문 의사':{select:{name:'또 갈래'}}}};const visits=['v1','v2'].map((id,i)=>({id,properties:{'식당':{relation:[{id:'m'}]},'상호명':{title:[{plain_text:'이전 상호'}]},'방문 날짜':{date:{start:`2026-11-${14+i}`}},'주문 메뉴':{rich_text:[{plain_text:'메뉴'+i}]},'재방문 의사':{select:{name:'보통'}}}}));const joined=joinVisits(visits,[master]);assert.equal(joined.length,2);assert.equal(joined[0].shopId,'m');assert.equal(joined[0].name,'새 상호');assert.equal(joined[1].menu,'메뉴1');assert.equal(joined[0].revisit,'보통');assert.equal(joined[0].shopRevisit,'또 갈래');const shared=clean(joined[0],0);assert.equal(shared.group,0);for(const key of ['id','shopId','photos','address','naverMap','googleMap','일상 기록'])assert.equal(shared[key],undefined);assert.throws(()=>joinVisits(visits,[]));assert.throws(()=>joinVisits([{id:'x',properties:{'식당':{relation:[{id:'m'},{id:'other'}]}}}],[master]));});

test('records remain available when the restaurant data source is inaccessible', async t => {
  const {default: handler} = await import('./index.js');
  const previous = process.env.NOTION_TOKEN;
  process.env.NOTION_TOKEN = 'test';
  t.after(() => {
    if (previous === undefined) delete process.env.NOTION_TOKEN;
    else process.env.NOTION_TOKEN = previous;
  });
  const visit = {id:'visit', object:'page', properties:{}};
  t.mock.method(globalThis, 'fetch', async url => {
    if (url.includes('4226d8c5-8de1-81e8-9ace-000b3415e595')) {
      return new Response(null, {status:404});
    }
    return Response.json({results:[visit],has_more:false});
  });
  const res = {
    setHeader(){},
    end(payload){this.payload = JSON.parse(payload);},
  };
  await handler({method:'GET',url:'/api/index?action=records'},res);
  assert.equal(res.statusCode,200);
  assert.equal(res.payload.records[0].id,'visit');
  assert.equal(res.payload.records[0].shopRevisit,'');
  assert.ok(res.payload.warning);
});

test('Naver restaurant links use place detail when the URL includes a place ID', () => {
  const place = url => normalize({properties:{'네이버 지도':{url}}}).naverPlace;
  assert.equal(place('https://map.naver.com/p/search/cafe/place/12345'),'https://m.place.naver.com/restaurant/12345/home');
  assert.equal(place('https://pcmap.place.naver.com/restaurant/12345/review'),'https://m.place.naver.com/restaurant/12345/home');
  assert.equal(place('https://map.naver.com/p/search/cafe'),'');
  assert.equal(place('https://example.com/restaurant/12345'),'');
});

test('representative photo resolves via visit + unique filename, not stale signed URL or wrong index',async()=>{const {resolvePhotos}=await import('./index.js');const visits=[{id:'v',shopId:'s',date:'2026-11-01',photos:[{name:'b.jpg',url:'https://example.com/b'},{name:'a.jpg',url:'https://example.com/a'}]}],places=[{id:'s'}];const row=(id,name,order)=>({id,properties:{'식당':{relation:[{id:'s'}]},'방문 이력':{relation:[{id:'v'}]},'사진명':{title:[{plain_text:'식당 · 2026-11-01 · 1 · '+name}]},'대표 사진':{checkbox:true},'표시 순서':{number:order}}});resolvePhotos([row('p','a.jpg',1),row('q','b.jpg',2)],visits,places);assert.equal(places[0].cover.url,'https://example.com/a');const places2=[{id:'s'}];resolvePhotos([row('p','missing.jpg',1)],visits,places2);assert.equal(places2[0].cover,undefined);});
test('unvisited place and wishlist fields never leak in public snapshots',async()=>{const {normalizePlace,clean}=await import('./index.js');const p=normalizePlace({id:'s',properties:{'상호명':{title:[{plain_text:'샵'}]},'장소 유형':{select:{name:'소품·굿즈샵'}},'위시리스트':{checkbox:true},'여행 계획':{relation:[{id:'secret'}]}}});assert.equal(p.wishlist,true);assert.equal(p.placeType,'소품·굿즈샵');const snapshot=clean(p,0);for(const k of ['travelIds','checklistIds','wishlist','plannedDate','interest','reference','cover','photos'])assert.equal(snapshot[k],undefined);});
test('explicit brand relations attach to branches and visits, conflicts stay unmerged, share stays private',async()=>{const {attachBrands,clean}=await import('./index.js');const places=[{id:'a',shopId:'a'},{id:'b',shopId:'b'},{id:'c',shopId:'c'}],records=[{id:'v',shopId:'a'},{id:'w',shopId:'b'}];const brand=(id,name,ids)=>({id,properties:{'브랜드명':{title:[{plain_text:name}]},'지점':{relation:ids.map(id=>({id}))}}});assert.equal(attachBrands(places,records,[brand('h','호시노',['a','b']),brand('other','다른 브랜드',['b'])]),1);assert.equal(places[0].brandName,'호시노');assert.equal(records[0].brandId,'h');assert.equal(places[1].brandId,undefined);assert.equal(records[1].brandId,undefined);assert.equal(places[2].brandId,undefined);assert.equal(clean(records[0],0).brandId,undefined);assert.equal(clean(records[0],0).brandName,undefined);});

test('public archive hides private data while an authenticated private view can read it', async t => {
  const {default:handler}=await import('./index.js');
  const env={NOTION_TOKEN:'test',APP_PASSWORD:'fixture-long-password'};
  for(const [key,value] of Object.entries(env)){
    const previous=process.env[key];
    process.env[key]=value;
    t.after(()=>{if(previous===undefined)delete process.env[key];else process.env[key]=previous;});
  }
  const page=(id,properties)=>({id,object:'page',properties});
  const title=text=>({title:[{plain_text:text}]});
  const relation=id=>({relation:[{id}]});
  const places=[
    page('visited',{'상호명':title('Visited'),'추천·관심 정보':{rich_text:[{plain_text:'Public recommendation'}]},'위시리스트':{checkbox:true},'여행 계획':relation('trip')}),
    page('unvisited',{'상호명':title('Unvisited')}),
  ];
  const data={
    '4226d8c5-8de1-812a-abad-000b3a03e68e':[page('visit',{'식당':relation('visited'),'간단 후기':{rich_text:[{plain_text:'Private review'}]}})],
    '4226d8c5-8de1-81e8-9ace-000b3415e595':places,
    '4236d8c5-8de1-8160-8c51-000b130b7c7e':[page('wish',{'아이템명':title('Private wish'),'장소':relation('visited')})],
  };
  let wishQueries=0;
  t.mock.method(globalThis,'fetch',async url=>{
    const id=url.split('/').at(-2);
    if(id==='4236d8c5-8de1-8160-8c51-000b130b7c7e')wishQueries++;
    return Response.json({results:data[id]??[],has_more:false});
  });
  async function call(action,body,cookie){
    const headers={};
    const res={setHeader(key,value){headers[key]=value;},end(payload){this.payload=JSON.parse(payload);}};
    await handler({method:body?'POST':'GET',url:'/api/index?action='+action,body,headers:{cookie}},res);
    return {...res,headers};
  }
  const publicView=await call('records');
  assert.equal(publicView.statusCode,200);
  assert.equal(wishQueries,0);
  assert.deepEqual(publicView.payload.places.map(p=>p.id),['visited']);
  assert.equal(publicView.payload.places[0].travelIds,undefined);
  assert.equal(publicView.payload.places[0].wishlist,undefined);
  assert.deepEqual(publicView.payload.wishes,[]);
  assert.equal(publicView.payload.places[0].interest,'Public recommendation');
  assert.equal(publicView.payload.records[0].review,undefined);
  const oldToken=seal([{name:'Visited',review:'Private review'}]);
  assert.equal((await call('shared',{token:oldToken})).payload.records[0].review,undefined);
  const login=await call('login',{password:env.APP_PASSWORD});
  assert.equal(login.statusCode,200);
  const authenticated=await call('records',undefined,login.headers['Set-Cookie'].split(';')[0]);
  assert.deepEqual(authenticated.payload.places.map(p=>p.id),['visited','unvisited']);
  assert.deepEqual(authenticated.payload.places[0].travelIds,['trip']);
  assert.equal(authenticated.payload.wishes[0].name,'Private wish');
  assert.equal(authenticated.payload.records[0].review,'Private review');
  const newShare=await call('share',{ids:['visited']});
  assert.equal(newShare.statusCode,200);
  assert.equal(unseal(newShare.payload.token)[0].review,undefined);
});

test('Notion schema sync maps usage and operating status without inferring dates',async()=>{
  const {normalizePlace,joinVisits}=await import('./index.js');
  const select=name=>({select:{name}});
  const master={id:'p',properties:{'장소 유형':select('관광지'),'영업 상태':select('폐업'),'영업 상태 확인일':{date:{start:'2026-11-18T23:00:00-05:00'}},'재방문 의사':select('또 갈래')}};
  const place=normalizePlace(master);
  assert.equal(place.operatingStatus,'closed');
  assert.equal(place.operatingStatusCheckedAt,'2026-11-18');
  assert.equal(normalizePlace({properties:{'영업 상태 확인일':{date:{start:'2026-02-30'}}}}).operatingStatusCheckedAt,null);
  assert.equal(normalizePlace({properties:{'영업 상태':select('그 외')}}).operatingStatusRaw,'그 외');
  assert.equal(normalizePlace({}).operatingStatus,'unknown');
  const modes=[['매장 방문','onsite'],['포장','takeout'],['배달','delivery'],['온라인 구매','online'],['미확인','unknown'],['다른 방식','unknown']];
  for(const [raw,mode] of modes)assert.equal(normalize({properties:{'이용 방식':select(raw)}}).usageMode,mode);
  const [visit]=joinVisits([{id:'v',properties:{'식당':{relation:[{id:'p'}]},'이용 방식':select('배달'),'재방문 의사':select('보통'),'구매품':{rich_text:[{plain_text:'망고'}]}}}],[master]);
  assert.deepEqual([visit.usageMode,visit.placeType,visit.shopRevisit,visit.revisit,visit.menu,visit.purchases],['delivery','관광지','또 갈래','보통','','망고']);
});
