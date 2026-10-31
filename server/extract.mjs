import {publicGet,validateUrl} from './network.mjs';
import {videoKey} from '../dist/evidence.mjs';
export function jsonObjects(html){
  const values=[];
  for(const m of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)){
    let s=m[1].trim();
    for(const candidate of [s,(()=>{try{return decodeURIComponent(s);}catch{return '';}})()]){
      try{values.push(JSON.parse(candidate));continue;}catch{}
      const start=candidate.search(/[\[{]/);if(start<0)continue;
      let depth=0,quoted=false,escaped=false;
      for(let i=start;i<candidate.length;i++){
        const c=candidate[i];if(quoted){if(escaped)escaped=false;else if(c==='\\')escaped=true;else if(c==='"')quoted=false;continue;}
        if(c==='"')quoted=true;else if(c==='{'||c==='[')depth++;else if(c==='}'||c===']'){depth--;if(!depth){try{values.push(JSON.parse(candidate.slice(start,i+1)));}catch{}break;}}
      }
    }
  }
  return values;
}
export function findVideo(objects,id){
  const queue=[...objects];let visits=0;
  while(queue.length&&visits++<100000){const obj=queue.pop();if(!obj||typeof obj!=='object')continue;
    if(String(obj.aweme_id||obj.awemeId||obj.item_id||'')===id&&obj.video)return obj;
    for(const value of Object.values(obj))if(value&&typeof value==='object')queue.push(value);
  }
  return null;
}
export function mediaFromObject(obj){
  const video=obj.video||{},addresses=[video.play_addr,video.playAddr,...(video.bit_rate||[]).map(x=>x.play_addr)];
  const urls=addresses.flatMap(x=>x?.url_list||x?.urlList||[]).filter(x=>typeof x==='string');
  const url=urls.find(u=>u.startsWith('https://'))||urls[0];
  return {url:url?.replace(/^http:\/\//,'https://'),title:obj.desc||'',duration:Math.min(Number(video.duration||0)/1000,600)};
}
export async function locateVideo(item){
  const key=videoKey(item);if(!key?.startsWith('douyin:'))throw new Error('当前自动读取支持抖音视频详情链接或作品 ID');
  const id=key.slice(7),candidates=[`https://www.iesdouyin.com/share/video/${id}/`,`https://www.douyin.com/video/${id}`];
  let reason='平台未提供可读取的视频内容，可能需要登录或触发访问限制';
  for(const url of candidates){
    try{validateUrl(url);const {body}=await publicGet(url);const html=body.toString('utf8');
      if(/你要观看的视频不存在/.test(html)){reason='你要观看的视频不存在';continue;}
      const obj=findVideo(jsonObjects(html),id);if(!obj)continue;
      const media=mediaFromObject(obj);if(media.url)return media;
    }catch(e){reason=e.message;}
  }
  throw new Error(reason);
}
