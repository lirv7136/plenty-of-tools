(function(root) {
  'use strict';
  function validateSize(width, height, bytes) {
    if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1) throw new Error('This image has invalid dimensions.');
    if (bytes > 20 * 1024 * 1024) throw new Error('Choose an image smaller than 20 MB.');
    if (width * height > 16000000 || width > 8192 || height > 8192) throw new Error('Choose an image up to 16 megapixels and 8,192 pixels per side. Resize it first, then try again.');
  }
  function toTensor(rgba) {
    if (!rgba.length || rgba.length % 4) throw new Error('Invalid image pixels.');
    const size = rgba.length / 4, out = new Float32Array(size * 3);
    const means = [0.485,0.456,0.406], deviations = [0.229,0.224,0.225];
    let max = 1e-6;
    for (let i=0;i<rgba.length;i+=4) for (let c=0;c<3;c++) max=Math.max(max,rgba[i+c]);
    for (let i=0;i<size;i++) for (let c=0;c<3;c++) out[c*size+i]=(rgba[i*4+c]/max-means[c])/deviations[c];
    return out;
  }
  function toMask(values) {
    let min=Infinity,max=-Infinity;
    for (const n of values) { if (!Number.isFinite(n)) throw new Error('The model returned an invalid cutout. Try another image.'); min=Math.min(min,n); max=Math.max(max,n); }
    if (max-min < 1e-6) throw new Error('No clear subject was found. Try a photo with more contrast between the subject and background.');
    const rgba=new Uint8ClampedArray(values.length*4);
    for (let i=0;i<values.length;i++) { rgba[i*4]=rgba[i*4+1]=rgba[i*4+2]=255; rgba[i*4+3]=Math.round((values[i]-min)/(max-min)*255); }
    return rgba;
  }
  function outputName(name) { return (String(name).replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9_-]+/g,'-').replace(/^-+|-+$/g,'').slice(0,100)||'image')+'-cutout.png'; }
  function imageFormat(bytes) {
    const b=Array.from(bytes);
    if (b[0]===255 && b[1]===216 && b[2]===255) return 'jpeg';
    if ([137,80,78,71,13,10,26,10].every((v,i)=>b[i]===v)) return 'png';
    if (String.fromCharCode(...b.slice(0,4))==='RIFF' && String.fromCharCode(...b.slice(8,12))==='WEBP') return 'webp';
    throw new Error('Choose a JPEG, PNG or WebP image. HEIC, SVG and other formats need to be converted first.');
  }
  const api={validateSize,toTensor,toMask,outputName,imageFormat};
  if (typeof module !== 'undefined' && module.exports) module.exports=api;
  else root.BackgroundCore=api;
})(typeof self !== 'undefined' ? self : globalThis);
