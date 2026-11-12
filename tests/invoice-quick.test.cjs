const {test}=require('node:test'),assert=require('node:assert/strict');
const quick=require('../tools/invoice-generator/static/quick.js');
const p=(t,o={})=>{const r=quick.parse(t,{today:'2026-11-13',...o});return [r.customer,r.items.map(i=>[i.description,i.quantity,i.price,i.date].filter(Boolean).join('|')).join(' ; '),r.problems.length];};
test('a short message becomes a customer and priced lines',()=>{
  assert.deepEqual(p('3 hrs mowing for Sue at $60'),['Sue','Mowing|3|60.00',0]);
  assert.deepEqual(p('Sue Smith: house clean $150'),['Sue Smith','House clean|1|150.00',0]);
  assert.deepEqual(p('invoice Bob Brown 1.5 hours gardening at $55 an hour yesterday'),['Bob Brown','Gardening|1.5|55.00|2026-11-12',0]);
  assert.deepEqual(p('Sue: 3 lessons at 60 each'),['Sue','Lessons|3|60.00',0]);
  assert.deepEqual(p('Cleaning 3h @ $45/hr for Kim on Nov 3'),['Kim','Cleaning|3|45.00|2026-11-03',0]);
  assert.deepEqual(p('window cleaning for Acme Pty Ltd on 4/11 $1,250.50'),['Acme Pty Ltd','Window cleaning|1|1250.50|2026-11-04',0]);
});
test('several items in one message',()=>{
  assert.deepEqual(p('2 x lawn mow @ 80, hedge trim 45 for Bob'),['Bob','Lawn mow|2|80.00 ; Hedge trim|1|45.00',0]);
  assert.deepEqual(p('Home clean for Sue Smith $150\nOven clean $40'),['Sue Smith','Home clean|1|150.00 ; Oven clean|1|40.00',0]);
  assert.deepEqual(p('fix tap $90 and replace washer $15 for Dan'),['Dan','Fix tap|1|90.00 ; Replace washer|1|15.00',0]);
  assert.deepEqual(p('logo design for Blue Co, 2 rounds of changes, $450'),['Blue Co','Logo design, 2 rounds of changes|1|450.00',0]);
});
test('a total is split into a unit price only when it divides to whole cents',()=>{
  assert.deepEqual(p('mowing for Sue, 3 hrs, $180 total'),['Sue','Mowing|3|60.00',0]);
  assert.deepEqual(p('mowing for Sue, 3 hrs, $100 total'),['Sue','Mowing (3 hrs)|1|100.00',0]);
});
test('it asks, and never invents an amount or a customer',()=>{
  assert.deepEqual(p('mowing for Sue'),['Sue','',1]);
  assert.deepEqual(p('$200 for Sue'),['Sue','',1]);
  assert.deepEqual(p('mowing $60'),['','Mowing|1|60.00',1]);
  assert.equal(quick.parse('hello',{today:'2026-11-13'}).problems.length,1);
  assert.equal(quick.parse('',{today:'2026-11-13'}).problems.length,1);
});
test('dates: day first by default, month first when asked, and a bad date is left in the words',()=>{
  assert.deepEqual(p('tutoring for Ann 4 Nov $60'),['Ann','Tutoring|1|60.00|2026-11-04',0]);
  assert.deepEqual(p('tutoring for Ann 3/11 $60',{monthFirst:true}),['Ann','Tutoring|1|60.00|2026-03-11',0]);
  assert.deepEqual(p('tutoring for Ann today $60'),['Ann','Tutoring|1|60.00|2026-11-13',0]);
});
