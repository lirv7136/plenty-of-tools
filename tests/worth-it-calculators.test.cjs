const {test}=require('node:test');
const assert=require('node:assert/strict');
const C=require('../tools/worth-it-calculators/static/core.js');
const example=id=>Object.fromEntries(C.calculators[id].fields.map(f=>[f.key,f.example]));
const calc=(id,overrides={})=>C.calculate(id,{...example(id),...overrides});
const close=(actual,expected)=>assert.ok(Math.abs(actual-expected)<1e-8,`${actual} != ${expected}`);
test('Vinted compares incremental expected profit, not all promoted sales',()=>{
  const r=calc('vinted');close(r.net,.7);close(r.margin,18);close(r.baseline,3.6);close(r.promoted,4.3);close(r.requiredChance,31.1111111111);
  assert.equal(calc('vinted',{after:20}).net,-2);
});
test('Vinted impossible and unprofitable break-even cases are explicit',()=>{
  assert.ok(calc('vinted',{fee:100}).requiredChance>100);
  assert.ok(calc('vinted',{fee:100}).notes.some(s=>s.includes('100%')));
  assert.equal(calc('vinted',{price:5,cost:7}).requiredChance,null);
  assert.ok(calc('vinted',{price:5,cost:7}).net<0);
});
test('Etsy corrects for attribution and uses contribution rather than revenue',()=>{
  const r=calc('etsy');assert.equal(r.net,15);assert.equal(r.attributedProfit,30);assert.equal(r.extraOrders,3);assert.equal(r.breakOrders,3);close(r.cpc,.3);close(r.cpa,7.5);close(r.roas,140/30);
  assert.equal(calc('etsy',{incremental:0}).net,-30);
  assert.equal(calc('etsy',{incremental:0}).breakOrders,null);
});
test('Etsy handles zero spend, zero orders and negative margins',()=>{
  const zero=calc('etsy',{orders:0,clicks:0,spend:0});assert.equal(zero.net,0);assert.equal(zero.roas,null);assert.equal(zero.cpa,null);assert.equal(zero.cpc,null);assert.equal(zero.breakOrders,0);
  assert.equal(calc('etsy',{cost:40}).breakOrders,null);
  assert.equal(calc('etsy',{spend:40,orders:0}).net,-40);
});
test('eBay separates cash costs from time value including negative savings',()=>{
  const r=calc('ebay');assert.equal(r.net,15);assert.equal(r.minutesSaved,50);assert.equal(r.timeValue,12.5);assert.equal(r.includingTime,27.5);
  assert.equal(calc('ebay',{ebayExtras:4}).net,-25);
  assert.equal(calc('ebay',{ebayMinutes:10,directMinutes:4}).timeValue,-15);
  assert.equal(calc('ebay',{parcels:0}).net,0);
});
test('Uber discounts unused credits and induced spending',()=>{
  const r=calc('uber');assert.equal(r.net,1);assert.equal(r.usedCredits,3);assert.equal(r.cashSavings,12);assert.equal(r.breakOrders,4);assert.equal(r.annualNet,12);
  assert.equal(calc('uber',{used:0}).net,-2);
  assert.equal(calc('uber',{extra:20}).net,-15);
});
test('Uber annual billing spreads the fee over 12 months',()=>{
  const r=calc('uber',{period:'annual',fee:120});assert.equal(r.monthlyFee,10);assert.equal(r.net,1);assert.equal(r.annualNet,12);assert.ok(r.notes.length);
  assert.equal(calc('uber',{period:'annual',fee:100}).monthlyFee,100/12);
});
test('Uber zero per-order savings yields no finite threshold unless other benefits cover cost',()=>{
  assert.equal(calc('uber',{saving:0}).breakOrders,null);
  assert.equal(calc('uber',{saving:0,rideSavings:30}).breakOrders,0);
  assert.equal(calc('uber',{fee:0,credits:0,extra:0,orders:0}).net,0);
});
test('Fast track counts each person’s fee and time consistently',()=>{
  const r=calc('fasttrack');assert.equal(r.totalFee,24);assert.equal(r.minutesSaved,25);assert.equal(r.personMinutes,50);close(r.timeValue,50/60*20);close(r.net,-7.3333333333);assert.equal(r.breakMinutes,36);close(r.breakHourly,28.8);
  close(calc('fasttrack',{people:1}).net,r.net/2);
});
test('Fast track handles zero value, slower queues, and free entry',()=>{
  assert.equal(calc('fasttrack',{hourValue:0}).breakMinutes,null);
  assert.equal(calc('fasttrack',{normal:10,fast:20}).breakHourly,null);
  assert.ok(calc('fasttrack',{normal:10,fast:20}).net<-24);
  const r=calc('fasttrack',{fee:0,hourValue:0});assert.equal(r.net,0);assert.equal(r.breakMinutes,0);
});
test('blank, negative, nonfinite, out-of-range and fractional counts are rejected',()=>{
  for(const override of [{price:''},{price:-1},{price:Infinity},{price:'1e3'},{price:'1,000'},{price:'1.005'},{after:101}])assert.throws(()=>calc('vinted',override));
  assert.throws(()=>calc('uber',{orders:2.5}));assert.throws(()=>calc('uber',{period:'weekly'}));assert.throws(()=>calc('fasttrack',{people:0}));assert.throws(()=>calc('fasttrack',{normal:1441}));
});
test('scenario tables contain the current inputs and stay inside validated limits',()=>{
  for(const id of Object.keys(C.calculators)){
    const s=C.scenarios(id,example(id));assert.equal(s.filter(s=>s.current).length,1);close(s.find(s=>s.current).net,calc(id).net);
    assert.ok(s.every(s=>Number.isFinite(s.net)));
  }
  assert.equal(C.scenarios('vinted',{...example('vinted'),after:100}).length,2);
  assert.equal(C.scenarios('uber',{...example('uber'),orders:0}).length,2);
  assert.deepEqual(C.scenarios('uber',{}),[]);
});
test('break-even order counts are rounded up without floating-point off-by-one errors',()=>{
  assert.equal(calc('uber',{fee:.3,saving:.1,rideSavings:0,credits:0,extra:0}).breakOrders,3);
  assert.equal(calc('uber',{fee:.31,saving:.1,rideSavings:0,credits:0,extra:0}).breakOrders,4);
  assert.equal(calc('vinted',{fee:2.7}).direction,'even');
});
