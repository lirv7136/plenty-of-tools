import {pipeline,env} from './transformers.min.js';
const MODEL='Xenova/whisper-tiny.en',REVISION='79fb389fc764e7c395bd330e9531d9d32ada7049';
const CACHE_NAME='pot-transcription-whisper-tiny-en-v1';
env.allowLocalModels=false;
env.useBrowserCache=false;env.useFSCache=false;env.useFS=false;
env.backends.onnx.wasm.wasmPaths=new URL('./',import.meta.url).href;
env.backends.onnx.wasm.numThreads=1;
env.backends.onnx.wasm.proxy=false;
const send=(type,data={})=>self.postMessage({type,...data});
self.onmessage=async({data})=>{
  if(data.type!=='transcribe')return;
  try {
    if(data.cache){
      try {
        const cache=await caches.open(CACHE_NAME);env.useCustomCache=true;
        env.customCache={match:key=>cache.match(key),put:async(key,response)=>{try{await cache.put(key,response);}catch{send('cache-warning');}}};
      }catch{send('cache-warning');env.useCustomCache=false;}
    }else env.useCustomCache=false;
    const transcriber=await pipeline('automatic-speech-recognition',MODEL,{revision:REVISION,quantized:true,progress_callback:info=>send('download',{info})});
    const total=Math.ceil(data.samples.length/(20*16000));let completed=0;
    send('transcribing',{completed,total});
    const output=await transcriber(data.samples,{return_timestamps:true,chunk_length_s:30,stride_length_s:5,do_sample:false,max_new_tokens:440,chunk_callback:()=>send('transcribing',{completed:++completed,total})});
    send('complete',{output});
  }catch(e){send('error',{message:e?.message||String(e)});}
};
