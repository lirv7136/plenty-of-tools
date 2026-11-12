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
    syncQuoteButton();syncVisitButton();syncNdis();
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
      data.columns.forEach((label,k)=>{const wrap=node('label',label.trim()||`Column ${k+1}`),input=node('input');input.type='text';input.maxLength=core.EXTRA_MAX;input.dataset.extra=String(k);if(core.isDateHeading(label)&&(!item.extra[k]||core.validDate(item.extra[k])))input.type='date';input.setAttribute('aria-label',`Item ${index+1} ${(label.trim()||`column ${k+1}`).toLowerCase()}`);input.value=item.extra[k]||'';wrap.append(input);panel.append(wrap);});
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
    meta.append(node('h1',core.title(data)),node('p',data.number||'Document number'),node('p','Date: '+date(data.issueDate)),node('p',(data.kind==='quote'?'Valid until: ':'Due: ')+date(data.dueDate)));
    head.append(seller,meta);paper.append(head);
    const parties=node('div',undefined,'inv-parties'),buyer=node('div'),amount=node('div');buyer.append(node('h3',data.kind==='quote'?'Prepared for':'Bill to'),node('p',data.clientName||'Customer name'));
    if(data.clientAbn.trim())block(buyer,'p','ABN '+data.clientAbn.trim());
    block(buyer,'p',data.clientAddress);block(buyer,'p',data.clientEmail);
    amount.append(node('h3',data.kind==='quote'?'Quote total (AUD)':'Amount due (AUD)'),node('h2',totals?money(data.kind==='quote'?totals.total:totals.due):'—'));
    if(data.kind==='quote')amount.append(node('p','This quote is not a tax invoice.','inv-doc-subtle'));
    parties.append(buyer,amount);paper.append(parties);
    const ndis=core.ndisLines(data);if(ndis.length){const box=node('section',undefined,'inv-doc-ndis');box.append(node('h3','NDIS'),node('p',ndis.join('\n')));paper.append(box);}
    const tax=data.gstMode!=='none';
    const table=node('table',undefined,tax?'':'inv-table-no-gst'),thead=node('thead'),tr=node('tr');
    const cols=data.columns,heads=['Description',...cols.map((c,k)=>c.trim()||`Column ${k+1}`),'Qty',data.gstMode==='inclusive'?'Unit (incl.)':tax?'Unit (excl.)':'Unit price',...(tax?['GST']:[]),'Amount'];
    const widths=cols.length?[null,...cols.map(c=>core.isItemHeading(c)?18:12),8,14,...(tax?[11]:[]),14]:[];if(widths.length)widths[0]=100-widths.slice(1).reduce((a,b)=>a+b,0);
    heads.forEach((text,k)=>{const th=node('th',text);th.scope='col';if(widths.length)th.style.width=widths[k]+'%';if(k>0&&k<=cols.length)th.style.textAlign='left';tr.append(th);});thead.append(tr);table.append(thead);
    const tbody=node('tbody');
    data.items.forEach((item,i)=>{
      const row=node('tr'),computed=totals?.items[i];
      const values=[item.description||'Item description',...data.columns.map((c,k)=>core.cellText(c,item.extra[k])),item.quantity||'—',computed?money(computed.price):'—',...(tax?[computed?(computed.taxable?money(computed.gst):'No GST'):'—']:[]),computed?money(computed.total):'—'];
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
    const bank=data.kind==='invoice'?core.bankLines(data):[];
    for(const [key,title] of [['bank','How to pay'],['payment',bank.length?'Payment terms':'Payment details / terms'],['notes','Notes']]){const body=key==='bank'?bank.join('\n'):data[key];if(!body.trim())continue;const section=node('section',undefined,'inv-doc-notes');section.append(node('h3',title),node('p',body));paper.append(section);}
    paper.append(node('p',tax?'All amounts in AUD. GST applies only to taxable lines and is rounded per line. Line amounts include any GST.':'All amounts in AUD. No GST charged — supplier not registered for GST.','inv-doc-footer'));
    relevelPreview(paper);
    settings();return errors;
  }
  function populate(){for(const key of Object.keys(core.fields))if($(key))$(key).value=data[key];renderColumns();itemInputs();render();}
  function replace(next,message){revision++;data=next;fromTemplate=null;isExample=false;$('offer').hidden=true;showErrors=false;displayErrors([]);populate();status(message);}
  function update(event){
    const input=event.target;
    if(input.dataset.field){const index=Number(input.closest('.inv-line').dataset.index);data.items[index][input.dataset.field]=input.value;}
    else if(input.dataset.extra){const index=Number(input.closest('.inv-line').dataset.index);data.items[index].extra[Number(input.dataset.extra)]=input.value;}
    else if(input.id==='inv-ndis'){data.ndis=input.value;if(data.ndis)setUpNdis();}
    else if(input.dataset.col){const k=Number(input.dataset.col),was=core.isDateHeading(data.columns[k]);data.columns[k]=input.value;if(was!==core.isDateHeading(input.value)){itemInputs();syncDateButton();}else relabelExtras();}
    else if(input.closest('.inv-templates'))return;
    else if(input.id.startsWith('inv-')&&Object.hasOwn(core.fields,input.id.slice(4)))data[input.id.slice(4)]=input.value;
    else return;
    if(input.id==='inv-clientName'||input.id==='inv-ndisName')$('offer').hidden=true;
    revision++;render();status('Unsaved edits. Save a draft file to keep your work.');
  }
  $('form').addEventListener('submit',event=>event.preventDefault());
  $('form').addEventListener('input',update);$('form').addEventListener('change',update);
  $('items').addEventListener('click',event=>{const button=event.target.closest('[data-remove]');if(!button||data.items.length===1)return;data.items.splice(Number(button.dataset.remove),1);revision++;itemInputs();render();status('Item removed.');});
  $('add').addEventListener('click',()=>{if(data.items.length>=100)return;data.items.push({description:'',quantity:'1',price:'0.00',tax:'gst',extra:data.columns.map(()=>'')});revision++;itemInputs();render();$('items').lastElementChild.querySelector('textarea').focus();});
  const blank=()=>{const d=core.defaults();d.number=core.nextFrom(store.lastInvoice,known());return d;};
  $('clear').addEventListener('click',()=>replace(blank(),'New document. Nothing has been saved automatically.'));
  $('example').addEventListener('click',()=>{
    const example=core.defaults();Object.assign(example,{number:'EXAMPLE-001',sellerName:'Example Studio (sample)',sellerAddress:'Sydney NSW\nAustralia',sellerEmail:'studio@example.com',clientName:'Example Customer',clientAddress:'Melbourne VIC\nAustralia',paid:'200.00',payment:'Example only — replace with your own payment details.\nUse the invoice number as your payment reference.',notes:'Fictional example. Replace all details before use.',items:[{description:'Website design services',quantity:'8',price:'125.00',tax:'gst',extra:[]},{description:'Project setup',quantity:'1',price:'150.00',tax:'gst',extra:[]}]});
    replace(example,'Fictional example loaded. The example uses no GST.');isExample=true;
  });
  const filename=()=>((data.number||'invoice').replace(/[^a-zA-Z0-9_-]+/g,'-').slice(0,80)||'invoice');
  $('save').addEventListener('click',()=>{const blob=new Blob([core.serialize(data)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=filename()+'.json';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);status('Draft download started. Keep this file to reopen and edit later.');});
  $('open').addEventListener('click',()=>$('load').click());
  $('load').addEventListener('change',async event=>{
    const file=event.target.files[0];event.target.value='';if(!file)return;const token=revision;
    try{if(file.size>1000000)throw new Error('Draft files must be smaller than 1 MB.');const next=core.parseDraft(await file.text());if(token!==revision){status('Draft was not opened because the current document changed. Open it again to replace this document.');return;}replace(next,'Draft opened locally. Review the details before printing.');}
    catch(error){displayErrors([error.message]);status('The current document has been kept.');}
  });
  $('print').addEventListener('click',()=>{showErrors=true;const errors=render();if(errors.length){$('errors').focus();return;}document.title=filename()+' — '+core.title(data);markUsed('print');window.print();});
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
    syncDateButton();
  }
  function syncDateButton(){$('date-col').hidden=data.columns.length>=core.MAX_COLUMNS||data.columns.some(core.isDateHeading);}
  $('date-col').addEventListener('click',()=>{if(data.columns.length>=core.MAX_COLUMNS)return;data.columns.unshift('Date');data.items.forEach(i=>i.extra.unshift(''));revision++;renderColumns();itemInputs();render();$('items').querySelector('[data-extra="0"]').focus();status('Date column added. Pick the date for each line.');});
  function relabelExtras(){for(const input of $('items').querySelectorAll('[data-extra]')){const k=Number(input.dataset.extra),label=data.columns[k].trim()||`Column ${k+1}`;input.parentElement.firstChild.textContent=label;input.setAttribute('aria-label',`Item ${Number(input.closest('.inv-line').dataset.index)+1} ${label.toLowerCase()}`);}}
  $('col-add').addEventListener('click',()=>{if(data.columns.length>=core.MAX_COLUMNS)return;data.columns.push('');data.items.forEach(i=>i.extra.push(''));revision++;renderColumns();itemInputs();render();$('columns').lastElementChild.querySelector('input').focus();status('Column added. Give it a heading.');});
  $('columns').addEventListener('click',event=>{const b=event.target.closest('[data-col-remove]');if(!b)return;const k=Number(b.dataset.colRemove);data.columns.splice(k,1);data.items.forEach(i=>i.extra.splice(k,1));revision++;renderColumns();itemInputs();render();status('Column removed.');});

  // ---------- templates (this browser only) ----------
  const TKEY='pot:invoice-generator:templates:v1';
  let store={v:1,used:[],lastInvoice:'',templates:[]},fromTemplate=null,isExample=false;
  // Every number this device knows was used: the high water list and each template's last number.
  const known=()=>[...store.used,...store.templates.map(t=>t.lastNumber)];
  function loadTemplates(){try{const raw=localStorage.getItem(TKEY);store=raw?core.validateTemplates(JSON.parse(raw)):{v:1,used:[],lastInvoice:'',templates:[]};}catch(e){status('Saved templates could not be read, so they were left alone.');}}
  function saveTemplates(){try{localStorage.setItem(TKEY,JSON.stringify(store));return true;}catch(e){status('This browser would not save templates (private windows and full storage do that). Export them to keep a copy.');return false;}}
  function renderTemplates(selected){
    const sel=$('tpl'),keep=selected!==undefined?selected:sel.value;
    sel.replaceChildren(store.templates.length?new Option('Choose a template',''):new Option('No templates yet',''),...store.templates.map(t=>new Option(`${t.name} (last ${t.lastNumber||'none'})`,t.id)));
    sel.value=store.templates.some(t=>t.id===keep)?keep:'';
    renderQuick();
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
    renderTemplates(t.id);status(`Saved the template "${t.name}". Next time it waits at the top of this page: the next one will be numbered ${core.nextFrom(t.lastNumber,known())}.`);
  });
  $('tpl-update').addEventListener('click',()=>{
    const old=chosen();if(!old)return;
    if(!confirm(`Update "${old.name}" with this document's details?`))return;
    const t=core.makeTemplate(old.name,data,{includeClient:old.includesClient,includeItems:old.includesItems},old.id);
    store.templates=store.templates.map(x=>x.id===old.id?t:x);if(saveTemplates()){renderTemplates(t.id);status(`Updated "${t.name}".`);}
  });
  function useTemplate(t){
    if(!t)return false;
    if(revision&&!confirm('Start a new document from this template? Unsaved edits to the current document will be lost.'))return false;
    let next;try{next=core.applyTemplate(lastLines(t),undefined,known());}catch(e){status('That template could not be used: '+e.message);return false;}
    replace(next,`New ${core.title(next).toLowerCase()} ${next.number} from "${t.name}", dated today. Check the customer and items, then download or email it.`);fromTemplate=t.id;
    return true;
  }
  $('tpl-use').addEventListener('click',()=>useTemplate(chosen()));
  $('tpl-delete').addEventListener('click',()=>{const t=chosen();if(!t||!confirm(`Delete the template "${t.name}"?`))return;store.templates=store.templates.filter(x=>x.id!==t.id);if(fromTemplate===t.id)fromTemplate=null;if(saveTemplates()){renderTemplates('');status('Template deleted.');}});
  $('tpl-export').addEventListener('click',()=>{download('invoice-templates.json',new Blob([core.serializeTemplates(store)],{type:'application/json'}));status('Templates file saved. Import it in another browser to use them there.');});
  $('tpl-import').addEventListener('click',()=>$('tpl-load').click());
  $('tpl-load').addEventListener('change',async event=>{
    const file=event.target.files[0];event.target.value='';if(!file)return;
    try{const incoming=core.parseTemplates(await file.text());const ids=new Set(store.templates.map(t=>t.id));const added=incoming.templates.filter(t=>!ids.has(t.id));
      if(store.templates.length+added.length>core.MAX_TEMPLATES)throw new Error(`That would make more than ${core.MAX_TEMPLATES} templates.`);
      store.templates=store.templates.concat(added);for(const n of incoming.used.slice().reverse())store.used=core.recordUsed(store.used,n);if(saveTemplates()){renderTemplates();status(`Imported ${added.length} template${added.length===1?'':'s'}${incoming.templates.length>added.length?'; ones already here were kept':''}.`);}}
    catch(e){status('Templates were not imported: '+e.message);}
  });
  // Once a document from a template is downloaded, emailed or printed, its number becomes the
  // template's last number, so the next document from it is numbered one higher.
  // The device's last number is kept only once something has been saved in this browser, so a
  // person who never saves leaves nothing behind.
  // An anonymous count of documents made, only where the site asks for one (Plain Invoice sets
  // INV_COUNT_URL; Plenty of Tools does not). One word is sent: no id, no content, no cookie.
  function count(event){try{if(window.INV_COUNT_URL&&navigator.sendBeacon)navigator.sendBeacon(window.INV_COUNT_URL,event);}catch(e){}}
  function markUsed(how){
    if(how)count(how);
    if(isExample)return;   // the fictional example never counts as a number used, and is never offered for saving
    const n=data.number.trim().slice(0,60),t=store.templates.find(x=>x.id===fromTemplate);
    if(n&&store.templates.length){recordNumber(n);if(t&&(t.data.kind||'invoice')===data.kind)t.lastNumber=n;if(saveTemplates())renderTemplates();recordHistory();}
    offerSave();
  }
  function recordNumber(n){store.used=core.recordUsed(store.used,n);if(data.kind==='invoice')store.lastInvoice=n;}
  // Another tab saved: take its templates and numbers, so two tabs never hand out the same number.
  window.addEventListener('storage',event=>{if(event.key===TKEY){loadTemplates();renderTemplates();}if(event.key===HKEY){loadHistory();renderHistory();}});

  // ---------- after the first download or email: offer to keep the details ----------
  const declined=new Set();
  const saved=name=>store.templates.some(x=>x.includesClient&&core.whoFor(x.data).toLowerCase()===name.toLowerCase());
  function offerSave(){
    const who=core.whoFor(data);
    if(!who||saved(who)||declined.has(who.toLowerCase())){$('offer').hidden=true;return;}
    $('offer-who').textContent=who.slice(0,60);const first=$('offer').hidden;$('offer').hidden=false;if(first&&$('mail').hidden)$('offer').scrollIntoView({block:'nearest'});
  }
  $('offer-no').addEventListener('click',()=>{declined.add(core.whoFor(data).toLowerCase());$('offer').hidden=true;status('Not saved. You can save it later at the bottom of the form.');});
  $('offer-save').addEventListener('click',()=>{
    const who=core.whoFor(data).slice(0,60);if(!who)return;
    const same=store.templates.find(x=>x.name.toLowerCase()===who.toLowerCase());
    if(same&&!same.includesClient&&!confirm(`Replace your template "${same.name}" with these details?`))return;
    if(!same&&store.templates.length>=core.MAX_TEMPLATES)return status(`Keep at most ${core.MAX_TEMPLATES} templates. Delete one at the bottom of the form first.`);
    let t;try{t=core.makeTemplate(who,data,{includeClient:true,includeItems:true},same&&same.id);}catch(e){return status(e.message);}
    store.templates=same?store.templates.map(x=>x.id===t.id?t:x):store.templates.concat(t);
    const before={used:store.used,lastInvoice:store.lastInvoice};if(data.number.trim())recordNumber(data.number.trim().slice(0,60));
    if(!saveTemplates()){Object.assign(store,before);return;}
    fromTemplate=t.id;$('offer').hidden=true;renderTemplates(t.id);recordHistory();
    status(`Saved. Next time, open this page and tap "${core.quickLabel(t)}": it fills in everything with that day's date and number ${core.nextFrom(t.lastNumber,known())}.`);
  });

  // ---------- start where you left off: one button per saved template, at the top ----------
  function renderQuick(){
    const list=$('quick-list');list.replaceChildren();
    const recent=store.templates.slice().sort((a,b)=>String(b.savedAt).localeCompare(String(a.savedAt)));
    for(const t of recent.slice(0,6)){
      const b=node('button',undefined,'btn primary inv-quick-btn');b.type='button';b.dataset.quick=t.id;
      b.append(node('span',core.quickLabel(t)),node('small',`Next number ${core.nextFrom(t.lastNumber,known())}`));list.append(b);
    }
    if(recent.length>6){const a=node('a',`All ${recent.length} saved`,'inv-quick-more');a.href='#inv-tpl';list.append(a);}
    $('quick').hidden=!recent.length;
  }
  $('quick-list').addEventListener('click',event=>{
    const b=event.target.closest('[data-quick]');if(!b)return;
    if(useTemplate(store.templates.find(t=>t.id===b.dataset.quick)))$('toolbar').scrollIntoView({block:'start'});
  });

  // ---------- PDF and email ----------
  function download(name,blob){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);}
  let libPromise=null;
  function pdfLib(){
    if(window.PDFLib)return Promise.resolve(window.PDFLib);
    if(!libPromise)libPromise=new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=window.INV_PDFLIB||'/assets/invoice-generator/pdf-lib.min.js';s.onload=()=>window.PDFLib?resolve(window.PDFLib):reject(new Error('missing'));s.onerror=()=>{libPromise=null;reject(new Error('offline'));};document.head.append(s);});
    return libPromise;
  }
  async function makePdf(){
    showErrors=true;const errors=render();if(errors.length){$('errors').focus();return null;}
    let lib;try{lib=await pdfLib();}catch(e){status('The PDF maker could not load (are you offline?). Use Print and choose Save as PDF instead.');return null;}
    const r=await window.InvoicePdf.build(lib,core,data);
    const note=r.replaced.length?` Some characters (${r.replaced.slice(0,6).join(' ')}) cannot go into this PDF and show as "?". Use Print and Save as PDF for those.`:'';
    return {file:new File([r.bytes],filename()+'.pdf',{type:'application/pdf'}),note,pages:r.pages};
  }
  $('pdf').addEventListener('click',async()=>{const p=await makePdf();if(!p)return;download(p.file.name,p.file);markUsed('pdf');status(`Downloaded ${p.file.name} (${p.pages} page${p.pages===1?'':'s'}).${p.note}`);});
  let mail=null,mailPdf=null;
  $('email').addEventListener('click',async()=>{
    const p=await makePdf();if(!p)return;mailPdf=p;
    mail=core.emailMessage(data,core.calculate(data));
    $('mail-to').value=mail.to;$('mail-to').placeholder='customer@example.com';$('mail-subject').value=mail.subject;$('mail-body').value=mail.body;
    $('mail-share').hidden=!(navigator.canShare&&navigator.canShare({files:[p.file]}));$('mail-gmailsend').hidden=!gmailId();$('mail-gmailsend').disabled=false;$('mail-gmailsend').textContent='Send with Gmail';
    $('mail-note').textContent=(mail.to?'':'Tip: add the customer email in the Customer section and it fills in for you. ')+p.note;
    $('mail').hidden=false;$('mail').scrollIntoView({block:'nearest'});$('mail-title').focus?.();status('Message ready. Choose how to send it.');
  });
  $('mail-close').addEventListener('click',()=>{$('mail').hidden=true;});
  // The message fields are editable; every way of sending uses what is in them now.
  for(const [id,key] of [['mail-to','to'],['mail-subject','subject'],['mail-body','body']])$(id).addEventListener('input',()=>{if(mail)mail[key]=$(id).value;});

  // ---------- Send with Gmail ----------
  // Google's sign in library asks for the gmail.send scope only (send as you; it cannot read
  // mail). The token lives in this tab's memory. The message goes from this browser straight to
  // the Gmail API; nothing passes through this site.
  // Until Google verifies the app, only listed test users can sign in, so the button shows only
  // when the site says it is public, or on a device that opened the page with ?gmail=1 once.
  const gmailBeta=(()=>{try{if(/[?&]gmail=1\b/.test(location.search))localStorage.setItem('pot:invoice-generator:gmail-beta','1');if(/[?&]gmail=0\b/.test(location.search))localStorage.removeItem('pot:invoice-generator:gmail-beta');return localStorage.getItem('pot:invoice-generator:gmail-beta')==='1';}catch(e){return /[?&]gmail=1\b/.test(location.search);}})();
  const gmailId=()=>window.POT&&window.POT.gmailClientId&&(window.POT.gmailPublic||gmailBeta)?window.POT.gmailClientId:'';
  let gmailToken=null,gmailClient=null;
  function loadGis(){return new Promise((res,rej)=>{if(window.google&&google.accounts&&google.accounts.oauth2)return res();const s=document.createElement('script');s.src='https://accounts.google.com/gsi/client';s.async=true;s.onload=res;s.onerror=()=>rej(new Error("Google's sign in could not load. Check your connection or ad blocker."));document.head.append(s);});}
  function gmailAuth(){return new Promise((resolve,reject)=>{
    gmailClient=gmailClient||google.accounts.oauth2.initTokenClient({client_id:gmailId(),scope:'https://www.googleapis.com/auth/gmail.send',callback:()=>{}});
    gmailClient.callback=r=>r&&r.access_token?resolve(r.access_token):reject(new Error(r&&r.error?'Google sign in was cancelled or refused.':'No permission was given.'));
    gmailClient.error_callback=e=>reject(new Error(e&&e.type==='popup_closed'?'Google sign in was closed before finishing.':'Google sign in did not complete.'));
    gmailClient.requestAccessToken({prompt:''});
  });}
  async function gmailPost(raw){return fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send',{method:'POST',headers:{Authorization:'Bearer '+gmailToken,'Content-Type':'application/json'},body:JSON.stringify({raw})});}
  $('mail-gmailsend').addEventListener('click',async()=>{
    const button=$('mail-gmailsend');
    if(!core.emailOk(mail.to)){status('Enter the customer email address in the To box first.');$('mail-to').focus();return;}
    let raw;try{raw=core.buildMime(mail,new Uint8Array(await mailPdf.file.arrayBuffer()),mailPdf.file.name);}catch(e){status(e.message);return;}
    button.disabled=true;status('Connecting to your Gmail…');
    try{
      await loadGis();
      if(!gmailToken)gmailToken=await gmailAuth();
      status(`Sending to ${mail.to}…`);
      let r=await gmailPost(raw);
      if(r.status===401){gmailToken=await gmailAuth();r=await gmailPost(raw);}
      if(!r.ok){let why='';try{why=((await r.json()).error||{}).message||'';}catch(e){}throw new Error(`Gmail did not accept the message${why?': '+why:''}.`);}
      markUsed('email');status(`Sent from your Gmail to ${mail.to}, with ${mailPdf.file.name} attached. A copy is in your Sent folder.`);
      button.textContent='Sent';
    }catch(e){status(e.message+' Nothing was sent. You can still use the other options.');button.disabled=false;}
  });
  $('mail-share').addEventListener('click',async()=>{
    try{await navigator.share({files:[mailPdf.file],title:mail.subject,text:mail.body});markUsed('email');status('Shared. Check the message in your mail app before you send it.');}
    catch(e){status(e&&e.name==='AbortError'?'Sharing cancelled.':'Sharing did not work here. Use "Download PDF and open email" instead.');}
  });
  function openWith(url,target){download(mailPdf.file.name,mailPdf.file);markUsed('email');const a=document.createElement('a');a.href=url;if(target){a.target='_blank';a.rel='noopener';}document.body.append(a);a.click();a.remove();status(`${mailPdf.file.name} is in your downloads. Attach it to the message before you send.`);}
  $('mail-app').addEventListener('click',()=>openWith(core.mailtoUrl(mail)));
  $('mail-gmail').addEventListener('click',()=>openWith(core.gmailUrl(mail),true));
  $('mail-outlook').addEventListener('click',()=>openWith(core.outlookUrl(mail),true));
  $('mail-copy').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(`Subject: ${mail.subject}\n\n${mail.body}`);status('Message copied.');}catch(e){status('Copying was blocked. Select the message text and copy it instead.');}});

  // ---------- added 11 Nov 2026: history, same again, quote to invoice, another visit ----------
  // Every element below may be missing (the older Plenty of Tools page has none of them), so each
  // is looked up once and every use is guarded.
  const has=id=>!!$(id);

  // Your invoices: kept in this browser only, and only once the person has saved something here,
  // the same rule as the running number. Each entry is the whole document, so it can be opened
  // again exactly, or used for "same again".
  const HKEY='pot:invoice-generator:history:v1',HMAX=200;
  let history=[];
  function loadHistory(){try{const raw=localStorage.getItem(HKEY);history=raw?JSON.parse(raw).filter(h=>h&&h.doc&&typeof h.id==='string'):[];}catch(e){history=[];}}
  function saveHistory(){try{localStorage.setItem(HKEY,JSON.stringify(history));return true;}catch(e){status('This browser would not keep the invoice list (private windows and full storage do that).');return false;}}
  function recordHistory(){
    const n=data.number.trim();if(!has('history')||!n||!store.templates.length||isExample)return;
    let doc;try{doc=core.cleanData(JSON.parse(JSON.stringify(data)));core.calculate(doc);}catch(e){return;}
    // One entry per document number and customer. Sending the same invoice again updates it in
    // place and keeps its paid state; the same number for someone else is a separate entry, and
    // the person is told, because two invoices should never share a number.
    const who=core.whoFor(doc).toLowerCase(),id=[doc.kind,n.toLowerCase(),who].join(':');
    const old=history.find(h=>h.id===id);
    const clash=history.find(h=>h.id!==id&&h.doc.kind===doc.kind&&h.doc.number.trim().toLowerCase()===n.toLowerCase());
    const entry={id,savedAt:old?old.savedAt:new Date().toISOString(),paidAt:old?old.paidAt:'',doc};
    history=old?history.map(h=>h.id===id?entry:h):[entry,...history].slice(0,HMAX);
    if(saveHistory())renderHistory();
    // After the caller's own message ("Downloaded …"), so the warning is not overwritten.
    if(clash)setTimeout(()=>status(`${$('status').textContent} Note: ${n} was already used for ${core.whoFor(clash.doc)||'another customer'}. Give each invoice its own number.`),0);
  }
  const sameClient=(a,b)=>a.trim().toLowerCase()===b.trim().toLowerCase();
  // For "New invoice for Sue": the template, with the lines of Sue's newest invoice in place of
  // the lines saved with it. Dates in a Date column are cleared: they belong to last time.
  function lastLines(t){
    const who=has('history')&&t.includesClient&&core.whoFor(t.data);if(!who)return t;
    // The newest invoice by its date, not the one most recently downloaded again.
    const last=history.filter(h=>h.doc.kind===(t.data.kind||'invoice')&&sameClient(core.whoFor(h.doc),who))
      .sort((a,b)=>b.doc.issueDate.localeCompare(a.doc.issueDate)||b.savedAt.localeCompare(a.savedAt))[0];if(!last)return t;
    const cols=last.doc.columns.slice(),dated=cols.map(core.isDateHeading);
    const items=last.doc.items.map(i=>({...i,extra:i.extra.map((v,k)=>dated[k]?'':v)}));
    return {...t,includesItems:true,data:{...t.data,columns:cols,items}};
  }
  function renderHistory(){
    if(!has('history'))return;
    const list=$('history-list');list.replaceChildren();
    const today=core.today();
    for(const h of history.slice(0,50)){
      let total='—';try{const c=core.calculate(h.doc);total=money(h.doc.kind==='quote'?c.total:c.due);}catch(e){}
      const row=node('li',undefined,'inv-hrow');
      const what=node('div',undefined,'inv-hwhat');what.append(node('strong',`${h.doc.number} · ${core.whoFor(h.doc)||'No customer'}`),node('span',`${total} · ${h.doc.kind==='quote'?'quote, valid until':'due'} ${date(h.doc.dueDate)}`));
      const state=h.doc.kind==='quote'?'Quote':h.paidAt?'Paid':h.doc.dueDate<today?'Overdue':'Unpaid';
      const tag=node('span',state,'inv-htag inv-htag-'+state.toLowerCase());
      const acts=node('div',undefined,'inv-hacts');
      if(h.doc.kind==='invoice'){const b=node('button',h.paidAt?'Mark unpaid':'Mark paid','btn small');b.type='button';b.dataset.hpaid=h.id;b.setAttribute('aria-label',`${h.paidAt?'Mark unpaid':'Mark paid'}: ${h.doc.number}`);acts.append(b);}
      const o=node('button','Open','btn small');o.type='button';o.dataset.hopen=h.id;o.setAttribute('aria-label',`Open ${h.doc.number}`);acts.append(o);
      row.append(what,tag,acts);list.append(row);
    }
    const unpaid=history.filter(h=>h.doc.kind==='invoice'&&!h.paidAt);
    let owed=0;for(const h of unpaid){try{owed+=core.calculate(h.doc).due;}catch(e){}}
    $('history-sum').textContent=history.length?(unpaid.length?`${unpaid.length} unpaid, ${money(owed)} owed to you.`:'Everything is paid.'):'';
    $('history').hidden=!history.length;
  }
  if(has('history')){
    $('history-list').addEventListener('click',event=>{
      const p=event.target.closest('[data-hpaid]'),o=event.target.closest('[data-hopen]');
      if(p){const h=history.find(x=>x.id===p.dataset.hpaid);if(!h)return;h.paidAt=h.paidAt?'':new Date().toISOString();if(saveHistory()){renderHistory();status(`${h.doc.number} marked ${h.paidAt?'paid':'unpaid'}.`);}}
      if(o){const h=history.find(x=>x.id===o.dataset.hopen);if(!h)return;if(revision&&!confirm('Open this invoice? Unsaved edits to the current document will be lost.'))return;
        let doc;try{doc=core.cleanData(JSON.parse(JSON.stringify(h.doc)));}catch(e){return status('That invoice could not be opened.');}
        replace(doc,`Opened ${doc.number} as it was sent. Download it again, or change it and send a correction.`);
        const t=store.templates.find(x=>x.includesClient&&sameClient(core.whoFor(x.data),core.whoFor(doc)));fromTemplate=t?t.id:null;$('toolbar').scrollIntoView({block:'start'});}
    });
  }

  // A quote the customer accepted becomes the invoice: same customer and lines, today's date,
  // the next invoice number and the usual payment terms.
  if(has('to-invoice')){
    $('to-invoice').addEventListener('click',()=>{
      if(data.kind!=='quote')return;
      const t=store.templates.find(x=>x.id===fromTemplate&&(x.data.kind||'invoice')==='invoice');
      const next={...JSON.parse(JSON.stringify(data)),kind:'invoice',number:core.nextFrom(store.lastInvoice,known()),issueDate:core.today(),paid:'0.00'};
      next.dueDate=core.addDays(next.issueDate,t?t.termsDays:14);
      const quote=data.number.trim();replace(next,`Invoice ${next.number} made from quote ${quote}. Check it, then download or email.`);if(t)fromTemplate=t.id;
    });
  }
  function syncQuoteButton(){if(has('to-invoice'))$('to-invoice').hidden=data.kind!=='quote';}

  // People paid by the visit: copy the last line, with the date left for the new visit.
  if(has('visit')){
    $('visit').addEventListener('click',()=>{
      if(data.items.length>=100)return;
      const last=data.items[data.items.length-1],dated=data.columns.map(core.isDateHeading);
      data.items.push({...last,extra:last.extra.map((v,k)=>dated[k]?'':v)});revision++;itemInputs();render();
      const k=dated.indexOf(true),line=$('items').lastElementChild;(k>=0?line.querySelector(`[data-extra="${k}"]`):line.querySelector('textarea')).focus();
      status('Another visit added. Pick its date.');
    });
  }
  function syncVisitButton(){if(has('visit'))$('visit').hidden=!data.columns.some(core.isDateHeading)||data.items.length>=100;}

  // NDIS: the participant, a Date and a Support item column on every line, and GST free lines by
  // default (an NDIS support is GST free only when all four ATO conditions hold, so the hint says so).
  function setUpNdis(){
    const cols=data.columns,hasDate=cols.some(core.isDateHeading),hasItem=cols.some(core.isItemHeading);
    const want=[...(hasDate?[]:['Date']),...(hasItem?[]:['Support item'])];
    for(const label of want){
      if(cols.length>=core.MAX_COLUMNS){const k=cols.findIndex(c=>!core.isDateHeading(c)&&!core.isItemHeading(c));if(k<0)break;cols.splice(k,1);data.items.forEach(i=>i.extra.splice(k,1));}
      cols.push(label);data.items.forEach(i=>i.extra.push(''));
    }
    if(data.gstMode!=='none')data.items.forEach(i=>{i.tax='none';});
    renderColumns();itemInputs();
    status('NDIS invoice: add the participant, then the date and support item number on each line.'+(data.gstMode!=='none'?' Lines are set to No GST: NDIS supports are GST free only when all four ATO conditions are met.':''));
  }
  function syncNdis(){
    if(!has('ndis'))return;
    $('ndis').value=data.ndis;$('ndis-fields').hidden=!data.ndis;
    const w=core.ndisWarnings(data);$('ndis-note').textContent=w.join(' ');$('ndis-note').hidden=!w.length;
  }

  // Forget everything this browser keeps for the invoice tool.
  if(has('forget')){
    $('forget').addEventListener('click',()=>{
      if(!confirm('Delete every saved customer, template and invoice in this browser? This cannot be undone.'))return;
      try{localStorage.removeItem(TKEY);localStorage.removeItem(HKEY);}catch(e){}
      store={v:1,used:[],lastInvoice:'',templates:[]};history=[];fromTemplate=null;renderTemplates('');renderHistory();status('Everything saved in this browser for invoices has been deleted.');
    });
  }

  // Search pages link here with ?start=… to open the tool ready for that kind of work.
  function startFrom(kind){
    const d=blank();
    if(kind==='visits'){d.columns=['Date'];d.items=d.items.map(i=>({...i,extra:['']}));}
    if(kind==='nogst')d.gstMode='none';
    if(kind==='tax')d.gstMode='exclusive';
    if(kind==='ndis'){d.ndis='plan';d.columns=['Date','Support item'];d.items=d.items.map(i=>({...i,extra:['','']}));}
    return d;
  }

  loadTemplates();loadHistory();renderTemplates();renderHistory();
  window.__invoice={state:()=>data,templates:()=>store,history:()=>history};   // test hook
  const start=/[?&]start=(visits|nogst|tax|ndis)\b/.exec(location.search);
  data=start?startFrom(start[1]):blank();populate();status('No account and nothing uploaded. Your draft stays in this tab; templates stay in this browser.');
})();
