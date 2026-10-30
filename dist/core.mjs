export const FIELDS = [
  {key:'title',label:'视频标题',aliases:['作品标题','视频标题','视频名称','标题','商品名称','商品标题','title']},
  {key:'gmv',label:'直接成交金额',aliases:['直接成交金额','直接成交额','支付成交金额','支付金额','成交金额','成交额','销售额','gmv','sales']},
  {key:'orders',label:'成交订单数',aliases:['成交订单数','支付订单数','成交订单','订单数','支付订单','销量','orders']},
  {key:'published',label:'发布时间',aliases:['发布时间','视频发布时间','作品发布时间','发布日期','发布日','publishdate','date']},
  {key:'views',label:'观看次数',aliases:['观看次数','播放次数','视频播放量','播放量','观看量','views']},
  {key:'duration',label:'视频时长 秒',aliases:['作品时长','视频时长','时长','duration']},
  {key:'category',label:'商品品类 可选',aliases:['主推品类','商品品类','商品类目','商品分类','品类','类目','category']},
  {key:'id',label:'视频 ID',aliases:['作品id','视频id','视频编号','作品编号','videoid']},
  {key:'url',label:'视频链接',aliases:['播放链接','视频链接','作品链接','url','link']},
  {key:'account',label:'账号名称',aliases:['达人昵称','账号名称','账号昵称','达人名称','账号','account']},
  {key:'assisted',label:'引流成交金额',aliases:['引流成交金额','引流成交额','间接成交金额','间接成交额']},
];
export const COLORS=['#26785d','#75a887','#a9c49a','#c6d5b2','#d4bf91','#8ca3b4','#b8adb8','#bcbfb6'];
const clean = value => String(value??'').normalize('NFKC').trim();
const headerKey = value => clean(value).toLowerCase().replace(/[\s_()（）\[\]【】元秒次笔单数量￥¥]/g,'');
const round = value => Math.round((value + Number.EPSILON)*100)/100;
export function parseNumber(value, header='') {
  if(value===null||value===undefined||value==='') return null;
  let raw=clean(value), multiplier=/万/.test(header)?10000:/千/.test(header)?1000:/亿/.test(header)?1e8:1;
  if (/^(--?|—|–|n\/?a|null|无|未提供)$/i.test(raw)) return null;
  let negative=/^\(.*\)$/.test(raw);
  raw=raw.replace(/[¥￥$€£,，\s()]/g,'').replace(/(人民币|元|次|笔|单|件|秒)$/,'');
  if (/[万w]$/i.test(raw)){multiplier=10000;raw=raw.slice(0,-1);}
  else if (/亿$/.test(raw)){multiplier=1e8;raw=raw.slice(0,-1);}
  else if (/[千k]$/i.test(raw)){multiplier=1000;raw=raw.slice(0,-1);}
  if(!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(raw))return null;
  const n=Number(raw)*multiplier*(negative?-1:1);
  return Number.isFinite(n)?round(n):null;
}
export function normalizeDate(value) {
  if(value===null||value===undefined||value==='')return null;
  if(value instanceof Date)return Number.isNaN(value.getTime())?null:value.toISOString().slice(0,10);
  if(typeof value==='number' && value>20000 && value<100000) return new Date(Date.UTC(1899,11,30)+Math.floor(value)*86400000).toISOString().slice(0,10);
  const raw=clean(value);
  const m=raw.match(/^(\d{4})[年/.-](\d{1,2})[月/.-](\d{1,2})(?:日|\s|T|$)/)||raw.match(/^(\d{4})(\d{2})(\d{2})$/);
  if(!m)return null;
  const [y,mo,d]=m.slice(1).map(Number),dt=new Date(Date.UTC(y,mo-1,d));
  if(dt.getUTCFullYear()!==y||dt.getUTCMonth()!==mo-1||dt.getUTCDate()!==d)return null;
  return dt.toISOString().slice(0,10);
}
export function matchHeaders(headers) {
  const keys=headers.map(headerKey), result={};
  for(const f of FIELDS){
    let idx=-1;
    for(const alias of f.aliases){idx=keys.indexOf(headerKey(alias));if(idx!==-1)break;}
    if(idx===-1){for(const alias of f.aliases){const a=headerKey(alias);idx=keys.findIndex(k=>k.startsWith(a)&&/^(万|千|亿|rmb|cny)?$/.test(k.slice(a.length)));if(idx!==-1)break;}}
    result[f.key]=idx;
  }
  return result;
}
export function detectHeader(rows) {
  let best={index:0,score:-1,mapping:matchHeaders(rows[0]||[])};
  for(let i=0;i<Math.min(rows.length,20);i++){
    const mapping=matchHeaders(rows[i]||[]),score=Object.entries(mapping).reduce((s,[k,v])=>s+(v>=0?(['title','gmv','orders','category'].includes(k)?3:1):0),0);
    if(score>best.score)best={index:i,score,mapping};
  }
  return best;
}
export const CATEGORY_NAMES=['牛仔裤','灯芯绒裤','其他休闲西装裤','针织毛衣','T恤打底背心','外套','马甲','卫衣','内衣','鞋靴','配饰包帽','护肤','彩妆','食品饮料','家居清洁','日用家居','母婴','数码家电','运动户外','宠物用品','待识别'];
export function categorize(title, supplied='') {
  if(clean(supplied))return {name:clean(supplied),source:'表内品类'};
  const t=clean(title);
  const rules=[
    ['外套',/牛仔外套|牛仔衣/],['灯芯绒裤',/灯芯绒/],['牛仔裤',/牛仔裤|牛仔控|白牛/],
    ['马甲',/马甲|马夹/],['内衣',/内衣/],['卫衣',/卫衣/],['针织毛衣',/毛衣|毛织|针织|开衫|羊毛衫|亨利衫/],
    ['外套',/皮衣|大衣|外套|风衣|棉服|夹克|冲锋衣|防晒衣|貂|鹅绒服|羽绒服|西装(?!裤)/],
    ['T恤打底背心',/打底|[Tt]恤|短t|长袖|背心|[Pp]olo衫|百搭上衣|#上衣/],
    ['其他休闲西装裤',/裤/],['鞋靴',/鞋|靴|脚宽脚胖/],['配饰包帽',/围巾|围脖|帽子|鸭舌帽|耳环|项链|包包|斜挎包/],
    ['护肤',/面霜|面膜|精华|爽肤水|洗面奶|防晒霜|护肤|水乳/],['彩妆',/口红|粉底|眼影|眉笔|散粉|彩妆|腮红/],
    ['食品饮料',/零食|饼干|坚果|咖啡|饮料|牛奶|燕麦|巧克力|水果|牛肉|鸡肉|米粉|酸奶|茶叶/],
    ['家居清洁',/洗衣液|清洁剂|洗洁精|去污|拖把|洗衣凝珠/],['母婴',/婴儿|宝宝|奶瓶|纸尿裤|母婴/],
    ['宠物用品',/猫粮|狗粮|宠物|猫砂/],['数码家电',/耳机|充电器|手机壳|电饭煲|吹风机|空气炸锅|数码|小家电/],
    ['日用家居',/收纳|床单|被套|枕头|水杯|餐具|保鲜盒|纸巾/],['运动户外',/瑜伽|哑铃|帐篷|露营|健身器材/],
  ];
  const rule=rules.find(([name,re],index)=>re.test(t)&&!(name==='外套'&&index!==0&&/西装裤/.test(t)));
  return {name:rule?rule[0]:'待识别',source:rule?'标题关键词':'信息不足'};
}
export function normalizeRows(rows,headerIndex,mapping,removeExact=true) {
  const headers=rows[headerIndex]||[],records=[],seen=new Set(),bad={},duplicates=[];
  let skippedTotals=0,exactDuplicates=0;
  for(let i=headerIndex+1;i<rows.length;i++){
    const raw=rows[i]||[];
    if(!raw.some(v=>clean(v)))continue;
    const get=k=>mapping[k]>=0?raw[mapping[k]]:null;
    const title=clean(get('title')),supplied=clean(get('category'));
    if(/^(合计|总计|总汇|汇总|total)$/i.test(title)){skippedTotals++;continue;}
    const signature=JSON.stringify(raw);
    if(seen.has(signature)){exactDuplicates++;if(removeExact)continue;}
    seen.add(signature);
    const cat=categorize(title,supplied),r={row:i+1,title,id:clean(get('id')),url:safeUrl(get('url')),account:clean(get('account'))||'未命名账号',published:normalizeDate(get('published')),category:cat.name,categorySource:cat.source};
    for(const key of ['gmv','orders','views','duration','assisted']){
      const val=get(key); r[key]=parseNumber(val,headers[mapping[key]]||'');
      if(['orders','views','duration'].includes(key)&&r[key]!==null&&(r[key]<0||(key!=='duration'&&!Number.isInteger(r[key]))))r[key]=null;
      if(mapping[key]>=0&&clean(val)&&r[key]===null)bad[key]=(bad[key]||0)+1;
    }
    if(mapping.published>=0&&clean(get('published'))&&!r.published)bad.published=(bad.published||0)+1;
    if(!title&&!supplied&&['gmv','orders','views'].every(k=>r[k]===null))continue;
    records.push(r);
  }
  const ids=new Map();for(const r of records){const key=r.id||r.url;if(key){if(ids.has(key))duplicates.push(r.row);else ids.set(key,r.row);}}
  return {records,bad,duplicates,exactDuplicates,skippedTotals,removedExact:removeExact?exactDuplicates:0};
}
export function safeUrl(value){try{const u=new URL(clean(value));return ['https:','http:'].includes(u.protocol)?u.href:'';}catch{return '';}}
export function inferPeriod(filename,records) {
  const m=filename.match(/(20\d{6})[^\d]+(20\d{6})/);
  if(m){const start=normalizeDate(m[1]),end=normalizeDate(m[2]);if(start&&end&&start<=end)return {start,end,source:'来自文件名'};}
  const end=records.map(r=>r.published).filter(Boolean).sort().at(-1)||new Date().toISOString().slice(0,10);
  const start=new Date(Date.parse(end+'T00:00:00Z')-29*86400000).toISOString().slice(0,10);
  return {start,end,source:'按最新发布日期推定 30 天，可修改'};
}
export function cohort(r,period){if(!r.published)return 'unknown';return r.published<period.start?'old':r.published>period.end?'after':'new';}
export function selectRecords(records,{scope='all',account='all',period}){return records.filter(r=>(account==='all'||r.account===account)&&(scope==='all'||cohort(r,period)===scope));}
export function summarize(records) {
  const values=k=>records.map(r=>r[k]).filter(v=>v!==null&&v!==undefined),sum=k=>{const v=values(k);return v.length?round(v.reduce((a,b)=>a+b,0)):null;};
  const paired=records.filter(r=>r.gmv!==null&&r.orders!==null),pairedOrders=paired.reduce((s,r)=>s+r.orders,0);
  const sold=records.filter(r=>r.orders!==null&&r.orders>0).length,known=values('orders').length;
  return {count:records.length,gmv:sum('gmv'),orders:sum('orders'),views:sum('views'),assisted:sum('assisted'),sold,knownOrders:known,avgOrder:pairedOrders>0?round(paired.reduce((s,r)=>s+r.gmv,0)/pairedOrders):null,soldRate:known?sold/known:null,missing:Object.fromEntries(['gmv','orders','views','assisted','duration','published'].map(k=>[k,records.filter(r=>r[k]===null||r[k]===undefined).length]))};
}
export function aggregate(records,metric='gmv') {
  const overall=summarize(records),groups=new Map();
  for(const r of records){if(!groups.has(r.category))groups.set(r.category,[]);groups.get(r.category).push(r);}
  return [...groups].map(([name,rr])=>{
    const s=summarize(rr),top=rr.slice().sort((a,b)=>(b[metric]??-Infinity)-(a[metric]??-Infinity));
    const durations=rr.map(r=>r.duration).filter(v=>v!==null).sort((a,b)=>a-b),l=durations.length;
    return {name,records:rr,...s,share:overall[metric]>0?(s[metric]??0)/overall[metric]:null,topShare:s[metric]>0?(top[0]?.[metric]??0)/s[metric]:null,top:top.slice(0,3),medianDuration:l?(l%2?durations[(l-1)/2]:(durations[l/2-1]+durations[l/2])/2):null};
  }).sort((a,b)=>(b[metric]??-Infinity)-(a[metric]??-Infinity)||b.count-a.count);
}
export const money=n=>n===null||n===undefined?'未提供':new Intl.NumberFormat('zh-CN',{maximumFractionDigits:2}).format(n);
export const compactMoney=n=>n===null||n===undefined?'未提供':Math.abs(n)>=10000?(n/10000).toFixed(2)+'万':money(n);
export const pct=n=>n===null||n===undefined?'—':(n*100).toFixed(1)+'%';
export function createInsights(records,groups,period,metric='gmv') {
  const insights=[],total=summarize(records),ranked=groups.filter(g=>g.name!=='待识别'&&(g[metric]??0)>0),unit=metric==='gmv'?'直接成交额':'订单数';
  const lead=ranked[0];
  if(lead)insights.push({kind:'focus',title:`${lead.name}是当前主力`,text:`${lead.count} 条视频贡献${metric==='gmv'?' ¥'+money(lead.gmv):' '+money(lead.orders)+' 单'}，占所选范围${unit}的 ${pct(lead.share)}。${lead.knownOrders?`${lead.sold} 条有订单。`:''}`});
  const high=ranked.find(g=>g.topShare>=0.6&&g.count>=3);
  if(high)insights.push({kind:'watch',title:`${high.name}需要验证复制效果`,text:`单条视频贡献该品类 ${pct(high.topShare)} 的${unit}。优先复盘这条代表视频，再小批量验证，避免将单条爆款当作稳定表现。`});
  const recent=records.filter(r=>cohort(r,period)==='new'),old=records.filter(r=>cohort(r,period)==='old'),rs=summarize(recent),os=summarize(old);
  if(recent.length&&old.length&&total[metric]>0)insights.push({kind:'time',title:'新旧视频的贡献不同',text:`本期发布 ${recent.length} 条，贡献 ${pct((rs[metric]??0)/total[metric])}；此前发布 ${old.length} 条，贡献 ${pct((os[metric]??0)/total[metric])}。这是当前报表中的成交归属，比较二创视频表现时请统一发布后的观察天数。`});
  else if(recent.length)insights.push({kind:'time',title:'按相同观察天数比较',text:`所选范围有 ${recent.length} 条本期发布视频。刚发布的视频积累时间较短，建议统一比较发布后 7 天或 14 天的成交。`});
  if(insights.length<3&&ranked.length>1){const next=ranked[1];insights.push({kind:'next',title:`继续测试${next.name}`,text:`该品类${unit}排名第 2，共 ${next.count} 条视频。将不同卖点分开测试，同时比较订单数和成交额。`});}
  return insights.slice(0,3);
}
const shot=(type,use)=>({type,use});
const FRAMEWORKS={
  '牛仔裤':{focus:'上身比例与腿型修饰',shots:[
    shot('全身展示','筛选同款裤装正面、侧面完整入画的片段，看整体比例与裤长。'),
    shot('下半身展示','选取腰胯至裤脚的中景，突出裤筒轮廓与腰胯贴合度。'),
    shot('细节近景','选取腰头、洗水、面料或裤脚的清晰近景，支撑具体卖点。'),
    shot('动态展示','利用已有走动、转身或坐起片段，呈现动态裤型。'),
    shot('搭配展示','筛选同款搭配不同上衣或鞋子的片段，说明使用场景。')],watch:'优先保留完整比例和裤筒轮廓；混剪前核对各片段是否为同款、同版型。'},
  '灯芯绒裤':{focus:'面料纹理与修饰版型',shots:[
    shot('全身展示','选取正面与侧面的完整上身片段，呈现裤长和整体轮廓。'),
    shot('下半身展示','选取腰胯到裤脚的片段，看微锥或直筒版型。'),
    shot('细节近景','优先找灯芯绒纹理、洗水颜色、腰头与裤脚的清晰片段。'),
    shot('动态展示','选取已有走动或转身片段，展示垂感和活动状态。'),
    shot('搭配展示','用同款裤装与秋冬上衣、鞋子的搭配片段收尾。')],watch:'复盘代表视频后，从现有素材中挑选相应画面；材质近景与上身片段需对应同一商品。'},
  '外套':{focus:'整体廓形与面料细节',shots:[
    shot('全身展示','优先选外套完整入画的正面、侧面片段，呈现衣长与整体风格。'),
    shot('半身展示','筛选肩线、领口、袖型及上半身廓形清晰的片段。'),
    shot('细节近景','选取面料、里料、门襟、拉链或纽扣的近景素材。'),
    shot('动态展示','利用已有走动、转身或抬臂片段，呈现外套的动态状态。'),
    shot('穿法对比','同款有对应素材时，拼接敞开、扣上或不同内搭的穿法。')],watch:'双面穿等功能只使用素材中已有且可核实的对应片段；不能仅凭画面判断保暖程度。'},
  '针织毛衣':{focus:'半身轮廓与针织纹理',shots:[
    shot('半身展示','优先选择领口、肩线、袖型和衣长清晰的上半身片段。'),
    shot('细节近景','筛选针织纹理、袖口、下摆和领口的近景素材。'),
    shot('全身展示','补充与下装同框的完整穿搭，呈现整套比例。'),
    shot('动态展示','利用已有抬臂、转身片段，观察松量与衣摆状态。'),
    shot('叠穿对比','同款有对应素材时，组合单穿、叠穿或不同下装的片段。')],watch:'面料触感等信息只能保留原素材中明确的说明，不从纹理画面推断个人穿着感受。'},
  'T恤打底背心':{focus:'单穿与叠穿轮廓',shots:[
    shot('半身展示','筛选领口、肩线与贴身程度清楚的单穿片段。'),
    shot('细节近景','选取领口、袖口、面料和下摆细节，呈现做工与纹理。'),
    shot('全身展示','补充完整搭配片段，展示衣长和上下身比例。'),
    shot('叠穿对比','组合同款单穿和搭配外套的素材，突出不同穿法。')],watch:'从同款已有素材中选取单穿与叠穿画面，避免将不同款式拼成穿法对比。'},
  '其他休闲西装裤':{focus:'裤型轮廓与功能细节',shots:[
    shot('全身展示','选择正面与侧面的完整穿搭片段，先看裤型与整体比例。'),
    shot('下半身展示','筛选腰胯到裤脚的中景，呈现宽松度、垂感与裤长。'),
    shot('细节近景','优先选腰头、抽绳、口袋、褶线等可见细节的片段。'),
    shot('动态展示','利用已有坐下、起身或走动素材，呈现活动状态。'),
    shot('搭配展示','组合同款裤装的通勤与休闲搭配片段。')],watch:'抽绳等功能优先用已有操作演示片段；舒适度不靠静态画面直接下结论。'},
  '鞋靴':{focus:'上脚效果与鞋型细节',shots:[
    shot('上脚展示','选取鞋与脚部完整入画的正面、侧面片段，呈现鞋型。'),
    shot('细节近景','筛选鞋头、鞋口、鞋底和材质的清晰近景。'),
    shot('动态展示','利用已有行走或转身片段，展示上脚后的动态状态。'),
    shot('搭配展示','补充同款鞋搭配不同裤装的下半身或全身素材。')],watch:'尺码和脚型信息保留原素材的明确说明；行走画面不等于已验证舒适度。'},
  '马甲':{focus:'叠穿层次与上身比例',shots:[shot('半身展示','选择肩部、领口和衣身轮廓清楚的片段。'),shot('细节近景','筛选纹理、纽扣、口袋或下摆细节。'),shot('全身展示','补充完整叠穿搭配，呈现衣长比例。'),shot('叠穿对比','组合同款搭配不同内搭的已有片段。')],watch:'同款不同内搭的素材更适合做叠穿对比。'},
  '卫衣':{focus:'宽松轮廓与图案细节',shots:[shot('半身展示','选择肩线、帽型或圆领轮廓清楚的片段。'),shot('细节近景','筛选图案、面料、袖口或下摆的近景。'),shot('全身展示','补充与下装同框的整体穿搭。'),shot('动态展示','利用已有抬臂、转身或走动片段，展示衣身状态。')],watch:'优先选择图案与版型清晰的素材，避免仅用局部片段判断整体松量。'},
  '内衣':{focus:'商品结构与穿着轮廓',shots:[shot('商品展示','选取商品正反面完整入画的片段。'),shot('细节近景','筛选肩带、边缘、内衬和扣位的结构细节。'),shot('半身展示','有适合展示的原素材时，保留实际穿着轮廓片段。'),shot('操作演示','选取已有的肩带调节或扣位演示片段。')],watch:'商品功能与尺码信息需与同款原素材一致。'},
  '配饰包帽':{focus:'佩戴比例与商品细节',shots:[shot('佩戴展示','选取配饰、包或帽子实际佩戴的清晰片段。'),shot('细节近景','筛选纹理、五金、接口或边缘细节。'),shot('操作演示','有对应素材时，保留开合、调节或收纳演示。'),shot('搭配展示','补充同款与整体穿搭同框的素材。')],watch:'先核对商品款式与规格，再组合佩戴和局部素材。'},
  '护肤':{focus:'商品质地与已有使用演示',shots:[shot('商品展示','选择包装与规格清晰可见的已有片段。'),shot('细节近景','筛选质地、用量与涂抹状态的近景。'),shot('操作演示','保留原素材中完整且连续的使用步骤。'),shot('信息展示','截取原素材中明确的规格与使用说明。')],watch:'不能将不同时间、不同条件的片段拼成未经验证的效果对比。'},
  '食品饮料':{focus:'实物份量与食用场景',shots:[shot('商品展示','选取包装、规格与整份实物同框的片段。'),shot('细节近景','筛选食物截面、颗粒、汤汁或冲泡状态等素材。'),shot('操作演示','选用已有拆封、冲泡或食用过程。'),shot('场景展示','补充原素材中明确的食用场景。')],watch:'同款规格、配料和份量需一致，不能用不同商品素材替代实物展示。'},
};
export function getFramework(category) {
  if(FRAMEWORKS[category])return FRAMEWORKS[category];
  const matched=categorize(category).name;if(FRAMEWORKS[matched])return FRAMEWORKS[matched];
  return {focus:'现有商品素材的画面组合',shots:[shot('商品展示','筛选商品完整入画、主体清晰的片段。'),shot('细节近景','选取与标题卖点对应的清晰局部素材。'),shot('操作演示','使用原素材中已有的实际操作或使用过程。'),shot('场景展示','补充商品与使用环境同框的片段。')],watch:category==='待识别'?'先修正品类或补充标题，再选择更有针对性的画面类别。':'使用通用画面建议；素材不足时精简剪辑顺序，保留同款且清晰的现有片段。'};
}
export function keywords(records) {
  const words=['显瘦','修饰腿型','显腿长','小个子','百搭','直筒','阔腿','微锥','弹力','轻微弹','复古','洗水','暖和','保暖','轻暖','轻便','重磅','质感','舒适','舒服','抽绳','通勤','叠穿','单穿','性价比','柔软','内搭','不累脚','脚宽','双面','好打理'];
  return words.map(word=>({word,count:records.filter(r=>r.title.includes(word)).length})).filter(x=>x.count).sort((a,b)=>b.count-a.count).slice(0,5);
}
export function buildReportData(records,options,filename,quality={}){
  const visible=selectRecords(records,options),groups=aggregate(visible,options.metric||'gmv');
  return {filename,options,records:visible,groups,totals:summarize(visible),insights:createInsights(visible,groups,options.period,options.metric||'gmv'),quality};
}
