import {readFileSync} from 'node:fs';
import {normalizeCategory,menuNames} from '../public/statistics.js';

const input=JSON.parse(readFileSync(0,'utf8').trim());
const {places=[],records=[],photoLinks=[]}=input;
const issues=[];
const emit=(issueType,entityId,relatedIds,severity,evidence,suggestedAction)=>{
  issues.push({issueType,entityId,relatedIds,severity,evidence,suggestedAction});
};
const index=new Map(places.map(place=>[place.id,place]));
const placeKeys=new Map(),visitKeys=new Map(),latestRated=new Map(),covers=new Map();
function duplicates(map,key,id,type){
  const previous=map.get(key);
  if(previous&&previous!==id)emit(type,id,[previous],'검토 후보','동일 비교 키','원본을 비교해 확인');
  else map.set(key,id);
}
for(const place of places){
  const name=normalizeCategory(place.name).normalize('NFKC').toLowerCase();
  if(name)duplicates(placeKeys,JSON.stringify([name,place.region,place.area,place.address].map(normalizeCategory)),place.id,'장소 중복 후보');
  if(!place.address&&!place.naverPlace&&!place.googleMap)emit('주소·지도 누락',place.id,[],'정보 부족','주소와 지도 미입력','필요한 경우에만 보완');
}
for(const visit of records){
  if(!index.has(visit.shopId)){
    emit('방문 관계 누락',visit.id,[],'확정 오류','연결 장소를 찾을 수 없음','Notion 방문 이력의 장소 관계 확인');
    continue;
  }
  if(visit.date)duplicates(visitKeys,JSON.stringify([visit.shopId,visit.date,menuNames(visit.menu||visit.purchases).sort()]),visit.id,'방문 중복 후보');
  if(visit.revisit&&visit.date){
    const current=latestRated.get(visit.shopId);
    if(!current||visit.date>current.date||(visit.date===current.date&&String(visit.id)<String(current.id)))latestRated.set(visit.shopId,visit);
  }
}
for(const [placeId,visit] of latestRated){
  const place=index.get(placeId);
  if(place.revisit&&place.revisit!==visit.revisit)emit('평가 불일치',placeId,[visit.id],'검토 후보','대표 평가와 최신 유효 방문 평가가 다름','대표 평가 정책에 따라 확인');
}
for(const photo of photoLinks){
  if(photo.representative)duplicates(covers,photo.shopId,photo.id,'대표 사진 중복 후보');
}
const totals={};
for(const issue of issues)totals[issue.severity]=(totals[issue.severity]||0)+1;
console.log(JSON.stringify({checked:{places:places.length,visits:records.length,photoLinks:photoLinks.length},totals,issues},null,2));
