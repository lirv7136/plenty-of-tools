const {test}=require('node:test'),assert=require('node:assert/strict');
const core=require('../tools/invoice-generator/static/core.js'),bulk=require('../tools/invoice-generator/static/bulk.js');
const base=(x={})=>({...core.defaults('2026-11-13'),sellerName:'Sam Clean Co',sellerAbn:'51 824 753 556',...x});
const run=(csv,b=base(),o={})=>bulk.toInvoices(bulk.parseCsv(csv),b,{core,today:'2026-11-13',known:[],...o});

test('CSV parsing: quotes, commas in cells, CRLF, a BOM, blank lines and semicolons',()=>{
  assert.deepEqual(bulk.parseCsv('﻿a,b\r\n"x, y","say ""hi"""\r\n\r\n1,2'),[['a','b'],['x, y','say "hi"'],['1','2']]);
  assert.deepEqual(bulk.parseCsv('a;b\n1;"2;3"\n'),[['a','b'],['1','2;3']]);
  assert.deepEqual(bulk.parseCsv('a,b\n"line\none",2'),[['a','b'],['line\none','2']]);
  assert.equal(bulk.toCsv([['a,b','=SUM(A1)','ok']]),'"a,b",\'=SUM(A1),ok\r\n','formulas are defused and commas quoted');
});
test('the template round trips: rows for one customer become one invoice, numbered in order',()=>{
  const r=run(bulk.template('general'));
  assert.deepEqual(r.errors,[]);
  assert.deepEqual(r.invoices.map(d=>[d.number,d.clientName,d.items.length,d.columns.join()]),[['INV-001','Sue Smith',2,'Date'],['INV-002','Bob Brown',1,'Date']]);
  assert.deepEqual(r.invoices[0].items.map(i=>i.extra[0]),['2026-11-04','2026-11-18']);
  assert.equal(core.calculate(r.invoices[0]).total,30000);
  assert.equal(r.invoices[0].sellerName,'Sam Clean Co');assert.equal(r.invoices[0].issueDate,'2026-11-13');
  const next=run(bulk.template('general'),base(),{known:['INV-041'],lastInvoice:'INV-041'});
  assert.deepEqual(next.invoices.map(d=>d.number),['INV-042','INV-043'],'numbers continue from the last one used');
});
test('the NDIS template makes one invoice per participant with dates and support items',()=>{
  const r=run(bulk.template('ndis'));
  assert.deepEqual(r.errors,[]);assert.equal(r.invoices.length,1);
  const d=r.invoices[0];
  assert.deepEqual([d.ndis,d.ndisName,d.ndisNumber,d.clientName,d.clientEmail,d.columns.join()],['plan','Jane Citizen','430000000','Plan Partners','accounts@example.com','Date,Support item']);
  assert.deepEqual(d.items.map(i=>[i.extra.join(),i.quantity,i.tax]),[['2026-11-10,01_011_0107_1_1','2','none'],['2026-11-12,01_011_0107_1_1','3','none']]);
  assert.equal(core.calculate(d).total,35115);   // 5 × $70.23
  assert.deepEqual(core.validate(d),[]);
  assert.match(run(bulk.template('ndis'),base({sellerAbn:''})).errors.join(),/Plan managers need your ABN/);
  assert.match(run(bulk.template('ndis'),base({region:'GB',currency:'GBP'})).errors.join(),/Australian businesses/);
});
test('dates, money and column names are read leniently; problems name their row',()=>{
  const r=run('Client,Service Date,Work,Hours,Rate,GST\nSue,4/11/2026,Clean,"1.5","$1,200.00",no\nSue,2026-11-05,Clean,,60,yes\n,5/11/2026,Clean,1,60,yes\nBob,31/02/2026,Clean,1,60,yes\nAnn,5/11/2026,,1,60,yes');
  assert.deepEqual(r.invoices.map(d=>d.clientName),['Sue']);
  assert.deepEqual(r.invoices[0].items.map(i=>[i.extra[0],i.quantity,i.price,i.tax]),[['2026-11-04','1.5','1200.00','none'],['2026-11-05','1','60','gst']]);
  assert.match(r.errors[0],/Row 4: no customer/);assert.match(r.errors[1],/Row 5: "31\/02\/2026" is not a date/);assert.match(r.errors[2],/Ann \(rows 6\): Enter a description/);
  assert.equal(run('customer,date,description,unit_price\nSue,11/4/2026,Clean,60',base({region:'US',currency:'USD',taxName:'Sales tax',taxRate:'0'})).invoices[0].items[0].extra[0],'2026-11-04','US dates are month first');
  assert.match(run('customer,description\nSue,Clean').errors.join(),/no "unit_price" column/);
  assert.match(run(bulk.template('general'),base({sellerName:''})).errors.join(),/Fill in your own details.*business name/);
  assert.deepEqual(run('customer,description,unit_price,invoice_number\nSue,A,10,X-7\nSue,B,10,X-8').invoices.map(d=>d.number),['X-7','X-8'],'an invoice_number column decides the grouping');
});
test('the invoice list exports one row per line, with totals and paid state',()=>{
  const d=run(bulk.template('ndis')).invoices[0];
  const rows=bulk.parseCsv(bulk.historyCsv([{doc:d,paidAt:'2026-11-20'}],core));
  assert.equal(rows.length,3);
  assert.deepEqual(rows[1].slice(0,10),['INV-001','invoice','2026-11-13','2026-11-27','Plan Partners','Jane Citizen','430000000','2026-11-10','01_011_0107_1_1','Assistance with self care']);
  assert.deepEqual(rows[1].slice(10),['2','70.23','0.00','140.46','351.15','AUD','yes']);
});
test('the ZIP holds every file, intact, with unique names',()=>{
  const {execFileSync}=require('node:child_process'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
  const a=new TextEncoder().encode('first file'),b=new Uint8Array(70000).map((_,i)=>i%251);
  const z=bulk.zip([{name:'INV-001 Sue.pdf',bytes:a},{name:'INV-001 Sue.pdf',bytes:b},{name:'bad/na:me.pdf',bytes:a}]);
  assert.equal(bulk.crc32(new TextEncoder().encode('123456789')),0xCBF43926);
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'zip-')),f=path.join(dir,'t.zip');fs.writeFileSync(f,z);
  execFileSync('unzip',['-q','-t',f]);   // throws if the archive is damaged
  execFileSync('unzip',['-q',f,'-d',dir]);
  assert.deepEqual(fs.readdirSync(dir).filter(n=>n!=='t.zip').sort(),['INV-001 Sue (2).pdf','INV-001 Sue.pdf','bad-na-me.pdf']);
  assert.deepEqual([...fs.readFileSync(path.join(dir,'INV-001 Sue (2).pdf'))],[...b]);
});
