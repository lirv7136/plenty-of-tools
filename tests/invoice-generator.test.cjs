const {test}=require('node:test'),assert=require('node:assert/strict');
const core=require('../tools/invoice-generator/static/core.js');
function invoice(extra={}){const d={...core.defaults('2026-09-16'),sellerName:'Example seller',clientName:'Example customer',items:[{description:'Services',quantity:'1',price:'100.00',tax:'gst'}],...extra};d.items=d.items.map(i=>i&&typeof i==='object'&&!Array.isArray(i)?{extra:[],...i}:i);return d;}
test('non-registered invoices never add GST even when a line is marked taxable',()=>{
  const result=core.calculate(invoice());assert.equal(result.total,10000);assert.equal(result.gst,0);assert.equal(core.title(invoice()),'Invoice');
});
test('GST-exclusive taxable and non-taxable lines reconcile to cents',()=>{
  const result=core.calculate(invoice({gstMode:'exclusive',paid:'20.00',items:[{description:'Work',quantity:'2.5',price:'125.00',tax:'gst'},{description:'No GST',quantity:'1',price:'50.00',tax:'none'}]}));
  assert.deepEqual([result.subtotal,result.gst,result.total,result.paid,result.due],[36250,3125,39375,2000,37375]);
  assert.equal(result.items[1].gst,0);
});
test('GST-inclusive prices keep the entered total and separate tax correctly',()=>{
  const result=core.calculate(invoice({gstMode:'inclusive',items:[{description:'Items',quantity:'3',price:'19.99',tax:'gst'}]}));
  assert.deepEqual([result.subtotal,result.gst,result.total],[5452,545,5997]);
  assert.equal(result.subtotal+result.gst,result.total);
});
test('half-cent and fractional quantity rounding use decimal arithmetic',()=>{
  assert.equal(core.calculate(invoice({items:[{description:'Small',quantity:'0.005',price:'1.00',tax:'none'}]})).total,1);
  assert.equal(core.calculate(invoice({gstMode:'exclusive',items:[{description:'Small',quantity:'1',price:'0.05',tax:'gst'}]})).gst,1);
  assert.equal(core.calculate(invoice({items:[{description:'Exact',quantity:'3',price:'0.10',tax:'none'}]})).total,30);
});
test('GST is rounded on each line and totals are sums of the displayed lines',()=>{
  const items=Array.from({length:7},()=>({description:'Small item',quantity:'1',price:'0.05',tax:'gst'}));
  const result=core.calculate(invoice({gstMode:'exclusive',items}));assert.equal(result.gst,7);assert.equal(result.total,42);
  assert.equal(result.items.reduce((s,i)=>s+i.total,0),result.total);
});
test('quotes ignore prior invoice payments and retain the Quote heading',()=>{
  const draft=invoice({kind:'quote',gstMode:'exclusive',paid:'9999.00'});
  assert.equal(core.title(draft),'Quote');assert.equal(core.calculate(draft).paid,0);assert.equal(core.calculate(draft).due,11000);
});
test('rejects malformed amounts, invalid quantities, excess precision and overpayment',()=>{
  for(const price of ['-1','NaN','1e5','2.999',''])assert.throws(()=>core.calculate(invoice({items:[{description:'Work',quantity:'1',price,tax:'gst'}]})));
  for(const quantity of ['0','-1','1.0001','1000001'])assert.throws(()=>core.calculate(invoice({items:[{description:'Work',quantity,price:'1',tax:'gst'}]})));
  assert.throws(()=>core.calculate(invoice({paid:'100.01'})),/cannot exceed/);
});
test('large totals and excessive rows are bounded',()=>{
  assert.throws(()=>core.calculate(invoice({items:[{description:'Huge',quantity:'1000000',price:'999999999.99',tax:'gst'}]})),/exceeds/);
  assert.throws(()=>core.calculate(invoice({items:[]})),/1 and 100/);
  assert.throws(()=>core.calculate(invoice({items:Array(101).fill({})})),/1 and 100/);
});
test('ABN validates the official example and rejects modified, zero and malformed values',()=>{
  assert.equal(core.abnValid('51 824 753 556'),true);
  for(const s of ['51 824 753 557','00000000000','ABN51824753556',''])assert.equal(core.abnValid(s),false);
});
test('tax invoice requires a valid ABN, seller, buyer, dates, number and item description',()=>{
  assert.deepEqual(core.validate(invoice()),[]);
  assert.ok(core.validate(invoice({gstMode:'exclusive'})).some(e=>e.includes('ABN')));
  const good=invoice({gstMode:'exclusive',sellerAbn:'51 824 753 556'});assert.deepEqual(core.validate(good),[]);assert.equal(core.title(good),'Tax Invoice');
  assert.ok(core.validate({...good,clientName:''}).some(e=>e.includes('customer')));
  assert.ok(core.validate({...good,dueDate:'2026-09-15'}).some(e=>e.includes('before')));
});
test('date checks reject impossible days and date addition crosses month/year safely',()=>{
  assert.equal(core.validDate('2026-02-29'),false);assert.equal(core.validDate('2024-02-29'),true);
  assert.equal(core.validDate('2026-13-01'),false);assert.equal(core.addDays('2026-12-25',14),'2027-01-08');
});
test('draft round-trips incomplete edits without executing content or accepting unknown schema',()=>{
  const draft=invoice({notes:'<img src=x onerror=alert(1)>',sellerName:'',paid:''});
  assert.deepEqual(core.parseDraft(core.serialize(draft)),draft);
  for(const text of ['{}','not json',JSON.stringify({format:'other',version:1,data:draft})])assert.throws(()=>core.parseDraft(text));
  const broken=JSON.parse(core.serialize(draft));broken.data.items[0].price=100;assert.throws(()=>core.parseDraft(JSON.stringify(broken)));
  broken.data.items=[];assert.throws(()=>core.parseDraft(JSON.stringify(broken)));
  assert.throws(()=>core.parseDraft(' '.repeat(1000001)),/1 MB/);
});

// ---------- added 24 Oct 2026: extra columns, templates, numbering, email, PDF ----------
const PDFLib=require('../tools/invoice-generator/static/pdf-lib.min.js');
const pdf=require('../tools/invoice-generator/static/pdf.js');
test('extra columns round trip, are capped at two and never change totals',()=>{
  const d=invoice({columns:['Date','Hours'],items:[{description:'Work',quantity:'2',price:'50.00',tax:'none',extra:['2026-10-01','4']}]});
  assert.deepEqual(core.parseDraft(core.serialize(d)),d);
  assert.equal(core.calculate(d).total,core.calculate(invoice({items:[{description:'Work',quantity:'2',price:'50.00',tax:'none'}]})).total);
  assert.ok(core.validate({...d,columns:['','Hours']}).some(e=>/Name extra column 1/.test(e)));
  const three=JSON.parse(core.serialize(d));three.data.columns.push('SKU');assert.throws(()=>core.parseDraft(JSON.stringify(three)),/at most 2/);
  const long=JSON.parse(core.serialize(d));long.data.items[0].extra[0]='x'.repeat(61);assert.throws(()=>core.parseDraft(JSON.stringify(long)),/extra column/);
  const short=JSON.parse(core.serialize(d));short.data.items[0].extra=['only one'];assert.deepEqual(core.parseDraft(JSON.stringify(short)).items[0].extra,['only one','']);
});
test('version 1 drafts from before extra columns still open',()=>{
  const v1=JSON.stringify({format:'plenty-of-tools-invoice',version:1,data:{...core.defaults('2026-09-16'),columns:undefined,sellerName:'A',clientName:'B',items:[{description:'Old',quantity:'1',price:'1.00',tax:'gst'}]}});
  const d=core.parseDraft(v1);assert.deepEqual(d.columns,[]);assert.deepEqual(d.items[0].extra,[]);
  assert.equal(JSON.parse(core.serialize(d)).version,2);
});
test('the next number keeps its prefix, suffix and zero padding',()=>{
  assert.equal(core.nextNumber('INV-001'),'INV-002');assert.equal(core.nextNumber('INV-009'),'INV-010');assert.equal(core.nextNumber('INV-099'),'INV-100');
  assert.equal(core.nextNumber('2026-041'),'2026-042');assert.equal(core.nextNumber('Q7-A'),'Q8-A');assert.equal(core.nextNumber('999'),'1000');
  assert.equal(core.nextNumber('DRAFT'),'DRAFT-2');assert.equal(core.nextNumber(''),'INV-001');
  assert.equal(core.nextNumber('A99999999999999999999'),'A100000000000000000000','no float rounding on long numbers');
});
test('templates keep the business, terms and columns, number the next document, and leave the customer out unless asked',()=>{
  const d=invoice({number:'INV-040',sellerAbn:'51 824 753 556',gstMode:'exclusive',issueDate:'2026-10-01',dueDate:'2026-10-15',payment:'BSB 000-000',columns:['Hours'],clientEmail:'b@example.com',
    items:[{description:'Retainer',quantity:'1',price:'500.00',tax:'gst',extra:['10']}]});
  const t=core.makeTemplate('Monthly',d);
  const next=core.applyTemplate(t,'2026-11-01');
  assert.equal(next.number,'INV-041');assert.equal(next.issueDate,'2026-11-01');assert.equal(next.dueDate,'2026-11-15');
  assert.equal(next.sellerName,'Example seller');assert.equal(next.gstMode,'exclusive');assert.equal(next.payment,'BSB 000-000');
  assert.deepEqual(next.columns,['Hours']);assert.deepEqual(next.items[0].extra,['']);assert.equal(next.items[0].description,'');
  assert.equal(next.clientName,'');assert.equal(next.clientEmail,'');assert.equal(next.paid,'0.00');
  const full=core.applyTemplate(core.makeTemplate('Acme monthly',d,{includeClient:true,includeItems:true}),'2026-11-01');
  assert.equal(full.clientName,'Example customer');assert.equal(full.items[0].description,'Retainer');assert.deepEqual(full.items[0].extra,['10']);
  assert.throws(()=>core.makeTemplate('  ',d),/name/);
});
test('the template store validates on load, and refuses damaged or hostile files',()=>{
  const d=invoice({number:'INV-1'});const store={v:1,templates:[core.makeTemplate('One',d),core.makeTemplate('Two',d,{includeItems:true})]};
  assert.deepEqual(core.parseTemplates(core.serializeTemplates(store)).templates.map(t=>t.name),['One','Two']);
  for(const bad of [{v:2,templates:[]},{v:1,templates:[{...store.templates[0],id:'"><img>'}]},{v:1,templates:[{...store.templates[0],termsDays:400}]},
    {v:1,templates:[{...store.templates[0],data:{...store.templates[0].data,gstMode:'evil'}}]},{v:1,templates:[store.templates[0],store.templates[0]]}])
    assert.throws(()=>core.validateTemplates(bad));
  assert.throws(()=>core.parseTemplates('nope'),/templates file/);
  assert.throws(()=>core.validateTemplates({v:1,templates:Array(51).fill(0).map((_,i)=>({...store.templates[0],id:'t'+i}))}),/at most 50/);
});
test('the email message states the amount and due date, and the compose links encode it',()=>{
  const d=invoice({number:'INV-7',clientName:'Jane',clientEmail:'jane@example.com',payment:'BSB 062-000 Acc 1234',dueDate:'2026-09-30',paid:'20.00'});
  const m=core.emailMessage(d,core.calculate(d));
  assert.equal(m.to,'jane@example.com');assert.equal(m.subject,'Invoice INV-7 from Example seller');
  assert.match(m.body,/^Hi Jane,/);assert.match(m.body,/\$80\.00, due 30 September 2026/);assert.match(m.body,/BSB 062-000/);
  const q=core.emailMessage({...d,kind:'quote'},core.calculate({...d,kind:'quote'}));assert.match(q.body,/quote INV-7 for \$100\.00, valid until/);assert.doesNotMatch(q.body,/BSB/);
  assert.match(core.mailtoUrl(m),/^mailto:jane@example\.com\?subject=Invoice%20INV-7%20from%20Example%20seller&body=Hi%20Jane%2C/);
  assert.match(core.gmailUrl(m),/^https:\/\/mail\.google\.com\/mail\/\?view=cm&fs=1&to=jane%40example\.com&su=/);
  assert.match(core.outlookUrl(m),/^https:\/\/outlook\.live\.com\/mail\/0\/deeplink\/compose\?to=/);
  assert.equal(core.mailtoUrl({...m,to:''}).startsWith('mailto:?subject='),true);
});
test('the PDF is a real document with the right title, page breaks and character fallbacks',async()=>{
  const items=Array.from({length:45},(_,i)=>({description:`Line ${i+1} mowing − edges`,quantity:'1',price:'10.00',tax:'gst',extra:[`D${i+1}`]}));
  const d=invoice({number:'INV-9',gstMode:'exclusive',sellerAbn:'51 824 753 556',clientName:'Zhang 中 Wei',columns:['Day'],items});
  const r=await pdf.build(PDFLib,core,d);
  assert.equal(Buffer.from(r.bytes.slice(0,5)).toString(),'%PDF-');
  assert.ok(r.pages>=2,'45 lines need more than one page');assert.deepEqual(r.replaced,['中'],'the minus sign is swapped silently, the Chinese character is reported');
  const loaded=await PDFLib.PDFDocument.load(r.bytes);assert.equal(loaded.getPageCount(),r.pages);assert.equal(loaded.getTitle(),'Tax Invoice INV-9');
  const quote=await pdf.build(PDFLib,core,invoice({kind:'quote'}));assert.equal(quote.pages,1);assert.deepEqual(quote.replaced,[]);
});
test('Send with Gmail builds a MIME message whose text and PDF attachment decode back exactly',async()=>{
  const r=await pdf.build(PDFLib,core,invoice({number:'INV-12'}));
  const msg={to:'jane@example.com',subject:'Invoice INV-12 from Café Ōtaki',body:'Hi Jane,\n\nPlease find attached invoice INV-12 for $100.00.\n\nThank you,\nCafé'};
  const raw=core.buildMime(msg,r.bytes,'INV-12.pdf');
  assert.match(raw,/^[A-Za-z0-9_-]+$/,'base64url with no padding');
  const mime=Buffer.from(raw.replace(/-/g,'+').replace(/_/g,'/'),'base64').toString('utf8');
  assert.match(mime,/^To: jane@example\.com\r\n/);
  const subj=/Subject: =\?UTF-8\?B\?([^?]+)\?=/.exec(mime)[1];assert.equal(Buffer.from(subj,'base64').toString('utf8'),msg.subject);
  const boundary=/boundary="([^"]+)"/.exec(mime)[1];const parts=mime.split('--'+boundary);
  const text=parts[1].split('\r\n\r\n')[1].replace(/\r\n/g,'');assert.equal(Buffer.from(text,'base64').toString('utf8'),msg.body);
  assert.match(parts[2],/Content-Disposition: attachment; filename="INV-12\.pdf"/);
  const att=Buffer.from(parts[2].split('\r\n\r\n')[1].replace(/\r\n/g,''),'base64');assert.ok(att.equals(Buffer.from(r.bytes)),'the attached PDF is byte for byte the one made');
  assert.ok(parts[3].startsWith('--'),'the message closes its boundary');
  assert.throws(()=>core.buildMime({...msg,to:'not an email'},r.bytes,'x.pdf'),/valid customer email/);
  assert.throws(()=>core.buildMime({...msg,to:'a@b.com\r\nBcc: evil@x.com'},r.bytes,'x.pdf'),/valid customer email/,'no header injection through the To box');
  const injected=Buffer.from(core.buildMime({...msg,subject:'Hi\r\nBcc: evil@x.com'},r.bytes,'x.pdf').replace(/-/g,'+').replace(/_/g,'/'),'base64').toString('utf8');
  assert.doesNotMatch(injected,/\r\nBcc:/,'no header injection through the subject');
});
