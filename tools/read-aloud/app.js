(()=>{
  'use strict';
  const C=window.ReadAloudCore,$=id=>document.getElementById('ra-'+id),synth=window.speechSynthesis;
  let voices=[],items=[],documentId='',current=0,loading=false,store,loadToken=0;
  try{store=new C.PositionStore(window.localStorage);}catch{}
  function status(text,error=false){$('status').textContent=text;$('status').classList.toggle('ra-error',error);}
  function position(index,offset){
    current=index;document.querySelector('#ra-reader [aria-current]')?.removeAttribute('aria-current');const node=$('sentence-'+index);if(node){node.setAttribute('aria-current','true');const box=$('reader').getBoundingClientRect(),b=node.getBoundingClientRect();if(b.top<box.top||b.bottom>box.bottom)$('reader').scrollTop+=b.top-box.top-40;}
    $('progress').textContent=index>=items.length?'Finished — '+items.length+' sentences':'Sentence '+(index+1)+' of '+items.length;
    if(documentId)try{if(!store)throw new Error();store.save(documentId,offset);$('position-status').textContent='Position saved in this browser. Reopen identical text to resume.';}catch{$('position-status').textContent='Position could not be saved. Browser storage may be unavailable or full.';}
  }
  const player=synth?new window.ReadAloudPlayer.Player(synth,window.SpeechSynthesisUtterance,position,(state,message)=>{
    $('pause').disabled=state!=='playing';$('stop').disabled=!['playing','paused'].includes(state);$('play').textContent=state==='paused'?'Resume':'Play';
    if(message)status(message,true);else if(state==='playing')status('Reading aloud…');else if(state==='paused')status('Paused. Resume when ready.');else if(state==='finished')status('Finished reading.');
  }):null;
  function voiceList(){
    const selected=voices[Number($('voice').value)]?.voiceURI,lang=(navigator.language||'en').toLowerCase();voices=synth?.getVoices().filter(v=>v.localService===true)||[];$('voice').replaceChildren();
    voices.forEach((v,i)=>{const o=document.createElement('option');o.value=String(i);o.textContent=v.name+' ('+v.lang+')';$('voice').append(o);});
    const preferred=voices.find(v=>v.voiceURI===selected)||voices.find(v=>v.lang.toLowerCase()===lang)||voices.find(v=>v.lang.toLowerCase().split('-')[0]===lang.split('-')[0])||voices.find(v=>v.default)||voices[0];
    if(preferred)$('voice').value=String(voices.indexOf(preferred));$('play').disabled=loading||!items.length||!voices.length;
    if(preferred&&$('status').textContent.startsWith('This browser has no local speech voices'))status(items.length?'Voice ready. Press Play to listen.':'Paste or open a document to start.');
    if(!voices.length){const o=document.createElement('option');o.textContent='No local voices available';$('voice').append(o);status('This browser has no local speech voices available. Install a voice in your device settings or try another browser.',true);}
  }
  voiceList();synth?.addEventListener('voiceschanged',voiceList);
  function locked(on){loading=on;$('load').disabled=on;$('file').disabled=on;$('example').disabled=on;$('text').disabled=on;$('play').disabled=on||!items.length||!voices.length;}
  async function load(text){
    const normal=C.normalize(text);if(!normal)throw new Error('There is no readable text. Scanned PDFs need OCR before this tool can read them.');
    const next=C.split(normal),hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(normal))),b=>b.toString(16).padStart(2,'0')).join('');
    player?.stop();items=next;documentId=hash;let offset=0;try{offset=store?.read(hash)||0;}catch{}
    current=C.indexAt(items,Math.min(offset,normal.length));player?.set(items,current);$('reader').replaceChildren();let paragraph=-1,p;
    items.forEach((s,i)=>{if(s.paragraph!==paragraph){p=document.createElement('p');$('reader').append(p);paragraph=s.paragraph;}const button=document.createElement('button');button.type='button';button.className='ra-sentence';button.id='ra-sentence-'+i;button.textContent=s.text+' ';button.addEventListener('click',()=>player?.seek(i,player.state==='playing'));p.append(button);});
    $('text').value=normal;position(current,offset);for(const id of ['prev','next'])$(id).disabled=false;status(current>=items.length?'You finished this document. Play starts again.':offset?'Document ready at your saved position.':'Document ready. Choose a voice and press Play.');if(!voices.length)voiceList();
  }
  $('load').addEventListener('click',async()=>{if(loading)return;locked(true);player?.stop();try{await load($('text').value);}catch(e){status(e.message,true);}finally{locked(false);}});
  $('example').addEventListener('click',()=>{$('text').value='A clear voice can make a long page easier to follow. Change the rate to suit your pace.\n\nYou can skip by sentence or paragraph. Reopen the same text later and your reading position will be remembered.';$('load').click();});
  $('file').addEventListener('change',async()=>{
    const file=$('file').files[0];if(!file||loading)return;locked(true);player?.stop();const token=++loadToken;let task;
    try{
      const pdf=file.name.toLowerCase().endsWith('.pdf');if(file.size>(pdf?25:2)*1048576)throw new Error(pdf?'PDF limit: 25 MiB.':'TXT limit: 2 MiB.');let text;
      if(pdf){
        pdfjsLib.GlobalWorkerOptions.workerSrc='/assets/read-aloud/pdf.worker.min.js';
        task=pdfjsLib.getDocument({data:new Uint8Array(await file.arrayBuffer()),isEvalSupported:false,useSystemFonts:true,disableFontFace:true});
        const pdfDoc=await task.promise;if(pdfDoc.numPages>200)throw new Error('PDF limit: 200 pages.');const pages=[];let count=0;
        for(let n=1;n<=pdfDoc.numPages;n++){status('Reading PDF page '+n+' of '+pdfDoc.numPages+'…');const page=await pdfDoc.getPage(n),content=await page.getTextContent();let part='';for(const item of content.items)if(typeof item.str==='string')part+=item.str+(item.hasEOL?'\n':' ');count+=part.length+2;if(count>C.MAX_TEXT)throw new Error('PDF text exceeds 500,000 characters.');pages.push(part);page.cleanup();}text=pages.join('\n\n');
      }else{if(!file.name.toLowerCase().endsWith('.txt'))throw new Error('Choose a TXT or PDF file.');text=new TextDecoder('utf-8',{fatal:true}).decode(await file.arrayBuffer());if(text.includes('\0'))throw new Error('Use a plain UTF 8 TXT file.');}
      if(token===loadToken)await load(text);
    }catch(e){status(e.name==='PasswordException'?'This PDF needs a password. Open an unlocked copy.':e.message||'The document could not be read.',true);}finally{try{await task?.destroy();}catch{}locked(false);$('file').value='';}
  });
  $('play').addEventListener('click',()=>{const voice=voices[Number($('voice').value)];if(!loading&&voice&&player)player.play({voice,rate:Number($('rate').value),pitch:Number($('pitch').value)});});
  $('pause').addEventListener('click',()=>player?.pause());$('stop').addEventListener('click',()=>{player?.stop();status('Stopped. Play continues from this part.');});
  for(const id of ['rate','pitch'])$(id).addEventListener('input',()=>{$(id+'-label').textContent=$(id).value+(id==='rate'?'×':'');player?.stop();status('Setting changed. Press Play to continue.');});
  $('voice').addEventListener('change',()=>{player?.stop();status('Voice changed. Press Play to continue.');});
  for(const [id,direction] of [['prev',-1],['next',1]])$(id).addEventListener('click',()=>player?.seek(C.skip(items,current,direction,$('skip').value==='paragraph'),player.state==='playing'));
  $('forget').addEventListener('click',()=>{try{if(!store)throw new Error();store.clear();$('position-status').textContent='Saved positions cleared. Reading again will save a new position.';}catch{$('position-status').textContent='Browser storage is unavailable.';}});
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&player?.state==='playing'){player.pause();status('Paused because the tab is hidden. Return and press Resume.');}});
  window.addEventListener('pagehide',()=>player?.stop());
  window.__readAloud={get state(){return player?.state;},get count(){return items.length;},get index(){return current;},get voices(){return voices.map(v=>({name:v.name,lang:v.lang,localService:v.localService}));},get loading(){return loading;}};
})();
