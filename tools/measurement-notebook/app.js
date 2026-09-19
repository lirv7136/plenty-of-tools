(function(){
  'use strict';
  const C=window.MeasurementCore,R=window.MeasurementRender,$=id=>document.getElementById('mn-'+id),stage=$('stage');
  const P=window.MeasurementProjects,S=window.MeasurementStorage;
  let project=null,photoBlob=null,saveTimer=null,savePromise=null,editVersion=0;
  let doc=null,image=null,imageURL=null,originalFile=null,history=new C.History(),selected=null,draft=null,mode='select',pendingStart=null;
  let camera={zoom:1,cx:.5,cy:.5},gesture=null,pinch=null,busy=false,dirty=false,formDirty=false,loadGeneration=0;
  const pointers=new Map();
  function status(message,error=false){$('status').textContent=message;$('status').classList.toggle('error',error);}
  function bounds(){return stage.getBoundingClientRect();}
  function transform(){const b=bounds();return C.view(doc.width,doc.height,b.width,b.height,camera);}
  function local(e){const b=bounds();return {x:e.clientX-b.left,y:e.clientY-b.top};}
  function imagePoint(p){return C.toImage(p,transform(),doc.width,doc.height);}
  function bounded(p){return {x:C.clamp(p.x),y:C.clamp(p.y)};}
  function current(){return draft||doc?.annotations.find(a=>a.id===selected);}
  function hasUnsavedForm(){if(formDirty){status('Apply or cancel your label changes first.',true);$('apply').focus();return true;}return false;}
  function changed(){dirty=true;editVersion++;clearTimeout(saveTimer);$('save-state').textContent='Unsaved changes…';$('save-state').classList.remove('mn-error');saveTimer=setTimeout(saveNow,400);}
  function sync(){doc.annotations=C.clone(history.current);if(selected&&!doc.annotations.some(a=>a.id===selected))selected=null;changed();render();inspector();}
  function commit(next){if(!next.every(C.validAnnotation))throw new Error('Invalid annotation.');history.commit(next);sync();}
  function setMode(next){if(hasUnsavedForm())return;mode=next;draft=null;pendingStart=null;gesture=null;selected=null;render();inspector();}
  function render(){
    if(!doc)return;
    const b=bounds(),v=transform();stage.setAttribute('viewBox',`0 0 ${b.width} ${b.height}`);stage.replaceChildren();
    const g=R.element('g',{transform:`translate(${v.tx} ${v.ty}) scale(${v.s})`});
    g.append(R.element('rect',{width:doc.width,height:doc.height,fill:'#fff'}));
    g.append(R.element('image',{href:imageURL,width:doc.width,height:doc.height,'pointer-events':'none'}));
    for(const a of doc.annotations)g.append(R.svgAnnotation(C.plan(a,doc.width,doc.height,R.measure),v.s,a.id===selected&&!draft));
    if(draft){const safe=C.clone(draft);if(safe.type==='dimension'&&!safe.valueText)safe.valueText='?';if(safe.type==='note'&&!safe.text)safe.text='Your note';const el=R.svgAnnotation(C.plan(safe,doc.width,doc.height,R.measure),v.s,true);el.setAttribute('opacity','.7');el.setAttribute('pointer-events','none');g.append(el);}
    if(pendingStart)g.append(R.element('circle',{cx:pendingStart.x*doc.width,cy:pendingStart.y*doc.height,r:6/v.s,fill:'#165DCC',stroke:'#fff','stroke-width':2/v.s}));
    stage.append(g);stage.style.cursor=mode==='pan'?'grab':mode==='select'?'default':'crosshair';
    $('zoom').textContent=Math.round(camera.zoom*100)+'%';$('zoom-out').disabled=camera.zoom<=1;$('zoom-in').disabled=camera.zoom>=8;
    $('undo').disabled=!history.past.length;$('redo').disabled=!history.future.length;
    document.querySelectorAll('[data-mode]').forEach(e=>e.setAttribute('aria-pressed',String(e.dataset.mode===mode)));
    $('mode-hint').textContent=mode==='dimension'?(pendingStart?'Now tap the other end. Escape cancels.':'Tap the first end of a measurement.'):mode==='note'?'Tap where you want a note.':mode==='pan'?'Drag to move around. Pinch or use + to zoom.':'Select a label or drag a handle to adjust it.';
    const disabled=!!draft||formDirty||busy;$('png').disabled=disabled;$('pdf').disabled=disabled;
  }
  function rebuildList(){
    $('list').replaceChildren();$('count').textContent=doc.annotations.length;
    doc.annotations.forEach((a,i)=>{
      const li=document.createElement('li'),button=document.createElement('button'),swatch=document.createElement('span'),text=document.createElement('span');button.type='button';button.dataset.annotationId=a.id;button.setAttribute('aria-current',String(selected===a.id));
      swatch.className='mn-swatch';swatch.style.background=a.style.colour;text.textContent=`${i+1}. ${a.type==='dimension'?a.valueText+' '+a.unit:a.text}`;button.append(swatch,text);button.addEventListener('click',()=>select(a.id));li.append(button);$('list').append(li);
    });
  }
  function select(id){if(hasUnsavedForm())return;draft=null;pendingStart=null;selected=id;mode='select';render();inspector();}
  function coordinateInput(key,label,value){const l=document.createElement('label');l.textContent=label;const input=document.createElement('input');input.type='number';input.min='0';input.max='100';input.step='0.01';input.value=String(Math.round(value*10000)/100);input.dataset.coord=key;input.required=true;l.append(input);$('coordinates').append(l);}
  function inspector(){
    formDirty=false;$('form-error').hidden=true;const a=current();$('inspector').hidden=!a;$('inspector-empty').hidden=!!a;$('inspector-heading').textContent=draft?'Add '+draft.type:a?'Edit '+a.type:'Your annotations';
    if(a){
      $('dimension-fields').hidden=a.type!=='dimension';$('value').required=a.type==='dimension';$('value').disabled=a.type!=='dimension';$('value').value=a.valueText||'';$('unit').value=a.unit||'mm';
      $('text').value=a.type==='dimension'?a.note:a.text;$('text').required=a.type==='note';$('colour').value=a.style.colour;$('size').value=a.style.size;$('apply').textContent=draft?'Add label':'Apply changes';$('delete').hidden=!!draft;$('coordinates').replaceChildren();
      const fields=a.type==='dimension'?['start','end']:['position'];for(const key of fields){coordinateInput(key+'.x',key==='position'?'X (%)':key+' X (%)',a[key].x);coordinateInput(key+'.y',key==='position'?'Y (%)':key+' Y (%)',a[key].y);}
    }
    rebuildList();render();
  }
  function begin(type,p,end){
    if(doc.annotations.length>=P.LIMITS.annotations){status('This photo has reached the 1,000 label limit. Start another project for more labels.',true);return;}
    const style={colour:'#165DCC',size:'normal'},id=crypto.randomUUID();
    draft=type==='dimension'?{id,type,start:p,end,labelOffset:{x:0,y:-.045},valueText:'',unit:'mm',note:'',style}:{id,type,position:p,text:'',style};
    pendingStart=null;selected=null;mode='select';inspector();(type==='dimension'?$('value'):$('text')).focus({preventScroll:true});
    if(window.innerWidth<=900)$('inspector').scrollIntoView({behavior:'smooth',block:'nearest'});
  }
  $('inspector').addEventListener('input',()=>{formDirty=true;$('form-error').hidden=true;render();});
  $('inspector').addEventListener('submit',e=>{
    e.preventDefault();const a=C.clone(current());if(!a)return;
    if(a.type==='dimension'){a.valueText=$('value').value.trim();a.unit=$('unit').value;a.note=$('text').value.trim();}else a.text=$('text').value.trim();
    a.style={colour:$('colour').value,size:$('size').value};
    for(const input of $('coordinates').querySelectorAll('input')){const [key,axis]=input.dataset.coord.split('.');a[key][axis]=Number(input.value)/100;}
    if(!C.validAnnotation(a)){$('form-error').hidden=false;$('form-error').textContent='Enter a positive measurement (for example 1200, 3.5 or 3 1/2 in), distinct endpoints, and coordinates from 0 to 100. Notes must contain text.';return;}
    const next=C.clone(doc.annotations),index=next.findIndex(x=>x.id===a.id);if(index<0)next.push(a);else next[index]=a;
    draft=null;formDirty=false;selected=a.id;commit(next);status('Label applied. Add another dimension or download your sheet.');
  });
  $('cancel').addEventListener('click',()=>{draft=null;pendingStart=null;formDirty=false;selected=null;inspector();});
  function remove(){if(!selected||hasUnsavedForm())return;const next=doc.annotations.filter(a=>a.id!==selected);selected=null;commit(next);status('Annotation deleted. Undo restores it.');}
  $('delete').addEventListener('click',remove);
  $('add-centre').addEventListener('click',()=>{if(!busy&&!hasUnsavedForm())begin('dimension',{x:.25,y:.5},{x:.75,y:.5});});
  document.querySelectorAll('[data-mode]').forEach(button=>button.addEventListener('click',()=>setMode(button.dataset.mode)));
  function undo(redo=false){if(hasUnsavedForm())return;draft=null;pendingStart=null;(redo?history.redo():history.undo());sync();status(redo?'Edit redone.':'Edit undone.');}
  $('undo').addEventListener('click',()=>undo());$('redo').addEventListener('click',()=>undo(true));
  function zoom(factor,p){if(!doc||busy)return;const b=bounds();camera=C.zoomAt(camera,factor,p||{x:b.width/2,y:b.height/2},doc.width,doc.height,b.width,b.height);render();}
  $('zoom-in').addEventListener('click',()=>zoom(1.3));$('zoom-out').addEventListener('click',()=>zoom(1/1.3));$('fit').addEventListener('click',()=>{camera={zoom:1,cx:.5,cy:.5};render();});
  stage.addEventListener('wheel',e=>{if(!doc||busy)return;e.preventDefault();zoom(Math.exp(-e.deltaY*.002),local(e));},{passive:false});
  function rollbackGesture(){if(gesture?.before)doc.annotations=C.clone(gesture.before);gesture=null;}
  stage.addEventListener('pointerdown',e=>{
    if(!doc||busy||e.button>0)return;e.preventDefault();stage.focus({preventScroll:true});stage.setPointerCapture(e.pointerId);pointers.set(e.pointerId,local(e));
    if(pointers.size>=2){rollbackGesture();pendingStart=null;const [p,q]=[...pointers.values()];pinch={distance:Math.max(1,Math.hypot(p.x-q.x,p.y-q.y)),mid:{x:(p.x+q.x)/2,y:(p.y+q.y)/2}};render();return;}
    if(hasUnsavedForm())return;
    const p=local(e),target=e.target.closest('[data-id]'),a=target&&doc.annotations.find(a=>a.id===target.dataset.id);
    if(mode==='pan'){gesture={type:'pan',start:p,camera:{...camera}};return;}
    if(mode==='select'&&a){selected=a.id;draft=null;const part=e.target.closest('[data-part]')?.dataset.part||'body';gesture={type:'edit',id:a.id,part,start:imagePoint(p),original:C.clone(a),before:C.clone(doc.annotations),moved:false};inspector();}
    else gesture={type:'tap',start:p,mode};
  });
  stage.addEventListener('pointermove',e=>{
    if(!pointers.has(e.pointerId)||!doc)return;const p=local(e);pointers.set(e.pointerId,p);
    if(pinch&&pointers.size>=2){const [a,b]=[...pointers.values()],distance=Math.max(1,Math.hypot(a.x-b.x,a.y-b.y)),mid={x:(a.x+b.x)/2,y:(a.y+b.y)/2},v=transform();camera.cx-=(mid.x-pinch.mid.x)/v.s/doc.width;camera.cy-=(mid.y-pinch.mid.y)/v.s/doc.height;zoom(distance/pinch.distance,mid);pinch={distance,mid};return;}
    if(!gesture)return;
    if(gesture.type==='pan'){const v=transform();camera.cx=gesture.camera.cx-(p.x-gesture.start.x)/v.s/doc.width;camera.cy=gesture.camera.cy-(p.y-gesture.start.y)/v.s/doc.height;render();}
    if(gesture.type==='edit'){
      const ip=imagePoint(p),dx=ip.x-gesture.start.x,dy=ip.y-gesture.start.y;
      if(Math.hypot(dx*doc.width,dy*doc.height)*transform().s<2&&!gesture.moved)return;gesture.moved=true;
      let a=C.clone(gesture.original);
      if(gesture.part==='start'||gesture.part==='end')a[gesture.part]=bounded(ip);
      else if(gesture.part==='label'&&a.type==='dimension'){a.labelOffset.x=C.clamp(a.labelOffset.x+dx,-1,1);a.labelOffset.y=C.clamp(a.labelOffset.y+dy,-1,1);}
      else a=C.moveAnnotation(a,dx,dy);
      doc.annotations=gesture.before.map(x=>x.id===a.id?a:C.clone(x));render();
    }
  });
  function finishPointer(e,cancelled){
    if(!pointers.has(e.pointerId))return;const p=local(e);pointers.delete(e.pointerId);if(stage.hasPointerCapture(e.pointerId))stage.releasePointerCapture(e.pointerId);
    if(pinch){if(!pointers.size)pinch=null;gesture=null;return;}
    const g=gesture;gesture=null;if(!g)return;
    if(cancelled){if(g.before)doc.annotations=g.before;pendingStart=null;render();inspector();return;}
    if(g.type==='edit'){if(doc.annotations.every(C.validAnnotation))history.commit(doc.annotations);else doc.annotations=C.clone(history.current);if(g.moved)changed();render();inspector();return;}
    if(g.type==='tap'&&Math.hypot(p.x-g.start.x,p.y-g.start.y)<8){
      const ip=imagePoint(p);if(ip.x<0||ip.y<0||ip.x>1||ip.y>1)return;
      if(g.mode==='dimension'){
        if(!pendingStart){pendingStart=ip;render();}
        else if(Math.hypot((ip.x-pendingStart.x)*doc.width,(ip.y-pendingStart.y)*doc.height)*transform().s>=8)begin('dimension',pendingStart,ip);
      }else if(g.mode==='note')begin('note',ip);else if(g.mode==='select'){selected=null;draft=null;inspector();}
    }
  }
  stage.addEventListener('pointerup',e=>finishPointer(e,false));stage.addEventListener('pointercancel',e=>finishPointer(e,true));
  stage.addEventListener('lostpointercapture',e=>{if(pointers.has(e.pointerId))finishPointer(e,true);});
  document.addEventListener('keydown',e=>{
    if(!doc||busy||e.target.matches('input,textarea,select'))return;
    if(e.key==='Escape'){rollbackGesture();pointers.clear();pinch=null;draft=null;pendingStart=null;formDirty=false;selected=null;inspector();return;}
    if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();undo(e.shiftKey);return;}
    if(e.key==='Delete'||e.key==='Backspace'){if(selected){e.preventDefault();remove();}return;}
    if(e.target===stage&&selected&&['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)){
      if(hasUnsavedForm())return;e.preventDefault();const step=(e.shiftKey?10:1)/transform().s,dx=e.key==='ArrowLeft'?-step:e.key==='ArrowRight'?step:0,dy=e.key==='ArrowUp'?-step:e.key==='ArrowDown'?step:0;
      commit(doc.annotations.map(a=>a.id===selected?C.moveAnnotation(a,dx/doc.width,dy/doc.height):a));
    }
  });
  $('title').addEventListener('input',()=>{if(doc){doc.title=$('title').value;changed();}});
  $('project-name').addEventListener('input',()=>{if(project){project.name=$('project-name').value;changed();}});
  function lock(on){busy=on;document.querySelector('.mn').classList.toggle('mn-busy',on);document.querySelector('.mn').setAttribute('aria-busy',String(on));$('workspace').inert=on;$('projects').inert=on;$('file').disabled=on;$('example').disabled=on;if(doc)render();}
  async function readPhoto(file,example=false){
    if(busy||!await leaveProject())return;
    const generation=++loadGeneration;lock(true);status('Opening photo…');let bitmap,newURL,c;
    try{
      if(!example){
        if(file.size>25*1024*1024)throw new Error('This photo is over 25 MB. Choose a smaller JPG, PNG or WebP.');
        const bytes=new Uint8Array(await file.slice(0,12).arrayBuffer());const jpeg=bytes[0]===255&&bytes[1]===216&&bytes[2]===255,png=bytes[0]===137&&bytes[1]===80&&bytes[2]===78&&bytes[3]===71,webp=String.fromCharCode(...bytes.slice(0,4))==='RIFF'&&String.fromCharCode(...bytes.slice(8,12))==='WEBP';
        if(!jpeg&&!png&&!webp)throw new Error('Choose a JPG, PNG or WebP photo. HEIC and SVG imports are not supported in this prototype.');
      }
      if(example){bitmap=new Image();bitmap.src='/assets/measurement-notebook/example-window.svg';await bitmap.decode();}
      else if(window.createImageBitmap)bitmap=await createImageBitmap(file,{imageOrientation:'from-image'});
      else {const url=URL.createObjectURL(file);try{bitmap=new Image();bitmap.src=url;await bitmap.decode();}finally{URL.revokeObjectURL(url);}}
      const w=bitmap.naturalWidth||bitmap.width,h=bitmap.naturalHeight||bitmap.height;
      if(w*h>24000000||w>16000||h>16000)throw new Error('This photo exceeds the prototype’s 24 megapixel or 16,000 pixel edge limit. Resize it first.');
      c=document.createElement('canvas');c.width=w;c.height=h;const ctx=c.getContext('2d');ctx.drawImage(bitmap,0,0);const normalized=await R.toBlob(c);
      newURL=URL.createObjectURL(normalized);const nextImage=new Image();nextImage.src=newURL;await nextImage.decode();
      if(generation!==loadGeneration)return;
      const old=imageURL;image=nextImage;imageURL=newURL;newURL=null;photoBlob=normalized;originalFile=file?file.slice(0,file.size,P.signature(new Uint8Array(await file.slice(0,12).arrayBuffer()))):null;doc={schemaVersion:1,title:example?'Kitchen window':file.name.replace(/\.[^.]+$/,'').slice(0,100)||'Measurement sheet',width:w,height:h,annotations:[]};
      project={id:crypto.randomUUID(),name:doc.title,created:Date.now(),updated:Date.now(),revision:0};$('project-name').value=project.name;$('backup').disabled=false;$('save').disabled=false;
      history=new C.History();selected=null;draft=null;formDirty=false;pendingStart=null;gesture=null;pinch=null;pointers.clear();camera={zoom:1,cx:.5,cy:.5};mode='dimension';dirty=false;
      $('workspace').hidden=false;$('empty').hidden=true;$('title').value=doc.title;$('photo-info').textContent=`${w.toLocaleString()} × ${h.toLocaleString()} px${example?' · example illustration':''}`;
      if(old)URL.revokeObjectURL(old);render();inspector();changed();status('Photo ready. Choose two points, then type the measurement.');
    }catch(error){status(error.message?.includes('prototype')||error.message?.includes('photo')?error.message:'That image could not be opened. Try another JPG, PNG or WebP.',true);}
    finally{bitmap?.close?.();if(c)c.width=c.height=1;if(newURL)URL.revokeObjectURL(newURL);lock(false);$('file').value='';}
  }
  $('file').addEventListener('change',()=>{if($('file').files[0])readPhoto($('file').files[0]);});$('example').addEventListener('click',()=>readPhoto(null,true));
  async function exportFile(type){
    if(!doc||busy||draft||hasUnsavedForm())return;lock(true);status(`Preparing ${type==='png'?'full resolution image':'PDF'}…`);
    try{
      await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
      if(!C.validDocument(doc))throw new Error('There is an invalid annotation. Review your labels and try again.');
      const blob=type==='png'?await R.png(image,doc):await R.pdf(image,doc,$('page').value,$('orientation').value);
      const name=(doc.title.trim()||'measurement-sheet').replace(/[<>:"/\\|?*\u0000-\u001F]/g,'-').slice(0,90);R.download(blob,name+'.'+type);status(`${type.toUpperCase()} prepared. Use your browser’s download or share controls to save it.`);
    }catch(error){status(error.message||'Export failed. Try a smaller photo.',true);}finally{lock(false);}
  }
  $('png').addEventListener('click',()=>exportFile('png'));$('pdf').addEventListener('click',()=>exportFile('pdf'));
  function snapshot(){return {...project,document:{...C.clone(doc),annotations:C.clone(history.current)}};}
  async function refreshProjects(){
    const {rows,damaged}=await S.list(),select=$('project-list'),previous=select.value;select.replaceChildren();
    const placeholder=document.createElement('option');placeholder.value='';placeholder.textContent=rows.length?'Choose a project':'No saved projects yet';select.append(placeholder);
    for(const row of rows){const o=document.createElement('option');o.value=row.project.id;o.textContent=row.project.name+' · '+new Date(row.project.updated).toLocaleDateString();select.append(o);}
    select.value=rows.some(r=>r.project.id===project?.id)?project.id:previous;
    const bytes=rows.reduce((n,r)=>n+r.bytes,0);let estimate;
    try{estimate=await navigator.storage?.estimate();}catch{}
    $('storage').textContent=`${rows.length} saved project${rows.length===1?'':'s'} · ${(bytes/1048576).toFixed(2)} MiB of project data`+(estimate?` · Browser estimate for this whole site: ${(estimate.usage/1048576).toFixed(1)} MiB used of ${(estimate.quota/1048576).toFixed(0)} MiB quota.`:'. Browser quota is unavailable.')+(damaged?` ${damaged} damaged record(s) could not be listed. Import a backup to recover them.`:'');
    return rows;
  }
  async function saveNow(){
    clearTimeout(saveTimer);
    if(savePromise){await savePromise;if(dirty)return saveNow();return true;}
    if(!project||!dirty)return true;
    if(!project.name.trim()){$('save-state').textContent='Not saved: enter a project name, or download a backup after naming it.';$('save-state').classList.add('mn-error');return false;}
    const version=editVersion,p=snapshot();$('save-state').textContent='Saving…';
    savePromise=(async()=>{
      try{
        const saved=await S.write(p,photoBlob,originalFile,p.revision||null);
        project.revision=saved.revision;project.updated=saved.updated;
        if(editVersion===version)dirty=false;
        $('save-state').textContent=dirty?'Newer edits waiting to save…':'Saved in this browser.';$('save-state').classList.remove('mn-error');
        try{await refreshProjects();}catch{}
        return true;
      }catch(error){$('save-state').textContent=(error.name==='QuotaExceededError'?'Storage is full. The last saved version is unchanged.':error.message||'Storage is unavailable.')+' Current edits are not saved. Keep this tab open, download a project backup, then free storage and retry.';$('save-state').classList.add('mn-error');return false;}
    })();
    const ok=await savePromise;savePromise=null;return ok;
  }
  async function leaveProject(){
    if(draft||formDirty){status('Apply or cancel your label changes before changing projects.',true);return false;}
    if(gesture){status('Finish the current drag first.',true);return false;}
    lock(true);try{await saveNow();return !dirty;}finally{lock(false);}
  }
  async function decoded(row){
    if(!P.metadata(row.project))throw new Error('Invalid project data.');await P.assets(row.image,row.original,row.project.document);
    const url=URL.createObjectURL(row.image),img=new Image();
    try{
      img.src=url;await img.decode();if(img.naturalWidth!==row.project.document.width||img.naturalHeight!==row.project.document.height)throw new Error('Photo dimensions do not match.');
      if(row.original){
        let source,sourceURL;
        try{if(window.createImageBitmap)source=await createImageBitmap(row.original,{imageOrientation:'from-image'});else{sourceURL=URL.createObjectURL(row.original);source=new Image();source.src=sourceURL;await source.decode();}
          if((source.naturalWidth||source.width)!==img.naturalWidth||(source.naturalHeight||source.height)!==img.naturalHeight)throw new Error('Original photo dimensions do not match.');
        }finally{source?.close?.();if(sourceURL)URL.revokeObjectURL(sourceURL);}
      }
      return {url,img};
    }
    catch{URL.revokeObjectURL(url);throw new Error('The project photo could not be decoded. No saved project was changed.');}
  }
  function showProject(row,loaded){
    if(imageURL)URL.revokeObjectURL(imageURL);imageURL=loaded.url;image=loaded.img;photoBlob=row.image;originalFile=row.original;
    const {document,...meta}=row.project;project=C.clone(meta);doc=C.clone(document);history=new C.History(doc.annotations);selected=null;draft=null;formDirty=false;dirty=false;gesture=null;pinch=null;pendingStart=null;pointers.clear();mode='select';camera={zoom:1,cx:.5,cy:.5};
    $('workspace').hidden=false;$('empty').hidden=true;$('title').value=doc.title;$('project-name').value=project.name;$('backup').disabled=false;$('save').disabled=false;$('photo-info').textContent=`${doc.width.toLocaleString()} × ${doc.height.toLocaleString()} px`;
    $('save-state').textContent='Saved in this browser.';$('save-state').classList.remove('mn-error');render();inspector();
  }
  function safeName(name){return (name.trim()||'measurement-project').replace(/[<>:"/\\|?*\u0000-\u001F]/g,'_').slice(0,90);}
  $('save').addEventListener('click',()=>{if(!busy)saveNow();});
  $('backup').addEventListener('click',async()=>{
    if(busy||!doc||draft||hasUnsavedForm())return;lock(true);
    try{const blob=await P.pack(snapshot(),photoBlob,originalFile);R.download(blob,safeName(project.name)+'.mnote');status('Editable project backup prepared. It includes applied edits, even if browser storage could not save them.');}catch(e){status(e.message,true);}finally{lock(false);}
  });
  $('refresh-projects').addEventListener('click',()=>refreshProjects().catch(e=>status(e.message,true)));
  function clearProject(){
    clearTimeout(saveTimer);project=null;doc=null;photoBlob=null;originalFile=null;image=null;if(imageURL)URL.revokeObjectURL(imageURL);imageURL=null;history=new C.History();dirty=false;draft=null;formDirty=false;selected=null;gesture=null;pendingStart=null;pointers.clear();pinch=null;
    $('workspace').hidden=true;$('empty').hidden=false;$('backup').disabled=true;$('save').disabled=true;
  }
  $('close-project').addEventListener('click',async()=>{
    if(busy||!project)return;lock(true);clearTimeout(saveTimer);
    try{if(savePromise)await savePromise;if((dirty||draft||formDirty)&&!confirm('Close without saving current edits? Your last successful save stays intact. Download a project backup before discarding work.'))return;clearProject();$('save-state').textContent='Project closed. Open it from the saved list to continue.';status('Project closed.');}finally{lock(false);}
  });
  $('open-project').addEventListener('click',async()=>{
    const id=$('project-list').value;if(!id||busy||!await leaveProject())return;lock(true);let loaded;
    try{const row=await S.read(id);loaded=await decoded(row);showProject(row,loaded);loaded=null;status('Project opened. Applied edits save automatically.');}catch(e){status(e.message,true);}finally{if(loaded)URL.revokeObjectURL(loaded.url);lock(false);}
  });
  $('duplicate-project').addEventListener('click',async()=>{
    const id=$('project-list').value;if(!id||busy||!await leaveProject())return;lock(true);let loaded;
    try{const row=await S.read(id);loaded=await decoded(row);row.project={...row.project,id:crypto.randomUUID(),name:(row.project.name.slice(0,93)+' (copy)'),created:Date.now(),updated:Date.now(),revision:0};row.project=await S.write(row.project,row.image,row.original,null);showProject(row,loaded);loaded=null;await refreshProjects();status('Project duplicated.');}catch(e){status(e.message,true);}finally{if(loaded)URL.revokeObjectURL(loaded.url);lock(false);}
  });
  $('delete-project').addEventListener('click',async()=>{
    const id=$('project-list').value;if(!id||busy||(id===project?.id&&!await leaveProject()))return;lock(true);
    try{const row=await S.read(id);if(!confirm('Delete “'+row.project.name+'” from this browser? This cannot be undone. Keep a project backup first.'))return;await S.remove(id,row.project.revision);
      if(project?.id===id){clearProject();$('save-state').textContent='Project deleted.';}
      await refreshProjects();status('Saved project deleted.');
    }catch(e){status(e.message,true);}finally{lock(false);}
  });
  $('import-project').addEventListener('change',async()=>{
    const file=$('import-project').files[0];if(!file||busy)return;
    if(!await leaveProject()){$('import-project').value='';return;}lock(true);let loaded;
    try{
      status('Checking project backup…');const row=await P.unpack(file);loaded=await decoded(row);
      row.project={...row.project,id:crypto.randomUUID(),revision:0};
      row.project=await S.write(row.project,row.image,row.original,null);
      showProject(row,loaded);loaded=null;await refreshProjects();status('Backup imported as a new project. Existing projects were kept.');
    }catch(e){status(e.name==='QuotaExceededError'?'Storage is full. The backup was not imported; existing projects are unchanged.':e.message,true);}finally{if(loaded)URL.revokeObjectURL(loaded.url);lock(false);$('import-project').value='';}
  });
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden'&&dirty)saveNow();});
  lock(true);
  refreshProjects().then(()=>{$('save-state').textContent='Projects are saved only in this browser. Open a saved project or start a new one.';}).catch(e=>{$('save-state').textContent='Browser storage is unavailable. You can still edit and download project backups. '+e.message;$('save-state').classList.add('mn-error');}).finally(()=>lock(false));
  new ResizeObserver(()=>{if(doc)render();}).observe(stage);
  window.addEventListener('beforeunload',e=>{if(dirty||formDirty||draft){e.preventDefault();e.returnValue='';}});
  // Read-only diagnostics for regression tests; no mutation shortcuts into the editor.
  window.__measurement={get document(){return C.clone(doc);},get project(){return C.clone(project);},get dirty(){return dirty;},get camera(){return {...camera};},get busy(){return busy;},get draft(){return C.clone(draft);}};
})();
