import https from 'node:https';
import dns from 'node:dns/promises';
import net from 'node:net';
export function publicAddress(ip){
  if(net.isIPv4(ip)){const [a,b]=ip.split('.').map(Number);return !(a===0||a===10||a===127||a>=224||(a===169&&b===254)||(a===172&&b>=16&&b<=31)||(a===192&&(b===168||b===0))||(a===100&&b>=64&&b<=127)||(a===198&&(b===18||b===19)));}
  // Reject mapped, link-local, unique-local and other non-global IPv6 addresses.
  return net.isIPv6(ip)&&/^[23]/i.test(ip)&&!ip.toLowerCase().startsWith('2001:db8:');
}
export function validateUrl(value){
  const u=new URL(value);
  if(u.protocol!=='https:'||u.username||u.password||(u.port&&u.port!=='443')||u.hostname.endsWith('.local')||u.hostname==='localhost')throw new Error('仅支持公开 HTTPS 视频链接');
  return u;
}
export async function publicGet(value,{limit=4*1024*1024,redirects=4,headers={}}={}){
  const u=validateUrl(value),hostname=u.hostname.replace(/^\[|\]$/g,'');
  const addresses=net.isIP(hostname)?[{address:hostname,family:net.isIP(hostname)}]:await dns.lookup(hostname,{all:true});
  if(!addresses.length||addresses.some(a=>!publicAddress(a.address)))throw new Error('视频链接解析到非公开网络地址');
  const addr=addresses[0];
  return new Promise((resolve,reject)=>{
    const req=https.get(u,{headers:{'User-Agent':'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1','Accept-Encoding':'identity',...headers},lookup:(_h,opts,cb)=>opts?.all?cb(null,[addr]):cb(null,addr.address,addr.family)},res=>{
      if(res.statusCode>=300&&res.statusCode<400&&res.headers.location){res.resume();if(!redirects)return reject(new Error('视频链接重定向过多'));return resolve(publicGet(new URL(res.headers.location,u).href,{limit,redirects:redirects-1,headers}));}
      if(res.statusCode!==200){res.resume();return reject(new Error(`视频平台返回 HTTP ${res.statusCode}`));}
      if(Number(res.headers['content-length'])>limit){res.destroy();return reject(new Error('视频资源超过处理大小上限'));}
      const chunks=[];let size=0;res.on('data',chunk=>{size+=chunk.length;if(size>limit){res.destroy(new Error('视频资源超过处理大小上限'));return;}chunks.push(chunk);});
      res.on('end',()=>resolve({body:Buffer.concat(chunks),url:u.href,type:String(res.headers['content-type']||'')}));res.on('error',reject);
    });
    const timer=setTimeout(()=>req.destroy(new Error('读取视频平台超时')),45000);timer.unref();req.on('close',()=>clearTimeout(timer));req.on('error',reject);
  });
}
