import http from 'node:http';
import {randomBytes} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve,extname} from 'node:path';
import {REVIEWED_VIDEOS} from '../dist/reviewed-videos.mjs';
import {videoKey} from '../dist/evidence.mjs';
import {analyzeVideo} from './analyzer.mjs';
const root=fileURLToPath(new URL('../dist/',import.meta.url));
export function createApp({analyzer=analyzeVideo,origins=(process.env.ALLOWED_ORIGINS||'https://video-sales-studio.onrender.com,http://localhost:3000,http://127.0.0.1:3000').split(','),dailyLimit=Number(process.env.DAILY_VIDEO_LIMIT||400)}={}){
  const jobs=new Map(),cache=new Map(),pending=new Map(),rates=new Map();let active=0,used=0,day=new Date().toISOString().slice(0,10);const queue=[];
  const execute=()=>{while(active<2&&queue.length){const task=queue.shift();active++;task().finally(()=>{active--;execute();});}};
  const getResult=item=>{
    const key=videoKey(item),known=REVIEWED_VIDEOS[key];if(known)return Promise.resolve(known);
    const cached=cache.get(key);if(cached&&cached.expires>Date.now())return Promise.resolve(cached.result);
    if(pending.has(key))return pending.get(key);
    const today=new Date().toISOString().slice(0,10);if(today!==day){day=today;used=0;}
    if(used>=dailyLimit)return Promise.resolve({status:'unavailable',category:'待识别',mainProduct:'',evidence:[],speechStages:[],reason:'当天自动核验数量达到上限，请明天重试'});
    used++;
    const promise=new Promise(resolveResult=>{queue.push(async()=>{
      let result;try{result=await analyzer(item);}catch(e){result={status:'unavailable',mainProduct:'',category:'待识别',evidence:[],speechStages:[],reason:e.code?e.message:'视频内容读取失败：'+String(e.message).slice(0,180),errorCode:e.code||'media_unavailable'};}
      cache.set(key,{result,expires:Date.now()+(result.status==='confirmed'?30*86400000:600000)});pending.delete(key);resolveResult(result);
      if(cache.size>2000)cache.delete(cache.keys().next().value);
    });execute();});pending.set(key,promise);return promise;
  };
  const cleanup=setInterval(()=>{for(const [id,j] of jobs)if(j.expires<Date.now())jobs.delete(id);for(const [ip,r]of rates)if(r.reset<Date.now())rates.delete(ip);},60000);cleanup.unref();
  const server=http.createServer(async(req,res)=>{
    const origin=req.headers.origin,allowed=!origin||origins.includes(origin);const path=new URL(req.url,'http://localhost').pathname;
    const send=(code,data)=>{res.writeHead(code,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...(origin&&allowed?{'Access-Control-Allow-Origin':origin,Vary:'Origin'}:{})});res.end(JSON.stringify(data));};
    if(!allowed)return send(403,{error:'请求来源未授权'});
    if(req.method==='OPTIONS'){res.writeHead(204,{'Access-Control-Allow-Origin':origin||origins[0],'Access-Control-Allow-Methods':'GET, POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type',Vary:'Origin'});return res.end();}
    if(path==='/healthz')return send(200,{ok:true,configured:Boolean(process.env.OPENAI_API_KEY),version:'2.0.0',reviewed:Object.keys(REVIEWED_VIDEOS).length});
    if(req.method==='POST'&&path==='/api/analyze'){
      const ip=req.socket.remoteAddress;let rate=rates.get(ip);if(!rate||rate.reset<Date.now()){rate={n:0,reset:Date.now()+3600000};rates.set(ip,rate);}if(++rate.n>40)return send(429,{error:'请求过多，请稍后重试'});
      if(jobs.size>=100)return send(503,{error:'分析任务较多，请稍后重试'});
      try{
        let body='',length=0;for await(const chunk of req){length+=chunk.length;if(length>100000){send(413,{error:'请求内容过大'});return;}body+=chunk.toString();}
        const input=JSON.parse(body);if(!Array.isArray(input.videos)||!input.videos.length||input.videos.length>25)return send(400,{error:'每批应为 1 至 25 条视频'});
        const unique=new Map();for(const item of input.videos){if(!item||typeof item!=='object')continue;const clean={url:String(item.url||'').slice(0,2000),id:String(item.id||'').slice(0,30),title:String(item.title||'').slice(0,1200)},key=videoKey(clean);if(!key)return send(400,{error:'缺少有效抖音视频链接或作品 ID'});unique.set(key,clean);}
        if(!unique.size)return send(400,{error:'没有有效视频'});
        const id=randomBytes(24).toString('hex'),job={total:unique.size,completed:0,results:{},expires:Date.now()+7200000};jobs.set(id,job);
        for(const [key,item]of unique)getResult(item).then(result=>{job.results[key]=result;job.completed++;});
        return send(202,{id,total:job.total});
      }catch{return send(400,{error:'无法读取分析请求'});}
    }
    if(req.method==='GET'&&path.startsWith('/api/jobs/')){const id=path.slice(10);const job=jobs.get(id);return job?send(200,{total:job.total,completed:job.completed,done:job.completed===job.total,results:job.results}):send(404,{error:'任务已过期，请重新上传分析'});}
    if(path.startsWith('/api/'))return send(404,{error:'接口不存在'});
    if(req.method!=='GET'&&req.method!=='HEAD')return send(405,{error:'请求方式不支持'});
    try{const file=resolve(root,'.'+decodeURIComponent(path==='/'?'/index.html':path));if(!file.startsWith(root)||file.split('/').some(x=>x.startsWith('.')))return send(404,{error:'页面不存在'});const data=await readFile(file);res.writeHead(200,{'Content-Type':({'.html':'text/html; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml'})[extname(file)]||'application/octet-stream','X-Content-Type-Options':'nosniff'});res.end(req.method==='HEAD'?undefined:data);}catch{send(404,{error:'页面不存在'});}
  });server.on('close',()=>clearInterval(cleanup));server.requestTimeout=15000;return server;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))createApp().listen(Number(process.env.PORT||3000),'0.0.0.0',()=>console.log('Video sales studio listening; version 2.0.0'));
