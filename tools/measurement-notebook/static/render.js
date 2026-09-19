/* Both SVG editing and canvas export consume the same source-pixel draw plan. */
(function(){
  'use strict';
  const C=window.MeasurementCore,NS='http://www.w3.org/2000/svg';
  const measuring=document.createElement('canvas').getContext('2d');
  const font=size=>`600 ${size}px system-ui, -apple-system, "Segoe UI", sans-serif`;
  function measure(text,size){measuring.font=font(size);return measuring.measureText(text).width;}
  function element(tag,attrs={},text){const e=document.createElementNS(NS,tag);for(const [k,v] of Object.entries(attrs))e.setAttribute(k,v);if(text!==undefined)e.textContent=text;return e;}
  function svgAnnotation(p,scale,selected=false){
    const g=element('g',{'data-id':p.id});
    if(p.type==='dimension'){
      g.append(element('line',{x1:p.start.x,y1:p.start.y,x2:p.end.x,y2:p.end.y,stroke:'#fff','stroke-width':p.stroke*2.3}));
      g.append(element('line',{x1:p.start.x,y1:p.start.y,x2:p.end.x,y2:p.end.y,stroke:p.colour,'stroke-width':p.stroke}));
      for(const points of p.arrows)g.append(element('polygon',{points:points.map(a=>`${a.x},${a.y}`).join(' '),fill:p.colour}));
      g.append(element('line',{x1:p.start.x,y1:p.start.y,x2:p.end.x,y2:p.end.y,stroke:'transparent','stroke-width':Math.max(24/scale,p.stroke*3),'data-part':'body',cursor:'move'}));
    }
    const box=element('g',{'data-part':p.type==='dimension'?'label':'body',cursor:'move'});
    box.append(element('rect',{x:p.box.x,y:p.box.y,width:p.box.w,height:p.box.h,rx:p.font*.18,fill:'#fff',stroke:p.colour,'stroke-width':p.stroke}));
    const t=element('text',{'font-family':'system-ui, -apple-system, Segoe UI, sans-serif','font-weight':600,'font-size':p.font,fill:p.colour,'pointer-events':'none'});
    p.lines.forEach((line,i)=>t.append(element('tspan',{x:p.box.x+p.padding,y:p.box.y+p.padding+p.font*(1+i*1.25)},line)));
    box.append(t);g.append(box);
    if(selected){
      g.append(element('rect',{x:p.box.x-3/scale,y:p.box.y-3/scale,width:p.box.w+6/scale,height:p.box.h+6/scale,fill:'none',stroke:'#111827','stroke-width':1.5/scale,'stroke-dasharray':`${4/scale} ${3/scale}`,'pointer-events':'none'}));
      if(p.type==='dimension')for(const part of ['start','end']){
        g.append(element('circle',{cx:p[part].x,cy:p[part].y,r:18/scale,fill:'transparent','data-part':part,cursor:'crosshair'}));
        g.append(element('circle',{cx:p[part].x,cy:p[part].y,r:6/scale,fill:'#fff',stroke:p.colour,'stroke-width':2/scale,'data-part':part,cursor:'crosshair'}));
      }
    }
    return g;
  }
  function canvasAnnotation(ctx,p){
    ctx.save();ctx.lineJoin='round';
    if(p.type==='dimension'){
      ctx.beginPath();ctx.moveTo(p.start.x,p.start.y);ctx.lineTo(p.end.x,p.end.y);ctx.strokeStyle='#fff';ctx.lineWidth=p.stroke*2.3;ctx.stroke();ctx.strokeStyle=p.colour;ctx.lineWidth=p.stroke;ctx.stroke();
      ctx.fillStyle=p.colour;
      for(const points of p.arrows){ctx.beginPath();points.forEach((a,i)=>i?ctx.lineTo(a.x,a.y):ctx.moveTo(a.x,a.y));ctx.closePath();ctx.fill();}
    }
    ctx.fillStyle='#fff';ctx.strokeStyle=p.colour;ctx.lineWidth=p.stroke;
    ctx.beginPath();ctx.roundRect(p.box.x,p.box.y,p.box.w,p.box.h,p.font*.18);ctx.fill();ctx.stroke();
    ctx.fillStyle=p.colour;ctx.font=font(p.font);ctx.textBaseline='alphabetic';
    p.lines.forEach((line,i)=>ctx.fillText(line,p.box.x+p.padding,p.box.y+p.padding+p.font*(1+i*1.25)));ctx.restore();
  }
  function drawPhoto(ctx,image,doc,x,y,w,h){ctx.save();ctx.translate(x,y);ctx.scale(w/doc.width,h/doc.height);ctx.drawImage(image,0,0,doc.width,doc.height);doc.annotations.forEach(a=>canvasAnnotation(ctx,C.plan(a,doc.width,doc.height,measure)));ctx.restore();}
  function canvas(w,h){const c=document.createElement('canvas');c.width=w;c.height=h;if(!c.getContext('2d'))throw new Error('Your browser could not allocate an image. Try a smaller photo.');return c;}
  function toBlob(c,type='image/png'){return new Promise((resolve,reject)=>c.toBlob(b=>b?resolve(b):reject(new Error('This device could not export that image size. Try a smaller photo.')),type,.94));}
  async function png(image,doc){const c=canvas(doc.width,doc.height);try{drawPhoto(c.getContext('2d'),image,doc,0,0,c.width,c.height);return await toBlob(c);}finally{c.width=c.height=1;}}
  async function pdf(image,doc,size,orientation){
    const paper=size==='Letter'?[612,792]:[595.28,841.89];if(orientation==='landscape')paper.reverse();
    const c=canvas(Math.round(paper[0]*2),Math.round(paper[1]*2)),ctx=c.getContext('2d');
    try{
      ctx.fillStyle='#fff';ctx.fillRect(0,0,c.width,c.height);ctx.fillStyle='#15191f';ctx.font=font(34);
      const title=C.wrap(doc.title.trim()||'Measurement sheet',c.width-100,t=>ctx.measureText(t).width);title.forEach((line,i)=>ctx.fillText(line,50,65+i*44));
      const top=95+(title.length-1)*44,bottom=c.height-85,availableW=c.width-100,availableH=bottom-top;
      const ratio=Math.min(availableW/doc.width,availableH/doc.height),w=doc.width*ratio,h=doc.height*ratio;
      drawPhoto(ctx,image,doc,(c.width-w)/2,top+(availableH-h)/2,w,h);
      ctx.fillStyle='#5d6774';ctx.font='18px system-ui, sans-serif';ctx.fillText('Dimensions entered by user · Photo not printed to scale',50,c.height-36);
      const pdf=await PDFLib.PDFDocument.create(),page=pdf.addPage(paper),bytes=await (await toBlob(c)).arrayBuffer();
      page.drawImage(await pdf.embedPng(bytes),{x:0,y:0,width:paper[0],height:paper[1]});pdf.setTitle(doc.title||'Measurement sheet');pdf.setCreator('Plenty of Tools · Measurement Notebook');
      return new Blob([await pdf.save()],{type:'application/pdf'});
    }finally{c.width=c.height=1;}
  }
  function download(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);}
  window.MeasurementRender={element,measure,svgAnnotation,canvasAnnotation,drawPhoto,toBlob,png,pdf,download};
})();
