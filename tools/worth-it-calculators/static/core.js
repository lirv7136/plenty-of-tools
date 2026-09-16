(function(root) {
  'use strict';
  const field = (key,label,kind,example,hint='',max) => ({key,label,kind,example,hint,min:kind==='people'?1:0,max:max ?? (kind==='percent'?100:kind==='minutes'?1440:kind==='people'?100:1000000)});
  const calculators = {
    vinted: {
      name:'Vinted bump', title:'Does the bump earn its cost back?',
      intro:'Compare the expected profit from selling one item over the same time window, with and without a bump. The change in sale probability is your estimate.',
      fields:[field('price','Selling price','money',25),field('cost','Costs if the item sells','money',7,'Include item cost, seller fees, packaging and any postage you pay.'),field('fee','Bump price','money',2),field('before','Chance of selling without a bump','percent',20),field('after','Chance of selling with a bump','percent',35,'Use the same time window for both probabilities. More views do not necessarily mean more sales.')],
      label:'Expected extra profit from the bump', positive:'The estimated uplift covers the bump', negative:'The estimated uplift falls short', even:'About break-even',
      metrics:[['Profit per sale before the bump','margin','money'],['Expected profit without a bump','baseline','money'],['Expected profit with a bump','promoted','money'],['Extra sale probability needed','requiredLift','points'],['Break-even chance with a bump','requiredChance','percent']],
      assumption:'This compares expected outcomes across many similar situations, not a guaranteed result for one item. If the item would sell later anyway, the benefit may mainly be a faster sale. Costs already paid may be excluded if you are comparing only future cash flows; use that basis consistently.',
      formula:'Extra expected profit = (bumped sale probability − normal sale probability) × (selling price − sale costs) − bump price.',
      source:'https://www.vinted.com/help/450-buying-a-bump', sourceLabel:'Vinted’s Bump guide', sourceNote:'Check the Bump price shown for your item. This calculator does not estimate the effect of a Bump on sales.',
      scenarioKey:'after', scenarioLabel:'Chance of selling with a bump', scenarioKind:'percent'
    },
    etsy: {
      name:'Etsy ads', title:'Are the ads adding profit?',
      intro:'Use one reporting period from your ads dashboard. Then estimate how many attributed orders were actually caused by the ads.',
      fields:[field('spend','Ad spend for the period','money',30),field('clicks','Ad clicks','count',100),field('orders','Orders attributed to ads','count',4),field('revenue','Average revenue per order','money',35,'Include shipping collected if you include shipping costs below.'),field('cost','Average costs per order','money',20,'Include product costs, marketplace/payment fees, postage and expected returns. Exclude ad spend.'),field('incremental','Share of attributed orders caused by ads','percent',75,'100% assumes every attributed order is additional. Attribution alone does not establish that.')],
      label:'Estimated incremental profit after ads',positive:'Estimated extra sales cover the ads',negative:'Estimated extra sales do not cover the ads',even:'About break-even',
      metrics:[['Contribution per order before ads','margin','money'],['Profit if every attributed order is additional','attributedProfit','money'],['Estimated additional orders','extraOrders','number'],['Cost per click','cpc','money'],['Cost per attributed order','cpa','money'],['Attributed revenue / ad spend (ROAS)','roas','ratio'],['Attributed orders needed to cover spend','breakOrders','count']],
      assumption:'This covers Etsy Ads, the on-site cost-per-click product. It does not calculate Offsite Ads fees. Revenue divided by ad spend is not profit. Reporting delays, refunds and orders that would have happened anyway can change the result.',
      formula:'Incremental profit = attributed orders × incremental share × (average revenue − average order costs) − ad spend.',
      source:'https://www.etsy.com/legal/advertising/',sourceLabel:'Etsy advertising policy',sourceNote:'Etsy Ads charges for clicks; Offsite Ads uses a different charging model. Enter actual costs from the same reporting period.',
      scenarioKey:'incremental',scenarioLabel:'Share of orders actually caused by ads',scenarioKind:'percent'
    },
    ebay: {
      name:'eBay labels',title:'Which shipping option costs less?',
      intro:'Compare an eBay label with a direct carrier quote for the same parcel, destination, cover and delivery service.',
      fields:[field('ebay','eBay label quote per parcel','money',7.5),field('direct','Direct carrier quote per parcel','money',9),field('ebayExtras','Extra costs with the eBay option','money',0,'Per parcel: printing, packaging differences, cover and surcharges not in the quote.'),field('directExtras','Extra costs with the direct option','money',0),field('parcels','Number of comparable parcels','count',10),field('ebayMinutes','Handling time per parcel with eBay','minutes',3),field('directMinutes','Handling time per parcel with the carrier','minutes',8),field('hourValue','Your value of an hour','money',15,'Optional time valuation: enter 0 to compare cash costs only.')],
      label:'Cash saved by choosing eBay labels',positive:'eBay has the lower cash cost',negative:'The direct carrier has the lower cash cost',even:'Same cash cost',
      metrics:[['eBay total cash cost','ebayTotal','money'],['Direct carrier total cash cost','directTotal','money'],['Cash difference per parcel','perParcel','money'],['Total handling minutes saved with eBay','minutesSaved','minutes'],['Value of that time difference','timeValue','money'],['eBay advantage including time value','includingTime','money']],
      assumption:'Positive differences favour eBay; negative differences favour the carrier. Time value is personal value, not cash income. Use equivalent tracked services and include any expected adjustments. This does not buy or generate a shipping label.',
      formula:'Cash saved = parcels × (direct quote + direct extras − eBay quote − eBay extras). Time value is shown separately.',
      source:'https://www.ebay.com/help/-/-/-/shipping-labels?id=4157',sourceLabel:'eBay shipping-label help',sourceNote:'Use the actual quotes for your parcel dimensions, weight and destination. Prices and service availability vary.',
      scenarioKey:'parcels',scenarioLabel:'Comparable parcels',scenarioKind:'count'
    },
    uber: {
      name:'Uber One',title:'Will you use enough of the membership?',
      intro:'Count only orders and rides you would take anyway. Compare the same checkout with and without the membership, then allow for unused credits and extra spending.',
      fields:[{key:'period',label:'Membership billing',kind:'select',example:'monthly',options:[['monthly','Monthly'],['annual','Annual (paid upfront)']]},field('fee','Membership price for that billing period','money',10),field('orders','Eligible orders per month','count',4),field('saving','Cash saving per eligible order','money',3,'Use the total checkout difference, excluding credits. Avoid counting the same discount twice.'),field('rideSavings','Other cash savings on planned rides per month','money',0,'Cash discounts only; enter ride credits separately below.'),field('credits','Membership credits earned per month','money',5),field('used','Share of credits you will use','percent',60),field('extra','Extra monthly spending caused by membership','money',4,'For example, adding items to reach minimums or placing extra orders.')],
      label:'Estimated net membership value per month',positive:'Your estimated use covers membership',negative:'Your estimated use falls short',even:'About break-even',
      metrics:[['Monthly membership cost','monthlyFee','money'],['Monthly cash savings before membership','cashSavings','money'],['Value of credits you expect to use','usedCredits','money'],['Extra spending included','extra','money'],['Net value over 12 similar months','annualNet','money'],['Eligible orders needed per month','breakOrders','count']],
      assumption:'Credit value is included only at the usage rate you enter and assumes it replaces spending you would make anyway. An annual fee is divided by 12 for comparison, but is paid upfront. Benefits, minimums and eligible stores vary; this does not verify your eligibility.',
      formula:'Monthly net value = orders × cash saving + ride cash savings + usable credits − monthly membership cost − extra spending.',
      source:'https://www.uber.com/au/en/uber-one/',sourceLabel:'Uber One benefits and eligibility',sourceNote:'Check your own offer and eligible checkout totals. The examples here are illustrative and are not current Uber prices or promised savings.',
      scenarioKey:'orders',scenarioLabel:'Eligible orders per month',scenarioKind:'count'
    },
    fasttrack: {
      name:'Airport fast track',title:'What is the shorter queue worth to you?',
      intro:'Compare the fee with your personal value of the time saved. Queue times are estimates, and a priority lane can still have a wait.',
      fields:[field('fee','Fast-track price per paying person','money',12),field('people','People paying and saving time','people',2),field('normal','Expected normal queue','minutes',35),field('fast','Expected fast-track queue','minutes',10),field('hourValue','Value of an hour per person','money',20,'This is how much the time is worth to you, not necessarily your hourly wage.')],
      label:'Time value minus the fast-track fee',positive:'Your time valuation exceeds the fee',negative:'The fee exceeds your time valuation',even:'About break-even',
      metrics:[['Total fee','totalFee','money'],['Minutes saved per person','minutesSaved','minutes'],['Total person-minutes saved','personMinutes','minutes'],['Personal value of the time saved','timeValue','money'],['Minutes per person needed to break even','breakMinutes','minutes'],['Break-even value of an hour per person','breakHourly','money']],
      assumption:'Time value is not a cash saving. Both queue estimates must cover the same stage of the airport journey. Travellers can value time differently; this model assumes the same fee, wait and time value for everyone counted.',
      formula:'Net personal value = people × ((normal wait − fast-track wait) ÷ 60 × hourly time value − price per person).',
      source:'https://www.heathrow.com/at-the-airport/airport-services/fast-track',sourceLabel:'Example airport fast-track information (Heathrow)',sourceNote:'Check your own airport’s price, eligibility, opening times and booking conditions. This calculator does not predict queues.',
      scenarioKey:'normal',scenarioLabel:'Normal queue estimate',scenarioKind:'minutes'
    }
  };
  function validate(id, raw) {
    const definition = calculators[id]; if(!definition) throw new Error('Unknown calculator.');
    const values = {}, errors = {};
    for(const f of definition.fields) {
      const value = raw[f.key];
      if(f.kind==='select') {if(!f.options.some(o=>o[0]===value)) errors[f.key]='Choose an option.';else values[f.key]=value;continue;}
      if(value===undefined || value===null || String(value).trim()==='') {errors[f.key]='Enter a value, including 0 when there is no cost or usage.';continue;}
      const text=String(value).trim(), n=Number(text), whole=['count','people'].includes(f.kind);
      if(!/^\d+(\.\d{1,2})?$/.test(text) || !Number.isFinite(n) || (whole&&!Number.isInteger(n))) errors[f.key]=whole?'Enter a whole number.':'Enter a number with up to 2 decimal places.';
      else if(n<f.min||n>f.max) errors[f.key]=`Enter a value from ${f.min} to ${f.max.toLocaleString('en')}.`;
      else values[f.key]=n;
    }
    return {values,errors};
  }
  const threshold = (cost, benefit) => cost<=0 ? 0 : benefit>0 ? Math.ceil(cost/benefit-1e-10) : null;
  function calculate(id, raw) {
    const {values:v,errors}=validate(id,raw);
    if(Object.keys(errors).length) {const e=new Error('Check the highlighted inputs.');e.fields=errors;throw e;}
    let r;
    if(id==='vinted') {
      const margin=v.price-v.cost, baseline=v.before/100*margin, promoted=v.after/100*margin-v.fee;
      const requiredLift=margin>0?v.fee/margin*100:null, requiredChance=requiredLift===null?null:v.before+requiredLift;
      r={net:promoted-baseline,margin,baseline,promoted,requiredLift,requiredChance,notes:[]};
      if(margin<=0)r.notes.push('Each sale has no positive contribution before the bump. Increasing sales cannot cover a positive bump cost.');
      if(requiredChance>100)r.notes.push('The break-even chance exceeds 100%, so this bump cannot pay back within this time window at this margin.');
      if(v.after<v.before)r.notes.push('You entered a lower sale probability with the bump.');
    } else if(id==='etsy') {
      const margin=v.revenue-v.cost, extraOrders=v.orders*v.incremental/100;
      r={net:extraOrders*margin-v.spend,margin,attributedProfit:v.orders*margin-v.spend,extraOrders,cpc:v.clicks?v.spend/v.clicks:null,cpa:v.orders?v.spend/v.orders:null,roas:v.spend?v.orders*v.revenue/v.spend:null,breakOrders:threshold(v.spend,margin*v.incremental/100),notes:[]};
      if(margin<=0)r.notes.push('Each order has no positive contribution before advertising. Additional orders cannot cover a positive ad spend.');
      if(!v.clicks&&(v.orders||v.spend))r.notes.push('You entered spend or orders with zero clicks. Check that all figures use the same reporting window.');
    } else if(id==='ebay') {
      const ebayTotal=(v.ebay+v.ebayExtras)*v.parcels,directTotal=(v.direct+v.directExtras)*v.parcels,minutesSaved=(v.directMinutes-v.ebayMinutes)*v.parcels;
      r={net:directTotal-ebayTotal,ebayTotal,directTotal,perParcel:v.direct+v.directExtras-v.ebay-v.ebayExtras,minutesSaved,timeValue:minutesSaved/60*v.hourValue,includingTime:directTotal-ebayTotal+minutesSaved/60*v.hourValue,notes:[]};
    } else if(id==='uber') {
      const monthlyFee=v.period==='annual'?v.fee/12:v.fee,cashSavings=v.orders*v.saving+v.rideSavings,usedCredits=v.credits*v.used/100,net=cashSavings+usedCredits-monthlyFee-v.extra;
      r={net,monthlyFee,cashSavings,usedCredits,extra:v.extra,annualNet:net*12,breakOrders:threshold(monthlyFee+v.extra-v.rideSavings-usedCredits,v.saving),notes:[]};
      if(v.period==='annual')r.notes.push('Annual billing is an upfront commitment. The monthly result spreads the full fee across 12 months.');
    } else {
      const minutesSaved=v.normal-v.fast,totalFee=v.fee*v.people,personMinutes=minutesSaved*v.people,timeValue=personMinutes/60*v.hourValue;
      r={net:timeValue-totalFee,totalFee,minutesSaved,personMinutes,timeValue,breakMinutes:v.fee===0?0:v.hourValue>0?v.fee/v.hourValue*60:null,breakHourly:v.fee===0?0:minutesSaved>0?v.fee/minutesSaved*60:null,notes:[]};
      if(minutesSaved<=0)r.notes.push('Your fast-track estimate saves no time. There is no time benefit to offset a positive fee.');
    }
    // Avoid showing negative zero or a verdict that contradicts the rounded money result.
    r.direction=Math.abs(r.net)<.005?'even':r.net>0?'positive':'negative';
    return r;
  }
  function scenarios(id, raw) {
    const d=calculators[id], {values,errors}=validate(id,raw);if(Object.keys(errors).length)return [];
    const key=d.scenarioKey, n=values[key],max=d.fields.find(f=>f.key===key).max;
    const candidates=d.scenarioKind==='percent'?[Math.max(0,n-25),n,Math.min(100,n+25)]:d.scenarioKind==='minutes'?[Math.max(0,n-15),n,Math.min(max,n+15)]:[Math.floor(n/2),n,Math.min(max,n+Math.max(4,n))];
    return [...new Set(candidates)].sort((a,b)=>a-b).map(value=>({value,current:value===n,net:calculate(id,{...values,[key]:value}).net}));
  }
  const api={calculators,validate,calculate,scenarios};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.WorthCore=api;
})(typeof globalThis!=='undefined'?globalThis:this);
