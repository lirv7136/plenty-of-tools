(function(root,factory){const api=factory();if(typeof module==='object')module.exports=api;else root.ReadAloudCore=api;})(globalThis,function(){
  'use strict';
  const MAX_TEXT=500000,MAX_POSITIONS=100,KEY='plenty-read-aloud-positions-v1';
  function normalize(text){if(typeof text!=='string'||text.length>MAX_TEXT)throw new Error('Use a document up to 500,000 characters.');return text.replace(/\r\n?/g,'\n').trim();}
  function split(text,segmenter=typeof Intl.Segmenter==='function'?new Intl.Segmenter(undefined,{granularity:'sentence'}):null){
    text=normalize(text);const result=[];let paragraph=0;
    for(const match of text.matchAll(/[^\n]+(?:\n(?!\n)[^\n]+)*/g)){
      const raw=match[0],parts=segmenter?Array.from(segmenter.segment(raw),s=>({text:s.segment,index:s.index})):fallback(raw);
      for(const part of parts){const lead=part.text.length-part.text.trimStart().length,t=part.text.trim();if(t)result.push({text:t,start:match.index+part.index+lead,end:match.index+part.index+lead+t.length,paragraph});}
      if(result.length>10000)throw new Error('Use a document with at most 10,000 sentences.');paragraph++;
    }return result;
  }
  function fallback(text){
    const result=[];let start=0;
    for(let i=0;i<text.length;i++){
      if(!/[.!?。！？]/u.test(text[i]))continue;
      if(text[i]==='.'&&(/\d/.test(text[i-1]||'')&&/\d/.test(text[i+1]||'')||/\b(?:Mr|Mrs|Ms|Dr|Prof|Sr|Jr|St|vs|e\.g|i\.e)\.$/i.test(text.slice(start,i+1))))continue;
      let end=i+1;while(end<text.length&&/[.!?。！？"'”’)]/u.test(text[end]))end++;
      if(end<text.length&&!/\s/u.test(text[end])&&!/[。！？]/u.test(text[i]))continue;
      result.push({text:text.slice(start,end),index:start});start=end;i=end-1;
    }
    if(start<text.length)result.push({text:text.slice(start),index:start});return result;
  }
  function chunks(text,max=200){
    const result=[];let start=0;
    while(start<text.length){let end=Math.min(text.length,start+max);if(end<text.length){if(/[\uD800-\uDBFF]/.test(text[end-1]))end--;const space=text.lastIndexOf(' ',end);if(space>start+max/2)end=space+1;}result.push({text:text.slice(start,end),offset:start});start=end;}
    return result;
  }
  function indexAt(sentences,offset){const i=sentences.findIndex(s=>s.end>offset);return i<0?sentences.length:i;}
  function skip(sentences,index,direction,paragraph=false){
    if(!sentences.length)return 0;index=Math.max(0,Math.min(sentences.length-1,index));
    if(!paragraph)return Math.max(0,Math.min(sentences.length-1,index+direction));
    const p=sentences[index].paragraph;let i=index;
    if(direction<0){while(i>0&&sentences[i-1].paragraph===p)i--;if(i>0){i--;while(i>0&&sentences[i-1].paragraph===sentences[i].paragraph)i--;}return i;}
    while(i<sentences.length-1&&sentences[i].paragraph===p)i++;
    return sentences[i].paragraph===p?index:i;
  }
  function positions(raw){
    try{if(typeof raw!=='string'||raw.length>32000)return {};const obj=JSON.parse(raw);if(!obj||typeof obj!=='object'||Array.isArray(obj)||Object.keys(obj).length>MAX_POSITIONS)return {};
      const clean={};for(const [id,p]of Object.entries(obj)){if(!/^[a-f0-9]{64}$/.test(id)||!p||Object.keys(p).sort().join()!=='offset,updated'||!Number.isInteger(p.offset)||p.offset<0||p.offset>MAX_TEXT||!Number.isSafeInteger(p.updated)||p.updated<0)return {};clean[id]={offset:p.offset,updated:p.updated};}return clean;
    }catch{return {};}
  }
  class PositionStore{
    constructor(storage){this.storage=storage;}
    read(id){return positions(this.storage.getItem(KEY))[id]?.offset||0;}
    save(id,offset,updated=Date.now()){
      const item=positions(JSON.stringify({[id]:{offset,updated}}));if(!item[id])throw new Error('Invalid reading position.');
      const all={...positions(this.storage.getItem(KEY)),...item},sorted=Object.entries(all).sort((a,b)=>b[1].updated-a[1].updated).slice(0,MAX_POSITIONS);this.storage.setItem(KEY,JSON.stringify(Object.fromEntries(sorted)));
    }
    clear(){this.storage.removeItem(KEY);}
  }
  return {MAX_TEXT,KEY,normalize,split,chunks,indexAt,skip,positions,PositionStore};
});
