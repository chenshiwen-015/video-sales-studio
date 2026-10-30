import {money,pct,summarize,cohort,getFramework,keywords} from './core.mjs';
import {getSpeechFramework} from './speech.mjs';

export function createReportDocument(report,lib,demo=false){
  if(!lib)throw new Error('Word 导出组件尚未就绪，请稍后重试。');
  const {Document,Paragraph,TextRun,HeadingLevel,Table,TableRow,TableCell,WidthType,AlignmentType,ExternalHyperlink,Footer,PageNumber,BorderStyle,VerticalAlign,LineRuleType}=lib;
  const font='Arial',eastAsia='Songti SC',body=[];
  const text=(value,bold=false)=>new TextRun({text:String(value??''),bold,font:{ascii:font,hAnsi:font,eastAsia},color:'000000',size:22});
  const p=(value,small=false,keepNext=false)=>new Paragraph({children:[new TextRun({text:String(value),font:{ascii:font,hAnsi:font,eastAsia},color:'000000',size:small?19:22})],spacing:{after:110,line:330,lineRule:LineRuleType.EXACT},widowControl:true,keepNext});
  const h=(value,level=1)=>new Paragraph({text:value,heading:level===1?HeadingLevel.HEADING_1:HeadingLevel.HEADING_2,keepNext:true,spacing:{before:level===1?260:190,after:120,line:level===1?380:340,lineRule:LineRuleType.EXACT}});
  const scope={all:'全部视频',new:'本期发布视频',old:'此前发布视频'}[report.options.scope]||'全部视频';
  const metric=report.options.metric||'gmv',metricLabel=metric==='gmv'?'直接成交额':'订单数',period=report.options.period;
  const title=report.options.account==='all'?'账号视频成交与话术画面分析':`${report.options.account} 视频成交与话术画面分析`;
  const date=new Date().toLocaleDateString('zh-CN');
  body.push(new Paragraph({text:title,heading:HeadingLevel.TITLE,spacing:{after:180,line:490,lineRule:LineRuleType.EXACT}}));
  body.push(p(`统计区间 ${period.start} 至 ${period.end}    分析范围 ${scope}    整理日期 ${date}`,true));
  if(demo)body.push(p('当前报告使用虚构演示数据，仅用于体验分析流程。',true));
  const lead=report.groups.find(g=>g.name!=='待识别'&&(g[metric]??0)>0);
  body.push(p(lead?`按${metricLabel}排序，${lead.name}是当前主力品类，${lead.count}条视频贡献所选范围${metricLabel}的${pct(lead.share)}。后续二创宜优先筛选能呈现主力品类卖点的录播画面，并结合单条爆款贡献验证素材组合效果。`:'当前范围没有足够的正成交数据来判断主力品类，请核对字段、分析范围和原始数据。'));
  body.push(h('品类成交表现'));
  const t=report.totals;
  body.push(p(`本次分析${t.count}条记录，直接成交额${money(t.gmv)}元，成交订单数${money(t.orders)}单。引流成交额${money(t.assisted)}元单独统计。金额与订单缺失时不按0填充。`));
  const rows=[['视频主推品类','视频数','直接成交额 元','订单数','指标占比','出单覆盖'],...report.groups.map(g=>[g.name,String(g.count),money(g.gmv),money(g.orders),pct(g.share),pct(g.soldRate)])];
  const border={style:BorderStyle.SINGLE,size:4,color:'D9D9D9'},widths=[2300,700,1600,900,1100,1200];
  body.push(new Table({width:{size:100,type:WidthType.PERCENTAGE},columnWidths:widths,borders:{top:border,bottom:border,left:border,right:border,insideHorizontal:border,insideVertical:border},rows:rows.map((row,index)=>new TableRow({tableHeader:index===0,cantSplit:true,children:row.map((value,col)=>new TableCell({width:{size:widths[col],type:WidthType.DXA},verticalAlign:VerticalAlign.CENTER,margins:{top:100,bottom:100,left:100,right:100},shading:{fill:index===0?'243746':index%2===0?'F2F5F7':'FFFFFF'},children:[new Paragraph({children:[new TextRun({text:value,bold:index===0,size:20,color:index===0?'FFFFFF':'000000',font:{ascii:font,hAnsi:font,eastAsia:'Heiti SC'}})],alignment:col===0?AlignmentType.LEFT:AlignmentType.CENTER,spacing:{after:0,line:280}})]}))}))}));
  body.push(p(`占比按${metricLabel}合计计算。出单覆盖为有订单的记录数除以订单信息完整的记录数，不是用户购买转化率。`,true));
  body.push(h('主要发现'));
  for(const insight of report.insights){body.push(h(insight.title,2));body.push(p(insight.text));}
  body.push(h('新旧视频贡献'));
  for(const [key,label] of [['new','本期发布'],['old','此前发布'],['after','统计区间之后发布'],['unknown','发布时间缺失']]){
    const rr=report.records.filter(r=>cohort(r,period)===key);if(!rr.length)continue;const s=summarize(rr);
    body.push(p(`${label}共${rr.length}条，直接成交额${money(s.gmv)}元，订单数${money(s.orders)}单。`));
  }
  body.push(p('发布时间与报表统计区间是两个不同口径。统计区间在本工具中用于区分新旧视频，不能从发布时间推导成交发生日期。比较二创视频表现时，建议比较发布后相同天数的成交。',true));
  body.push(h('主要品类的话术与画面建议'));
  body.push(p('以下同时保留视频话术内容框架分析和二创画面建议。话术主线依据品类、有成交视频的标题卖点推断，用于筛选和重组已有录播表达，不代表原片口播转写。画面类别用于挑选对应素材，缺少的片段可跳过；商品信息以原素材明确说明为准。',true));
  for(const group of report.groups.filter(g=>g.name!=='待识别').slice(0,6)){
    const f=getFramework(group.name),speech=getSpeechFramework(group.name,group.records,metric);body.push(h(`${group.name} ${f.focus}`,2));
    body.push(p(`${group.count}条视频，直接成交额${money(group.gmv)}元，订单数${money(group.orders)}单。单条最高贡献占该品类${metricLabel}的${pct(group.topShare)}。`,false,true));
    const tags=keywords(group.records);if(tags.length)body.push(p('标题常见卖点：'+tags.map(t=>`${t.word} ${t.count}条`).join('、'),false,true));
    body.push(new Paragraph({children:[text('视频话术内容框架',true)],keepNext:true,spacing:{before:120,after:100,line:330,lineRule:LineRuleType.EXACT}}));
    body.push(p(speech.basis,true));
    body.push(p('建议话术主线：'+speech.angle,false,true));
    speech.stages.forEach((item,i)=>body.push(new Paragraph({children:[text(`${i+1}  ${item.label}：`,true),text(item.detail)],indent:{left:240,hanging:240},spacing:{after:70,line:320,lineRule:LineRuleType.EXACT},keepNext:i<speech.stages.length-1})));
    body.push(p('话术开头示例：“'+speech.opening+'”'));
    body.push(p(speech.note,true));
    body.push(new Paragraph({children:[text('二创画面建议',true)],keepNext:true,spacing:{before:120,after:100,line:330,lineRule:LineRuleType.EXACT}}));
    body.push(p('建议画面类别',false,true));
    f.shots.forEach((shot,i)=>body.push(new Paragraph({children:[text(`${i+1}  ${shot.type}：`,true),text(shot.use)],indent:{left:240,hanging:240},spacing:{after:70,line:320,lineRule:LineRuleType.EXACT},keepNext:i<f.shots.length-1})));
    body.push(p('建议剪辑顺序：'+f.shots.map(shot=>shot.type).join(' → ')));
    body.push(p(f.watch,true));
    body.push(p('参考视频',true));
    for(const r of group.top){
      const label=r.title||'无标题视频';
      const children=r.url?[new ExternalHyperlink({link:r.url,children:[new TextRun({text:label,style:'Hyperlink',size:20})]})]:[new TextRun({text:label,size:20})];
      children.push(new TextRun({text:`；直接成交${money(r.gmv)}元，${money(r.orders)}单${r.duration!==null?'，'+money(r.duration)+'秒':''}；${r.published||'发布日期未提供'}；来源第${r.row}行。`,size:19}));
      body.push(new Paragraph({children,spacing:{after:100,line:300,lineRule:LineRuleType.EXACT},widowControl:true}));
    }
  }
  body.push(h('数据口径与来源'));
  body.push(p(`来源文件：${report.filename}。统计区间${period.start}至${period.end}，${period.source}。当前账号筛选：${report.options.account==='all'?'全部账号':report.options.account}；分析范围：${scope}。`,true));
  body.push(p('品类优先采用表内商品品类，缺少时由标题关键词推断，也可能由使用者手动修正。一条视频包含多个商品时，本表不能还原商品级销量。标题提到的卖点与成交存在关联，不能据此认定因果关系。',true));
  body.push(p('直接成交额与引流成交额不混加。平均每单成交额仅计算金额和订单数均完整的记录，不等同于商品单价。观看次数可能由“万”等简写换算，未使用观看次数代替商品点击次数计算购买转化率。',true));
  const unknown=report.groups.find(g=>g.name==='待识别');if(unknown)body.push(p(`仍有${unknown.count}条待识别记录，直接成交额${money(unknown.gmv)}元，保留在品类统计中。`,true));
  if(report.quality.removedExact)body.push(p(`本次忽略${report.quality.removedExact}条内容完全相同的重复行。`,true));
  if(report.quality.duplicates?.length)body.push(p(`另有${report.quality.duplicates.length}行与其他记录的视频ID或链接重复，当前保留。请核对数据粒度和成交是否重复归属。`,true));
  for(const [key,value] of Object.entries(t.missing)){if(value&&['gmv','orders','published','views'].includes(key))body.push(p(`${({gmv:'直接成交额',orders:'订单数',published:'发布时间',views:'观看次数'})[key]}缺失${value}条，相关结果受数据完整度限制。`,true));}
  return new Document({creator:'',title,description:'视频带货品类与内容框架分析',styles:{default:{document:{run:{font:{ascii:font,hAnsi:font,eastAsia},size:22,color:'000000'},paragraph:{spacing:{after:110,line:330}}}},paragraphStyles:[{id:'Title',name:'Title',basedOn:'Normal',next:'Normal',run:{size:38,bold:true,color:'000000',font:{ascii:font,hAnsi:font,eastAsia:'Heiti SC'}},paragraph:{spacing:{after:180},keepNext:true}},{id:'Heading1',name:'Heading 1',basedOn:'Normal',next:'Normal',run:{size:29,bold:true,color:'000000',font:{ascii:font,hAnsi:font,eastAsia:'Heiti SC'}},paragraph:{keepNext:true}},{id:'Heading2',name:'Heading 2',basedOn:'Normal',next:'Normal',run:{size:24,bold:true,color:'000000',font:{ascii:font,hAnsi:font,eastAsia:'Heiti SC'}},paragraph:{keepNext:true}}]},sections:[{properties:{page:{size:{width:12240,height:15840},margin:{top:1000,bottom:1000,left:1080,right:1080}}},footers:{default:new Footer({children:[new Paragraph({children:[new TextRun({children:[PageNumber.CURRENT],size:18})],alignment:AlignmentType.CENTER})]})},children:body}]});
}
export async function downloadWord(report,demo=false){
  const lib=globalThis.docx,document=createReportDocument(report,lib,demo),blob=await lib.Packer.toBlob(document),url=URL.createObjectURL(blob),a=window.document.createElement('a');
  a.href=url;a.download=`视频成交分析_${report.options.period.start}_${report.options.period.end}.docx`;window.document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),3000);
}
