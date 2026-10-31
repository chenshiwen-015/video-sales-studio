import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {publicGet} from './network.mjs';
const exec=promisify(execFile);
export async function sampleMedia(media){
  const dir=await mkdtemp(join(tmpdir(),'video-sales-'));
  try{
    const {body}=await publicGet(media.url,{limit:100*1024*1024});const file=join(dir,'video.mp4');await writeFile(file,body);
    const probe=await exec('ffprobe',['-v','error','-show_entries','format=duration','-of','json',file],{timeout:15000,maxBuffer:100000});
    const duration=Number(JSON.parse(probe.stdout).format?.duration);if(!Number.isFinite(duration)||duration<=0||duration>600)throw new Error('仅处理时长不超过 10 分钟的视频');
    const seconds=[...new Set([0.6,1.8,3.5,duration*.18,duration*.35,duration*.55,duration*.72,duration*.86,duration-1].filter(t=>t>0&&t<duration).map(t=>Number(t.toFixed(1))))].sort((a,b)=>a-b);
    const frames=[];
    for(const [i,t] of seconds.entries()){
      const path=join(dir,`frame-${i}.jpg`);await exec('ffmpeg',['-hide_banner','-loglevel','error','-protocol_whitelist','file,pipe','-ss',String(t),'-i',file,'-frames:v','1','-vf','scale=720:960:force_original_aspect_ratio=decrease','-q:v','3',path],{timeout:20000,maxBuffer:100000});
      frames.push({seconds:t,image:await readFile(path)});
    }
    let audio=null;
    try{const path=join(dir,'audio.mp3');await exec('ffmpeg',['-hide_banner','-loglevel','error','-protocol_whitelist','file,pipe','-i',file,'-vn','-ac','1','-ar','16000','-b:a','32k',path],{timeout:45000,maxBuffer:100000});audio=await readFile(path);}catch{}
    return {frames,audio,duration};
  }finally{await rm(dir,{recursive:true,force:true});}
}
