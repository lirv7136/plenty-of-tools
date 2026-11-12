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

// ---------- 11 Nov 2026: what a first real user could not find ----------
test('a Date column is recognised and its values print as short dates; other text is kept as typed',()=>{
  for(const h of ['Date','date ',' Visit date','Service dates'])assert.ok(core.isDateHeading(h),h);
  for(const h of ['Hours','Day','Job no.','Date paid','Updated','',undefined])assert.ok(!core.isDateHeading(h),String(h));
  assert.equal(core.cellText('Date','2026-11-03'),'3 Nov 2026');
  assert.equal(core.cellText('Date','Tues 3rd'),'Tues 3rd');
  assert.equal(core.cellText('Date','2026-02-30'),'2026-02-30');
  assert.equal(core.cellText('Hours','2026-11-03'),'2026-11-03');
  assert.equal(core.cellText('Date',''),'');
});
test('templates for different customers share one running number, unless their pattern differs',()=>{
  assert.equal(core.nextFrom('INV-002','INV-007'),'INV-008');
  assert.equal(core.nextFrom('INV-009','INV-007'),'INV-010');
  assert.equal(core.nextFrom('INV-002',''),'INV-003');
  assert.equal(core.nextFrom('Q-002','INV-007'),'Q-003');
  assert.equal(core.nextFrom('2026-05','2026-011'),'2026-012');
  assert.equal(core.nextFrom('','INV-007'),'INV-008');
  assert.equal(core.nextFrom('',[]),'INV-001');
  assert.equal(core.nextFrom('INV-002',['INV-010','Q-050','EXAMPLE-009']),'INV-011');
  const t=core.makeTemplate('Sue',invoice({number:'INV-002',clientName:'Sue Smith'}),{includeClient:true,includeItems:true});
  const next=core.applyTemplate(t,'2026-12-01',['INV-005']);
  assert.deepEqual([next.number,next.issueDate,next.clientName,next.items[0].description],['INV-006','2026-12-01','Sue Smith','Services']);
});
test('the start again label names the customer when the template keeps one',()=>{
  const d=invoice({clientName:'Sue Smith'});
  assert.equal(core.quickLabel(core.makeTemplate('Sue',d,{includeClient:true})),'New invoice for Sue Smith');
  assert.equal(core.quickLabel(core.makeTemplate('Retainer',d)),'New invoice from "Retainer"');
  assert.equal(core.quickLabel(core.makeTemplate('Q',invoice({kind:'quote',clientName:'Bo'}),{includeClient:true})),'New quote for Bo');
});
test('the list of numbers used only goes up for each pattern',()=>{
  assert.deepEqual(core.recordUsed([],'INV-001'),['INV-001']);
  assert.deepEqual(core.recordUsed(['INV-010','Q-001'],'INV-002'),['INV-010','Q-001'],'re-sending an old invoice does not wind the count back');
  assert.deepEqual(core.recordUsed(['INV-010'],'Q-003'),['Q-003','INV-010'],'a quote does not replace the invoice count');
  assert.deepEqual(core.recordUsed(['INV-010'],'INV-011'),['INV-011']);
  assert.deepEqual(core.recordUsed(['INV-010'],'no digits'),['INV-010']);
  assert.equal(core.recordUsed(Array.from({length:30},(_,i)=>`P${i}-1`),'X-1').length,20);
});
test('stored numbers survive a reload, and a store without them still loads',()=>{
  const t=core.makeTemplate('Sue',invoice(),{});
  const s=core.validateTemplates({v:1,used:['INV-004',7,''],lastInvoice:'INV-004',templates:[t]});
  assert.deepEqual([s.used,s.lastInvoice],[['INV-004'],'INV-004']);
  assert.deepEqual([core.validateTemplates({v:1,templates:[t]}).used,core.validateTemplates({v:1,used:'x',templates:[]}).used],[[],[]]);
});

// ---------- 12 Nov 2026: bank details and PayID ----------
test('bank details go under How to pay with the invoice number as the reference',()=>{
  const d=invoice({number:'INV-009',bankName:'Sam Clean Co',bankBsb:'062 000',bankAccount:'1234 5678',payId:'sam@example.com'});
  assert.deepEqual(core.bankLines(d),['Bank transfer','Account name: Sam Clean Co','BSB: 062-000','Account: 1234 5678','PayID: sam@example.com','Reference: INV-009']);
  assert.deepEqual(core.bankLines(invoice({payId:'0400 000 000'})),['PayID: 0400 000 000','Reference: INV-001']);
  assert.deepEqual(core.bankLines(invoice({kind:'quote',bankBsb:'062000',bankAccount:'12345678'})),['Bank transfer','BSB: 062-000','Account: 12345678'],'a quote has no payment reference');
  assert.deepEqual(core.bankLines(invoice()),[]);
  assert.match(core.emailMessage(d,core.calculate(d)).body,/How to pay:\nBank transfer\nAccount name: Sam Clean Co\nBSB: 062-000/);
});
test('a BSB and account number are checked together',()=>{
  const errs=x=>core.validate(invoice(x)).join(' ');
  assert.match(errs({bankBsb:'06200',bankAccount:'12345678'}),/6 digits/);
  assert.match(errs({bankBsb:'062000',bankAccount:'12'}),/4 to 10 digits/);
  assert.match(errs({bankBsb:'062000'}),/Add the account number/);
  assert.match(errs({bankAccount:'12345678'}),/Add the BSB/);
  assert.equal(errs({bankBsb:'062-000',bankAccount:'1234 5678'}),'');
});
test('drafts and templates saved before bank details existed still open',()=>{
  const old=invoice();for(const k of ['bankName','bankBsb','bankAccount','payId'])delete old[k];
  const back=core.parseDraft(JSON.stringify({format:'plenty-of-tools-invoice',version:2,data:old}));
  assert.deepEqual([back.bankBsb,back.payId],['','']);
  assert.throws(()=>core.parseDraft(JSON.stringify({format:'plenty-of-tools-invoice',version:2,data:{...old,bankBsb:7}})),/invalid bankBsb/);
});

// ---------- 12 Nov 2026: totals worked by hand, one case per GST mode ----------
test('hand worked totals: no GST, with a half cent that rounds up',()=>{
  // 3 × $50.00 = $150.00; 1.5 × $33.33 = $49.995, which rounds to $50.00. Total $200.00.
  const r=core.calculate(invoice({items:[{description:'Clean',quantity:'3',price:'50.00',tax:'gst'},{description:'Ironing',quantity:'1.5',price:'33.33',tax:'gst'}]}));
  assert.deepEqual([r.items[1].total,r.subtotal,r.gst,r.total,r.due],[5000,20000,0,20000,20000]);
});
test('hand worked totals: prices exclude GST, with a GST free line and a half cent of GST',()=>{
  // 2.5 × $125.00 = $312.50, GST $31.25. $50.00 GST free. $0.05, GST 0.5c rounds up to 1c.
  // Subtotal $362.55, GST $31.26, total $393.81.
  const r=core.calculate(invoice({gstMode:'exclusive',items:[{description:'Work',quantity:'2.5',price:'125.00',tax:'gst'},{description:'Fee',quantity:'1',price:'50.00',tax:'none'},{description:'Tiny',quantity:'1',price:'0.05',tax:'gst'}]}));
  assert.deepEqual([r.subtotal,r.gst,r.total],[36255,3126,39381]);
});
test('hand worked totals: prices include GST, with a part payment',()=>{
  // 3 × $19.99 = $59.97, GST 59.97/11 = $5.4518 → $5.45, net $54.52. $110.00: GST $10.00, net $100.00.
  // $20.00 GST free. Subtotal $174.52, GST $15.45, total $189.97; $100.00 paid leaves $89.97 due.
  const r=core.calculate(invoice({gstMode:'inclusive',paid:'100.00',items:[{description:'Items',quantity:'3',price:'19.99',tax:'gst'},{description:'Service',quantity:'1',price:'110.00',tax:'gst'},{description:'Exempt',quantity:'1',price:'20.00',tax:'none'}]}));
  assert.deepEqual([r.subtotal,r.gst,r.total,r.paid,r.due],[17452,1545,18997,10000,8997]);
});

// ---------- 12 Nov 2026: NDIS invoices (rules read on ndis.gov.au, Guide to getting paid) ----------
function ndisInvoice(extra={}){return invoice({ndis:'plan',ndisName:'Jane Citizen',ndisNumber:'430000000',sellerAbn:'51 824 753 556',columns:['Date','Support item'],
  items:[{description:'Assistance with self care',quantity:'2',price:'70.23',tax:'none',extra:['2026-11-10','01_011_0107_1_1']}],...extra});}
test('an NDIS invoice needs the participant, NDIS number, ABN for plan managers, and a date and support item on every line',()=>{
  assert.deepEqual(core.validate(ndisInvoice()),[]);
  const e=x=>core.validate(ndisInvoice(x)).join(' ');
  assert.match(e({ndisName:''}),/participant’s name/);
  assert.match(e({ndisNumber:''}),/NDIS number/);
  assert.match(e({sellerAbn:''}),/Plan managers need your ABN/);
  assert.doesNotMatch(e({sellerAbn:'',ndis:'self'}),/ABN/,'self managed: the page only requires the ABN for plan managers');
  assert.match(e({columns:['Date'],items:[{description:'x',quantity:'1',price:'1',tax:'none',extra:['2026-11-10']}]}),/Support item column/);
  assert.match(e({items:[{description:'x',quantity:'1',price:'1',tax:'none',extra:['','01_011_0107_1_1']}]}),/date of support for item 1/);
  assert.match(e({items:[{description:'x',quantity:'1',price:'1',tax:'none',extra:['2026-11-10','']}]}),/support item number for item 1/);
});
test('NDIS lines, the 90 day and 2 year warnings, and who it is for',()=>{
  const d=ndisInvoice();
  assert.deepEqual(core.ndisLines(d),['NDIS participant: Jane Citizen','NDIS number: 430000000','Funding: plan managed']);
  assert.deepEqual(core.ndisWarnings(d,'2026-11-12'),[]);
  assert.match(core.ndisWarnings(d,'2027-03-01').join(),/more than 90 days old/);
  assert.match(core.ndisWarnings(d,'2029-01-01').join(),/more than 2 years old/);
  assert.equal(core.whoFor({...d,clientName:'Plan Partners'}),'Jane Citizen','a plan manager bills for many participants');
  assert.equal(core.whoFor(invoice({clientName:'Sue'})),'Sue');
  assert.match(core.emailMessage(d,core.calculate(d)).subject,/for NDIS participant Jane Citizen \(430000000\)$/);
  assert.equal(core.quickLabel(core.makeTemplate('Jane',d,{includeClient:true})),'New invoice for Jane Citizen');
});
test('a draft from before NDIS still opens, and an unknown NDIS setting is refused',()=>{
  const old=invoice();for(const k of ['ndis','ndisName','ndisNumber'])delete old[k];
  assert.equal(core.parseDraft(JSON.stringify({format:'plenty-of-tools-invoice',version:2,data:old})).ndis,'');
  assert.throws(()=>core.parseDraft(JSON.stringify({format:'plenty-of-tools-invoice',version:2,data:{...old,ndis:'agency'}})),/unsupported/);
});

// ---------- 13 Nov 2026: other countries ----------
test('hand worked tax at other rates: UK VAT 20% added, NZ GST 15% included, and 12.5%',()=>{
  // UK: 3 × £45.50 = £136.50, VAT 20% = £27.30, total £163.80.
  const uk=core.calculate(invoice({region:'GB',currency:'GBP',taxName:'VAT',taxRate:'20',gstMode:'exclusive',items:[{description:'Work',quantity:'3',price:'45.50',tax:'gst'}]}));
  assert.deepEqual([uk.subtotal,uk.gst,uk.total],[13650,2730,16380]);
  // NZ: $115.00 including 15% GST: GST = 115 × 15/115 = $15.00, net $100.00.
  const nz=core.calculate(invoice({region:'NZ',currency:'NZD',taxRate:'15',gstMode:'inclusive',items:[{description:'Work',quantity:'1',price:'115.00',tax:'gst'}]}));
  assert.deepEqual([nz.subtotal,nz.gst,nz.total],[10000,1500,11500]);
  // 12.5% on $19.99 = $2.49875, which rounds to $2.50.
  const odd=core.calculate(invoice({region:'XX',taxRate:'12.5',gstMode:'exclusive',items:[{description:'Work',quantity:'1',price:'19.99',tax:'gst'}]}));
  assert.deepEqual([odd.gst,odd.total],[250,2249]);
  // A 0% rate (US default) charges nothing even on a taxable line.
  assert.equal(core.calculate(invoice({region:'US',currency:'USD',taxName:'Sales tax',taxRate:'0',gstMode:'exclusive'})).gst,0);
  assert.throws(()=>core.calculate(invoice({taxRate:'abc',gstMode:'exclusive'})),/rate as a percentage/);
});
test('outside Australia: no ABN checks, no Tax Invoice heading, no BSB or NDIS, local money and labels',()=>{
  const d=invoice({region:'GB',currency:'GBP',taxName:'VAT',taxRate:'20',gstMode:'exclusive',sellerAbn:'GB123456789',bankBsb:'12',ndis:'plan'});
  assert.deepEqual(core.validate(d),[]);
  assert.equal(core.title(d),'Invoice');
  assert.equal(core.money(16380,d),'£163.80');
  assert.equal(core.money(123456,{region:'AU',currency:'AUD'}),'$1,234.56');
  assert.equal(core.aud(123456),'$1,234.56');
  assert.equal(core.idPrefix(d),'VAT number: ');assert.equal(core.idPrefix(invoice()),'ABN ');
  assert.deepEqual(core.bankLines({...d,bankBsb:'062000',bankAccount:'12345678'}),[]);
  assert.deepEqual(core.ndisLines(d),[]);
  assert.match(core.validate(invoice({gstMode:'exclusive'})).join(),/Enter your ABN/,'Australia still asks for the ABN');
});
test('a document from before regions is Australian, and an unknown region or currency is refused',()=>{
  const old=invoice();for(const k of ['region','currency','taxName','taxRate'])delete old[k];
  const back=core.parseDraft(JSON.stringify({format:'plenty-of-tools-invoice',version:2,data:old}));
  assert.deepEqual([back.region,back.currency,back.taxName,back.taxRate],['AU','AUD','GST','10']);
  for(const bad of [{region:'ZZ'},{currency:'BTC'}])assert.throws(()=>core.parseDraft(JSON.stringify({format:'plenty-of-tools-invoice',version:2,data:{...invoice(),...bad}})),/unsupported/);
  assert.equal(core.parseDraft(JSON.stringify({format:'plenty-of-tools-invoice',version:2,data:{...invoice(),region:'NZ',currency:'NZD',ndis:'plan'}})).ndis,'','NDIS is dropped outside Australia');
});
