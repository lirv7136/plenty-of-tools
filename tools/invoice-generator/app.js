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
    ['Description','Qty',data.gstMode==='inclusive'?'Unit (incl.)':tax?'Unit (excl.)':'Unit price',...(tax?['GST']:[]),'Amount'].forEach(text=>{const th=node('th',text);th.scope='col';tr.append(th);});thead.append(tr);table.append(thead);
    const tbody=node('tbody');
    data.items.forEach((item,i)=>{
      const row=node('tr'),computed=totals?.items[i];
      const values=[item.description||'Item description',item.quantity||'—',computed?money(computed.price):'—',...(tax?[computed?(computed.taxable?money(computed.gst):'No GST'):'—']:[]),computed?money(computed.total):'—'];
      values.forEach(value=>row.append(node('td',value)));tbody.append(row);
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
  function populate(){for(const key of Object.keys(core.fields))$(key).value=data[key];itemInputs();render();}
  function replace(next,message){revision++;data=next;showErrors=false;displayErrors([]);populate();status(message);}
  function update(event){
    const input=event.target;
    if(input.dataset.field){const index=Number(input.closest('.inv-line').dataset.index);data.items[index][input.dataset.field]=input.value;}
    else if(input.id.startsWith('inv-')&&Object.hasOwn(core.fields,input.id.slice(4)))data[input.id.slice(4)]=input.value;
    else return;
    revision++;render();status('Unsaved edits. Save a draft file to keep your work.');
  }
  $('form').addEventListener('submit',event=>event.preventDefault());
  $('form').addEventListener('input',update);$('form').addEventListener('change',update);
  $('items').addEventListener('click',event=>{const button=event.target.closest('[data-remove]');if(!button||data.items.length===1)return;data.items.splice(Number(button.dataset.remove),1);revision++;itemInputs();render();status('Item removed.');});
  $('add').addEventListener('click',()=>{if(data.items.length>=100)return;data.items.push({description:'',quantity:'1',price:'0.00',tax:'gst'});revision++;itemInputs();render();$('items').lastElementChild.querySelector('textarea').focus();});
  $('clear').addEventListener('click',()=>replace(core.defaults(),'New document. Nothing has been saved automatically.'));
  $('example').addEventListener('click',()=>{
    const example=core.defaults();Object.assign(example,{number:'EXAMPLE-001',sellerName:'Example Studio (sample)',sellerAddress:'Sydney NSW\nAustralia',sellerEmail:'studio@example.com',clientName:'Example Customer',clientAddress:'Melbourne VIC\nAustralia',paid:'200.00',payment:'Example only — replace with your own payment details.\nUse the invoice number as your payment reference.',notes:'Fictional example. Replace all details before use.',items:[{description:'Website design services',quantity:'8',price:'125.00',tax:'gst'},{description:'Project setup',quantity:'1',price:'150.00',tax:'gst'}]});
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
  $('print').addEventListener('click',()=>{showErrors=true;const errors=render();if(errors.length){$('errors').focus();return;}document.title=filename()+' — '+core.title(data);window.print();});
  window.addEventListener('beforeprint',render);
  window.addEventListener('afterprint',()=>{document.title=originalTitle;});
  populate();status('No account, uploads or automatic saving. Your draft stays in this tab.');
})();
