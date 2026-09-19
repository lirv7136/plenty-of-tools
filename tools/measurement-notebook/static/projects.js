/* Portable project format and validation. No DOM, storage, or external dependencies. */
(function(root,factory){const api=factory(typeof module==='object'?require('./core.js'):root.MeasurementCore);if(typeof module==='object')module.exports=api;else root.MeasurementProjects=api;})(globalThis,function(C){
  'use strict';
  const MiB=1024*1024, LIMITS={header:2*MiB,image:100*MiB,original:25*MiB,file:128*MiB,annotations:1000}, MAGIC='MNOTE002';
  const exact=(o,keys)=>!!o&&typeof o==='object'&&!Array.isArray(o)&&Object.keys(o).sort().join('|')===keys.slice().sort().join('|');
  const text=(s,max)=>typeof s==='string'&&s.length<=max;
  const id=s=>typeof s==='string'&&/^[a-zA-Z0-9-]{1,128}$/.test(s);
  const fail=message=>{throw new Error(message);};
  function document(d){
    if(!C.validDocument(d)||!exact(d,['schemaVersion','title','width','height','annotations'])||d.width>16000||d.height>16000||d.annotations.length>LIMITS.annotations)return false;
    return d.annotations.every(a=>id(a.id)&&exact(a.style,['colour','size'])&&(a.type==='note'?
      exact(a,['id','type','position','text','style'])&&exact(a.position,['x','y']):
      exact(a,['id','type','start','end','labelOffset','valueText','unit','note','style'])&&['start','end','labelOffset'].every(k=>exact(a[k],['x','y']))));
  }
  function metadata(p){return exact(p,['id','name','created','updated','revision','document'])&&id(p.id)&&text(p.name,100)&&p.name.trim().length>0&&Number.isSafeInteger(p.created)&&p.created>=0&&Number.isSafeInteger(p.updated)&&p.updated>=p.created&&p.updated<=8000000000000000&&Number.isSafeInteger(p.revision)&&p.revision>=0&&p.revision<Number.MAX_SAFE_INTEGER&&document(p.document);}
  function signature(bytes){
    if(bytes[0]===255&&bytes[1]===216&&bytes[2]===255)return 'image/jpeg';
    if([137,80,78,71,13,10,26,10].every((v,i)=>bytes[i]===v))return 'image/png';
    if(String.fromCharCode(...bytes.slice(0,4))==='RIFF'&&String.fromCharCode(...bytes.slice(8,12))==='WEBP')return 'image/webp';
    return null;
  }
  async function digest(blob){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await blob.arrayBuffer())),n=>n.toString(16).padStart(2,'0')).join('');}
  async function assets(image,original,d){
    if(!(image instanceof Blob)||!image.size||image.size>LIMITS.image||image.type!=='image/png')fail('Invalid project image or image size.');
    const b=new Uint8Array(await image.slice(0,24).arrayBuffer());
    if(b.length<24||signature(b)!=='image/png'||String.fromCharCode(...b.slice(12,16))!=='IHDR')fail('The project photo is not a PNG.');
    const view=new DataView(b.buffer);
    if(view.getUint32(16)!==d.width||view.getUint32(20)!==d.height)fail('Photo dimensions do not match the project.');
    if(original!==null&&(!(original instanceof Blob)||!original.size||original.size>LIMITS.original||signature(new Uint8Array(await original.slice(0,12).arrayBuffer()))!==original.type))fail('Invalid original photo in project.');
  }
  async function pack(p,image,original=null){
    if(!metadata(p))fail('Project data is invalid. Apply your changes before exporting.');
    await assets(image,original,p.document);
    const describe=async blob=>blob?{size:blob.size,type:blob.type,sha256:await digest(blob)}:null;
    const header=new TextEncoder().encode(JSON.stringify({format:MAGIC,project:p,projectSha256:await digest(new Blob([JSON.stringify(p)])),image:await describe(image),original:await describe(original)}));
    if(header.length>LIMITS.header)fail('Project metadata is too large.');
    const prefix=new Uint8Array(12);prefix.set(new TextEncoder().encode(MAGIC));new DataView(prefix.buffer).setUint32(8,header.length);
    const blob=new Blob([prefix,header,image,...(original?[original]:[])],{type:'application/octet-stream'});
    if(blob.size>LIMITS.file)fail('Project backup exceeds 128 MiB.');return blob;
  }
  async function unpack(file){
    if(!(file instanceof Blob)||file.size<12||file.size>LIMITS.file)fail('Choose a Measurement Notebook backup up to 128 MiB.');
    const prefix=new Uint8Array(await file.slice(0,12).arrayBuffer());
    if(new TextDecoder().decode(prefix.slice(0,8))!==MAGIC)fail('Unsupported backup format or version. Choose a .mnote file exported by this notebook.');
    const length=new DataView(prefix.buffer).getUint32(8);
    if(length<2||length>LIMITS.header||12+length>file.size)fail('The backup header is damaged or too large.');
    let h;try{h=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(await file.slice(12,12+length).arrayBuffer()));}catch{fail('The backup contains invalid project JSON.');}
    const descriptor=(a,max)=>exact(a,['size','type','sha256'])&&Number.isSafeInteger(a.size)&&a.size>0&&a.size<=max&&['image/png','image/jpeg','image/webp'].includes(a.type)&&typeof a.sha256==='string'&&/^[a-f0-9]{64}$/.test(a.sha256);
    if(!exact(h,['format','project','projectSha256','image','original'])||h.format!==MAGIC||!metadata(h.project)||typeof h.projectSha256!=='string'||!/^[a-f0-9]{64}$/.test(h.projectSha256)||!descriptor(h.image,LIMITS.image)||h.image.type!=='image/png'||(h.original!==null&&!descriptor(h.original,LIMITS.original)))fail('The backup contains invalid project fields, annotations or assets.');
    if(await digest(new Blob([JSON.stringify(h.project)]))!==h.projectSha256)fail('The backup project checksum does not match. The file may be corrupted.');
    const offset=12+length;
    if(offset+h.image.size+(h.original?.size||0)!==file.size)fail('The backup is incomplete or has unexpected extra data.');
    const image=file.slice(offset,offset+h.image.size,h.image.type),original=h.original?file.slice(offset+h.image.size,file.size,h.original.type):null;
    if(await digest(image)!==h.image.sha256||original&&await digest(original)!==h.original.sha256)fail('The backup photo checksum does not match. The file may be corrupted.');
    await assets(image,original,h.project.document);
    return {project:h.project,image,original};
  }
  return {LIMITS,MAGIC,document,metadata,signature,assets,digest,pack,unpack};
});
