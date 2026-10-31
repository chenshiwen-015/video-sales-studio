import {analysisPayload,applyEvidence,videoKey} from './evidence.mjs';
const pause=(ms,signal)=>new Promise((resolve,reject)=>{const id=setTimeout(done,ms);function done(){signal?.removeEventListener('abort',abort);resolve();}function abort(){clearTimeout(id);reject(new DOMException('Cancelled','AbortError'));}if(signal?.aborted)abort();else signal?.addEventListener('abort',abort,{once:true});});
export async function analyzeRecords(records,{base='',signal,onProgress=()=>{},request=fetch}={}){
  const videos=analysisPayload(records);let completed=0;
  const read=async(path,options={})=>{
    const response=await request(base+path,{...options,signal:AbortSignal.any([signal||new AbortController().signal,AbortSignal.timeout(90000)])});
    const data=await response.json();if(!response.ok)throw new Error(data.error||`分析服务返回 HTTP ${response.status}`);return data;
  };
  try{
    for(let start=0;start<videos.length;start+=25){
      const batch=videos.slice(start,start+25),job=await read('/api/analyze',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({videos:batch})});let done=0;const began=Date.now();
      while(true){
        if(signal?.aborted)throw new DOMException('Cancelled','AbortError');
        const progress=await read('/api/jobs/'+job.id);
        for(const r of records){const result=progress.results[videoKey(r)];if(result)applyEvidence(r,result);}
        done=progress.completed;onProgress(completed+done,videos.length);
        if(progress.done)break;
        if(Date.now()-began>35*60000)throw new Error('本批视频分析超时，请稍后重试');
        await pause(3000,signal);
      }
      completed+=done;
    }
    for(const r of records)if(r.analysis?.status==='pending')applyEvidence(r,{status:'unavailable',category:'待识别',mainProduct:'',evidence:[],reason:'缺少可读取的抖音视频链接或作品 ID'});
    return {completed,total:videos.length};
  }catch(e){
    if(e.name==='AbortError'||signal?.aborted)throw e;
    for(const r of records)if(r.analysis?.status==='pending')applyEvidence(r,{status:'unavailable',category:'待识别',mainProduct:'',evidence:[],reason:'自动核验未完成：'+e.message});
    return {completed,total:videos.length,error:e.message};
  }
}
