(function(root){
  'use strict';
  const LIMIT=99999999999n;
  const fields={kind:20,gstMode:20,number:60,issueDate:10,dueDate:10,sellerName:160,sellerAbn:20,sellerAddress:600,sellerEmail:254,sellerPhone:60,clientName:160,clientAbn:20,clientAddress:600,clientEmail:254,paid:20,payment:1000,notes:2000};
  function today(){const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');}
  function validDate(value){if(!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;const d=new Date(value+'T00:00:00Z');return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===value&&value>='1900-01-01'&&value<='2100-12-31';}
  function addDays(date,days){const d=new Date(date+'T00:00:00Z');d.setUTCDate(d.getUTCDate()+days);return d.toISOString().slice(0,10);}
  function defaults(date=today()){return {kind:'invoice',gstMode:'none',number:'INV-001',issueDate:date,dueDate:addDays(date,14),sellerName:'',sellerAbn:'',sellerAddress:'',sellerEmail:'',sellerPhone:'',clientName:'',clientAbn:'',clientAddress:'',clientEmail:'',paid:'0.00',payment:'',notes:'',columns:[],items:[{description:'',quantity:'1',price:'0.00',tax:'gst',extra:[]}]};}
  function abnValid(value){const digits=String(value).replace(/\s/g,'');if(!/^[1-9]\d{10}$/.test(digits))return false;const weights=[10,1,3,5,7,9,11,13,15,17,19];return [...digits].reduce((sum,n,i)=>sum+(Number(n)-(i===0?1:0))*weights[i],0)%89===0;}
  function decimal(value,places,label){let text=String(value).trim();if(text.startsWith('.'))text='0'+text;if(!new RegExp('^\\d{1,12}(?:\\.\\d{0,'+places+'})?$').test(text))throw new Error(`${label}: enter a non-negative number with up to ${places} decimal places.`);const [whole,fraction='']=text.split('.');return BigInt(whole)*10n**BigInt(places)+BigInt(fraction.padEnd(places,'0'));}
  const round=(n,d)=>(n+d/2n)/d;
  function calculate(data){
    if(!['none','exclusive','inclusive'].includes(data.gstMode)||!['invoice','quote'].includes(data.kind))throw new Error('Choose a valid document type and GST setting.');
    if(!Array.isArray(data.items)||data.items.length<1||data.items.length>100)throw new Error('Use between 1 and 100 line items.');
    let subtotal=0n,gst=0n,total=0n;
    const items=data.items.map((item,i)=>{
      const quantity=decimal(item.quantity,3,`Item ${i+1} quantity`),price=decimal(item.price,2,`Item ${i+1} price`);
      if(quantity<=0n||quantity>1000000000n)throw new Error(`Item ${i+1}: quantity must be greater than zero and no more than 1,000,000.`);
      if(price>LIMIT)throw new Error(`Item ${i+1}: unit price is too large.`);
      if(!['gst','none'].includes(item.tax))throw new Error(`Item ${i+1}: choose a valid GST treatment.`);
      const amount=round(quantity*price,1000n),taxable=data.gstMode!=='none'&&item.tax==='gst';
      const tax=taxable?round(amount,data.gstMode==='inclusive'?11n:10n):0n;
      const net=data.gstMode==='inclusive'?amount-tax:amount, gross=data.gstMode==='exclusive'?amount+tax:amount;
      subtotal+=net;gst+=tax;total+=gross;
      if(total>LIMIT)throw new Error('This document exceeds the supported total of $999,999,999.99.');
      return {net:Number(net),gst:Number(tax),total:Number(gross),amount:Number(amount),taxable,price:Number(price)};
    });
    const paid=data.kind==='quote'?0n:decimal(data.paid||'0',2,'Amount already paid');
    if(paid>total)throw new Error('Amount already paid cannot exceed the invoice total. This tool does not create credit notes.');
    return {items,subtotal:Number(subtotal),gst:Number(gst),total:Number(total),paid:Number(paid),due:Number(total-paid)};
  }
  function validate(data){
    const errors=[];
    if(!data.sellerName.trim())errors.push('Enter your business name.');
    if(!data.clientName.trim())errors.push('Enter the customer’s name or business name.');
    if(!data.number.trim())errors.push('Enter an invoice or quote number.');
    if(!validDate(data.issueDate))errors.push('Choose a valid issue date.');
    if(!validDate(data.dueDate))errors.push(data.kind==='quote'?'Choose a valid quote expiry date.':'Choose a valid due date.');
    if(validDate(data.issueDate)&&validDate(data.dueDate)&&data.dueDate<data.issueDate)errors.push('The due or expiry date cannot be before the issue date.');
    if(data.gstMode!=='none'&&!data.sellerAbn.trim())errors.push('Enter your ABN when using a GST-registered setting.');
    for(const [key,label] of [['sellerAbn','Your ABN'],['clientAbn','Customer ABN']])if(data[key].trim()&&!abnValid(data[key]))errors.push(`${label} has an invalid format or checksum.`);
    for(const [key,label] of [['sellerEmail','Your email'],['clientEmail','Customer email']])if(data[key].trim()&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data[key].trim()))errors.push(`${label} is not a valid email address.`);
    data.items.forEach((item,i)=>{if(!item.description.trim())errors.push(`Enter a description for item ${i+1}.`);});
    (data.columns||[]).forEach((label,i)=>{if(!label.trim())errors.push(`Name extra column ${i+1}, or remove it.`);});
    try{calculate(data);}catch(e){errors.push(e.message);}
    return errors;
  }

  // ---------- extra line columns ----------
  // Up to two extra columns with the user's own headings (Date, Hours, Job no., SKU…). Each
  // item carries one text value per column. They are descriptive only: they never enter the maths.
  const MAX_COLUMNS=2,COLUMN_MAX=24,EXTRA_MAX=60;
  function cleanColumns(input){
    if(input===undefined)return [];
    if(!Array.isArray(input)||input.length>MAX_COLUMNS)throw new Error(`Use at most ${MAX_COLUMNS} extra columns.`);
    return input.map(label=>{if(typeof label!=='string'||label.length>COLUMN_MAX)throw new Error('An extra column heading is invalid.');return label;});
  }
  function cleanExtra(input,count){
    const extra=input===undefined?[]:input;
    if(!Array.isArray(extra)||extra.length>MAX_COLUMNS)throw new Error('A line item has invalid extra column values.');
    const out=extra.map(v=>{if(typeof v!=='string'||v.length>EXTRA_MAX)throw new Error('A line item has invalid extra column values.');return v;});
    while(out.length<count)out.push('');
    return out.slice(0,count);
  }

  function cleanData(input){
    const data={};
    for(const [key,max] of Object.entries(fields)){if(typeof input[key]!=='string'||input[key].length>max)throw new Error(`The draft has an invalid ${key} field.`);data[key]=input[key];}
    if(!['invoice','quote'].includes(data.kind)||!['none','exclusive','inclusive'].includes(data.gstMode))throw new Error('The draft contains unsupported settings.');
    data.columns=cleanColumns(input.columns);
    if(!Array.isArray(input.items)||input.items.length<1||input.items.length>100)throw new Error('The draft must contain 1–100 items.');
    data.items=input.items.map(item=>{const clean={};for(const [key,max] of Object.entries({description:500,quantity:20,price:20,tax:10})){if(!item||typeof item[key]!=='string'||item[key].length>max)throw new Error('A draft line item is invalid.');clean[key]=item[key];}if(!['gst','none'].includes(clean.tax))throw new Error('Unsupported line-item tax setting.');clean.extra=cleanExtra(item.extra,data.columns.length);return clean;});
    return data;
  }
  // Version 1 drafts (no extra columns) still open; new drafts are version 2.
  function parseDraft(text){
    if(text.length>1000000)throw new Error('Draft files must be smaller than 1 MB.');
    let doc;try{doc=JSON.parse(text);}catch{throw new Error('This is not a valid JSON draft.');}
    if(!doc||doc.format!=='plenty-of-tools-invoice'||![1,2].includes(doc.version)||!doc.data||typeof doc.data!=='object')throw new Error('Choose a draft saved by this invoice generator.');
    return cleanData(doc.data);
  }
  const serialize=data=>JSON.stringify({format:'plenty-of-tools-invoice',version:2,data},null,2);
  const title=data=>data.kind==='quote'?'Quote':data.gstMode==='none'?'Invoice':'Tax Invoice';

  // ---------- numbering ----------
  // The next number after the last one used: the last run of digits goes up by one and keeps its
  // width (INV-009 → INV-010, 2026-041 → 2026-042). A number with no digits gets "-2".
  function nextNumber(value){
    const text=String(value||'').trim();
    if(!text)return 'INV-001';
    const m=/^(.*?)(\d+)(\D*)$/.exec(text);
    if(!m)return (text+'-2').slice(0,60);
    const next=(BigInt(m[2])+1n).toString().padStart(m[2].length,'0');
    return (m[1]+next+m[3]).slice(0,60);
  }
  const daysBetween=(a,b)=>Math.round((Date.parse(b+'T00:00:00Z')-Date.parse(a+'T00:00:00Z'))/86400000);

  // ---------- templates ----------
  // A template keeps what repeats: your business details, GST setting, payment terms, notes and
  // extra columns, the gap between issue and due dates, and the last number used so the next
  // document is numbered for you. Optionally the customer and the line items too.
  const SELLER=['kind','gstMode','sellerName','sellerAbn','sellerAddress','sellerEmail','sellerPhone','payment','notes'];
  const CLIENT=['clientName','clientAbn','clientAddress','clientEmail'];
  const MAX_TEMPLATES=50;
  function makeTemplate(name,data,opts={},id){
    const label=String(name||'').trim().slice(0,60);
    if(!label)throw new Error('Give the template a name.');
    const t={id:id||('t'+Date.now().toString(36)+Math.random().toString(36).slice(2,6)),name:label,savedAt:new Date().toISOString(),
      lastNumber:String(data.number||'').slice(0,60),
      termsDays:validDate(data.issueDate)&&validDate(data.dueDate)?Math.min(365,Math.max(0,daysBetween(data.issueDate,data.dueDate))):14,
      includesClient:!!opts.includeClient,includesItems:!!opts.includeItems,data:{columns:(data.columns||[]).slice()}};
    for(const k of SELLER)t.data[k]=data[k];
    if(opts.includeClient)for(const k of CLIENT)t.data[k]=data[k];
    if(opts.includeItems)t.data.items=data.items.map(i=>({...i,extra:(i.extra||[]).slice()}));
    return t;
  }
  function applyTemplate(t,date=today()){
    const base=defaults(date);
    const doc={...base,...t.data,number:nextNumber(t.lastNumber),issueDate:date,dueDate:addDays(date,t.termsDays),paid:'0.00'};
    if(!t.includesClient)for(const k of CLIENT)doc[k]='';
    const cols=doc.columns.length;
    doc.items=(t.includesItems&&t.data.items?t.data.items:base.items).map(i=>({...i,extra:cleanExtra(i.extra,cols)}));
    return cleanData(doc);
  }
  function validateTemplates(store){
    if(!store||store.v!==1||!Array.isArray(store.templates))throw new Error('This is not a saved templates file.');
    if(store.templates.length>MAX_TEMPLATES)throw new Error(`Keep at most ${MAX_TEMPLATES} templates.`);
    const ids=new Set();
    return {v:1,templates:store.templates.map(t=>{
      if(!t||typeof t.id!=='string'||!/^[A-Za-z0-9_-]{1,40}$/.test(t.id)||ids.has(t.id))throw new Error('A template has an invalid id.');ids.add(t.id);
      if(typeof t.name!=='string'||!t.name.trim()||t.name.length>60)throw new Error('A template has an invalid name.');
      if(typeof t.lastNumber!=='string'||t.lastNumber.length>60)throw new Error(`Template "${t.name}" has an invalid number.`);
      if(!Number.isInteger(t.termsDays)||t.termsDays<0||t.termsDays>365)throw new Error(`Template "${t.name}" has invalid payment terms.`);
      if(!t.data||typeof t.data!=='object')throw new Error(`Template "${t.name}" is empty.`);
      const probe={...defaults('2026-01-01'),...t.data,items:t.includesItems&&t.data.items?t.data.items:defaults('2026-01-01').items};
      if(!t.includesClient)for(const k of CLIENT)probe[k]='';
      const clean=cleanData(probe);
      const data={columns:clean.columns};for(const k of SELLER)data[k]=clean[k];
      if(t.includesClient)for(const k of CLIENT)data[k]=clean[k];
      if(t.includesItems)data.items=clean.items;
      return {id:t.id,name:t.name,savedAt:typeof t.savedAt==='string'?t.savedAt.slice(0,40):'',lastNumber:t.lastNumber,termsDays:t.termsDays,
        includesClient:!!t.includesClient,includesItems:!!t.includesItems,data};
    })};
  }
  function parseTemplates(text){
    if(text.length>2000000)throw new Error('Template files must be smaller than 2 MB.');
    let o;try{o=JSON.parse(text);}catch{throw new Error('This is not a saved templates file.');}
    if(!o||o.format!=='plenty-of-tools-invoice-templates')throw new Error('This is not a saved templates file.');
    return validateTemplates(o.store);
  }
  const serializeTemplates=store=>JSON.stringify({format:'plenty-of-tools-invoice-templates',version:1,store},null,2);

  // ---------- email ----------
  // A browser page cannot send mail itself, so this writes the message for the person's own mail
  // app: a share sheet with the PDF attached where the device supports it, otherwise a mailto or
  // webmail compose link plus the downloaded PDF to attach.
  const aud=cents=>new Intl.NumberFormat('en-AU',{style:'currency',currency:'AUD'}).format(cents/100);
  const longDate=v=>validDate(v)?new Intl.DateTimeFormat('en-AU',{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(v+'T00:00:00Z')):v;
  function emailMessage(data,totals){
    const doc=title(data).toLowerCase(),who=data.sellerName.trim()||'us';
    const subject=`${title(data)} ${data.number.trim()} from ${who}`.slice(0,200);
    const lines=[`Hi ${data.clientName.trim()||'there'},`,''];
    if(data.kind==='quote')lines.push(`Please find attached quote ${data.number.trim()} for ${aud(totals.total)}, valid until ${longDate(data.dueDate)}.`);
    else lines.push(`Please find attached ${doc} ${data.number.trim()} for ${aud(totals.due)}, due ${longDate(data.dueDate)}.`);
    if(data.kind==='invoice'&&data.payment.trim())lines.push('','Payment details:',data.payment.trim().slice(0,800));
    lines.push('','Thank you,',data.sellerName.trim()||'');
    return {to:data.clientEmail.trim(),subject,body:lines.join('\n').trim()};
  }
  const q=s=>encodeURIComponent(s);
  const mailtoUrl=m=>`mailto:${m.to?q(m.to).replace(/%40/g,'@'):''}?subject=${q(m.subject)}&body=${q(m.body)}`;
  const gmailUrl=m=>`https://mail.google.com/mail/?view=cm&fs=1&to=${q(m.to)}&su=${q(m.subject)}&body=${q(m.body)}`;
  const outlookUrl=m=>`https://outlook.live.com/mail/0/deeplink/compose?to=${q(m.to)}&subject=${q(m.subject)}&body=${q(m.body)}`;

  const api={defaults,today,validDate,addDays,abnValid,decimal,calculate,validate,parseDraft,serialize,title,fields,
    MAX_COLUMNS,COLUMN_MAX,EXTRA_MAX,cleanColumns,cleanExtra,nextNumber,makeTemplate,applyTemplate,validateTemplates,parseTemplates,
    serializeTemplates,MAX_TEMPLATES,emailMessage,mailtoUrl,gmailUrl,outlookUrl,aud};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.InvoiceCore=api;
})(typeof globalThis!=='undefined'?globalThis:this);
