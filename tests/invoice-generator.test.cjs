const {test}=require('node:test'),assert=require('node:assert/strict');
const core=require('../tools/invoice-generator/static/core.js');
function invoice(extra={}){return {...core.defaults('2026-09-16'),sellerName:'Example seller',clientName:'Example customer',items:[{description:'Services',quantity:'1',price:'100.00',tax:'gst'}],...extra};}
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
