'use strict';
importScripts('./core.js');
let session;
async function loadModel() {
  if (session) return session;
  postMessage({type:'status',text:'Loading processing engine (about 11 MB on first use)…'});
  importScripts('./ort.wasm.min.js');
  ort.env.wasm.wasmPaths = new URL('./', self.location.href).href;
  ort.env.wasm.numThreads = 1;
  ort.env.wasm.proxy = false;
  ort.env.logLevel = 'error';
  const response=await fetch(new URL('./u2netp.onnx', self.location.href));
  if (!response.ok) throw new Error('The cutout model could not be downloaded. Check your connection and try again.');
  const reader=response.body.getReader(), total=Number(response.headers.get('content-length'))||4574861;
  const chunks=[]; let loaded=0;
  while (true) {
    const {done,value}=await reader.read(); if(done) break;
    chunks.push(value); loaded+=value.length;
    postMessage({type:'status',text:'Loading cutout model…',progress:Math.min(1,loaded/total)});
  }
  const data=new Uint8Array(loaded); let offset=0;
  for (const chunk of chunks) { data.set(chunk,offset); offset+=chunk.length; }
  postMessage({type:'status',text:'Preparing the local processing engine…'});
  session=await ort.InferenceSession.create(data,{executionProviders:['wasm'],graphOptimizationLevel:'all'});
  return session;
}
self.onmessage=async event => {
  try {
    const active=await loadModel();
    postMessage({type:'status',text:'Removing the background on your device…'});
    const input=new ort.Tensor('float32',BackgroundCore.toTensor(new Uint8ClampedArray(event.data.pixels)),[1,3,320,320]);
    const output=await active.run({[active.inputNames[0]]:input});
    const prediction=output[active.outputNames[0]];
    if (prediction.data.length!==320*320) throw new Error('Unexpected model output. Please reload this page.');
    const mask=BackgroundCore.toMask(prediction.data);
    for (const tensor of Object.values(output)) tensor.dispose(); input.dispose();
    postMessage({type:'result',mask:mask.buffer},[mask.buffer]);
  } catch(error) {
    postMessage({type:'error',text:error.message || 'Processing failed. Try a smaller image or another browser.'});
  }
};
