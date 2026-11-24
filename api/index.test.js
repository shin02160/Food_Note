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
