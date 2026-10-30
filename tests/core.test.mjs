import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import fs from 'node:fs';
import {getSpeechFramework} from '../dist/speech.mjs';
import {parseNumber,normalizeDate,detectHeader,normalizeRows,inferPeriod,aggregate,summarize,selectRecords,safeUrl,categorize,getFramework,CATEGORY_NAMES} from '../dist/core.mjs';
const require=createRequire(import.meta.url);
const XLSX=require('../dist/vendor/xlsx.full.min.js');

assert.equal(parseNumber('¥1,234.56'),1234.56);
assert.equal(parseNumber('3.75万'),37500);
assert.equal(parseNumber(3.75,'直接成交金额（万元）'),37500);
assert.equal(parseNumber('2.5万','直接成交金额（万元）'),25000);
assert.equal(parseNumber('0'),0);
assert.equal(parseNumber('—'),null);
assert.equal(parseNumber('10%'),null);
assert.equal(parseNumber('(123.45)'),-123.45);
assert.equal(normalizeDate('2026/10/28 18:47'),'2026-10-28');
assert.equal(normalizeDate('2026-02-30'),null);
assert.equal(normalizeDate(46323),'2026-10-28');
assert.equal(safeUrl('javascript:alert(1)'), '');
assert.equal(categorize('牛仔外套 #百搭裤子').name,'外套');
assert.equal(categorize('日常穿搭').name,'待识别');
assert.equal(categorize('牛仔裤','自定义品类').name,'自定义品类');
for(const category of [...CATEGORY_NAMES,'自定义品类']){
  const framework=getFramework(category);
  assert.ok(framework.shots.length>=3,category+' has usable footage suggestions');
  assert.ok(framework.shots.every(shot=>shot.type&&shot.use),category+' has shot types and selection guidance');
  assert.ok(!/拍摄|复拍|怎么拍/.test(JSON.stringify(framework)),category+' uses footage-editing language');
  assert.equal(framework.hook,undefined);
  assert.equal(framework.steps,undefined);
}
assert.ok(getFramework('牛仔裤').shots.some(shot=>shot.type==='全身展示'));
assert.ok(getFramework('牛仔裤').shots.some(shot=>shot.type==='下半身展示'));
assert.ok(getFramework('外套').shots.some(shot=>shot.type==='半身展示'));
assert.ok(getFramework('外套').shots.some(shot=>shot.type==='细节近景'));
const speechSamples=[{title:'显瘦牛仔裤',gmv:100,orders:1},{title:'百搭牛仔裤',gmv:0,orders:0},{title:'修饰腿型牛仔裤',gmv:null,orders:2},{title:'',gmv:300,orders:3}];
const speech=getSpeechFramework('牛仔裤',speechSamples,'gmv');
assert.equal(speech.sampleSize,1);
assert.equal(speech.signals.find(s=>s.word==='显瘦').count,1);
assert.ok(!speech.signals.some(s=>s.word==='百搭'));
assert.equal(getSpeechFramework('牛仔裤',speechSamples,'orders').sampleSize,2);
assert.ok(getSpeechFramework('自定义品类',[]).basis.includes('没有'));
for(const c of CATEGORY_NAMES){
  const s=getSpeechFramework(c,speechSamples);
  assert.ok(s.stages.length>=4&&s.stages.every(stage=>stage.label&&stage.detail));
  assert.ok(s.opening&&s.angle&&s.note.includes('不是原片口播转写'));
}

const input=[['周度报表'],['作品标题','作品ID','直接成交金额','成交订单数','发布时间','播放链接'],['显瘦牛仔裤','a','¥998',2,'2026/10/01','https://www.douyin.com/video/a'],['灯芯绒休闲裤','b','¥499',1,'2026/09/01',''],['','','¥0',0,'',''],['缺失金额','c','—',5,'2026/10/04',''],['显瘦牛仔裤','a','¥998',2,'2026/10/01','https://www.douyin.com/video/a'],['合计','','¥2495',10,'','']];
const header=detectHeader(input);assert.equal(header.index,1);
const clean=normalizeRows(input,header.index,header.mapping,true);
assert.equal(clean.records.length,4);assert.equal(clean.removedExact,1);assert.equal(clean.skippedTotals,1);
const total=summarize(clean.records);assert.equal(total.gmv,1497);assert.equal(total.orders,8);assert.equal(total.missing.gmv,1);assert.equal(total.avgOrder,499);
const groups=aggregate(clean.records);assert.equal(groups.reduce((s,g)=>s+g.gmv,0),1497);
const period=inferPeriod('[20261001-20261030]_测试.xlsx',clean.records);
assert.equal(period.start,'2026-10-01');assert.equal(period.end,'2026-10-30');
assert.equal(selectRecords(clean.records,{scope:'new',account:'all',period}).length,2);
assert.equal(selectRecords(clean.records,{scope:'old',account:'all',period}).length,1);
assert.equal(normalizeRows(input,header.index,header.mapping,false).duplicates.length,1);

const metricOnly=[['商品类目','订单数'],['食品饮料',5],['护肤',null]];
const m=detectHeader(metricOnly),o=normalizeRows(metricOnly,m.index,m.mapping);
assert.equal(o.records.length,2);assert.equal(summarize(o.records).gmv,null);assert.equal(aggregate(o.records,'orders')[0].name,'食品饮料');

if(process.argv[2]){
  const wb=XLSX.read(fs.readFileSync(process.argv[2]),{type:'buffer',raw:true});
  const rows=XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{header:1,raw:true,defval:null,blankrows:true});
  const head=detectHeader(rows),result=normalizeRows(rows,head.index,head.mapping),s=summarize(result.records),g=aggregate(result.records);
  assert.equal(g.reduce((sum,x)=>sum+x.count,0),s.count);
  assert.ok(Math.abs(g.reduce((sum,x)=>sum+(x.gmv??0),0)-(s.gmv??0))<0.01);
  assert.equal(g.reduce((sum,x)=>sum+(x.orders??0),0),s.orders??0);
  const p=inferPeriod(process.argv[2],result.records),n=selectRecords(result.records,{scope:'new',account:'all',period:p});
  const old=selectRecords(result.records,{scope:'old',account:'all',period:p});
  assert.ok(n.length+old.length<=s.count);
  console.log('本地工作簿解析、品类汇总对账与发布时间拆分检查通过。');
}
console.log('数字单位、缺失值、日期边界、重复行、字段识别、范围筛选和汇总检查通过。');
