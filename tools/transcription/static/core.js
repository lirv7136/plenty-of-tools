(function(root){
  'use strict';
  const SAMPLE_RATE=16000, MAX_SECONDS=600, MAX_BYTES=50*1024*1024, CACHE_NAME='pot-transcription-whisper-tiny-en-v1';
  function timestamp(seconds,separator=',') {
    let ms=Math.max(0,Math.round(seconds*1000));
    const hours=Math.floor(ms/3600000);ms%=3600000;const minutes=Math.floor(ms/60000);ms%=60000;const secs=Math.floor(ms/1000);ms%=1000;
    return `${String(hours).padStart(2,'0')}:${String(minutes).padStart(2,'0')}:${String(secs).padStart(2,'0')}${separator}${String(ms).padStart(3,'0')}`;
  }
  function normalise(output,duration) {
    if(!Number.isFinite(duration)||duration<=0)throw new Error('Audio duration must be positive.');
    const chunks=Array.isArray(output.chunks)?output.chunks:[],segments=[];let adjusted=false;
    for(let i=0;i<chunks.length;i++){
      const text=String(chunks[i].text||'').trim();if(!text)continue;
      const [rawStart,rawEnd]=chunks[i].timestamp||[],previous=segments.at(-1)?.end||0;
      const start=Math.min(duration,Math.max(previous,Number.isFinite(rawStart)?rawStart:previous));
      const nextStart=chunks[i+1]?.timestamp?.[0];
      const end=Math.min(duration,Math.max(start,Number.isFinite(rawEnd)?rawEnd:Number.isFinite(nextStart)?nextStart:duration));
      if(rawStart!==start||rawEnd!==end)adjusted=true;
      if(end>start)segments.push({start,end,text});
      else if(segments.length){segments.at(-1).text+=' '+text;adjusted=true;}
    }
    if(!segments.length&&String(output.text||'').trim()){segments.push({start:0,end:duration,text:String(output.text).trim()});adjusted=true;}
    // Align the editor and SRT to millisecond precision.
    return {segments:segments.map(s=>({...s,start:Math.round(s.start*1000)/1000,end:Math.round(s.end*1000)/1000})),adjusted};
  }
  function validate(segments,duration){
    const errors=[];let previous=0;
    segments.forEach((s,i)=>{
      if(!String(s.text).trim())return; // Empty text removes this cue from exports.
      const start=typeof s.start==='string'&&s.start.trim()===''?NaN:Number(s.start),end=typeof s.end==='string'&&s.end.trim()===''?NaN:Number(s.end);
      if(!Number.isFinite(start)||!Number.isFinite(end)||start<0||end>duration+.001||end<=start||Math.round(end*1000)<=Math.round(start*1000))errors.push(`Segment ${i+1}: use a start and end within the audio, with the end after the start.`);
      else if(start<previous-.0005)errors.push(`Segment ${i+1}: its start overlaps the previous segment.`);
      previous=end;
    });return errors;
  }
  function exportText(segments){return segments.filter(s=>s.text.trim()).map(s=>s.text.trim()).join('\n\n')+'\n';}
  function exportSRT(segments,duration){
    const errors=validate(segments,duration);if(errors.length)throw new Error(errors[0]);
    return segments.filter(s=>s.text.trim()).map((s,i)=>`${i+1}\n${timestamp(Number(s.start))} --> ${timestamp(Number(s.end))}\n${s.text.trim().replace(/\r/g,'').replace(/\n\s*\n/g,'\n')}`).join('\n\n')+'\n';
  }
  function mono(channels){
    if(!channels.length||channels.some(c=>c.length!==channels[0].length))throw new Error('Audio channels must have matching lengths.');
    const samples=new Float32Array(channels[0].length);
    for(const channel of channels)for(let i=0;i<samples.length;i++)samples[i]+=channel[i]/channels.length;
    return samples;
  }
  function isSilent(samples){let peak=0;for(const s of samples)peak=Math.max(peak,Math.abs(s));return peak<1e-5;}
  const api={SAMPLE_RATE,MAX_SECONDS,MAX_BYTES,CACHE_NAME,timestamp,normalise,validate,exportText,exportSRT,mono,isSilent};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.TranscriptionCore=api;
})(typeof globalThis!=='undefined'?globalThis:this);
