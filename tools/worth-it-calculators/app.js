(() => {
  'use strict';
  const C=window.WorthCore,$=id=>document.getElementById(id), states={};
  let active='',lastResult=null;
  const state=()=>states[active];
  function format(value,kind) {
    if(value===null)return 'Not available';
    if(kind==='money')return new Intl.NumberFormat('en-AU',{style:'currency',currency:$('wc-currency').value,currencyDisplay:'code'}).format(Math.abs(value)<.005?0:value);
    const number=new Intl.NumberFormat('en-AU',{maximumFractionDigits:2}).format(value);
    return number+(kind==='percent'?'%':kind==='points'?' percentage points':kind==='ratio'?'×':kind==='minutes'?' min':'');
  }
  function summary(container,rows) {
    container.replaceChildren();
    rows.forEach(([label,value])=>{const row=document.createElement('div'),dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=label;dd.textContent=value;row.append(dt,dd);container.append(row);});
  }
  function inputSummary() {return C.calculators[active].fields.map(f=>[f.label,f.kind==='select'?f.options.find(o=>o[0]===state().values[f.key])[1]:format(Number(state().values[f.key]),f.kind)]);}
  function renderResult(showErrors=false) {
    const definition=C.calculators[active],validation=C.validate(active,state().values);
    definition.fields.forEach(f=>{const message=showErrors?validation.errors[f.key]:'';$(`wc-${f.key}`).setAttribute('aria-invalid',String(!!message));$(`wc-err-${f.key}`).textContent=message||'';});
    const invalid=Object.keys(validation.errors).length>0;
    $('wc-error').hidden=!invalid||!showErrors;$('wc-empty').hidden=!invalid||showErrors;$('wc-results').hidden=invalid;lastResult=null;
    if(invalid)return;
    const r=C.calculate(active,state().values);lastResult=r;
    $('wc-result-label').textContent=definition.label;$('wc-net').textContent=format(r.net,'money');
    $('wc-verdict').textContent=definition[r.direction];$('wc-verdict').dataset.direction=r.direction;
    $('wc-notes').replaceChildren();r.notes.forEach(note=>{const li=document.createElement('li');li.textContent=note;$('wc-notes').append(li);});
    summary($('wc-metrics'),definition.metrics.map(([label,key,kind])=>[label,format(r[key],kind)]));
    $('wc-scenario-label').textContent=definition.scenarioLabel;$('wc-scenario-net-label').textContent=definition.label;
    $('wc-scenario-rows').replaceChildren();
    C.scenarios(active,state().values).forEach(s=>{const tr=document.createElement('tr'),th=document.createElement('th'),td=document.createElement('td');tr.dataset.current=String(s.current);th.scope='row';th.textContent=format(s.value,definition.scenarioKind)+(s.current?' (your figure)':'');td.textContent=format(s.net,'money');tr.append(th,td);$('wc-scenario-rows').append(tr);});
    summary($('wc-input-summary'),inputSummary());
    $('wc-print-example').textContent=state().example?'Includes illustrative example inputs; edited values may differ.':'User-entered assumptions.';
  }
  function buildFields() {
    $('wc-fields').replaceChildren();
    C.calculators[active].fields.forEach(f=>{
      const block=document.createElement('div');block.className='wc-field';
      const label=document.createElement('label');label.htmlFor=`wc-${f.key}`;label.textContent=f.label;
      const wrap=document.createElement('div');wrap.className='wc-input-wrap';
      const input=document.createElement(f.kind==='select'?'select':'input');input.id=`wc-${f.key}`;input.name=f.key;
      if(f.kind==='select')f.options.forEach(([value,text])=>{const o=document.createElement('option');o.value=value;o.textContent=text;input.append(o);});
      else {input.type='text';input.inputMode=['count','people'].includes(f.kind)?'numeric':'decimal';input.maxLength=18;input.required=true;}
      input.value=state().values[f.key];input.setAttribute('aria-describedby',`wc-hint-${f.key} wc-err-${f.key}`);
      const unit=document.createElement('span');unit.textContent=f.kind==='money'?$('wc-currency').value:f.kind==='percent'?'%':f.kind==='minutes'?'min':'';unit.setAttribute('aria-hidden','true');if(f.kind==='money')unit.dataset.currency='true';
      wrap.append(input);if(unit.textContent)wrap.append(unit);
      const hint=document.createElement('small');hint.className='wc-hint';hint.id=`wc-hint-${f.key}`;hint.textContent=f.hint||'';
      const err=document.createElement('small');err.className='wc-field-error';err.id=`wc-err-${f.key}`;
      input.addEventListener('input',()=>{state().values[f.key]=input.value;renderResult(state().submitted);});
      block.append(label,wrap,hint,err);$('wc-fields').append(block);
    });
    $('wc-example-note').hidden=!state().example;
  }
  function activate(id,focus=false) {
    active=Object.hasOwn(C.calculators,id)?id:'vinted';const d=C.calculators[active];
    if(!states[active])states[active]={values:Object.fromEntries(d.fields.map(f=>[f.key,f.kind==='select'?f.example:''])),submitted:false,example:false};
    for(const key of Object.keys(C.calculators)) {const tab=$(`wc-tab-${key}`);if(key===active)tab.setAttribute('aria-current','page');else tab.removeAttribute('aria-current');}
    $('wc-title').textContent=d.title;$('wc-intro').textContent=d.intro;$('wc-assumptions').textContent=d.assumption;$('wc-formula').textContent=d.formula;$('wc-source-note').textContent=d.sourceNote;$('wc-source').textContent=d.sourceLabel;$('wc-source').href=d.source;
    document.title=`${d.name} calculator · Plenty of Tools`;
    buildFields();renderResult(state().submitted);if(focus)$('wc-title').focus({preventScroll:true});
  }
  $('wc-form').addEventListener('submit',e=>{e.preventDefault();state().submitted=true;renderResult(true);const invalid=$('wc-form').querySelector('[aria-invalid=true]');if(invalid)invalid.focus();});
  $('wc-example').addEventListener('click',()=>{state().values=Object.fromEntries(C.calculators[active].fields.map(f=>[f.key,String(f.example)]));state().submitted=true;state().example=true;buildFields();renderResult(true);});
  $('wc-clear').addEventListener('click',()=>{delete states[active];activate(active);$('wc-form').querySelector('input,select').focus();});
  $('wc-currency').addEventListener('change',()=>{document.querySelectorAll('[data-currency]').forEach(el=>{el.textContent=$('wc-currency').value;});renderResult(state().submitted);});
  $('wc-print').addEventListener('click',()=>{if(lastResult)window.print();});
  $('wc-download').addEventListener('click',()=>{
    if(!lastResult)return;const d=C.calculators[active];
    const report=[d.name+' calculation',`Currency: ${$('wc-currency').value}`,state().example?'Includes illustrative example inputs; edited values may differ.':'User-entered assumptions.','',...inputSummary().map(([k,v])=>`${k}: ${v}`),'',`${d.label}: ${format(lastResult.net,'money')}`,d[lastResult.direction],...d.metrics.map(([label,key,kind])=>`${label}: ${format(lastResult[key],kind)}`),...lastResult.notes,'','Alternative scenarios (all other inputs fixed):',...C.scenarios(active,state().values).map(s=>`${d.scenarioLabel}: ${format(s.value,d.scenarioKind)} — ${format(s.net,'money')}${s.current?' (your figure)':''}`),'',d.formula,d.assumption,d.sourceNote,d.source,'','Calculated locally with Plenty of Tools. Values are estimates, not guaranteed outcomes.'].join('\n');
    const url=URL.createObjectURL(new Blob([report],{type:'text/plain;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download=`${active}-calculation.txt`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  });
  window.addEventListener('hashchange',()=>activate(location.hash.slice(1),true));
  activate(location.hash.slice(1));
})();
