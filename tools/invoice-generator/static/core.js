(function(root){
  'use strict';
  const LIMIT=99999999999n;
  const fields={kind:20,gstMode:20,number:60,issueDate:10,dueDate:10,sellerName:160,sellerAbn:20,sellerAddress:600,sellerEmail:254,sellerPhone:60,clientName:160,clientAbn:20,clientAddress:600,clientEmail:254,paid:20,payment:1000,notes:2000,bankName:100,bankBsb:12,bankAccount:20,payId:100,ndis:10,ndisName:160,ndisNumber:30,region:5,currency:3,taxName:20,taxRate:6};
  // Added 11 Nov 2026. Drafts and templates saved before then lack them, so they default to empty.
  const OPTIONAL=new Set(['bankName','bankBsb','bankAccount','payId','ndis','ndisName','ndisNumber','region','currency','taxName','taxRate']);
  // Added 13 Nov 2026: other countries. Australia is the default, and a document saved before
  // this is Australian. A region sets the currency, what the tax is called, a starting rate (the
  // person can change it) and what the business number is called. BSB, PayID, ABN checks, "Tax
  // Invoice" and NDIS apply to Australia only.
  const REGIONS={
    AU:{name:'Australia',currency:'AUD',taxName:'GST',taxRate:'10',idLabel:'ABN',locale:'en-AU'},
    NZ:{name:'New Zealand',currency:'NZD',taxName:'GST',taxRate:'15',idLabel:'NZBN or GST number',locale:'en-NZ'},
    GB:{name:'United Kingdom',currency:'GBP',taxName:'VAT',taxRate:'20',idLabel:'VAT number',locale:'en-GB'},
    EU:{name:'Europe (euro)',currency:'EUR',taxName:'VAT',taxRate:'20',idLabel:'VAT number',locale:'en-IE'},
    US:{name:'United States',currency:'USD',taxName:'Sales tax',taxRate:'0',idLabel:'Tax ID (EIN)',locale:'en-US'},
    CA:{name:'Canada',currency:'CAD',taxName:'GST/HST',taxRate:'5',idLabel:'Business number',locale:'en-CA'},
    XX:{name:'Somewhere else',currency:'USD',taxName:'Tax',taxRate:'0',idLabel:'Tax ID',locale:'en-GB'}};
  const CURRENCIES=['AUD','NZD','USD','CAD','GBP','EUR','SGD','HKD','ZAR','INR','CHF','SEK','NOK','DKK','AED','MYR','PHP'];
  const OLD={region:'AU',currency:'AUD',taxName:'GST',taxRate:'10'};
  const regionOf=d=>REGIONS[d&&d.region]||REGIONS.AU;
  const isAU=d=>!d.region||d.region==='AU';
  const taxName=d=>String(d.taxName||'').trim()||regionOf(d).taxName;
  const idLabel=d=>regionOf(d).idLabel;
  // How the business number is written on the document: "ABN 51 824 753 556", "VAT number: GB123…".
  const idPrefix=d=>isAU(d)?'ABN ':idLabel(d)+': ';
  const money=(cents,d)=>new Intl.NumberFormat(regionOf(d).locale,{style:'currency',currency:(d&&d.currency)||'AUD'}).format(cents/100);
  // The tax rate as hundredths of a percent (10% is 1000), so the maths stays in whole numbers.
  function rateBp(d){const t=String(d.taxRate===undefined?'10':d.taxRate).trim();if(!/^\d{1,2}(\.\d{1,2})?$/.test(t))throw new Error(`Enter the ${taxName(d)} rate as a percentage, like 10 or 12.5.`);const [w,f='']=t.split('.');return BigInt(w)*100n+BigInt(f.padEnd(2,'0'));}
  function today(){const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');}
  function validDate(value){if(!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;const d=new Date(value+'T00:00:00Z');return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===value&&value>='1900-01-01'&&value<='2100-12-31';}
  function addDays(date,days){const d=new Date(date+'T00:00:00Z');d.setUTCDate(d.getUTCDate()+days);return d.toISOString().slice(0,10);}
  function defaults(date=today()){return {kind:'invoice',gstMode:'none',number:'INV-001',issueDate:date,dueDate:addDays(date,14),sellerName:'',sellerAbn:'',sellerAddress:'',sellerEmail:'',sellerPhone:'',clientName:'',clientAbn:'',clientAddress:'',clientEmail:'',paid:'0.00',payment:'',notes:'',bankName:'',bankBsb:'',bankAccount:'',payId:'',ndis:'',ndisName:'',ndisNumber:'',region:'AU',currency:'AUD',taxName:'GST',taxRate:'10',columns:[],items:[{description:'',quantity:'1',price:'0.00',tax:'gst',extra:[]}]};}
  function abnValid(value){const digits=String(value).replace(/\s/g,'');if(!/^[1-9]\d{10}$/.test(digits))return false;const weights=[10,1,3,5,7,9,11,13,15,17,19];return [...digits].reduce((sum,n,i)=>sum+(Number(n)-(i===0?1:0))*weights[i],0)%89===0;}
  function decimal(value,places,label){let text=String(value).trim();if(text.startsWith('.'))text='0'+text;if(!new RegExp('^\\d{1,12}(?:\\.\\d{0,'+places+'})?$').test(text))throw new Error(`${label}: enter a non-negative number with up to ${places} decimal places.`);const [whole,fraction='']=text.split('.');return BigInt(whole)*10n**BigInt(places)+BigInt(fraction.padEnd(places,'0'));}
  const round=(n,d)=>(n+d/2n)/d;
  function calculate(data){
    if(!['none','exclusive','inclusive'].includes(data.gstMode)||!['invoice','quote'].includes(data.kind))throw new Error('Choose a valid document type and GST setting.');
    if(!Array.isArray(data.items)||data.items.length<1||data.items.length>100)throw new Error('Use between 1 and 100 line items.');
    let subtotal=0n,gst=0n,total=0n;
    const bp=data.gstMode==='none'?0n:rateBp(data);
    const items=data.items.map((item,i)=>{
      const quantity=decimal(item.quantity,3,`Item ${i+1} quantity`),price=decimal(item.price,2,`Item ${i+1} price`);
      if(quantity<=0n||quantity>1000000000n)throw new Error(`Item ${i+1}: quantity must be greater than zero and no more than 1,000,000.`);
      if(price>LIMIT)throw new Error(`Item ${i+1}: unit price is too large.`);
      if(!['gst','none'].includes(item.tax))throw new Error(`Item ${i+1}: choose a valid GST treatment.`);
      const amount=round(quantity*price,1000n),taxable=data.gstMode!=='none'&&item.tax==='gst';
      const tax=taxable&&bp>0n?round(amount*bp,data.gstMode==='inclusive'?10000n+bp:10000n):0n;
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
    const au=isAU(data);
    if(au&&data.gstMode!=='none'&&!data.sellerAbn.trim())errors.push('Enter your ABN when using a GST-registered setting.');
    if(au)for(const [key,label] of [['sellerAbn','Your ABN'],['clientAbn','Customer ABN']])if(data[key].trim()&&!abnValid(data[key]))errors.push(`${label} has an invalid format or checksum.`);
    for(const [key,label] of [['sellerEmail','Your email'],['clientEmail','Customer email']])if(data[key].trim()&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data[key].trim()))errors.push(`${label} is not a valid email address.`);
    const bsb=String(data.bankBsb||'').replace(/[\s-]/g,''),acct=String(data.bankAccount||'').replace(/\s/g,'');
    if(au&&bsb&&!/^\d{6}$/.test(bsb))errors.push('A BSB has 6 digits, like 062-000.');
    if(au&&acct&&!/^\d{4,10}$/.test(acct))errors.push('An account number has 4 to 10 digits.');
    if(au&&bsb&&!acct)errors.push('Add the account number to go with the BSB, or clear the BSB.');
    if(au&&acct&&!bsb)errors.push('Add the BSB to go with the account number, or clear it.');
    if(data.ndis&&au){
      if(!String(data.ndisName||'').trim())errors.push('Enter the NDIS participant’s name.');
      if(!String(data.ndisNumber||'').trim())errors.push('Enter the participant’s NDIS number (participant reference number).');
      if(data.ndis==='plan'&&!data.sellerAbn.trim())errors.push('Plan managers need your ABN on the invoice. If you are exempt, attach the ATO statement by a supplier form instead and use a regular invoice.');
      const cols=data.columns||[],d=cols.findIndex(isDateHeading),it=cols.findIndex(isItemHeading);
      if(d<0)errors.push('Add a Date column: the NDIS needs the date of each support.');
      if(it<0)errors.push('Add a Support item column: the NDIS needs the support item number on each line.');
      data.items.forEach((item,i)=>{if(d>=0&&!String(item.extra[d]||'').trim())errors.push(`Enter the date of support for item ${i+1}.`);if(it>=0&&!String(item.extra[it]||'').trim())errors.push(`Enter the support item number for item ${i+1}.`);});
    }
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

  // A column headed Date (or Visit date, Service date…) gets a date picker on each line, stores
  // the date as YYYY-MM-DD and shows it on the invoice as "3 Nov 2026". Anything else typed into
  // it (an old draft's "Tues 3rd") is kept and shown exactly as typed.
  const isDateHeading=label=>/^(dates?|(visit|service|support|work|job|session) dates?)$/i.test(String(label||'').trim());
  const shortDate=v=>new Intl.DateTimeFormat('en-AU',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'}).format(new Date(v+'T00:00:00Z'));
  const isItemHeading=label=>/^(support item( (number|no\.?|ref(erence)?( number)?))?|ndis item( number)?|item (number|no\.?))$/i.test(String(label||'').trim());
  const cellText=(heading,value)=>isDateHeading(heading)&&validDate(value)?shortDate(value):String(value||'');

  function cleanData(input){
    const data={};
    for(const [key,max] of Object.entries(fields)){if(OPTIONAL.has(key)&&input[key]===undefined){data[key]=OLD[key]||'';continue;}if(typeof input[key]!=='string'||input[key].length>max)throw new Error(`The draft has an invalid ${key} field.`);data[key]=input[key];}
    if(!['invoice','quote'].includes(data.kind)||!['none','exclusive','inclusive'].includes(data.gstMode)||!['','self','plan'].includes(data.ndis)||!REGIONS[data.region]||!CURRENCIES.includes(data.currency))throw new Error('The draft contains unsupported settings.');
    if(data.region!=='AU')data.ndis='';
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
  const title=data=>data.kind==='quote'?'Quote':data.gstMode==='none'||!isAU(data)?'Invoice':'Tax Invoice';

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
  // One running sequence for everything made on this device: a template saved for each customer
  // must never hand out a number another customer already has. A number's pattern is what
  // surrounds its last run of digits (INV-… , Q-… , 2026-…). nextFrom counts on from the highest
  // number of the same pattern among everything known: every template's last number and the
  // device's list of highest numbers used. A different pattern (quotes, a second business) keeps
  // its own count. recordUsed keeps that list: one entry per pattern that only ever goes up.
  function pattern(s){const m=/^(.*?)(\d+)(\D*)$/.exec(String(s||'').trim());return m&&{key:m[1]+'\u0000'+m[3],n:BigInt(m[2])};}
  function nextFrom(ref,known=[]){
    const start=String(ref||'').trim()||'INV-000',r=pattern(start);
    if(!r)return nextNumber(start);
    let best=start,top=r.n;
    for(const k of [].concat(known||[])){const p=pattern(k);if(p&&p.key===r.key&&p.n>top){top=p.n;best=String(k).trim();}}
    return nextNumber(best);
  }
  function recordUsed(used,number){
    const n=String(number||'').trim().slice(0,60),p=pattern(n),list=Array.isArray(used)?used:[];
    if(!p)return list.slice(0,20);
    const prev=list.find(x=>{const q=pattern(x);return q&&q.key===p.key;}),keep=prev&&pattern(prev).n>p.n?prev:n;
    return [keep,...list.filter(x=>x!==prev)].slice(0,20);
  }
  const daysBetween=(a,b)=>Math.round((Date.parse(b+'T00:00:00Z')-Date.parse(a+'T00:00:00Z'))/86400000);

  // ---------- templates ----------
  // A template keeps what repeats: your business details, GST setting, payment terms, notes and
  // extra columns, the gap between issue and due dates, and the last number used so the next
  // document is numbered for you. Optionally the customer and the line items too.
  const SELLER=['kind','gstMode','sellerName','sellerAbn','sellerAddress','sellerEmail','sellerPhone','payment','notes','bankName','bankBsb','bankAccount','payId','region','currency','taxName','taxRate'];
  const CLIENT=['clientName','clientAbn','clientAddress','clientEmail','ndis','ndisName','ndisNumber'];
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
  function applyTemplate(t,date=today(),known=[]){
    const base=defaults(date);
    const doc={...base,...t.data,number:nextFrom(t.lastNumber,known),issueDate:date,dueDate:addDays(date,t.termsDays),paid:'0.00'};
    if(!t.includesClient)for(const k of CLIENT)doc[k]='';
    const cols=doc.columns.length;
    doc.items=(t.includesItems&&t.data.items?t.data.items:base.items).map(i=>({...i,extra:cleanExtra(i.extra,cols)}));
    return cleanData(doc);
  }
  function validateTemplates(store){
    if(!store||store.v!==1||!Array.isArray(store.templates))throw new Error('This is not a saved templates file.');
    if(store.templates.length>MAX_TEMPLATES)throw new Error(`Keep at most ${MAX_TEMPLATES} templates.`);
    const ids=new Set();
    const used=(Array.isArray(store.used)?store.used:[]).filter(x=>typeof x==='string'&&x.trim()&&x.length<=60).slice(0,20);
    const lastInvoice=typeof store.lastInvoice==='string'?store.lastInvoice.slice(0,60):'';
    // Ids of templates deleted on some device, with when: so a sync does not bring them back.
    const deleted={};if(store.deleted&&typeof store.deleted==='object')for(const [k,v] of Object.entries(store.deleted).slice(0,300))if(/^[A-Za-z0-9_-]{1,40}$/.test(k)&&typeof v==='string')deleted[k]=v.slice(0,40);
    return {v:1,used,lastInvoice,deleted,templates:store.templates.map(t=>{
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
  // ---------- sync: merging what two devices each have ----------
  // Templates: the copy saved most recently wins, and one deleted anywhere after its last save
  // stays deleted. Numbers used only ever go up. Nothing is dropped just because the other device
  // has not seen it.
  function mergeStores(a,b){
    const A=validateTemplates(a),B=validateTemplates(b),deleted={...B.deleted};
    for(const [k,v] of Object.entries(A.deleted))if(!deleted[k]||v>deleted[k])deleted[k]=v;
    const byId=new Map();
    for(const t of [...A.templates,...B.templates]){const have=byId.get(t.id);if(!have||String(t.savedAt)>String(have.savedAt)||(String(t.savedAt)===String(have.savedAt)&&pattern(t.lastNumber)&&pattern(have.lastNumber)&&pattern(t.lastNumber).n>pattern(have.lastNumber).n))byId.set(t.id,t);}
    const templates=[...byId.values()].filter(t=>!(deleted[t.id]&&deleted[t.id]>=String(t.savedAt))).slice(0,MAX_TEMPLATES);
    let used=A.used.slice();for(const n of B.used.slice().reverse())used=recordUsed(used,n);
    const pa=pattern(A.lastInvoice),pb=pattern(B.lastInvoice);
    const lastInvoice=!A.lastInvoice?B.lastInvoice:!B.lastInvoice?A.lastInvoice:pa&&pb&&pa.key===pb.key&&pb.n>pa.n?B.lastInvoice:A.lastInvoice;
    return {v:1,used,lastInvoice,deleted,templates};
  }
  // Invoices: one entry per id; the copy changed most recently wins (marking paid counts as a change).
  function mergeHistory(a,b,max=200){
    const stamp=h=>String(h.updatedAt||h.savedAt||''),byId=new Map();
    for(const h of [...(Array.isArray(a)?a:[]),...(Array.isArray(b)?b:[])]){
      if(!h||typeof h.id!=='string'||!h.doc)continue;
      let doc;try{doc=cleanData(h.doc);}catch(e){continue;}
      const clean={id:h.id.slice(0,300),savedAt:String(h.savedAt||'').slice(0,40),paidAt:String(h.paidAt||'').slice(0,40),doc,...(h.updatedAt?{updatedAt:String(h.updatedAt).slice(0,40)}:{})};
      const have=byId.get(clean.id);if(!have||stamp(clean)>stamp(have))byId.set(clean.id,clean);
    }
    return [...byId.values()].sort((x,y)=>String(y.savedAt).localeCompare(String(x.savedAt))).slice(0,max);
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
  const aud=cents=>money(cents,OLD);
  const longDate=v=>validDate(v)?new Intl.DateTimeFormat('en-AU',{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(v+'T00:00:00Z')):v;
  // How to pay, as lines for the invoice and the email: bank transfer and PayID, with the
  // invoice number as the reference. Empty when no bank details or PayID are given.
  function bankLines(data){
    if(!isAU(data))return [];
    const bsb=String(data.bankBsb||'').replace(/[\s-]/g,''),acct=String(data.bankAccount||'').trim(),lines=[];
    if(bsb&&acct){lines.push('Bank transfer');if(String(data.bankName||'').trim())lines.push('Account name: '+data.bankName.trim());lines.push(`BSB: ${bsb.slice(0,3)}-${bsb.slice(3)}`,'Account: '+acct);}
    if(String(data.payId||'').trim())lines.push('PayID: '+data.payId.trim());
    if(lines.length&&data.kind==='invoice'&&String(data.number||'').trim())lines.push('Reference: '+data.number.trim());
    return lines;
  }
  // NDIS (read 12 Nov 2026 on ndis.gov.au, Guide to getting paid): a claim needs the participant's
  // name, participant reference or NDIS number, dates of support, support item number and price.
  // Plan managers need the provider's ABN. Claims more than 90 days after a support may be held
  // for extra checks (up to 28 days); the limit itself is 2 years.
  // Who an invoice is for, in the person's eyes: the NDIS participant, not their plan manager,
  // who may bill for many participants.
  const whoFor=d=>String((d.ndis&&d.ndisName)||d.clientName||'').trim();
  function ndisLines(data){
    if(!data.ndis||!isAU(data))return [];
    return ['NDIS participant: '+String(data.ndisName||'').trim(),'NDIS number: '+String(data.ndisNumber||'').trim(),
      data.ndis==='plan'?'Funding: plan managed':'Funding: self managed'];
  }
  function ndisWarnings(data,on=today()){
    if(!data.ndis)return [];
    const d=(data.columns||[]).findIndex(isDateHeading);if(d<0)return [];
    const dates=data.items.map(i=>i.extra[d]).filter(validDate),out=[];
    if(dates.some(x=>x<addDays(on,-730)))out.push('A support on this invoice is more than 2 years old. NDIS payment requests must be made within 2 years of the support.');
    else if(dates.some(x=>x<addDays(on,-90)))out.push('A support on this invoice is more than 90 days old. The NDIS may hold claims like that for extra checks, for up to 28 days.');
    return out;
  }
  // The words on a "start again" button: who it is for, if the template keeps the customer.
  function quickLabel(t){
    const doc=t.data.kind==='quote'?'quote':'invoice',who=t.includesClient&&whoFor(t.data);
    return who?`New ${doc} for ${who.slice(0,60)}`:`New ${doc} from "${t.name}"`;
  }
  function emailMessage(data,totals){
    const doc=title(data).toLowerCase(),who=data.sellerName.trim()||'us';
    const subject=(`${title(data)} ${data.number.trim()} from ${who}`+(data.ndis?` for NDIS participant ${String(data.ndisName||'').trim()} (${String(data.ndisNumber||'').trim()})`:'')).slice(0,200);
    const lines=[`Hi ${data.clientName.trim()||'there'},`,''];
    if(data.kind==='quote')lines.push(`Please find attached quote ${data.number.trim()} for ${money(totals.total,data)}, valid until ${longDate(data.dueDate)}.`);
    else lines.push(`Please find attached ${doc} ${data.number.trim()} for ${money(totals.due,data)}, due ${longDate(data.dueDate)}.`);
    const bank=data.kind==='invoice'?bankLines(data):[];
    if(bank.length)lines.push('','How to pay:',...bank);
    if(data.kind==='invoice'&&data.payment.trim())lines.push('',bank.length?'Payment terms:':'Payment details:',data.payment.trim().slice(0,800));
    lines.push('','Thank you,',data.sellerName.trim()||'');
    return {to:data.clientEmail.trim(),subject,body:lines.join('\n').trim()};
  }
  const q=s=>encodeURIComponent(s);
  const mailtoUrl=m=>`mailto:${m.to?q(m.to).replace(/%40/g,'@'):''}?subject=${q(m.subject)}&body=${q(m.body)}`;
  const gmailUrl=m=>`https://mail.google.com/mail/?view=cm&fs=1&to=${q(m.to)}&su=${q(m.subject)}&body=${q(m.body)}`;
  const outlookUrl=m=>`https://outlook.live.com/mail/0/deeplink/compose?to=${q(m.to)}&subject=${q(m.subject)}&body=${q(m.body)}`;

  // ---------- Send with Gmail: the message itself ----------
  // A multipart MIME message (the text, and the PDF as an attachment) in the base64url form the
  // Gmail API's users.messages.send takes as `raw`. Gmail fills in From with the signed in account.
  const emailOk=s=>/^[^\s@,;<>"]+@[^\s@,;<>"]+\.[^\s@,;<>"]+$/.test(String(s).trim());
  function bytesToB64(bytes){let bin='';for(let i=0;i<bytes.length;i+=0x8000)bin+=String.fromCharCode.apply(null,bytes.subarray(i,i+0x8000));return btoa(bin);}
  const utf8B64=s=>bytesToB64(new TextEncoder().encode(s));
  const wrap76=s=>s.replace(/.{1,76}/g,'$&\r\n').trimEnd();
  function buildMime(msg,pdfBytes,filename){
    if(!emailOk(msg.to))throw new Error('Enter a valid customer email address.');
    const subject=String(msg.subject||'').replace(/[\r\n]+/g,' ').trim();
    if(!subject)throw new Error('Add a subject.');
    const name=(String(filename||'invoice.pdf').replace(/[^A-Za-z0-9._-]+/g,'-').slice(0,90)||'invoice')+(/\.pdf$/i.test(filename||'')?'':'.pdf');
    const boundary='pot-'+Math.random().toString(36).slice(2)+Date.now().toString(36);
    const lines=['To: '+String(msg.to).trim(),'Subject: =?UTF-8?B?'+utf8B64(subject)+'?=','MIME-Version: 1.0',`Content-Type: multipart/mixed; boundary="${boundary}"`,'',
      '--'+boundary,'Content-Type: text/plain; charset="UTF-8"','Content-Transfer-Encoding: base64','',wrap76(utf8B64(String(msg.body||''))),'',
      '--'+boundary,`Content-Type: application/pdf; name="${name}"`,`Content-Disposition: attachment; filename="${name}"`,'Content-Transfer-Encoding: base64','',wrap76(bytesToB64(pdfBytes)),'',
      '--'+boundary+'--',''];
    return utf8B64(lines.join('\r\n')).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
  }

  const api={REGIONS,CURRENCIES,regionOf,isAU,taxName,idLabel,idPrefix,money,defaults,today,validDate,addDays,abnValid,decimal,calculate,validate,parseDraft,serialize,title,fields,emailOk,buildMime,
    MAX_COLUMNS,COLUMN_MAX,EXTRA_MAX,cleanColumns,cleanExtra,nextNumber,nextFrom,recordUsed,mergeStores,mergeHistory,bankLines,cleanData,ndisLines,ndisWarnings,isItemHeading,whoFor,isDateHeading,cellText,quickLabel,makeTemplate,applyTemplate,validateTemplates,parseTemplates,
    serializeTemplates,MAX_TEMPLATES,emailMessage,mailtoUrl,gmailUrl,outlookUrl,aud};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.InvoiceCore=api;
})(typeof globalThis!=='undefined'?globalThis:this);
