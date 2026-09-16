(() => {
  'use strict';
  const C=window.TranscriptionCore,$=id=>document.getElementById(id);
  let file=null,audioURL=null,worker=null,controller=null,token=0,busy=false,duration=0,segments=[],playUntil=null;
  const downloads=new Map();
  const status=text=>{$('tr-status').textContent=text;};
  const error=(text='')=>{$('tr-error').textContent=text;$('tr-error').hidden=!text;};
  function setBusy(value){busy=value;for(const id of ['tr-open','tr-example','tr-cache','tr-forget'])$(id).disabled=value;$('tr-start').disabled=value||!file;$('tr-cancel').hidden=!value;}
  function releaseWorker(){worker?.terminate();worker=null;}
  function stop(message='Stopped. Your audio is still loaded; you can start again.'){
    token++;releaseWorker();controller?.abort();controller=null;setBusy(false);$('tr-progress-panel').hidden=true;status(message);
  }
  function resetTranscript(){segments=[];$('tr-segments').replaceChildren();$('tr-results').hidden=true;$('tr-timing-errors').hidden=true;}
  function loadFile(next){
    if(!next)return;
    if(next.size>C.MAX_BYTES){error('This file exceeds 50 MB. Choose a smaller audio file.');return;}
    if(next.size===0){error('This file is empty. Choose an audio file with recorded speech.');return;}
    stop();resetTranscript();error();file=next;duration=0;playUntil=null;
    $('tr-audio').pause();$('tr-audio').removeAttribute('src');if(audioURL)URL.revokeObjectURL(audioURL);
    audioURL=URL.createObjectURL(file);$('tr-audio').src=audioURL;$('tr-audio-panel').hidden=false;$('tr-filename').textContent=file.name;
    $('tr-file-info').textContent=`${(file.size/1024/1024).toFixed(2)} MB · audio will be decoded locally`;
    setBusy(false);status('Audio ready. Press Transcribe English to load the model and begin.');
  }
  $('tr-audio').addEventListener('loadedmetadata',()=>{const d=$('tr-audio').duration;if(Number.isFinite(d)&&d>0&&file){$('tr-file-info').textContent=`${C.timestamp(d,'.')} · ${(file.size/1024/1024).toFixed(2)} MB`;
    if(d>C.MAX_SECONDS+.001){error('This recording exceeds 10 minutes. Choose a shorter recording.');$('tr-start').disabled=true;}
  }});
  $('tr-audio').addEventListener('timeupdate',()=>{if(playUntil!==null&&$('tr-audio').currentTime>=playUntil){$('tr-audio').pause();playUntil=null;}});
  $('tr-open').addEventListener('click',()=>$('tr-file').click());
  $('tr-file').addEventListener('change',()=>{const next=$('tr-file').files[0];$('tr-file').value='';loadFile(next);});
  $('tr-example').addEventListener('click',async()=>{
    stop();const run=++token;controller=new AbortController();setBusy(true);error();status('Opening the short example…');
    try{const response=await fetch('/assets/transcription/example-jfk.wav',{signal:controller.signal});if(!response.ok)throw new Error('The example file could not be loaded.');const blob=await response.blob();if(run!==token)return;loadFile(new File([blob],'jfk-example.wav',{type:'audio/wav'}));}
    catch(e){if(run===token){setBusy(false);error(e.message);status('Example could not be opened. You can choose your own audio file.');}}
  });
  function updateExports(){
    const any=segments.some(s=>s.text.trim()),problems=C.validate(segments,duration);
    $('tr-txt').disabled=!any;$('tr-srt').disabled=!any||problems.length>0;$('tr-timing-errors').hidden=!problems.length;$('tr-timing-errors').textContent=problems.join(' ');
    const words=segments.map(s=>s.text.trim()).filter(Boolean).join(' ').split(/\s+/).filter(Boolean).length;
    $('tr-summary').textContent=`${segments.length} segments · ${words} words · ${C.timestamp(duration,'.')} audio`;
  }
  function renderSegments(){
    $('tr-segments').replaceChildren();
    segments.forEach((s,i)=>{
      const row=document.createElement('div');row.className='tr-segment';const times=document.createElement('div');times.className='tr-times';
      for(const key of ['start','end']){
        const label=document.createElement('label');label.textContent=key==='start'?'Start (seconds)':'End (seconds)';
        const input=document.createElement('input');input.type='number';input.min=0;input.max=duration;input.step=.001;input.value=s[key];input.setAttribute('aria-label',`Segment ${i+1} ${key} in seconds`);
        input.addEventListener('input',()=>{s[key]=input.value;updateExports();});label.append(input);times.append(label);
      }
      const play=document.createElement('button');play.className='btn small';play.textContent='Play';play.setAttribute('aria-label',`Play segment ${i+1}`);
      play.addEventListener('click',()=>{const start=Number(s.start),end=Number(s.end);if(!s.start.toString().trim()||!Number.isFinite(start)||start<0||start>duration)return;$('tr-audio').currentTime=start;playUntil=Number.isFinite(end)&&end>start?end:null;$('tr-audio').play().catch(()=>status('Use the audio player to listen to this segment.'));});times.append(play);
      const label=document.createElement('label');label.className='tr-segment-text';const title=document.createElement('span');title.textContent=`Segment ${i+1}`;
      const text=document.createElement('textarea');text.rows=3;text.maxLength=10000;text.value=s.text;text.addEventListener('input',()=>{s.text=text.value;updateExports();});label.append(title,text);row.append(times,label);$('tr-segments').append(row);
    });$('tr-results').hidden=false;updateExports();
  }
  function downloadProgress(info){
    if(!info.file)return;
    const previous=downloads.get(info.file)||{};downloads.set(info.file,{...previous,...info});$('tr-downloads').replaceChildren();
    for(const [name,item]of downloads){const li=document.createElement('li');li.textContent=`${name.split('/').at(-1)} — ${item.status==='done'?'ready':Number.isFinite(item.progress)?`${Math.min(100,Math.round(item.progress))}%`:'loading'}`;$('tr-downloads').append(li);}
    const values=[...downloads.values()],known=values.filter(v=>v.total>0);const loaded=known.reduce((s,v)=>s+(v.loaded||0),0);
    $('tr-progress').removeAttribute('value');$('tr-progress-label').textContent=`Loading model files${loaded?` · ${(loaded/1024/1024).toFixed(1)} MB read`:''}. This may include files already cached on your device.`;
  }
  $('tr-start').addEventListener('click',async()=>{
    if(busy||!file)return;
    stop();const run=++token;setBusy(true);error();resetTranscript();downloads.clear();$('tr-downloads').replaceChildren();$('tr-cache-status').textContent='';
    $('tr-progress-panel').hidden=false;$('tr-progress').removeAttribute('value');$('tr-progress-label').textContent='Decoding and resampling to 16 kHz on your device…';status('Preparing audio…');
    try {
      const Offline=window.OfflineAudioContext||window.webkitOfflineAudioContext;
      if(!Offline||!window.Worker||!window.WebAssembly)throw new Error('This browser lacks the audio or WebAssembly features needed. Try a current desktop browser.');
      const bytes=await file.arrayBuffer();if(run!==token)return;
      let decoded;try{decoded=await new Offline(1,1,C.SAMPLE_RATE).decodeAudioData(bytes);}catch{throw new Error('This browser could not decode the audio. Try a WAV or MP3 version.');}
      if(run!==token)return;
      duration=Math.round(decoded.duration*1000)/1000;
      if(!duration||duration>C.MAX_SECONDS)throw new Error('Choose audio between a fraction of a second and 10 minutes long.');
      const samples=C.mono(Array.from({length:decoded.numberOfChannels},(_,i)=>decoded.getChannelData(i)));decoded=null;
      if(C.isSilent(samples)){setBusy(false);$('tr-progress-panel').hidden=true;status('This audio is silent or extremely quiet. No model was downloaded and no transcript was generated.');return;}
      status('Loading the English model. Your audio stays on this device.');
      worker=new Worker('/assets/transcription/worker.js',{type:'module'});
      worker.onmessage=({data})=>{
        if(run!==token)return;
        if(data.type==='download')downloadProgress(data.info);
        else if(data.type==='cache-warning')$('tr-cache-status').textContent='The browser could not save model files. Transcription can continue, but the next run may need another download.';
        else if(data.type==='transcribing'){
          status('Transcribing English on your device…');$('tr-downloads').replaceChildren();$('tr-progress').max=data.total;$('tr-progress').value=data.completed;
          $('tr-progress-label').textContent=`${data.completed} of ${data.total} overlapping audio chunks processed. Speed depends on your device; keep this tab open.`;
        }else if(data.type==='complete'){
          const result=C.normalise(data.output,duration);segments=result.segments;$('tr-timing-note').hidden=!result.adjusted;
          releaseWorker();setBusy(false);$('tr-progress-panel').hidden=true;
          if(segments.length){renderSegments();status('Transcription complete. Review the words and timestamps before downloading.');}
          else status('No speech was transcribed. Try a clearer recording with English speech.');
        }else if(data.type==='error')fail(data.message);
      };
      worker.onerror=e=>{e.preventDefault();if(run===token)fail(e.message||'The transcription worker stopped unexpectedly.');};
      worker.postMessage({type:'transcribe',samples,cache:$('tr-cache').checked},[samples.buffer]);
    }catch(e){if(run===token)fail(e.message);}
  });
  function fail(message){releaseWorker();setBusy(false);$('tr-progress-panel').hidden=true;error(`Could not transcribe: ${String(message).slice(0,450)}`);status('Your audio is still loaded. Check your connection for a first-time model download, or retry with a shorter WAV/MP3 file.');}
  $('tr-cancel').addEventListener('click',()=>stop());
  $('tr-clear').addEventListener('click',()=>{
    stop();file=null;duration=0;resetTranscript();error();$('tr-audio').pause();$('tr-audio').removeAttribute('src');$('tr-audio').load();if(audioURL)URL.revokeObjectURL(audioURL);audioURL=null;playUntil=null;
    $('tr-audio-panel').hidden=true;$('tr-filename').textContent='';$('tr-file-info').textContent='';$('tr-file').value='';setBusy(false);status('Audio and transcript cleared from this tab. Cached model files are separate.');
  });
  $('tr-forget').addEventListener('click',async()=>{
    if(busy)return;$('tr-forget').disabled=true;
    try{if(!('caches'in window))throw new Error();await caches.delete(C.CACHE_NAME);$('tr-cache-status').textContent='Cached model removed. The next run will download it again.';}
    catch{$('tr-cache-status').textContent='Model storage is unavailable in this browser. You can clear this site’s data in browser settings.';}
    finally{$('tr-forget').disabled=busy;}
  });
  function save(kind){
    updateExports();if($(kind==='txt'?'tr-txt':'tr-srt').disabled)return;
    const text=kind==='txt'?C.exportText(segments):C.exportSRT(segments,duration),url=URL.createObjectURL(new Blob([text],{type:kind==='txt'?'text/plain;charset=utf-8':'application/x-subrip;charset=utf-8'}));
    const link=document.createElement('a');link.href=url;link.download=(file.name.replace(/\.[^.]+$/,'').replace(/[^a-z0-9_-]+/gi,'-').slice(0,100)||'transcript')+'.'+kind;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  $('tr-txt').addEventListener('click',()=>save('txt'));$('tr-srt').addEventListener('click',()=>save('srt'));
  window.addEventListener('pagehide',()=>{releaseWorker();controller?.abort();});
})();
