(function(){
  'use strict';
  const core=window.InvoiceCore,$=id=>document.getElementById('inv-'+id);
  let data=core.defaults(),revision=0,showErrors=false;
  const originalTitle=document.title;
  const node=(tag,text,className)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(className)n.className=className;return n;};
  // The preview is a picture of a document sitting inside the page, so its headings would
  // otherwise land in the page's own outline: a second h1, and a jump from h1 to h3. The tags
  // stay exactly as they are, because both the screen and the print stylesheets target them by
  // name and the printed invoice depends on that. aria-level re-levels them for assistive
  // technology instead, under the "Live preview" heading, and changes nothing visual. The
  // seller name sits above the document title in the paper, so both sit at the same level.
  const relevelPreview=root=>{for(const h of root.querySelectorAll('h1,h2,h3,h4,h5,h6')){h.setAttribute('role','heading');h.setAttribute('aria-level',/^H[12]$/.test(h.tagName)?'3':'4');}};
  const money=cents=>new Intl.NumberFormat('en-AU',{style:'currency',currency:'AUD'}).format(cents/100);
  const date=value=>core.validDate(value)?new Intl.DateTimeFormat('en-AU',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'}).format(new Date(value+'T00:00:00Z')):'—';
  function block(parent,tag,text,className){if(text)parent.append(node(tag,text,className));}
  function status(text){$('status').textContent=text;}
  function displayErrors(errors){
    $('errors').replaceChildren();$('errors').hidden=!errors.length;
    if(errors.length){$('errors').append(node('p','Check these details:'));const list=node('ul');errors.forEach(error=>list.append(node('li',error)));$('errors').append(list);}
  }
  function settings(){
    $('due-label').textContent=data.kind==='quote'?'Valid until':'Due date';$('paid').disabled=data.kind==='quote';
    $('price-hint').textContent=data.gstMode==='none'?'Unit prices in AUD. GST is not charged.':data.gstMode==='inclusive'?'Unit prices include GST where applicable. Choose the tax treatment for each line.':'Unit prices exclude GST. 10% is added to taxable lines.';
    for(const select of $('items').querySelectorAll('select'))select.disabled=data.gstMode==='none';
    $('add').disabled=data.items.length>=100;
  }
  function itemInputs(){
    $('items').replaceChildren();
    data.items.forEach((item,index)=>{
      const panel=node('div',undefined,'inv-line');panel.dataset.index=String(index);
      const head=node('div',undefined,'inv-line-head');head.append(node('strong',`Item ${index+1}`));
      const remove=node('button','Remove','btn small');remove.type='button';remove.dataset.remove=String(index);remove.disabled=data.items.length===1;remove.setAttribute('aria-label',`Remove item ${index+1}`);head.append(remove);panel.append(head);
      function field(key,label,type='text'){
        const wrap=node('label',label),input=node(type==='textarea'?'textarea':type==='select'?'select':'input');input.dataset.field=key;input.setAttribute('aria-label',`Item ${index+1} ${label.toLowerCase()}`);
        if(type==='select'){input.append(new Option('GST (10%)','gst'),new Option('No GST (0%)','none'));}
        else if(type==='textarea'){input.rows=2;input.maxLength=500;}else{input.type='text';input.inputMode='decimal';input.maxLength=20;}
        input.value=item[key];wrap.append(input);return wrap;
      }
      panel.append(field('description','Description','textarea'));
      data.columns.forEach((label,k)=>{const wrap=node('label',label.trim()||`Column ${k+1}`),input=node('input');input.type='text';input.maxLength=core.EXTRA_MAX;input.dataset.extra=String(k);input.setAttribute('aria-label',`Item ${index+1} ${(label.trim()||`column ${k+1}`).toLowerCase()}`);input.value=item.extra[k]||'';wrap.append(input);panel.append(wrap);});
      const row=node('div',undefined,'inv-row');row.append(field('quantity','Quantity'),field('price','Unit price'));panel.append(row,field('tax','GST treatment','select'));$('items').append(panel);
    });settings();
  }
  function totalRow(parent,label,value,className=''){const row=node('div',undefined,'inv-total-row '+className);row.append(node('span',label),node('span',value));parent.append(row);}
  function render(){
    let totals=null,calculationError='';try{totals=core.calculate(data);}catch(e){calculationError=e.message;}
    const errors=core.validate(data);document.body.classList.toggle('invoice-invalid',errors.length>0);
    $('validation').textContent=errors.length?'Draft — details needed':'Ready to print';
    if(showErrors)displayErrors(errors);
    const paper=$('paper');paper.replaceChildren();
    const head=node('div',undefined,'inv-doc-head'),seller=node('div'),meta=node('div',undefined,'inv-doc-meta');
    seller.append(node('h2',data.sellerName||'Your business'));
    if(data.sellerAbn.trim())block(seller,'p','ABN '+data.sellerAbn.trim());
    for(const key of ['sellerAddress','sellerEmail','sellerPhone'])block(seller,'p',data[key]);
    meta.append(node('h1',core.title(data)),node('p',data.number||'Document number'),node('p','Issued: '+date(data.issueDate)),node('p',(data.kind==='quote'?'Valid until: ':'Due: ')+date(data.dueDate)));
    head.append(seller,meta);paper.append(head);
    const parties=node('div',undefined,'inv-parties'),buyer=node('div'),amount=node('div');buyer.append(node('h3',data.kind==='quote'?'Prepared for':'Bill to'),node('p',data.clientName||'Customer name'));
    if(data.clientAbn.trim())block(buyer,'p','ABN '+data.clientAbn.trim());
    block(buyer,'p',data.clientAddress);block(buyer,'p',data.clientEmail);
    amount.append(node('h3',data.kind==='quote'?'Quote total (AUD)':'Amount due (AUD)'),node('h2',totals?money(data.kind==='quote'?totals.total:totals.due):'—'));
    if(data.kind==='quote')amount.append(node('p','This quote is not a tax invoice.','inv-doc-subtle'));
    parties.append(buyer,amount);paper.append(parties);
    const tax=data.gstMode!=='none';
    const table=node('table',undefined,tax?'':'inv-table-no-gst'),thead=node('thead'),tr=node('tr');
    const cols=data.columns,heads=['Description',...cols.map((c,k)=>c.trim()||`Column ${k+1}`),'Qty',data.gstMode==='inclusive'?'Unit (incl.)':tax?'Unit (excl.)':'Unit price',...(tax?['GST']:[]),'Amount'];
    const widths=cols.length?[null,...cols.map(()=>12),8,14,...(tax?[11]:[]),14]:[];if(widths.length)widths[0]=100-widths.slice(1).reduce((a,b)=>a+b,0);
    heads.forEach((text,k)=>{const th=node('th',text);th.scope='col';if(widths.length)th.style.width=widths[k]+'%';if(k>0&&k<=cols.length)th.style.textAlign='left';tr.append(th);});thead.append(tr);table.append(thead);
    const tbody=node('tbody');
    data.items.forEach((item,i)=>{
      const row=node('tr'),computed=totals?.items[i];
      const values=[item.description||'Item description',...data.columns.map((_,k)=>item.extra[k]||''),item.quantity||'—',computed?money(computed.price):'—',...(tax?[computed?(computed.taxable?money(computed.gst):'No GST'):'—']:[]),computed?money(computed.total):'—'];
      values.forEach((value,k)=>{const td=node('td',value);if(k>0&&k<=data.columns.length)td.style.textAlign='left';row.append(td);});tbody.append(row);
    });table.append(tbody);paper.append(table);
    if(calculationError)paper.append(node('p','Draft: '+calculationError,'inv-doc-subtle'));
    const summary=node('div',undefined,'inv-totals');
    totalRow(summary,tax?'Subtotal (excl. GST)':'Subtotal',totals?money(totals.subtotal):'—');
    if(tax)totalRow(summary,'GST',totals?money(totals.gst):'—');
    totalRow(summary,data.kind==='quote'?'Quote total':'Total',totals?money(totals.total):'—','strong');
    if(data.kind==='invoice'){
      if(totals?.paid)totalRow(summary,'Already paid','−'+money(totals.paid));
      totalRow(summary,'Amount due',totals?money(totals.due):'—','strong balance');
    }paper.append(summary);
    for(const [key,title] of [['payment','Payment details / terms'],['notes','Notes']])if(data[key].trim()){const section=node('section',undefined,'inv-doc-notes');section.append(node('h3',title),node('p',data[key]));paper.append(section);}
    paper.append(node('p',tax?'All amounts in AUD. GST applies only to taxable lines and is rounded per line. Line amounts include any GST.':'All amounts in AUD. No GST charged — supplier not registered for GST.','inv-doc-footer'));
    relevelPreview(paper);
    settings();return errors;
  }
  function populate(){for(const key of Object.keys(core.fields))$(key).value=data[key];renderColumns();itemInputs();render();}
  function replace(next,message){revision++;data=next;fromTemplate=null;showErrors=false;displayErrors([]);populate();status(message);}
  function update(event){
    const input=event.target;
    if(input.dataset.field){const index=Number(input.closest('.inv-line').dataset.index);data.items[index][input.dataset.field]=input.value;}
    else if(input.dataset.extra){const index=Number(input.closest('.inv-line').dataset.index);data.items[index].extra[Number(input.dataset.extra)]=input.value;}
    else if(input.dataset.col){data.columns[Number(input.dataset.col)]=input.value;relabelExtras();}
    else if(input.closest('.inv-templates'))return;
    else if(input.id.startsWith('inv-')&&Object.hasOwn(core.fields,input.id.slice(4)))data[input.id.slice(4)]=input.value;
    else return;
    revision++;render();status('Unsaved edits. Save a draft file to keep your work.');
  }
  $('form').addEventListener('submit',event=>event.preventDefault());
  $('form').addEventListener('input',update);$('form').addEventListener('change',update);
  $('items').addEventListener('click',event=>{const button=event.target.closest('[data-remove]');if(!button||data.items.length===1)return;data.items.splice(Number(button.dataset.remove),1);revision++;itemInputs();render();status('Item removed.');});
  $('add').addEventListener('click',()=>{if(data.items.length>=100)return;data.items.push({description:'',quantity:'1',price:'0.00',tax:'gst',extra:data.columns.map(()=>'')});revision++;itemInputs();render();$('items').lastElementChild.querySelector('textarea').focus();});
  $('clear').addEventListener('click',()=>replace(core.defaults(),'New document. Nothing has been saved automatically.'));
  $('example').addEventListener('click',()=>{
    const example=core.defaults();Object.assign(example,{number:'EXAMPLE-001',sellerName:'Example Studio (sample)',sellerAddress:'Sydney NSW\nAustralia',sellerEmail:'studio@example.com',clientName:'Example Customer',clientAddress:'Melbourne VIC\nAustralia',paid:'200.00',payment:'Example only — replace with your own payment details.\nUse the invoice number as your payment reference.',notes:'Fictional example. Replace all details before use.',items:[{description:'Website design services',quantity:'8',price:'125.00',tax:'gst',extra:[]},{description:'Project setup',quantity:'1',price:'150.00',tax:'gst',extra:[]}]});
    replace(example,'Fictional example loaded. The example uses no GST.');
  });
  const filename=()=>((data.number||'invoice').replace(/[^a-zA-Z0-9_-]+/g,'-').slice(0,80)||'invoice');
  $('save').addEventListener('click',()=>{const blob=new Blob([core.serialize(data)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=filename()+'.json';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);status('Draft download started. Keep this file to reopen and edit later.');});
  $('open').addEventListener('click',()=>$('load').click());
  $('load').addEventListener('change',async event=>{
    const file=event.target.files[0];event.target.value='';if(!file)return;const token=revision;
    try{if(file.size>1000000)throw new Error('Draft files must be smaller than 1 MB.');const next=core.parseDraft(await file.text());if(token!==revision){status('Draft was not opened because the current document changed. Open it again to replace this document.');return;}replace(next,'Draft opened locally. Review the details before printing.');}
    catch(error){displayErrors([error.message]);status('The current document has been kept.');}
  });
  $('print').addEventListener('click',()=>{showErrors=true;const errors=render();if(errors.length){$('errors').focus();return;}document.title=filename()+' — '+core.title(data);markUsed();window.print();});
  window.addEventListener('beforeprint',render);
  window.addEventListener('afterprint',()=>{document.title=originalTitle;});

  // ---------- extra columns ----------
  function renderColumns(){
    $('columns').replaceChildren();
    data.columns.forEach((label,k)=>{
      const row=node('div',undefined,'inv-col'),wrap=node('label',`Column ${k+1} heading`),input=node('input');
      input.maxLength=core.COLUMN_MAX;input.dataset.col=String(k);input.value=label;input.placeholder=k?'Hours':'Date';wrap.append(input);
      const remove=node('button','Remove','btn small');remove.type='button';remove.dataset.colRemove=String(k);remove.setAttribute('aria-label',`Remove column ${k+1}`);
      row.append(wrap,remove);$('columns').append(row);
    });
    $('col-add').disabled=data.columns.length>=core.MAX_COLUMNS;
  }
  function relabelExtras(){for(const input of $('items').querySelectorAll('[data-extra]')){const k=Number(input.dataset.extra),label=data.columns[k].trim()||`Column ${k+1}`;input.parentElement.firstChild.textContent=label;input.setAttribute('aria-label',`Item ${Number(input.closest('.inv-line').dataset.index)+1} ${label.toLowerCase()}`);}}
  $('col-add').addEventListener('click',()=>{if(data.columns.length>=core.MAX_COLUMNS)return;data.columns.push('');data.items.forEach(i=>i.extra.push(''));revision++;renderColumns();itemInputs();render();$('columns').lastElementChild.querySelector('input').focus();status('Column added. Give it a heading.');});
  $('columns').addEventListener('click',event=>{const b=event.target.closest('[data-col-remove]');if(!b)return;const k=Number(b.dataset.colRemove);data.columns.splice(k,1);data.items.forEach(i=>i.extra.splice(k,1));revision++;renderColumns();itemInputs();render();status('Column removed.');});

  // ---------- templates (this browser only) ----------
  const TKEY='pot:invoice-generator:templates:v1';
  let store={v:1,templates:[]},fromTemplate=null;
  function loadTemplates(){try{const raw=localStorage.getItem(TKEY);if(raw)store=core.validateTemplates(JSON.parse(raw));}catch(e){status('Saved templates could not be read, so they were left alone.');}}
  function saveTemplates(){try{localStorage.setItem(TKEY,JSON.stringify(store));return true;}catch(e){status('This browser would not save templates (private windows and full storage do that). Export them to keep a copy.');return false;}}
  function renderTemplates(selected){
    const sel=$('tpl'),keep=selected!==undefined?selected:sel.value;
    sel.replaceChildren(store.templates.length?new Option('Choose a template',''):new Option('No templates yet',''),...store.templates.map(t=>new Option(`${t.name} (last ${t.lastNumber||'none'})`,t.id)));
    sel.value=store.templates.some(t=>t.id===keep)?keep:'';
    const has=!!sel.value;$('tpl-use').disabled=!has;$('tpl-delete').disabled=!has;$('tpl-update').disabled=!has;$('tpl-export').disabled=!store.templates.length;
  }
  const chosen=()=>store.templates.find(t=>t.id===$('tpl').value);
  $('tpl').addEventListener('change',()=>renderTemplates());
  $('tpl-save').addEventListener('click',()=>{
    if(store.templates.length>=core.MAX_TEMPLATES)return status(`Keep at most ${core.MAX_TEMPLATES} templates. Delete one first.`);
    let t;try{t=core.makeTemplate($('tpl-name').value,data,{includeClient:$('tpl-client').checked,includeItems:$('tpl-items').checked});}catch(e){return status(e.message);}
    const same=store.templates.find(x=>x.name.toLowerCase()===t.name.toLowerCase());
    if(same&&!confirm(`Replace the template "${same.name}"?`))return;
    if(same)t.id=same.id;
    store.templates=same?store.templates.map(x=>x.id===t.id?t:x):store.templates.concat(t);
    if(!saveTemplates())return;
    fromTemplate=t.id;$('tpl-name').value='';$('tpl-client').checked=false;$('tpl-items').checked=false;$('tpl-name').closest('details').open=false;
    renderTemplates(t.id);status(`Saved the template "${t.name}". Next time, choose it and start a new document: it will be numbered ${core.nextNumber(t.lastNumber)}.`);
  });
  $('tpl-update').addEventListener('click',()=>{
    const old=chosen();if(!old)return;
    if(!confirm(`Update "${old.name}" with this document's details?`))return;
    const t=core.makeTemplate(old.name,data,{includeClient:old.includesClient,includeItems:old.includesItems},old.id);
    store.templates=store.templates.map(x=>x.id===old.id?t:x);if(saveTemplates()){renderTemplates(t.id);status(`Updated "${t.name}".`);}
  });
  $('tpl-use').addEventListener('click',()=>{
    const t=chosen();if(!t)return;
    if(revision&&!confirm('Start a new document from this template? Unsaved edits to the current document will be lost.'))return;
    let next;try{next=core.applyTemplate(t);}catch(e){return status('That template could not be used: '+e.message);}
    replace(next,`New ${core.title(next).toLowerCase()} ${next.number} from "${t.name}". Check the customer and items, then download or email it.`);fromTemplate=t.id;
  });
  $('tpl-delete').addEventListener('click',()=>{const t=chosen();if(!t||!confirm(`Delete the template "${t.name}"?`))return;store.templates=store.templates.filter(x=>x.id!==t.id);if(fromTemplate===t.id)fromTemplate=null;if(saveTemplates()){renderTemplates('');status('Template deleted.');}});
  $('tpl-export').addEventListener('click',()=>{download('invoice-templates.json',new Blob([core.serializeTemplates(store)],{type:'application/json'}));status('Templates file saved. Import it in another browser to use them there.');});
  $('tpl-import').addEventListener('click',()=>$('tpl-load').click());
  $('tpl-load').addEventListener('change',async event=>{
    const file=event.target.files[0];event.target.value='';if(!file)return;
    try{const incoming=core.parseTemplates(await file.text());const ids=new Set(store.templates.map(t=>t.id));const added=incoming.templates.filter(t=>!ids.has(t.id));
      if(store.templates.length+added.length>core.MAX_TEMPLATES)throw new Error(`That would make more than ${core.MAX_TEMPLATES} templates.`);
      store.templates=store.templates.concat(added);if(saveTemplates()){renderTemplates();status(`Imported ${added.length} template${added.length===1?'':'s'}${incoming.templates.length>added.length?'; ones already here were kept':''}.`);}}
    catch(e){status('Templates were not imported: '+e.message);}
  });
  // Once a document from a template is downloaded, emailed or printed, its number becomes the
  // template's last number, so the next document from it is numbered one higher.
  function markUsed(){const t=store.templates.find(x=>x.id===fromTemplate);if(!t||!data.number.trim())return;t.lastNumber=data.number.trim().slice(0,60);if(saveTemplates())renderTemplates();}

  // ---------- PDF and email ----------
  function download(name,blob){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);}
  let libPromise=null;
  function pdfLib(){
    if(window.PDFLib)return Promise.resolve(window.PDFLib);
    if(!libPromise)libPromise=new Promise((resolve,reject)=>{const s=document.createElement('script');s.src='/assets/invoice-generator/pdf-lib.min.js';s.onload=()=>window.PDFLib?resolve(window.PDFLib):reject(new Error('missing'));s.onerror=()=>{libPromise=null;reject(new Error('offline'));};document.head.append(s);});
    return libPromise;
  }
  async function makePdf(){
    showErrors=true;const errors=render();if(errors.length){$('errors').focus();return null;}
    let lib;try{lib=await pdfLib();}catch(e){status('The PDF maker could not load (are you offline?). Use Print and choose Save as PDF instead.');return null;}
    const r=await window.InvoicePdf.build(lib,core,data);
    const note=r.replaced.length?` Some characters (${r.replaced.slice(0,6).join(' ')}) cannot go into this PDF and show as "?". Use Print and Save as PDF for those.`:'';
    return {file:new File([r.bytes],filename()+'.pdf',{type:'application/pdf'}),note,pages:r.pages};
  }
  $('pdf').addEventListener('click',async()=>{const p=await makePdf();if(!p)return;download(p.file.name,p.file);markUsed();status(`Downloaded ${p.file.name} (${p.pages} page${p.pages===1?'':'s'}).${p.note}`);});
  let mail=null,mailPdf=null;
  $('email').addEventListener('click',async()=>{
    const p=await makePdf();if(!p)return;mailPdf=p;
    mail=core.emailMessage(data,core.calculate(data));
    $('mail-to').value=mail.to||'(add the customer email above)';$('mail-subject').value=mail.subject;$('mail-body').value=mail.body;
    $('mail-share').hidden=!(navigator.canShare&&navigator.canShare({files:[p.file]}));
    $('mail-note').textContent=(mail.to?'':'Tip: add the customer email in the Customer section and it fills in for you. ')+p.note;
    $('mail').hidden=false;$('mail').scrollIntoView({block:'nearest'});$('mail-title').focus?.();status('Message ready. Choose how to send it.');
  });
  $('mail-close').addEventListener('click',()=>{$('mail').hidden=true;});
  $('mail-share').addEventListener('click',async()=>{
    try{await navigator.share({files:[mailPdf.file],title:mail.subject,text:mail.body});markUsed();status('Shared. Check the message in your mail app before you send it.');}
    catch(e){status(e&&e.name==='AbortError'?'Sharing cancelled.':'Sharing did not work here. Use "Download PDF and open email" instead.');}
  });
  function openWith(url,target){download(mailPdf.file.name,mailPdf.file);markUsed();const a=document.createElement('a');a.href=url;if(target){a.target='_blank';a.rel='noopener';}document.body.append(a);a.click();a.remove();status(`${mailPdf.file.name} is in your downloads. Attach it to the message before you send.`);}
  $('mail-app').addEventListener('click',()=>openWith(core.mailtoUrl(mail)));
  $('mail-gmail').addEventListener('click',()=>openWith(core.gmailUrl(mail),true));
  $('mail-outlook').addEventListener('click',()=>openWith(core.outlookUrl(mail),true));
  $('mail-copy').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(`Subject: ${mail.subject}\n\n${mail.body}`);status('Message copied.');}catch(e){status('Copying was blocked. Select the message text and copy it instead.');}});

  loadTemplates();renderTemplates();
  window.__invoice={state:()=>data,templates:()=>store};   // test hook
  populate();status('No account and nothing uploaded. Your draft stays in this tab; templates stay in this browser.');
})();
