// Public video identities are independent of workbook row order and sales amounts.
export function videoKey(record){
  const url=String(record.url||'');
  try{const u=new URL(url);if(/(^|\.)douyin\.com$/.test(u.hostname)||u.hostname==='iesdouyin.com'||u.hostname==='www.iesdouyin.com'){const id=u.pathname.match(/\/(?:video|share\/video)\/(\d{15,22})/)?.[1]||u.searchParams.get('modal_id');if(/^\d{15,22}$/.test(id||''))return `douyin:${id}`;}}catch{}
  if(/^\d{15,22}$/.test(String(record.id||'')))return `douyin:${record.id}`;
  return '';
}
export const needsReview=r=>(r.gmv??0)>0||(r.orders??0)>0;
export function applyEvidence(record,result){
  record.analysis=result;
  record.mainProduct=result?.mainProduct||'';
  if(record.categorySource==='手动修正')return record;
  const confirmed=result?.status==='confirmed'&&result.mainProduct&&result.category&&result.category!=='待识别'&&result.evidence?.length;
  record.category=confirmed?result.category:'待识别';
  record.categorySource=confirmed?(result.method==='manual'?'字幕与画面人工核验':'视频内容自动核验'):(result?.reason||'尚未取得视频内容证据');
  return record;
}
export function prepareRecords(records,reviews){
  for(const r of records){
    r.titleCategory=r.category;
    const known=reviews[videoKey(r)];
    if(known)applyEvidence(r,known);
    else applyEvidence(r,{status:needsReview(r)?'pending':'not_reviewed',mainProduct:'',category:'待识别',evidence:[],reason:needsReview(r)?'等待视频内容核验':'零成交视频未做付费核验'});
  }
  return records;
}
export function evidenceCoverage(records){
  const positive=records.filter(needsReview),confirmed=positive.filter(r=>r.analysis?.status==='confirmed'&&r.category!=='待识别'&&r.categorySource!=='手动修正'),unknown=positive.filter(r=>r.category==='待识别');
  const sum=(rs,k)=>rs.reduce((v,r)=>v+(r[k]??0),0);
  return {positive:positive.length,confirmed:confirmed.length,manual:positive.filter(r=>r.categorySource==='手动修正').length,unknown:unknown.length,unknownGmv:sum(unknown,'gmv'),unknownOrders:sum(unknown,'orders'),confirmedGmv:sum(confirmed,'gmv'),positiveGmv:sum(positive,'gmv')};
}
export function analysisPayload(records){
  const unique=new Map();
  for(const r of records.filter(needsReview))if(r.analysis?.status==='pending'){
    const key=videoKey(r);if(!key)continue;
    unique.set(key,{key,url:`https://www.douyin.com/video/${key.slice(7)}`,id:r.id,title:r.title.slice(0,600)});
  }
  return [...unique.values()];
}
export const evidenceText=r=>(r.analysis?.evidence||[]).map(e=>`${e.seconds===null||e.seconds===undefined?'':`${e.seconds}秒 `}${e.text||''}`).join('；');
