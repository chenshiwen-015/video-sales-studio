import {FIELDS,COLORS,CATEGORY_NAMES,matchHeaders,detectHeader,normalizeRows,parseNumber,normalizeDate,inferPeriod,cohort,summarize,aggregate,selectRecords,buildReportData,getFramework,keywords,money,compactMoney,pct,safeUrl} from './core.mjs';
import {downloadWord} from './report.mjs';
import {getSpeechFramework} from './speech.mjs';
import {prepareRecords,evidenceCoverage,evidenceText} from './evidence.mjs';
import {REVIEWED_VIDEOS} from './reviewed-videos.mjs';
import {analyzeRecords} from './auto-analysis.mjs';
import {API_BASE} from './config.mjs';

const $=id=>document.getElementById(id);
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const paths={grid:'<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',chart:'<path d="M4 3v17h17M8 15v-4m5 4V6m5 9V9"/>',layers:'<path d="m12 3 9 5-9 5-9-5 9-5Zm-9 9 9 5 9-5M3 16l9 5 9-5"/>',table:'<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M3 14h18M9 4v16"/>',shield:'<path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3Z"/><path d="m8 12 3 3 5-6"/>',lock:'<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3m-4 5v2"/>',spark:'<path d="m12 3 2.4 6.6L21 12l-6.6 2.4L12 21l-2.4-6.6L3 12l6.6-2.4L12 3Z"/>',play:'<path d="m9 5 11 7-11 7V5Z"/>',upload:'<path d="M12 16V3m-5 5 5-5 5 5M4 16v4a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-4"/>',download:'<path d="M12 3v13m-5-5 5 5 5-5M4 16v4a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-4"/>',file:'<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9l-6-6Z"/><path d="M14 3v6h6M8 13h8m-8 4h5"/>',info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10v1"/>',sliders:'<path d="M4 6h8m4 0h4M4 12h2m4 0h10M4 18h10m4 0h2"/><circle cx="14" cy="6" r="2"/><circle cx="8" cy="12" r="2"/><circle cx="16" cy="18" r="2"/>',search:'<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',chevron:'<path d="m7 10 5 5 5-5"/>',money:'<path d="m8 3 4 6 4-6M5 10h14M5 15h14m-7-6v12"/>',cart:'<path d="M3 4h2l3 12h10l3-9H6m3 13h1m7 0h1"/>',clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l4 2"/>'};
const icon=name=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name]||paths.chart}</svg>`;
function icons(root=document){root.querySelectorAll('[data-icon]').forEach(el=>el.innerHTML=icon(el.dataset.icon));}
icons();
const state={filename:'',sheets:{},sheet:'',headerIndex:0,mapping:{},records:[],quality:{},period:null,scope:'all',account:'all',metric:'gmv',demo:false,page:1,search:'',categoryFilter:'all',unknownOnly:false,overrides:new Map(),report:null};
let toastTimer,analysisController,generation=0,analyzing=false;
function cancelAnalysis(){generation++;analysisController?.abort();analyzing=false;}
async function runAnalysis(){
  const current=++generation;analysisController?.abort();analysisController=new AbortController();analyzing=true;render();
  message('正在核验视频主讲品、字幕与画面…',true);
  try{const result=await analyzeRecords(state.records,{base:API_BASE,signal:analysisController.signal,onProgress:(n,total)=>{if(current!==generation)return;message(`正在核验新视频 ${n} / ${total}，已完成的结果已更新…`,true);render();}});
    if(current!==generation)return;analyzing=false;render();const c=evidenceCoverage(state.records);
    message(result.error?`已保留已核验结果；新视频自动核验未完成：${result.error}。未确认的成交留在“待识别”。`:`分析完成：${c.confirmed} / ${c.positive} 条有成交视频已核验，${c.unknown} 条待确认。`);
  }catch(e){if(current===generation&&e.name!=='AbortError'){analyzing=false;message('分析未完成：'+e.message);render();}}
}
function toast(text){$('toast').textContent=text;$('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').hidden=true,3500);}
function message(text,loading=false){$('message').textContent=text;$('message').className=loading?'loading':'';$('message').hidden=!text;}
function chooseFile(){$('file-input').click();}
for(const id of ['upload-btn','demo-upload'])$(id).addEventListener('click',chooseFile);
$('file-input').addEventListener('change',e=>{if(e.target.files[0])loadFile(e.target.files[0]);e.target.value='';});
const drop=$('dropzone');drop.addEventListener('click',chooseFile);drop.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();chooseFile();}});
for(const event of ['dragenter','dragover'])drop.addEventListener(event,e=>{e.preventDefault();drop.classList.add('dragover');});
for(const event of ['dragleave','drop'])drop.addEventListener(event,e=>{e.preventDefault();drop.classList.remove('dragover');});
drop.addEventListener('drop',e=>{if(e.dataTransfer.files.length>1){message('每次请选择一份数据表；工作簿内可以包含多个工作表。');return;}if(e.dataTransfer.files[0])loadFile(e.dataTransfer.files[0]);});

async function loadFile(file){
  if(!/\.(xlsx|xls|csv)$/i.test(file.name)){message('请选择 .xlsx、.xls 或 .csv 数据表。');return;}
  if(file.size>20*1024*1024){message('文件超过 20 MB，请先精简工作表后重试。');return;}
  if(!globalThis.XLSX){message('表格解析组件尚未就绪，请稍后重试或刷新页面。');return;}
  message('正在读取工作簿并识别数据字段…',true);$('upload-btn').disabled=true;
  try{
    const buffer=await file.arrayBuffer();let input=buffer,type='array';
    if(/\.csv$/i.test(file.name)){input=new TextDecoder('utf-8').decode(buffer);if(input.includes('\uFFFD'))input=new TextDecoder('gb18030').decode(buffer);type='string';}
    const wb=XLSX.read(input,{type,cellDates:false,raw:true});
    const sheets={};
    for(const name of wb.SheetNames){const ws=wb.Sheets[name];if(!ws['!ref'])continue;const range=XLSX.utils.decode_range(ws['!ref']);if(range.e.r>100000||range.e.c>500)throw new Error('工作表范围过大。请保留最多 100,000 行、500 列后重试。');sheets[name]=XLSX.utils.sheet_to_json(ws,{header:1,range:0,raw:true,defval:null,blankrows:true});}
    const names=Object.keys(sheets);if(!names.length)throw new Error('工作簿中没有可分析的数据。');
    let sheet=names[0],best=-1;for(const n of names){const score=detectHeader(sheets[n]).score;if(score>best){best=score;sheet=n;}}
    state.records=[];state.report=null;$('dashboard').hidden=true;$('empty-state').hidden=false;
    state.sheets=sheets;state.sheet=sheet;state.filename=file.name;state.demo=false;state.overrides.clear();
    const header=detectHeader(sheets[sheet]);state.headerIndex=header.index;state.mapping=header.mapping;
    state.scope='all';state.account='all';state.metric=state.mapping.gmv>=0?'gmv':'orders';
    if(mappingValid(state.mapping)){applyMapping(true);toast('数据已读取，正在核验视频内容');}
    else {message('需要对应少量字段，确认后即可开始分析。');openMapping();}
  }catch(err){message(`无法读取数据表：${err.message||'请检查文件格式后重试。'}`);}
  finally{$('upload-btn').disabled=false;}
}
const mappingValid=m=>(m.title>=0||m.category>=0)&&(m.gmv>=0||m.orders>=0);
function applyMapping(resetPeriod=false){
  if(!mappingValid(state.mapping))throw new Error('请选择标题或品类，并至少对应一项成交指标。');
  const result=normalizeRows(state.sheets[state.sheet],state.headerIndex,state.mapping,$('dedupe-check').checked);
  if(!result.records.length)throw new Error('标题行下方未找到有效数据，请检查工作表和标题所在行。');
  cancelAnalysis();state.records=result.records;state.quality=result;
  if(!state.demo)prepareRecords(state.records,REVIEWED_VIDEOS);
  for(const r of state.records){const value=state.overrides.get(`${state.sheet}:${r.row}`);if(value){r.category=value;r.categorySource='手动修正';}}
  if(resetPeriod||!state.period)state.period=inferPeriod(state.filename,state.records);
  state.page=1;state.search='';state.categoryFilter='all';state.unknownOnly=false;$('search-input').value='';$('unknown-only').checked=false;
  state.account='all';$('account-select').innerHTML='<option value="all">全部账号</option>'+[...new Set(state.records.map(r=>r.account))].map(v=>`<option value="${esc(v)}">${esc(v)}</option>`).join('');
  $('start-date').value=state.period.start;$('end-date').value=state.period.end;
  if(state.mapping[state.metric]<0)state.metric=state.mapping.gmv>=0?'gmv':'orders';
  $('empty-state').hidden=true;$('dashboard').hidden=false;$('demo-banner').hidden=!state.demo;
  $('dataset-name').textContent=state.filename;$('dataset-meta').textContent=`${state.sheet} · ${state.records.length.toLocaleString()} 条有效记录 · 成交数据留在当前页面`;
  render();
  if(!state.demo)void runAnalysis();
}
function openMapping(){
  if(!Object.keys(state.sheets).length){toast('请先上传一份数据表');return;}
  $('mapping-error').textContent='';$('sheet-select').innerHTML=Object.keys(state.sheets).map(name=>`<option value="${esc(name)}" ${name===state.sheet?'selected':''}>${esc(name)}</option>`).join('');
  $('header-row').value=state.headerIndex+1;renderMappingFields(state.mapping);$('mapping-dialog').showModal();
}
function renderMappingFields(mapping){
  const sheet=$('sheet-select').value||state.sheet,idx=Number($('header-row').value)-1,headers=state.sheets[sheet]?.[idx]||[];
  $('mapping-fields').innerHTML=FIELDS.map(f=>`<label>${esc(f.label)}<select name="${f.key}" aria-label="对应${esc(f.label)}"><option value="-1">未提供</option>${headers.map((v,i)=>`<option value="${i}" ${mapping[f.key]===i?'selected':''}>${esc(String(v??'').slice(0,55)||`未命名列 ${i+1}`)}</option>`).join('')}</select></label>`).join('');
}
$('mapping-btn').addEventListener('click',openMapping);
for(const id of ['close-mapping','cancel-mapping'])$(id).addEventListener('click',()=>$('mapping-dialog').close());
$('sheet-select').addEventListener('change',()=>{const info=detectHeader(state.sheets[$('sheet-select').value]);$('header-row').value=info.index+1;renderMappingFields(info.mapping);});
$('header-row').addEventListener('change',()=>{const rows=state.sheets[$('sheet-select').value];renderMappingFields(matchHeaders(rows[Number($('header-row').value)-1]||[]));});
$('mapping-form').addEventListener('submit',e=>{
  e.preventDefault();const m={};new FormData(e.target).forEach((v,k)=>m[k]=Number(v));
  if(!mappingValid(m)){$('mapping-error').textContent='请对应视频标题或商品品类，并至少选择成交金额或订单数。';return;}
  const cols=Object.values(m).filter(v=>v>=0);if(new Set(cols).size!==cols.length){$('mapping-error').textContent='同一列不能对应多个不同字段，请检查选择。';return;}
  const previous={sheet:state.sheet,headerIndex:state.headerIndex,mapping:state.mapping};
  try{state.sheet=$('sheet-select').value;state.headerIndex=Number($('header-row').value)-1;state.mapping=m;applyMapping(false);$('mapping-dialog').close();toast('字段已更新，正在重新分析');}
  catch(err){Object.assign(state,previous);$('mapping-error').textContent=err.message;}
});
function options(){return {scope:state.scope,account:state.account,metric:state.metric,period:state.period};}
function render(){
  state.report=buildReportData(state.records,options(),state.filename,{...state.quality,bad:state.quality.bad,duplicates:state.quality.duplicates});
  const {records,groups,totals,insights}=state.report;
  $('period-source').textContent=state.period.source;
  document.querySelectorAll('[data-scope]').forEach(b=>{b.classList.toggle('selected',b.dataset.scope===state.scope);b.setAttribute('aria-pressed',b.dataset.scope===state.scope);});
  document.querySelectorAll('[data-metric]').forEach(b=>{b.classList.toggle('selected',b.dataset.metric===state.metric);b.disabled=state.mapping[b.dataset.metric]<0;b.setAttribute('aria-pressed',b.dataset.metric===state.metric);});
  $('scope-note').textContent=({all:'全部视频',new:'统计区间内发布',old:'统计区间前发布'}[state.scope])+` · ${records.length} 条`;
  const metrics=[['直接成交额',compactMoney(totals.gmv),'元','money',totals.missing.gmv?`${totals.missing.gmv} 条记录未提供金额`:'不含引流成交金额'],['成交订单数',money(totals.orders),'单','cart',totals.missing.orders?`${totals.missing.orders} 条记录未提供订单`:`${totals.sold} 条视频产生订单`],['视频数量',money(totals.count),'条','play',`${new Set(records.map(r=>r.category)).size} 个识别品类`],['平均每单成交额',money(totals.avgOrder),'元','chart','仅计算金额与订单均完整的记录']];
  $('metrics').innerHTML=metrics.map(([label,value,unit,ico,note])=>`<article class="metric"><div class="metric-top"><span>${label}</span><span>${icon(ico)}</span></div><div class="metric-value">${value}<small>${value==='未提供'?'':unit}</small></div><div class="metric-note">${esc(note)}</div></article>`).join('');
  $('insights').innerHTML=insights.map(x=>`<article class="insight ${x.kind}"><div class="insight-heading">${icon(x.kind==='watch'?'info':x.kind==='time'?'clock':'spark')}<strong>${esc(x.title)}</strong></div><p>${esc(x.text)}</p></article>`).join('');
  renderQuality();renderCategories(groups);renderCohorts();renderFrameworks(groups);renderDetails();
  $('word-btn').disabled=analyzing||!records.length;$('csv-btn').disabled=analyzing||!records.length;
}
function renderQuality(){
  const q=state.quality,notes=[],total=state.records.length,unclassified=state.records.filter(r=>r.category==='待识别').length;
  if(!state.demo){const c=evidenceCoverage(state.report.records);notes.push(`有成交视频 ${c.positive} 条，内容核验确认 ${c.confirmed} 条，手动指定 ${c.manual} 条；待识别 ${c.unknown} 条、¥${money(c.unknownGmv)}、${money(c.unknownOrders)} 单。确认主讲品后，整条视频的直接成交额与订单归属该主讲品。`);const errors=[...new Set(state.report.records.filter(r=>r.analysis?.status==='unavailable').map(r=>r.analysis.reason))];for(const reason of errors.slice(0,3))notes.push(reason);}
  if(unclassified)notes.push(`${unclassified} 条记录暂不能判断品类，已计入“待识别”，可在数据明细中修正。`);
  if(q.removedExact)notes.push(`已忽略 ${q.removedExact} 条内容完全相同的重复行，可在字段设置中调整。`);
  else if(q.exactDuplicates)notes.push(`保留了 ${q.exactDuplicates} 条完全重复行，金额可能重复累计。`);
  if(q.duplicates?.length)notes.push(`${q.duplicates.length} 行与其他记录的视频 ID 或链接重复，当前均保留。请核对是分商品记录还是重复导出，成交可能重复归属。`);
  if(q.skippedTotals)notes.push(`已跳过 ${q.skippedTotals} 行明确标记的合计或总计。`);
  for(const [key,n] of Object.entries(q.bad||{}))notes.push(`${FIELDS.find(f=>f.key===key)?.label||key}有 ${n} 条值无法解析，相关计算视为缺失。`);
  const missing=summarize(state.records).missing;
  for(const key of ['gmv','orders','views','published'])if(missing[key]&&state.mapping[key]>=0)notes.push(`${FIELDS.find(f=>f.key===key)?.label}有 ${missing[key]}/${total} 条缺失；未按 0 填充。`);
  if(state.mapping.gmv<0)notes.push('未提供直接成交金额，金额指标不可用，当前可按订单数分析。');
  if(state.mapping.orders<0)notes.push('未提供订单数，出单覆盖与平均每单成交额不可用。');
  if(state.mapping.published<0)notes.push('未提供发布时间，无法区分新旧视频。');
  if(state.records.some(r=>r.gmv<0))notes.push('存在负成交额，已按原值计入；请确认报表是否包含退款或调整。');
  if(state.mapping.gmv>=0){const header=String(state.sheets[state.sheet][state.headerIndex][state.mapping.gmv]);if(!/直接/.test(header))notes.push(`金额字段使用“${header}”，请确认是否符合本次成交统计口径。`);}
  $('quality-notes').innerHTML=notes.length?`<details class="notice"><summary>${icon('info').replace('<svg','<svg style="display:inline-block;vertical-align:middle;width:13px;height:13px;margin-right:5px"')}数据检查 · ${notes.length} 项需留意</summary><ul>${notes.map(n=>`<li>${esc(n)}</li>`).join('')}</ul></details>`:'';
}
function renderCategories(groups){
  const metric=state.metric,max=Math.max(...groups.map(g=>g[metric]??0),0),top=groups.slice(0,7);
  $('category-chart').innerHTML=top.length?`<div class="bars">${top.map((g,i)=>`<div class="bar-item"><div class="bar-label"><span>${esc(g.name)}</span><strong>${metric==='gmv'?'¥ '+compactMoney(g.gmv):money(g.orders)+' 单'} <span class="subtle">${pct(g.share)}</span></strong></div><div class="bar-track"><div class="bar-fill" style="width:${max>0?Math.max(0,(g[metric]??0)/max*100):0}%;background:${COLORS[i]}"></div></div></div>`).join('')}</div>`:'<div class="empty-results">此范围没有数据，请调整发布时间或账号。</div>';
  $('category-count').textContent=`${groups.length} 个品类`;
  $('category-table').innerHTML=groups.length?groups.map((g,i)=>`<tr><td><div class="rank-cell"><span class="rank-number ${i<3?'top':''}">${i+1}</span>${esc(g.name)}</div></td><td>${g.gmv===null?'—':'¥'+compactMoney(g.gmv)}</td><td>${g.orders===null?'—':money(g.orders)}</td><td>${g.count}</td><td>${pct(g.soldRate)}</td></tr>`).join(''):'<tr><td colspan="5" class="empty-results">没有可分析的数据</td></tr>';
}
function renderCohorts(){
  const base=selectRecords(state.records,{...options(),scope:'all'}),all=summarize(base),metric=state.metric;
  const definitions=[['new','本期发布',''],['old','此前发布','old'],['after','区间之后发布','unknown'],['unknown','发布时间缺失','unknown']];
  $('cohort-view').innerHTML=`<div class="cohort-body">${definitions.map(([key,label,cls])=>{const r=base.filter(r=>cohort(r,state.period)===key),t=summarize(r),val=metric==='gmv'?'¥ '+compactMoney(t.gmv):money(t.orders)+' 单';return `<div class="cohort-item ${cls}"><strong>${label}</strong><div class="cohort-money">${r.length?val:'—'}</div><div class="subtle">${r.length} 条视频 · 贡献 ${r.length&&all[metric]>0?pct((t[metric]??0)/all[metric]):'—'}</div></div>`;}).join('')}</div>`;
}
function renderSpeech(group){
  const s=getSpeechFramework(group.name,group.records,state.metric);
  return `<section class="speech-section" aria-label="视频话术内容框架"><div class="speech-heading"><h4>视频话术内容框架</h4><span class="pill neutral">${s.observed.length?'内容证据 + 结构建议':'结构建议'}</span></div><p class="speech-basis">${esc(s.basis)}</p>${s.observed.map(e=>`<p class="speech-basis"><strong>${esc(e.product)}</strong>：${esc(e.detail)}</p>`).join('')}<p class="speech-angle"><span>建议话术主线</span>${esc(s.angle)}</p><ol class="speech-stages">${s.stages.map(stage=>`<li><strong>${esc(stage.label)}</strong><p>${esc(stage.detail)}</p></li>`).join('')}</ol><p class="speech-opening"><span>话术开头示例</span>“${esc(s.opening)}”</p><p class="speech-note">${esc(s.note)}</p></section>`;
}
function renderFrameworks(groups){
  const candidates=groups.filter(g=>g.name!=='待识别').slice(0,6);
  $('framework-list').innerHTML=candidates.length?candidates.map((g,i)=>{const f=getFramework(g.name),tags=keywords(g.records);return `<details class="panel framework-card" ${i===0?'open':''}><summary><span class="framework-index">${String(i+1).padStart(2,'0')}</span><div class="framework-title"><h3>${esc(g.name)}</h3><p>${esc(f.focus)}</p></div><span class="framework-badge">${g.count} 条视频 · ${state.metric==='gmv'?'¥'+compactMoney(g.gmv):money(g.orders)+' 单'}</span><span class="chevron">${icon('chevron')}</span></summary><div class="framework-body">${tags.length?`<div class="keyword-list">${tags.map(t=>`<span>${esc(t.word)} · ${t.count} 条</span>`).join('')}</div>`:''}${renderSpeech(g)}<div class="shot-label">二创画面建议 · 从已有录播素材中筛选</div><ol class="framework-steps">${f.shots.map(s=>`<li><strong>${esc(s.type)}</strong><p>${esc(s.use)}</p></li>`).join('')}</ol><p class="framework-sequence"><span>建议剪辑顺序</span>${f.shots.map(s=>esc(s.type)).join(' → ')}</p><p class="framework-watch">${esc(f.watch)}${g.topShare>=.6?` 该类单条最高贡献 ${pct(g.topShare)}，需验证二创组合的效果。`:''}</p><div class="evidence-label">参考视频 · 按${state.metric==='gmv'?'直接成交额':'订单数'}排序</div>${g.top.map(r=>`<div class="evidence-video"><span class="video-title">${r.url?`<a href="${esc(r.url)}" target="_blank" rel="noopener noreferrer">${esc(r.title||'无标题视频')} ↗</a>`:esc(r.title||'无标题视频')}</span><span class="video-stat">${r.gmv===null?'金额未提供':'¥'+money(r.gmv)} · ${r.orders===null?'订单未提供':money(r.orders)+' 单'}${r.duration!==null?' · '+money(r.duration)+' 秒':''}</span></div>`).join('')}</div></details>`;}).join(''):'<div class="panel empty-results">没有已识别的品类。请在数据明细中修正品类，或调整分析范围。</div>';
}
function renderDetails(){
  const base=state.report.records,groups=aggregate(base,state.metric),current=$('category-filter').value;
  $('category-filter').innerHTML='<option value="all">全部品类</option>'+groups.map(g=>`<option value="${esc(g.name)}">${esc(g.name)}</option>`).join('');
  $('category-filter').value=groups.some(g=>g.name===state.categoryFilter)?state.categoryFilter:'all';
  let rows=base.filter(r=>(!state.unknownOnly||r.category==='待识别')&&(state.categoryFilter==='all'||r.category===state.categoryFilter)&&(!state.search||(r.title+' '+r.category+' '+(r.mainProduct||'')).toLowerCase().includes(state.search.toLowerCase())));
  rows.sort((a,b)=>(b[state.metric]??-Infinity)-(a[state.metric]??-Infinity));
  const pages=Math.max(1,Math.ceil(rows.length/15));state.page=Math.min(state.page,pages);
  const pageRows=rows.slice((state.page-1)*15,state.page*15);
  $('detail-count').textContent=`${rows.length} 条记录`;
  $('detail-table').innerHTML=pageRows.length?pageRows.map(r=>`<tr><td>${r.url?`<a class="detail-title" title="${esc(r.title)}" href="${esc(r.url)}" target="_blank" rel="noopener noreferrer">${esc(r.title||'无标题视频')} ↗</a>`:`<span class="detail-title" title="${esc(r.title)}">${esc(r.title||'无标题视频')}</span>`}<div class="row-meta">${esc(r.account)} · ${esc(r.categorySource)}${r.mainProduct?' · 主讲：'+esc(r.mainProduct):''}</div>${r.analysis?.evidence?.length?`<div class="row-meta" title="${esc(evidenceText(r))}">${esc(evidenceText(r).slice(0,160))}</div>`:''}</td><td><button class="edit-category-btn ${r.category==='待识别'?'unknown':''}" data-edit="${r.row}" aria-label="修正第${r.row}行品类">${esc(r.category)} ✎</button></td><td>${r.published||'未提供'}</td><td>${r.gmv===null?'未提供':'¥'+money(r.gmv)}</td><td>${r.orders===null?'未提供':money(r.orders)}</td><td>${r.views===null?'未提供':money(r.views)}</td><td>${r.row}</td></tr>`).join(''):'<tr><td colspan="7" class="empty-results">没有匹配的记录，请调整搜索或筛选条件。</td></tr>';
  $('page-info').textContent=`第 ${state.page} / ${pages} 页 · 每页 15 条`;$('prev-page').disabled=state.page<=1;$('next-page').disabled=state.page>=pages;
}
document.querySelectorAll('[data-scope]').forEach(b=>b.addEventListener('click',()=>{state.scope=b.dataset.scope;state.page=1;render();}));
document.querySelectorAll('[data-metric]').forEach(b=>b.addEventListener('click',()=>{state.metric=b.dataset.metric;state.page=1;render();}));
$('account-select').addEventListener('change',e=>{state.account=e.target.value;state.page=1;render();});
function updateDates(){const start=$('start-date').value,end=$('end-date').value;if(!start||!end||start>end){message('开始日期需早于或等于结束日期，请检查统计区间。当前结果仍对应上一次有效区间。');$('word-btn').disabled=true;$('csv-btn').disabled=true;return;}state.period={start,end,source:'手动设置的统计区间'};message('');state.page=1;render();}
$('start-date').addEventListener('change',updateDates);$('end-date').addEventListener('change',updateDates);
$('search-input').addEventListener('input',e=>{state.search=e.target.value.trim();state.page=1;renderDetails();});
$('category-filter').addEventListener('change',e=>{state.categoryFilter=e.target.value;state.page=1;renderDetails();});
$('unknown-only').addEventListener('change',e=>{state.unknownOnly=e.target.checked;state.page=1;renderDetails();});
$('prev-page').addEventListener('click',()=>{state.page--;renderDetails();});$('next-page').addEventListener('click',()=>{state.page++;renderDetails();});
let editingRow=null;
$('detail-table').addEventListener('click',e=>{const b=e.target.closest('[data-edit]');if(!b)return;editingRow=Number(b.dataset.edit);const r=state.records.find(r=>r.row===editingRow);$('edit-title').textContent=(r.title||'无标题视频').slice(0,100);$('edit-category').value=r.category==='待识别'?'':r.category;$('category-options').innerHTML=[...new Set([...CATEGORY_NAMES,...state.records.map(r=>r.category)])].map(c=>`<option value="${esc(c)}"></option>`).join('');$('edit-dialog').showModal();});
for(const id of ['close-edit','cancel-edit'])$(id).addEventListener('click',()=>$('edit-dialog').close());
$('edit-form').addEventListener('submit',e=>{e.preventDefault();const c=$('edit-category').value.trim();if(!c)return;const r=state.records.find(r=>r.row===editingRow);r.category=c;r.categorySource='手动修正';state.overrides.set(`${state.sheet}:${r.row}`,c);state.categoryFilter='all';$('edit-dialog').close();render();toast('品类已修正，相关分析已更新');});
$('reset-btn').addEventListener('click',()=>{cancelAnalysis();state.records=[];state.sheets={};state.overrides.clear();state.report=null;$('dashboard').hidden=true;$('empty-state').hidden=false;message('');window.scrollTo({top:0,behavior:'smooth'});toast('数据已从当前页面清空');});
$('word-btn').addEventListener('click',async()=>{const b=$('word-btn');b.disabled=true;try{await downloadWord(state.report,state.demo);toast('Word 报告已生成');}catch(err){message('报告生成失败：'+err.message);}finally{b.disabled=false;}});
function saveBlob(blob,name){const a=document.createElement('a'),url=URL.createObjectURL(blob);a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),2000);}
$('csv-btn').addEventListener('click',()=>{const fields=['title','mainProduct','category','categorySource','analysisStatus','analysisEvidence','published','gmv','orders','views','duration','account','url','row'],headers=['视频标题','主讲品','视频品类','品类来源','核验状态','内容证据','发布时间','直接成交金额','成交订单数','观看次数','时长秒','账号','视频链接','来源行'];const cell=v=>'"'+(typeof v==='string'?v.replace(/^[=+@\-\t\r]/,"'$&"):String(v??'')).replace(/"/g,'""')+'"';const rows=[headers,...state.report.records.map(r=>fields.map(f=>f==='analysisStatus'?r.analysis?.status:f==='analysisEvidence'?evidenceText(r):r[f]))];saveBlob(new Blob(['\uFEFF'+rows.map(rr=>rr.map(cell).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'}),'视频分析明细.csv');toast('已导出当前分析范围的明细');});
document.querySelectorAll('[data-nav]').forEach(a=>a.addEventListener('click',e=>{if(!state.report){e.preventDefault();toast('上传数据表或查看演示后，即可查看分析');return;}document.querySelectorAll('[data-nav]').forEach(x=>x.classList.toggle('active',x===a));}));
new IntersectionObserver(entries=>{const item=entries.find(e=>e.isIntersecting);if(item)document.querySelectorAll('[data-nav]').forEach(a=>a.classList.toggle('active',a.dataset.nav===item.target.id));},{rootMargin:'-5% 0px -65% 0px'}).observe($('overview'));
for(const id of ['categories','frameworks','details'])new IntersectionObserver(entries=>{if(entries[0].isIntersecting)document.querySelectorAll('[data-nav]').forEach(a=>a.classList.toggle('active',a.dataset.nav===id));},{rootMargin:'-5% 0px -65% 0px'}).observe($(id));

function loadDemo(){
  cancelAnalysis();
  const headers=['作品标题','作品ID','播放链接','发布时间','作品时长','直接成交金额','成交订单数','观看次数','达人昵称','引流成交金额'];
  const sample=[
    ['小个子显比例的直筒牛仔裤 #牛仔裤 #显瘦', '2026/10/03',72,28900,59,12800],['秋冬百搭直筒牛仔裤 #牛仔裤 #百搭','2026/09/18',65,42300,86,21000],['看腰胯和裤筒的上身效果 #牛仔裤 #修饰腿型','2026/10/12',88,12800,27,6200],['复古洗水阔腿牛仔裤 #牛仔裤 #洗水','2026/10/19',91,5890,12,2800],['舒服又显瘦的牛仔裤 #牛仔裤','2026/10/25',56,998,2,480],
    ['微锥灯芯绒裤 #灯芯绒 #修饰腿型','2026/09/15',66,32500,68,15000],['轻微弹灯芯绒休闲裤 #灯芯绒 #百搭','2026/10/08',75,4520,10,2700],['复古灯芯绒休闲裤 #灯芯绒 #复古','2026/10/22',69,968,2,630],
    ['又轻又暖的夹克外套 #外套 #轻暖','2026/10/06',83,12700,15,8500],['有质感的羊毛大衣 #大衣 #保暖','2026/09/20',98,18600,12,13000],['通勤好搭的短外套 #外套 #通勤','2026/10/18',77,5660,7,4200],
    ['一件毛衣的两种搭配 #毛衣 #百搭','2026/10/07',80,16600,55,7200],['柔软保暖的圆领毛衣 #毛衣 #柔软','2026/10/15',65,3380,10,2100],['日常百搭针织衫 #针织衫','2026/10/23',61,899,3,820],
    ['抽绳直筒休闲裤 #休闲裤 #舒服 #抽绳','2026/10/14',86,6800,21,4900],['舒服利落的西装裤 #西装裤 #通勤','2026/09/23',79,5990,11,3300],['高腰百搭休闲裤 #休闲裤 #显腿长','2026/10/21',74,1316,4,940],
    ['单穿叠穿都好看的长袖T恤 #打底衫','2026/10/11',54,3890,24,2800],['日常上脚的穆勒鞋 #鞋子 #不累脚','2026/10/13',68,2780,6,1700],['今天分享一套秋冬搭配','2026/10/20',70,799,2,620],
  ];
  state.sheets={'视频数据':[headers,...sample.map((r,i)=>[r[0],'DEMO-'+(i+1),'',r[1],r[2],r[3],r[4],r[5],'示例穿搭账号',0])]};state.sheet='视频数据';state.filename='演示数据_[20261001-20261030].xlsx';state.headerIndex=0;state.mapping=matchHeaders(headers);state.demo=true;state.overrides.clear();state.scope='all';state.metric='gmv';applyMapping(true);message('');toast('已加载虚构演示数据');
}
$('demo-btn').addEventListener('click',loadDemo);
