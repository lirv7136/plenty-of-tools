const {test}=require('node:test');
const assert=require('node:assert/strict');
const C=require('../tools/worth-it-calculators/static/core.js');
const example=id=>Object.fromEntries(C.calculators[id].fields.map(f=>[f.key,f.example]));
const calc=(id,overrides={})=>C.calculate(id,{...example(id),...overrides});
const close=(actual,expected)=>assert.ok(Math.abs(actual-expected)<1e-8,`${actual} != ${expected}`);
test('seat fees count only paid seats; benefits apply once per party and leg',()=>{
  const r=calc('seats');close(r.net,6);close(r.totalFee,48);close(r.breakFee,9);close(r.requiredLift,40);
  close(calc('seats',{fee:9}).net,0);
  assert.equal(calc('seats',{people:1,paidSeats:1}).benefit,0);
  assert.equal(calc('seats',{paidSeats:0}).totalFee,0);
  assert.equal(calc('seats',{legs:0}).net,0);
  assert.equal(calc('seats',{splitValue:0}).requiredLift,null);
  assert.throws(()=>calc('seats',{paidSeats:4}));
  assert.ok(calc('seats',{before:0,after:100}).net<0);assert.equal(calc('seats',{before:0,after:100}).breakFee,null);
});
test('bags separate cash, amortised purchase, expected gate fees and party time',()=>{
  const r=calc('bags');close(r.checked,80);close(r.allocated,20);close(r.gate,25);close(r.cashSaved,35);close(r.net,49+2/3);
  const flat={purchase:20,trips:1,checkedMinutes:0,cabinMinutes:0,risk:10,gateFee:100,fee:20};
  close(calc('bags',flat).net,0);close(calc('bags',flat).breakFee,20);close(calc('bags',flat).breakRisk,10);
  assert.equal(calc('bags',{legs:0}).breakFee,null);
  assert.equal(calc('bags',{gateFee:0}).breakRisk,null);
  assert.ok(calc('bags',{checkedMinutes:0,cabinMinutes:1440}).timeValue<0);
});
test('wifi bills whole cruise and exposes the shared connection case',()=>{
  const r=calc('wifi');assert.equal(r.cost,168);assert.equal(r.net,-28);assert.equal(r.breakDays,5);
  assert.equal(calc('wifi',{devices:2}).sharingSaving,168);
  assert.equal(calc('wifi',{value:42}).net,0);
  assert.equal(calc('wifi',{sea:0,port:0}).perDay,null);
  assert.equal(calc('wifi',{value:0}).breakDays,null);
  assert.throws(()=>calc('wifi',{sea:7,port:1}));
  assert.ok(calc('wifi',{value:1}).notes.some(n=>n.includes('exceed')));
});
test('parking threshold respects coverage, included parking and alternatives',()=>{
  assert.equal(calc('parking').net,60);assert.equal(calc('parking').breakDays,5);
  assert.equal(calc('parking',{days:5,daily:30}).net,0);
  assert.equal(calc('parking',{covered:4}).breakDays,null);
  assert.equal(calc('parking',{days:10}).net,60);
  assert.equal(calc('parking',{daily:0}).breakDays,null);
  assert.equal(calc('parking',{pass:0,residual:0,daily:0}).breakDays,0);
  assert.equal(calc('parking',{days:0}).net,-150);
  assert.ok(calc('parking',{alternative:0}).notes.some(n=>n.includes('cheaper')));
});
test('all numeric field limits are accepted, finite and enforced at both ends',()=>{
  for(const id of ['seats','bags','wifi','parking'])for(const f of C.calculators[id].fields.filter(f=>f.kind!=='select')){
    for(const boundary of [f.min,f.max]){
      const raw={...example(id),[f.key]:boundary};
      if(id==='seats'){if(f.key==='people')raw.paidSeats=Math.min(raw.paidSeats,raw.people);else raw.people=Math.max(raw.people,raw.paidSeats);}
      if(id==='wifi'){if(f.key==='billed'){raw.sea=0;raw.port=0;}else if(f.key==='sea'||f.key==='port'){raw[f.key==='sea'?'port':'sea']=0;raw.billed=Math.max(raw.billed,raw.sea+raw.port);}}
      const result=C.calculate(id,raw);
      for(const n of Object.values(result))if(typeof n==='number')assert.ok(Number.isFinite(n),id+' '+f.key);
      assert.ok(C.scenarios(id,raw).some(s=>s.current));
    }
    assert.ok(C.validate(id,{...example(id),[f.key]:f.max+1}).errors[f.key]);
    assert.ok(C.validate(id,{...example(id),[f.key]:f.min-1}).errors[f.key]);
  }
});
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
