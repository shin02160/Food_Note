import {readFileSync} from 'node:fs';
import {normalizeCategory,menuNames,placeTypes} from '../public/statistics.js';

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
function checkOption(record,field,label){
  if(record[field+'FieldPresent']===false)emit('속성 누락',record.id,[],'정보 부족',label,'Notion 스키마와 연결 권한 확인');
  if(record[field+'Raw']&&record[field]==='unknown'&&record[field+'Raw']!=='미확인')emit('미지원 옵션',record.id,[],'검토 후보',label,'Notion 옵션과 앱 매핑 비교');
}
for(const place of places){
  checkOption(place,'operatingStatus','영업 상태');
  if(place.placeTypeFieldPresent===false)emit('속성 누락',place.id,[],'정보 부족','장소 유형','Notion 스키마 확인');
  if(place.placeTypeRaw&&!placeTypes.includes(place.placeTypeRaw))emit('미지원 옵션',place.id,[],'검토 후보','장소 유형','Notion 옵션과 앱 매핑 비교');
  if(place.operatingStatusDateFieldPresent===false)emit('속성 누락',place.id,[],'정보 부족','영업 상태 확인일','Notion 스키마 확인');
  if(place.operatingStatusCheckedAtRaw&&!place.operatingStatusCheckedAt)emit('유효하지 않은 날짜',place.id,[],'검토 후보','영업 상태 확인일','Notion 날짜 확인');
  const name=normalizeCategory(place.name).normalize('NFKC').toLowerCase();
  if(name)duplicates(placeKeys,JSON.stringify([name,place.region,place.area,place.address].map(normalizeCategory)),place.id,'장소 중복 후보');
  if(!place.address&&!place.naverPlace&&!place.googleMap)emit('주소·지도 누락',place.id,[],'정보 부족','주소와 지도 미입력','필요한 경우에만 보완');
}
for(const visit of records){
  checkOption(visit,'usageMode','이용 방식');
  if(!index.has(visit.shopId)){
    emit('방문 관계 누락',visit.id,[],'확정 오류','연결 장소를 찾을 수 없음','Notion 방문 이력의 장소 관계 확인');
    continue;
  }
  if(visit.date)duplicates(visitKeys,JSON.stringify([visit.shopId,visit.date,menuNames(visit.menu||visit.purchases).sort()]),visit.id,'방문 중복 후보');
  if(visit.revisit&&visit.date){
    const current=latestRated.get(visit.shopId);
    if(!current||visit.date>current.date)latestRated.set(visit.shopId,{date:visit.date,visits:[visit]});
    else if(visit.date===current.date)current.visits.push(visit);
  }
}
for(const [placeId,{visits}] of latestRated){
  if(new Set(visits.map(visit=>visit.revisit)).size>1){emit('동일 날짜 평가 충돌',placeId,visits.map(visit=>visit.id),'검토 후보','최신 날짜에 서로 다른 평가','방문 시점 확인');continue;}
  const [visit]=visits;
  const place=index.get(placeId);
  if(place.revisit&&place.revisit!==visit.revisit)emit('평가 불일치',placeId,[visit.id],'검토 후보','대표 평가와 최신 유효 방문 평가가 다름','대표 평가 정책에 따라 확인');
}
for(const photo of photoLinks){
  if(photo.representative)duplicates(covers,photo.shopId,photo.id,'대표 사진 중복 후보');
}
const totals={};
for(const issue of issues)totals[issue.severity]=(totals[issue.severity]||0)+1;
console.log(JSON.stringify({checked:{places:places.length,visits:records.length,photoLinks:photoLinks.length},totals,issues},null,2));
