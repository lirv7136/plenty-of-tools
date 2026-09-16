(function(root) {
  'use strict';
  const byteLength=s=>new TextEncoder().encode(s).length;
  function payload(type, data) {
    let value;
    if(type==='url') {
      let url=String(data.url||'').trim();
      if(!url) throw new Error('Enter a website address.');
      if(/\s/.test(url)) throw new Error('Remove spaces and line breaks from the website address.');
      if(!/^[a-z][a-z0-9+.-]*:/i.test(url)) url='https://'+url;
      let parsed; try { parsed=new URL(url); } catch { throw new Error('Enter a valid website address, such as https://example.com.'); }
      if(!['http:','https:'].includes(parsed.protocol)||!parsed.hostname||parsed.username||parsed.password) throw new Error('Use an http:// or https:// website address without embedded login details.');
      value=parsed.href;
    } else if(type==='text') {
      value=String(data.text||''); if(!value.trim()) throw new Error('Enter some text for the code.');
    } else if(type==='wifi') {
      const ssid=String(data.ssid||''), password=String(data.password||''), security=data.security||'WPA';
      if(!ssid || byteLength(ssid)>32 || /[\r\n\0]/.test(ssid)) throw new Error('Enter a network name of 1–32 UTF-8 bytes, without line breaks.');
      if(!['WPA','WEP','nopass'].includes(security)) throw new Error('Choose a supported Wi-Fi security type.');
      if(security!=='nopass' && (!password || /[\r\n\0]/.test(password))) throw new Error('Enter the exact Wi-Fi password, without line breaks.');
      const escape=s=>s.replace(/[\\;,:\"]/g,'\\$&');
      value=`WIFI:T:${security};S:${escape(ssid)};${security==='nopass'?'':`P:${escape(password)};`}${data.hidden?'H:true;':''};`;
    } else if(type==='email') {
      const email=String(data.email||'').trim();
      if(!/^[^\s@?&#]+@[^\s@?&#]+\.[^\s@?&#]+$/.test(email)) throw new Error('Enter a valid email address.');
      const query=[];
      if(data.subject) query.push('subject='+encodeURIComponent(data.subject));
      if(data.body) query.push('body='+encodeURIComponent(data.body));
      value='mailto:'+email.split('@').map(encodeURIComponent).join('@')+(query.length?'?'+query.join('&'):'');
    } else throw new Error('Choose a supported code type.');
    if(byteLength(value)>2000) throw new Error('This content is too long. Keep the encoded content under 2,000 UTF-8 bytes.');
    return value;
  }
  function validateColour(colour) {
    if(!/^#[0-9a-f]{6}$/i.test(colour)) throw new Error('Choose a valid code colour.');
    const rgb=[1,3,5].map(i=>parseInt(colour.slice(i,i+2),16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);
    const contrast=1.05/(rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722+.05);
    if(contrast<4.5) throw new Error('Choose a darker colour so the code has enough contrast against white.');
    return colour.toLowerCase();
  }
  function encode(text, level='M', encoder=root.qrcode) {
    if(!['L','M','Q','H'].includes(level)) throw new Error('Choose an error correction level.');
    encoder.stringToBytes=encoder.stringToBytesFuncs['UTF-8'];
    try { const qr=encoder(0,level); qr.addData(text,'Byte'); qr.make(); return qr; }
    catch { throw new Error('This content does not fit at this error correction level. Shorten it or choose a lower level.'); }
  }
  function layout(qr, size) {
    if(![512,1024,2048].includes(size)) throw new Error('Choose a supported PNG size.');
    const count=qr.getModuleCount(), scale=Math.floor(size/(count+8));
    return {count,scale,padding:Math.floor((size-count*scale)/2),size};
  }
  function draw(qr,canvas,size,colour) {
    validateColour(colour); const {count,scale,padding}=layout(qr,size);
    canvas.width=canvas.height=size; const ctx=canvas.getContext('2d'); ctx.fillStyle='#ffffff'; ctx.fillRect(0,0,size,size); ctx.fillStyle=colour;
    for(let r=0;r<count;r++) for(let c=0;c<count;c++) if(qr.isDark(r,c)) ctx.fillRect(padding+c*scale,padding+r*scale,scale,scale);
  }
  function svg(qr,colour='#15191f') {
    colour=validateColour(colour); const count=qr.getModuleCount(), side=count+8, paths=[];
    for(let r=0;r<count;r++) for(let c=0;c<count;c++) if(qr.isDark(r,c)) paths.push(`M${c+4},${r+4}h1v1h-1z`);
    return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${side} ${side}" width="${side*16}" height="${side*16}" shape-rendering="crispEdges"><title>Static QR code</title><rect width="100%" height="100%" fill="#ffffff"/><path d="${paths.join('')}" fill="${colour}"/></svg>\n`;
  }
  const api={payload,validateColour,encode,layout,draw,svg,byteLength};
  if(typeof module!=='undefined'&&module.exports) module.exports=api;
  if(typeof document==='undefined') return;
  const $=id=>document.getElementById('qr-'+id);
  let current=null, generation=0;
  function invalidate(message='Details changed. Generate your code again.') {
    generation++; current=null; $('png').disabled=$('svg').disabled=true;
    $('canvas').hidden=true; $('canvas').width=$('canvas').height=1; $('placeholder').hidden=false;
    $('details').hidden=true; $('details').open=false; $('payload').textContent=''; $('error').hidden=true; $('status').textContent=message;
  }
  function fields() {
    for(const type of ['url','text','wifi','email']) $('fields-'+type).hidden=$('type').value!==type;
    const open=$('security').value==='nopass'; $('password').disabled=open; $('show-password').disabled=open;
  }
  function generate(focus=true) {
    invalidate('');
    try {
      const data={}; for(const key of ['url','text','ssid','password','security','email','subject','body']) data[key]=$(key).value;
      data.hidden=$('hidden').checked;
      const text=payload($('type').value,data), colour=validateColour($('colour').value), qr=encode(text,$('level').value), size=Number($('size').value);
      draw(qr,$('canvas'),size,colour); current={qr,colour}; $('canvas').hidden=false; $('placeholder').hidden=true;
      $('png').disabled=$('svg').disabled=false; $('payload').textContent=text; $('details').hidden=false;
      $('status').textContent=`Ready · ${size} × ${size} PNG · ${byteLength(text)} bytes encoded. No expiry or scan limit.`;
      if(focus) $('preview-title').focus();
    } catch(error) { $('error').textContent=error.message; $('error').hidden=false; $('status').textContent='Check the details and generate again.'; }
  }
  function save(blob,extension) {
    const url=URL.createObjectURL(blob), a=document.createElement('a'); a.href=url; a.download='qr-code.'+extension;
    document.body.append(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(url),1000);
    $('status').textContent=`${extension.toUpperCase()} download started. Test a scan before printing.`;
  }
  $('form').addEventListener('submit',event=>{event.preventDefault();generate();});
  $('form').addEventListener('input',event=>{if(event.target.id==='qr-show-password')return;invalidate();fields();});
  $('form').addEventListener('change',event=>{if(event.target.id==='qr-show-password')return;invalidate();fields();});
  $('show-password').addEventListener('change',()=>{$('password').type=$('show-password').checked?'text':'password';});
  $('clear').addEventListener('click',()=>{$('form').reset();$('password').type='password';fields();invalidate('Cleared. Your content is no longer held by this tool.');$('type').focus();});
  $('example').addEventListener('click',()=>{$('form').reset();$('password').type='password';$('url').value='https://example.com/';fields();generate();});
  $('svg').addEventListener('click',()=>{if(current)save(new Blob([svg(current.qr,current.colour)],{type:'image/svg+xml;charset=utf-8'}),'svg');});
  $('png').addEventListener('click',()=>{
    if(!current)return; const token=generation; $('png').disabled=true;
    $('canvas').toBlob(blob=>{if(token!==generation)return;$('png').disabled=false;if(blob)save(blob,'png');else{$('error').textContent='The PNG could not be created. Try SVG or a smaller PNG size.';$('error').hidden=false;}},'image/png');
  });
  fields();
})(typeof globalThis!=='undefined'?globalThis:this);
