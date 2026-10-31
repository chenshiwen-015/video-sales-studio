import test from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {prepareRecords,applyEvidence,analysisPayload,evidenceCoverage,videoKey} from '../dist/evidence.mjs';
import {REVIEWED_VIDEOS} from '../dist/reviewed-videos.mjs';
import {summarize,aggregate} from '../dist/core.mjs';
import {getSpeechFramework} from '../dist/speech.mjs';
import {analyzeRecords} from '../dist/auto-analysis.mjs';
import {publicAddress,validateUrl} from '../server/network.mjs';
import {findVideo,jsonObjects,mediaFromObject} from '../server/extract.mjs';
import {validateAnalysis} from '../server/analyzer.mjs';
import {createApp} from '../server/index.mjs';
const sample=()=>[{title:'#牛仔裤',url:'https://www.douyin.com/video/7687559670814346523',gmv:50,orders:2,category:'牛仔裤',categorySource:'标题关键词'},{title:'#灯芯绒',id:'7999999999999999991',gmv:20,orders:1,category:'灯芯绒裤',categorySource:'标题关键词'}];
const confirmed={status:'confirmed',mainProduct:'项链',category:'配饰包帽',confidence:.96,evidence:[{source:'visual',text:'手持项链展示扣头',seconds:2}],speechStages:[],reason:'主讲项链'};
test('real content overrides misleading tags; totals remain unchanged and unknown stays separate',()=>{const rows=sample(),before=summarize(rows);prepareRecords(rows,REVIEWED_VIDEOS);assert.equal(rows[0].category,'灯芯绒裤');assert.equal(rows[0].mainProduct,'灯芯绒工装裤');assert.equal(rows[1].category,'待识别');assert.equal(summarize(rows).gmv,before.gmv);assert.equal(summarize(rows).orders,before.orders);assert.equal(aggregate(rows).reduce((v,g)=>v+g.gmv,0),70);assert.equal(evidenceCoverage(rows).unknownGmv,20);});
test('manual overrides survive delayed AI results',()=>{const r=sample()[1];r.category='鞋靴';r.categorySource='手动修正';applyEvidence(r,confirmed);assert.equal(r.category,'鞋靴');assert.equal(r.categorySource,'手动修正');});
test('only public content metadata crosses the backend boundary; duplicate IDs deduplicate',()=>{const rows=sample();rows.push({...rows[1],account:'private account',gmv:999,orders:9});prepareRecords(rows,REVIEWED_VIDEOS);const payload=analysisPayload(rows);assert.equal(payload.length,1);assert.deepEqual(Object.keys(payload[0]).sort(),['id','key','title','url']);assert.ok(!JSON.stringify(payload).includes('private account'));assert.equal(videoKey({url:'https://evil.example/video/7687559670814346523'}),'');});
test('no source evidence cannot confirm category; audio claims cannot survive frame-only analysis',()=>{const r=validateAnalysis({...confirmed,evidence:[{source:'audio',text:'这条项链',seconds:null}]},{hasFrames:true});assert.equal(r.status,'provisional');assert.equal(r.category,'待识别');assert.equal(validateAnalysis(confirmed,{hasFrames:true}).category,'配饰包帽');});
test('recommendation video objects never become evidence for requested ID',()=>{const source='<script>window._ROUTER_DATA = '+JSON.stringify({recommend:{aweme_id:'111',video:{play_addr:{url_list:['https://cdn.example/wrong.mp4']}}},detail:{aweme_id:'222',desc:'actual',video:{play_addr:{url_list:['https://cdn.example/right.mp4']}}}})+';</script>';const obj=findVideo(jsonObjects(source),'222');assert.equal(mediaFromObject(obj).title,'actual');assert.equal(findVideo(jsonObjects(source),'333'),null);});
test('SSRF blocks credentials, local addresses and mapped private IPs',()=>{for(const ip of ['127.0.0.1','10.0.0.1','169.254.169.254','192.168.1.1','172.20.0.1','100.64.0.1','::1','::ffff:127.0.0.1','fc00::1'])assert.equal(Boolean(publicAddress(ip)),false,ip);assert.ok(publicAddress('8.8.8.8'));for(const url of ['http://example.com','https://x:y@example.com','https://example.com:8443','https://localhost/'])assert.throws(()=>validateUrl(url));});
test('speech analysis retains observed content separately from suggested structure',()=>{const rows=sample();prepareRecords(rows,REVIEWED_VIDEOS);const speech=getSpeechFramework('灯芯绒裤',rows);assert.equal(speech.observed.length,1);assert.ok(speech.observed[0].detail.includes('灯芯绒'));assert.ok(speech.stages.length>=3);});
test('API jobs deduplicate analysis and preserve explicit errors; frontend integrates without financial payload',async()=>{
  let calls=0;const server=createApp({analyzer:async()=>{calls++;return confirmed;}});server.listen(0,'127.0.0.1');await once(server,'listening');const base=`http://127.0.0.1:${server.address().port}`;
  try{
    const rows=sample();prepareRecords(rows,REVIEWED_VIDEOS);const result=await analyzeRecords(rows,{base});assert.equal(result.completed,1);assert.equal(rows[1].category,'配饰包帽');assert.equal(calls,1);
    const second=sample();prepareRecords(second,REVIEWED_VIDEOS);await analyzeRecords(second,{base});assert.equal(calls,1);
    const forbidden=await fetch(base+'/healthz',{headers:{Origin:'https://evil.example'}});assert.equal(forbidden.status,403);
    const bad=await fetch(base+'/api/analyze',{method:'POST',body:JSON.stringify({videos:[{url:'https://localhost/'}]})});assert.equal(bad.status,400);
    const oversized=await fetch(base+'/api/analyze',{method:'POST',body:' '.repeat(110000)});assert.equal(oversized.status,413);
    const secret=await fetch(base+'/.env.local');assert.equal(secret.status,404);
  }finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
});
test('backend offline returns explicit unknown, never title fallback; cancelled uploads cannot apply results',async()=>{
  const rows=sample();prepareRecords(rows,REVIEWED_VIDEOS);const r=await analyzeRecords(rows,{request:async()=>{throw new Error('offline');}});assert.equal(r.error,'offline');assert.equal(rows[1].category,'待识别');assert.equal(rows[0].category,'灯芯绒裤');
  const pending=sample();prepareRecords(pending,REVIEWED_VIDEOS);const controller=new AbortController();controller.abort();await assert.rejects(analyzeRecords(pending,{signal:controller.signal,request:async()=>{throw new DOMException('Cancelled','AbortError');}}));assert.equal(pending[1].category,'待识别');
});
