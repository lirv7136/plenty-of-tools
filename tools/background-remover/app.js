(function() {
  'use strict';
  const $=id=>document.getElementById('br-'+id), core=window.BackgroundCore;
  const original=$('original'), result=$('result'), cutout=document.createElement('canvas');
  let worker=null, revision=0, fileName='', busy=false, hasResult=false, timer=null, exampleController=null;
  function status(text) { $('status').textContent=text; }
  function stopWorker() { clearTimeout(timer); timer=null; if(worker) worker.terminate(); worker=null; }
  function setBusy(value) {
    busy=value; $('remove').disabled=value; $('cancel').hidden=!value; $('progress-wrap').hidden=!value;
    $('state').textContent=value?'Processing':hasResult?'Done':'Ready';
  }
  function clear() {
    revision++; stopWorker(); if(exampleController) exampleController.abort(); exampleController=null;
    hasResult=false; setBusy(false); fileName=''; $('file').value=''; $('editor').hidden=true; $('clear').hidden=true;
    $('error').hidden=true; $('result').hidden=true; $('placeholder').hidden=false; $('download').hidden=true;
    $('options').hidden=true; $('quality').hidden=true; $('credit').hidden=true; $('info').textContent=''; $('dimensions').textContent='';
    $('remove').textContent='Remove background';
    for (const c of [original,result,cutout]) c.width=c.height=1;
    document.querySelector('input[name="br-background"][value="transparent"]').checked=true;
    status('Ready when you are.');
  }
  function fail(message) { stopWorker(); setBusy(false); $('error').textContent=message; $('error').hidden=false; status('Could not finish. You can try again.'); }
  async function loadFile(file,isExample=false,token=revision) {
    let bitmap;
    try {
      if(file.size>20*1024*1024) throw new Error('Choose an image smaller than 20 MB.');
      core.imageFormat(new Uint8Array(await file.slice(0,12).arrayBuffer()));
      if(token!==revision) return;
      if(!window.createImageBitmap || !window.Worker || !window.WebAssembly) throw new Error('This browser cannot run the remover. Try a recent Chrome, Edge, Firefox or Safari browser.');
      bitmap=await createImageBitmap(file,{imageOrientation:'from-image'});
      if(token!==revision) return;
      core.validateSize(bitmap.width,bitmap.height,file.size);
      original.width=bitmap.width; original.height=bitmap.height; original.getContext('2d').drawImage(bitmap,0,0);
      fileName=file.name||'image.png'; $('info').textContent=`${fileName} · ${bitmap.width} × ${bitmap.height} pixels`;
      $('editor').hidden=false; $('clear').hidden=false; $('credit').hidden=!isExample; $('editor-title').focus();
    } catch(error) { if(token===revision) fail(error.message || 'This image could not be read. Try another JPEG, PNG or WebP.'); }
    finally { if(bitmap) bitmap.close(); }
  }
  function openFile(file) { clear(); if(file) loadFile(file); }
  function render() {
    if(!hasResult) return;
    result.width=cutout.width; result.height=cutout.height;
    const ctx=result.getContext('2d'), choice=document.querySelector('input[name="br-background"]:checked').value;
    if(choice!=='transparent') { ctx.fillStyle=choice==='custom'?$('colour').value:choice; ctx.fillRect(0,0,result.width,result.height); }
    ctx.drawImage(cutout,0,0);
  }
  function finish(buffer) {
    const small=document.createElement('canvas'); small.width=small.height=320;
    small.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(buffer),320,320),0,0);
    cutout.width=original.width; cutout.height=original.height;
    const ctx=cutout.getContext('2d'); ctx.drawImage(original,0,0); ctx.globalCompositeOperation='destination-in';
    ctx.imageSmoothingEnabled=true; ctx.imageSmoothingQuality='high'; ctx.drawImage(small,0,0,cutout.width,cutout.height); ctx.globalCompositeOperation='source-over';
    hasResult=true; render(); setBusy(false); clearTimeout(timer);
    $('result').hidden=false; $('placeholder').hidden=true; $('download').hidden=false; $('options').hidden=false; $('quality').hidden=false;
    $('dimensions').textContent=`${cutout.width} × ${cutout.height}`;
    $('remove').textContent='Remove again'; status('Done. Review the edges, choose your background, then download the PNG.');
    $('download').focus();
  }
  function remove() {
    if(busy || !fileName) return;
    $('error').hidden=true; setBusy(true); $('progress').removeAttribute('value'); status('Starting local background removal…');
    const token=revision;
    timer=setTimeout(()=>{ if(token===revision && busy) fail('Processing took too long on this device. Try a smaller image or another browser.'); },180000);
    try {
      if(!worker) worker=new Worker('/assets/background-remover/worker.js');
      worker.onmessage=event=>{
        if(token!==revision) return;
        const data=event.data;
        if(data.type==='status') { status(data.text); if(data.progress!==undefined) { $('progress').max=1; $('progress').value=data.progress; } else $('progress').removeAttribute('value'); }
        else if(data.type==='result') { try { finish(data.mask); } catch(error) { fail('The result could not be rendered. Try a smaller image.'); } }
        else if(data.type==='error') fail(`Background removal failed. ${data.text}`);
      };
      worker.onerror=event=>{ event.preventDefault(); if(token===revision) fail('The local processing engine could not start. Check your connection, reload the page and try again.'); };
      const small=document.createElement('canvas'); small.width=small.height=320;
      const ctx=small.getContext('2d',{willReadFrequently:true}); ctx.fillStyle='#ffffff'; ctx.fillRect(0,0,320,320);
      ctx.imageSmoothingQuality='high'; ctx.drawImage(original,0,0,320,320);
      const pixels=ctx.getImageData(0,0,320,320).data.buffer; worker.postMessage({pixels},[pixels]);
    } catch(error) { fail('Unable to start background removal in this browser. Try reloading the page or using another browser.'); }
  }
  $('file').addEventListener('change',event=>openFile(event.target.files[0]));
  $('clear').addEventListener('click',()=>{clear(); $('remove').textContent='Remove background';});
  $('remove').addEventListener('click',remove);
  $('cancel').addEventListener('click',()=>{revision++;stopWorker();setBusy(false);status('Cancelled. Your original image is still here; you can try again.');});
  $('example').addEventListener('click',async()=>{
    clear(); const token=revision; exampleController=new AbortController(); $('example').disabled=true;
    try {
      const response=await fetch('/assets/background-remover/example-astronaut.png',{signal:exampleController.signal});
      if(!response.ok) throw new Error('The example could not load. Try opening your own photo.');
      const blob=await response.blob(); if(token!==revision) return;
      await loadFile(new File([blob],'nasa-astronaut.png',{type:'image/png'}),true,token);
    } catch(error) { if(token===revision && error.name!=='AbortError') fail(error.message); }
    finally { $('example').disabled=false; }
  });
  for(const radio of document.querySelectorAll('input[name="br-background"]')) radio.addEventListener('change',render);
  $('colour').addEventListener('input',()=>{document.querySelector('input[name="br-background"][value="custom"]').checked=true;render();});
  $('download').addEventListener('click',()=>{
    if(!hasResult) return;
    const token=revision, name=core.outputName(fileName); $('download').disabled=true;
    try {
      result.toBlob(blob=>{
        $('download').disabled=false; if(token!==revision) return;
        if(!blob) { fail('The PNG could not be created. Try a smaller image.'); return; }
        const url=URL.createObjectURL(blob), a=document.createElement('a'); a.href=url; a.download=name;
        document.body.append(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(url),1000);
        status('PNG downloaded. Your photo has stayed on this device.');
      },'image/png');
    } catch(error) { $('download').disabled=false; fail('The PNG could not be created. Try a smaller image.'); }
  });
  const drop=$('drop');
  for(const type of ['dragenter','dragover']) drop.addEventListener(type,event=>{event.preventDefault();drop.classList.add('dragging');});
  for(const type of ['dragleave','drop']) drop.addEventListener(type,event=>{event.preventDefault();drop.classList.remove('dragging');});
  drop.addEventListener('drop',event=>{if(event.dataTransfer.files.length!==1){$('error').textContent='Choose one image at a time.';$('error').hidden=false;return;}openFile(event.dataTransfer.files[0]);});
  window.addEventListener('pagehide',()=>{revision++;stopWorker();if(exampleController)exampleController.abort();if(busy){setBusy(false);status('Processing stopped when you left this page. You can try again.');}});
})();
