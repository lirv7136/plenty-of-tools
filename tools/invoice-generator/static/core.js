(function(root){
  'use strict';
  const LIMIT=99999999999n;
  const fields={kind:20,gstMode:20,number:60,issueDate:10,dueDate:10,sellerName:160,sellerAbn:20,sellerAddress:600,sellerEmail:254,sellerPhone:60,clientName:160,clientAbn:20,clientAddress:600,clientEmail:254,paid:20,payment:1000,notes:2000};
  function today(){const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');}
  function validDate(value){if(!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;const d=new Date(value+'T00:00:00Z');return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===value&&value>='1900-01-01'&&value<='2100-12-31';}
  function addDays(date,days){const d=new Date(date+'T00:00:00Z');d.setUTCDate(d.getUTCDate()+days);return d.toISOString().slice(0,10);}
  function defaults(date=today()){return {kind:'invoice',gstMode:'none',number:'INV-001',issueDate:date,dueDate:addDays(date,14),sellerName:'',sellerAbn:'',sellerAddress:'',sellerEmail:'',sellerPhone:'',clientName:'',clientAbn:'',clientAddress:'',clientEmail:'',paid:'0.00',payment:'',notes:'',items:[{description:'',quantity:'1',price:'0.00',tax:'gst'}]};}
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
    try{calculate(data);}catch(e){errors.push(e.message);}
    return errors;
  }
  function parseDraft(text){
    if(text.length>1000000)throw new Error('Draft files must be smaller than 1 MB.');
    let doc;try{doc=JSON.parse(text);}catch{throw new Error('This is not a valid JSON draft.');}
    if(!doc||doc.format!=='plenty-of-tools-invoice'||doc.version!==1||!doc.data||typeof doc.data!=='object')throw new Error('Choose a draft saved by this invoice generator.');
    const input=doc.data,data={};
    for(const [key,max] of Object.entries(fields)){if(typeof input[key]!=='string'||input[key].length>max)throw new Error(`The draft has an invalid ${key} field.`);data[key]=input[key];}
    if(!['invoice','quote'].includes(data.kind)||!['none','exclusive','inclusive'].includes(data.gstMode))throw new Error('The draft contains unsupported settings.');
    if(!Array.isArray(input.items)||input.items.length<1||input.items.length>100)throw new Error('The draft must contain 1–100 items.');
    data.items=input.items.map(item=>{const clean={};for(const [key,max] of Object.entries({description:500,quantity:20,price:20,tax:10})){if(!item||typeof item[key]!=='string'||item[key].length>max)throw new Error('A draft line item is invalid.');clean[key]=item[key];}if(!['gst','none'].includes(clean.tax))throw new Error('Unsupported line-item tax setting.');return clean;});
    return data;
  }
  const serialize=data=>JSON.stringify({format:'plenty-of-tools-invoice',version:1,data},null,2);
  const title=data=>data.kind==='quote'?'Quote':data.gstMode==='none'?'Invoice':'Tax Invoice';
  const api={defaults,today,validDate,addDays,abnValid,decimal,calculate,validate,parseDraft,serialize,title,fields};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.InvoiceCore=api;
})(typeof globalThis!=='undefined'?globalThis:this);
