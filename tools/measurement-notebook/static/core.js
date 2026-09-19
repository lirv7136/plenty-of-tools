/* Pure document/geometry functions shared by the editor and exporters. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.MeasurementCore=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const UNITS=['mm','cm','m','in','ft'], COLOURS=['#165DCC','#0B7254','#AC341F','#262B33'];
  const clamp=(n,min=0,max=1)=>Math.max(min,Math.min(max,n));
  const clone=value=>JSON.parse(JSON.stringify(value));
  function measurement(value,unit){
    if(!UNITS.includes(unit)||typeof value!=='string'||value.length>32)return false;
    const t=value.trim();
    if(/^\d+(?:\.\d+)?$/.test(t))return Number.isFinite(Number(t))&&Number(t)>0;
    const m=/^(?:(\d+)\s+)?(\d+)\/(\d+)$/.exec(t);
    return !!m&&['in','ft'].includes(unit)&&Number(m[3])>0&&Number(m[2])>0&&Number(m[2])<Number(m[3]);
  }
  function point(p){return !!p&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.x>=0&&p.x<=1&&p.y>=0&&p.y<=1;}
  function validAnnotation(a){
    if(!a||typeof a.id!=='string'||!a.id||!a.style||!COLOURS.includes(a.style.colour)||!['small','normal','large'].includes(a.style.size))return false;
    if(a.type==='note')return point(a.position)&&typeof a.text==='string'&&a.text.trim().length>0&&a.text.length<=240;
    return a.type==='dimension'&&point(a.start)&&point(a.end)&&Math.hypot(a.end.x-a.start.x,a.end.y-a.start.y)>0.0001&&measurement(a.valueText,a.unit)&&typeof a.note==='string'&&a.note.length<=240&&a.labelOffset&&Number.isFinite(a.labelOffset.x)&&Number.isFinite(a.labelOffset.y)&&Math.abs(a.labelOffset.x)<=1&&Math.abs(a.labelOffset.y)<=1;
  }
  function validDocument(doc){return !!doc&&doc.schemaVersion===1&&typeof doc.title==='string'&&doc.title.length<=100&&Number.isInteger(doc.width)&&Number.isInteger(doc.height)&&doc.width>0&&doc.height>0&&doc.width*doc.height<=24000000&&Array.isArray(doc.annotations)&&doc.annotations.every(validAnnotation)&&new Set(doc.annotations.map(a=>a.id)).size===doc.annotations.length;}
  function view(width,height,vw,vh,camera){const s=Math.min(vw/width,vh/height)*.92*camera.zoom;return {s,tx:vw/2-camera.cx*width*s,ty:vh/2-camera.cy*height*s};}
  const toImage=(p,v,w,h)=>({x:(p.x-v.tx)/v.s/w,y:(p.y-v.ty)/v.s/h});
  const toView=(p,v,w,h)=>({x:p.x*w*v.s+v.tx,y:p.y*h*v.s+v.ty});
  function zoomAt(camera,factor,p,w,h,vw,vh){const old=view(w,h,vw,vh,camera),anchor=toImage(p,old,w,h),zoom=clamp(camera.zoom*factor,1,8),s=Math.min(vw/w,vh/h)*.92*zoom;return {zoom,cx:anchor.x-(p.x-vw/2)/s/w,cy:anchor.y-(p.y-vh/2)/s/h};}
  function moveAnnotation(a,dx,dy){
    const result=clone(a),points=a.type==='dimension'?[a.start,a.end]:[a.position];
    dx=clamp(dx,-Math.min(...points.map(p=>p.x)),1-Math.max(...points.map(p=>p.x)));
    dy=clamp(dy,-Math.min(...points.map(p=>p.y)),1-Math.max(...points.map(p=>p.y)));
    if(a.type==='dimension'){result.start={x:a.start.x+dx,y:a.start.y+dy};result.end={x:a.end.x+dx,y:a.end.y+dy};}
    else result.position={x:a.position.x+dx,y:a.position.y+dy};return result;
  }
  function wrap(text,width,measure){
    const lines=[];
    for(const paragraph of String(text).split('\n')){
      let line='';
      for(const word of paragraph.split(/\s+/)){
        if(!word)continue;
        if(line&&measure(line+' '+word)<=width){line+=' '+word;continue;}
        if(line){lines.push(line);line='';}
        for(const char of Array.from(word)){if(line&&measure(line+char)>width){lines.push(line);line='';}line+=char;}
      }
      lines.push(line);
    }
    return lines;
  }
  // A shared source-pixel draw plan keeps screen and raster exports identical.
  function plan(a,w,h,measure){
    const font=Math.min(w,h)*.027*({small:.78,normal:1,large:1.35}[a.style.size]),padding=font*.42;
    const label=a.type==='dimension'?a.valueText.trim()+' '+a.unit+(a.note?'\n'+a.note:''):a.text;
    let fs=font,lines,boxW,boxH;
    for(let attempt=0;attempt<20;attempt++){
      lines=wrap(label,w*.44,t=>measure(t,fs));boxW=Math.min(w,Math.max(fs*2,...lines.map(t=>measure(t,fs)))+padding*2);boxH=lines.length*fs*1.25+padding*2;
      if(boxH<=h*.75)break;fs*=.85;
    }
    const pos=a.type==='dimension'?{x:(a.start.x+a.end.x)/2+a.labelOffset.x,y:(a.start.y+a.end.y)/2+a.labelOffset.y}:a.position;
    const box={x:clamp(pos.x*w-boxW/2,0,w-boxW),y:clamp(pos.y*h-boxH/2,0,h-boxH),w:boxW,h:boxH};
    const result={id:a.id,type:a.type,colour:a.style.colour,font:fs,padding,lines,box,stroke:Math.max(w,h)*.0025};
    if(a.type==='dimension'){
      result.start={x:a.start.x*w,y:a.start.y*h};result.end={x:a.end.x*w,y:a.end.y*h};
      const angle=Math.atan2(result.end.y-result.start.y,result.end.x-result.start.x),len=Math.min(font*.65,Math.hypot(result.end.x-result.start.x,result.end.y-result.start.y)/3);
      result.arrows=[{p:result.start,angle},{p:result.end,angle:angle+Math.PI}].map(({p,angle})=>[p,{x:p.x+len*Math.cos(angle-.48),y:p.y+len*Math.sin(angle-.48)},{x:p.x+len*Math.cos(angle+.48),y:p.y+len*Math.sin(angle+.48)}]);
    }
    return result;
  }
  class History{
    constructor(initial=[]){this.current=clone(initial);this.past=[];this.future=[];}
    commit(next){if(JSON.stringify(next)===JSON.stringify(this.current))return false;this.past.push(clone(this.current));if(this.past.length>100)this.past.shift();this.current=clone(next);this.future=[];return true;}
    undo(){if(!this.past.length)return false;this.future.push(clone(this.current));this.current=this.past.pop();return true;}
    redo(){if(!this.future.length)return false;this.past.push(clone(this.current));this.current=this.future.pop();return true;}
  }
  return {UNITS,COLOURS,clamp,clone,measurement,validAnnotation,validDocument,view,toImage,toView,zoomAt,moveAnnotation,wrap,plan,History};
});
