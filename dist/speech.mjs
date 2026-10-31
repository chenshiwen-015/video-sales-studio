import {categorize,keywords} from './core.mjs';

const stage=(label,detail)=>({label,detail});
const FRAMEWORKS={
  '牛仔裤':{angle:'选裤诉求 → 上身比例 → 版型与细节依据 → 搭配场景 → 选购信息',opening:'选牛仔裤，先看腰胯和裤筒，再看整体比例。',stages:[stage('选裤诉求','围绕腿型、裤长或比例等标题中出现的需求切入。'),stage('上身结果','承接原素材对裤型和上下身比例的说明，先讲穿上后的效果。'),stage('具体依据','保留同款原口播中对直筒、阔腿、腰头、洗水或面料的明确解释。'),stage('搭配场景','串联同款已有的上衣、鞋子与通勤或日常搭配说明。'),stage('选购信息','以原素材中明确的尺码、规格及商品入口信息收尾。')]},
  '灯芯绒裤':{angle:'穿着顾虑 → 版型效果 → 纹理与面料特点 → 秋冬搭配 → 选择建议',opening:'选灯芯绒裤，可以先看裤筒轮廓和腰胯，再看面料纹理。',stages:[stage('穿着顾虑','用标题里出现的显瘦、修饰腿型或复古风格等诉求引入。'),stage('版型效果','承接同款原口播对微锥、直筒及腰胯轮廓的说明。'),stage('材质解释','保留原素材对纹理、洗水、厚薄或弹性的明确描述。'),stage('搭配应用','组合已有的秋冬上衣、鞋子与整套搭配讲解。'),stage('选择建议','保留同款原素材中明确的尺码、规格与选购信息。')]},
  '外套':{angle:'穿着场景 → 整体风格 → 版型与面料细节 → 不同穿法 → 选购信息',opening:'这件外套可以先看整体廓形，再看肩线、领口和不同穿法。',stages:[stage('场景引入','从标题中可见的季节、通勤或日常穿着需求切入。'),stage('整体风格','先承接原口播对长短、轮廓或搭配风格的说明。'),stage('卖点依据','用原素材中明确的面料、肩线、领口与做工描述解释卖点。'),stage('穿法说明','筛选同款原素材中对敞开、扣上或内搭变化的讲解。'),stage('选购信息','保留已核实的尺码、规格、价格或商品入口信息。')]},
  '针织毛衣':{angle:'搭配需求 → 上身轮廓 → 面料与细节说明 → 单穿叠穿 → 选择建议',opening:'选这件毛衣，先看领口、肩线和衣长，再看单穿与叠穿的搭配。',stages:[stage('需求切入','围绕标题中出现的百搭、暖和、风格或日常使用需求开场。'),stage('上身轮廓','承接原素材对领口、肩线、袖型与衣长的说明。'),stage('细节依据','保留原口播对针织纹理、面料与穿着感受的明确描述。'),stage('搭配价值','组合同款单穿、叠穿或不同下装的已有讲解。'),stage('选择建议','以同款原素材中明确的尺码、规格与选购信息收尾。')]},
  'T恤打底背心':{angle:'使用需求 → 单穿效果 → 领口面料细节 → 叠穿搭配 → 选购信息',opening:'这件打底，单穿和放进外套里分别是什么效果？',stages:[stage('使用需求','从日常打底、单穿或叠穿需求切入。'),stage('单穿效果','承接原素材对贴身程度、衣长与上身轮廓的说明。'),stage('细节解释','保留领口、袖口、面料与厚薄等原口播中的明确描述。'),stage('叠穿应用','组合同款与不同外套、下装搭配的已有讲解。'),stage('选购信息','保留已确认的尺码、规格、价格或商品入口信息。')]},
  '其他休闲西装裤':{angle:'日常需求 → 利落裤型 → 腰头与功能细节 → 活动和搭配 → 选择建议',opening:'想穿得利落，可以先看裤型，再看腰头和活动时的状态。',stages:[stage('需求引入','围绕标题中出现的舒适、通勤或日常活动需求切入。'),stage('裤型结果','先承接原素材对垂感、裤长与整体比例的说明。'),stage('细节依据','保留原口播中对抽绳、腰头、口袋或褶线的明确讲解。'),stage('场景应用','串联同款已有的活动状态、通勤或休闲搭配说明。'),stage('选择建议','保留原素材中明确的尺码、规格和选购信息。')]},
  '鞋靴':{angle:'穿着场景 → 上脚效果 → 鞋型与材质 → 行走搭配 → 尺码信息',opening:'这双鞋可以先看上脚效果，再看鞋头、鞋口和搭配。',stages:[stage('场景需求','从标题中出现的季节、搭配或日常穿着需求切入。'),stage('上脚效果','承接原素材对鞋型与搭配比例的说明。'),stage('细节依据','保留鞋头、鞋口、鞋底与材质的明确讲解。'),stage('搭配应用','组合原素材中已有的行走、裤装搭配或使用场景说明。'),stage('尺码信息','保留原口播中明确的脚型、尺码及选码建议。')]},
};

export function getSpeechFramework(category,records=[],metric='gmv'){
  const eligible=records.filter(r=>r.title&&(r[metric]??0)>0),signals=keywords(eligible);
  const base=FRAMEWORKS[category]||FRAMEWORKS[categorize(category).name]||{
    angle:'具体需求 → 商品特点 → 明确依据 → 使用场景 → 选购信息',opening:'先看这款商品适合的使用场景，再看它的具体特点。',
    stages:[stage('具体需求','用标题中明确的使用需求或适用场景引入。'),stage('商品特点','筛选原素材对同款商品主要特点的讲解。'),stage('明确依据','保留与特点直接相关且可核实的规格或功能说明。'),stage('使用场景','组合原素材中已有的使用过程与适用条件。'),stage('选购信息','保留已确认的规格、选择建议和商品入口信息。')]
  };
  const measure=metric==='orders'?'有订单':'有直接成交';
  const basis=signals.length?`本品类有 ${eligible.length} 条${measure}且有标题的视频。标题中较常出现的卖点为${signals.map(x=>`“${x.word}” ${x.count} 条`).join('、')}；可优先围绕这些表达筛选原有话术片段。`:eligible.length?`本品类有 ${eligible.length} 条${measure}且有标题的视频，当前关键词规则未提取到明确卖点。以下使用该品类的内容结构建议，需结合原录播核对。`:'当前范围没有同时具备标题与正成交指标的视频。以下为品类内容结构建议，分析依据仍需补充。';
  const observed=records.filter(r=>(r[metric]??0)>0&&r.analysis?.status==='confirmed'&&r.analysis.evidence?.length).sort((a,b)=>(b[metric]??0)-(a[metric]??0)).slice(0,3).map(r=>({product:r.mainProduct||r.title,detail:r.analysis.speechStages?.length?r.analysis.speechStages.map(x=>(x.seconds===null||x.seconds===undefined?'':x.seconds+'秒 ')+x.label+'：'+x.detail).join(' → '):r.analysis.evidence.map(x=>(x.seconds===null||x.seconds===undefined?'':x.seconds+'秒 ')+x.text).join('；')}));
  const contentBasis=observed.length?`以下列出 ${observed.length} 条已确认主讲品的成交视频内容证据，再给出可复用的话术结构。证据描述不代表整片逐字稿。`:basis;
  return {...base,basis:contentBasis,observed,signals,sampleSize:eligible.length,note:'下方结构为二创建议；已读内容在证据中单列，示例不是原片口播转写。用于筛选和重组已有录播中的话术片段；商品参数、尺码与价格以原素材明确说明为准。'};
}
