(function(root) {
  'use strict';
  const field = (key,label,kind,example,hint='',max) => ({key,label,kind,example,hint,min:kind==='people'?1:0,max:max ?? (kind==='percent'?100:kind==='minutes'?1440:kind==='people'?100:1000000)});
  const calculators = {
    seats: {
      name:'Seat selection',title:'What is sitting together worth to your party?',
      intro:'Compare the price of choosing seats with the expected inconvenience avoided. Check family seating arrangements before assigning a chance of separation.',
      fields:[field('people','People in your party','people',3),field('paidSeats','Seats you would pay for per leg','count',3,'Exclude any seats included in your fare or family seating arrangement.',100),field('legs','Flight legs','count',2,'Count each flight separately.',100),field('fee','Selection fee per paid seat per leg','money',8),field('before','Chance the party is split on a leg without selection','percent',50),field('after','Chance the party is split on a leg after selection','percent',5,'Aircraft changes can still affect seating.'),field('splitValue','Value to the whole party of avoiding one split leg','money',60,'A personal valuation, not compensation per person.'),{key:'child',label:'Travelling with a child who needs an adult beside them?',kind:'select',example:'yes',options:[['yes','Yes — check the airline family arrangement'],['no','No']]}],
      label:'Expected benefit minus seat selection fees',positive:'Your valuation covers the selection fees',negative:'The selection fees exceed your valuation',even:'About break even',
      metrics:[['Total selection fees','totalFee','money'],['Expected value of avoided separation','benefit','money'],['Maximum fee per paid seat per leg to break even','breakFee','money'],['Reduction in split probability needed','requiredLift','points']],
      assumption:'The value of avoiding separation applies once to the whole party per leg, not once per traveller. This does not estimate seating probabilities or decide whether a child can travel safely. If adjacent adult seating is essential, confirm it with the airline. A free family arrangement may cover an adult and child without keeping the entire party together.',
      formula:'Net value = legs × ((split chance without − split chance with) ÷ 100 × value of avoiding a split − paid seats × fee).',
      source:'https://corporate.ryanair.com/news/ryanair-tweaks-seat-allocation-for-families-to-match-industry-standard/',sourceLabel:'Ryanair family seating announcement',sourceNote:'Reviewed September 2026: Ryanair announced free adjacent family allocation after check in for bookings from 25 June 2026. Choosing specific seats still costs extra; use your booking quote. Example inputs are hypothetical, not Ryanair prices or split probabilities.',
      scenarioKey:'before',scenarioLabel:'Chance of a split without selection',scenarioKind:'percent'
    },
    bags: {
      name:'Checked bag or carry on',title:'Does travelling with carry on only save enough?',
      intro:'Include buying a suitable cabin bag, any cabin allowance fee, the chance of a gate check, and the value of time at baggage collection.',
      fields:[field('bags','Bags compared','people',1),field('legs','Flight legs','count',2,'Each leg is assumed to have the same fees and a baggage collection.',100),field('fee','Checked fee per bag per leg','money',40),field('cabinFee','Cabin allowance fee per bag per leg','money',0),field('purchase','Total cost of suitable cabin bags','money',80,'Enter 0 if already owned. Include all bags needed.'),field('trips','Comparable trips over which to spread the purchase','people',4,'Use 1 to charge the full purchase to this trip.'),field('risk','Chance each cabin bag must be gate checked per leg','percent',10),field('gateFee','Extra charge per gate checked bag','money',125),field('checkedMinutes','Carousel wait per leg with checked bags','minutes',25),field('cabinMinutes','Expected delay per leg with carry on only','minutes',3,'Include the chance of waiting for a gate checked bag here.'),field('hourValue','Value of one hour for the whole party','money',20)],
      label:'Carry on advantage including time value',positive:'Carry on has the lower combined cost',negative:'Checking bags has the lower combined cost',even:'About break even',
      metrics:[['Checked baggage cash cost','checked','money'],['Cabin bag purchase allocated to this trip','allocated','money'],['Expected gate charges','gate','money'],['Carry on cash cost','cabin','money'],['Cash saved by carry on','cashSaved','money'],['Value of time saved','timeValue','money'],['Checked fee per bag per leg at break even','breakFee','money'],['Gate check probability at break even','breakRisk','percent']],
      assumption:'Only compare options that meet your packing needs and airline rules. A risk estimate is not permission to take an oversized bag. Allocating a purchase across trips does not reduce the upfront amount. Time is valued once per party per leg. Connections without baggage collection need an adjusted average wait.',
      formula:'Carry on advantage = checked fees − cabin allowance fees − allocated bag purchase − expected gate charges + (checked wait − cabin delay) × legs ÷ 60 × party hourly value.',
      source:'https://www.jetstar.com/au/en/help/excess-baggage-charges-at-the-airport',sourceLabel:'Jetstar airport baggage fees',sourceNote:'Reviewed September 2026: Jetstar lists AUD 125 for excess cabin baggage at the Australian domestic gate, distinct from its AUD 85 extra 7 kg option. These are airport charges, not advance checked bag quotes. Check rules for your travel date; Jetstar flags a change from February 2027.',
      scenarioKey:'risk',scenarioLabel:'Gate check probability per bag per leg',scenarioKind:'percent'
    },
    wifi: {
      name:'Cruise wifi',title:'How much connection will you actually use?',
      intro:'Compare the package with your personal value of useful internet days. Two people taking turns on one device need only one connection if the plan permits it.',
      fields:[field('fee','Package price per connection per billed day','money',24),field('billed','Days the package charges for','people',7,'Often the whole cruise, including port days.'),field('sea','Days at sea when you would use it','count',3,'Only count useful days within the billed period.',100),field('port','Other days when you would use it aboard','count',1,'Do not count the same day twice.',100),field('devices','Simultaneous connections you would buy','people',1,'Enter 1 for two people sharing one device in turns. Price multi device bundles as one package with its total daily price.'),field('people','People benefiting','people',2),field('value','Value per useful day for the whole group','money',35,'What messaging, browsing, work or entertainment is worth to everyone combined.'),{key:'use',label:'Main use',kind:'select',example:'messages',options:[['messages','Messages and social apps'],['web','Email and browsing'],['calls','Video, streaming or work calls']]}],
      label:'Personal value minus wifi package cost',positive:'Your expected use covers the package',negative:'The package costs more than your expected use',even:'About break even',
      metrics:[['Package cost','cost','money'],['Useful days','useful','count'],['Value of useful connection','benefit','money'],['Cost per useful day','perDay','money'],['Cost per person','perPerson','money'],['Cost with one shared connection','shared','money'],['Saving from one shared connection','sharingSaving','money'],['Useful days needed to break even','breakDays','count']],
      assumption:'Useful days and billed days are separate. Sharing assumes taking turns, not simultaneous access or a hotspot, and depends on the plan terms. All users share the group value entered above. Multi device bundle comparisons require separate quotes. Satellite speed and app access are not guaranteed.',
      formula:'Net value = (useful sea days + useful other days) × group daily value − daily price × billed days × connections.',
      source:'https://www.carnival.com/internet-plans',sourceLabel:'Carnival internet plans and restrictions',sourceNote:'Reviewed September 2026: Carnival lists Value from USD 23.80 per day before sailing, covering the full cruise, and USD 28 for an onboard 24 hour Value plan. Its regular plans allow one device at a time and switching devices. Value excludes video streaming. Use your own cruise quote.',
      scenarioKey:'sea',scenarioLabel:'Useful days at sea',scenarioKind:'count'
    },
    parking: {
      name:'Theme park parking',title:'Daily parking, a pass, or a ride?',
      intro:'Compare daily parking with a prepaid or annual option over the same visit period, then check a shuttle or rideshare for the whole party.',
      fields:[field('days','Visit days within the pass period','count',6,'Count days, not separate parks visited on one day.',366),field('daily','Daily parking per vehicle','money',35),field('pass','Prepaid or annual parking cost','money',150,'Use only the extra cost of gaining parking if you already planned to buy admission.'),field('covered','Visit days covered by the pass','count',6,'Enter the maximum usable covered days in this period. Remaining days pay the daily rate.',366),field('residual','Parking charge on a covered day','money',0),field('driving','Fuel and tolls per visit day','money',10),field('alternative','Return shuttle or rideshare per visit day','money',40,'Total for the whole party, both directions, including tips and surcharges.')],
      label:'Cash saved by the parking pass versus daily parking',positive:'The pass saves money versus daily parking',negative:'Daily parking costs less than the pass',even:'Same cash cost',
      metrics:[['Daily parking plus driving','dailyTotal','money'],['Pass plus remaining fees and driving','passTotal','money'],['Shuttle or rideshare total','alternativeTotal','money'],['Pass advantage versus shuttle or rideshare','alternativeSaving','money'],['Covered visit days needed to break even','breakDays','count']],
      assumption:'Use one vehicle and one pass period. A pass must be valid on your actual dates; unused or excluded days cannot earn savings. Parking does not include admission. This compares cash costs, not travel time, accessibility or convenience. Buying an admission pass solely for parking requires including its full extra cost.',
      formula:'Pass saving = min(visit days, covered days) × (daily parking − covered day charge) − pass price. Driving costs are the same for both parking options.',
      source:'https://disneyworld.disney.go.com/guest-services/parking/',sourceLabel:'Walt Disney World parking information',sourceNote:'Reviewed September 2026: Walt Disney World standard car parking is USD 35 per day including tax, valid at its four theme parks that day. Standard parking is included for Disney Resort hotel guests and select annual passholders. The illustrative 150 pass price is not a Disney offer.',
      scenarioKey:'days',scenarioLabel:'Visit days',scenarioKind:'count'
    },
    vinted: {
      name:'Vinted bump', title:'Does the bump earn its cost back?',
      intro:'Compare the expected profit from selling one item over the same time window, with and without a bump. The change in sale probability is your estimate.',
      fields:[field('price','Selling price','money',25),field('cost','Costs if the item sells','money',7,'Include item cost, seller fees, packaging and any postage you pay.'),field('fee','Bump price','money',2),field('before','Chance of selling without a bump','percent',20),field('after','Chance of selling with a bump','percent',35,'Use the same time window for both probabilities. More views do not necessarily mean more sales.')],
      label:'Expected extra profit from the bump', positive:'The estimated uplift covers the bump', negative:'The estimated uplift falls short', even:'About break even',
      metrics:[['Profit per sale before the bump','margin','money'],['Expected profit without a bump','baseline','money'],['Expected profit with a bump','promoted','money'],['Extra sale probability needed','requiredLift','points'],['Break even chance with a bump','requiredChance','percent']],
      assumption:'This compares expected outcomes across many similar situations, not a guaranteed result for one item. If the item would sell later anyway, the benefit may mainly be a faster sale. Costs already paid may be excluded if you are comparing only future cash flows; use that basis consistently.',
      formula:'Extra expected profit = (bumped sale probability − normal sale probability) × (selling price − sale costs) − bump price.',
      source:'https://www.vinted.com/help/450-buying-a-bump', sourceLabel:'Vinted’s Bump guide', sourceNote:'Check the Bump price shown for your item. This calculator does not estimate the effect of a Bump on sales.',
      scenarioKey:'after', scenarioLabel:'Chance of selling with a bump', scenarioKind:'percent'
    },
    etsy: {
      name:'Etsy ads', title:'Are the ads adding profit?',
      intro:'Use one reporting period from your ads dashboard. Then estimate how many attributed orders were actually caused by the ads.',
      fields:[field('spend','Ad spend for the period','money',30),field('clicks','Ad clicks','count',100),field('orders','Orders attributed to ads','count',4),field('revenue','Average revenue per order','money',35,'Include shipping collected if you include shipping costs below.'),field('cost','Average costs per order','money',20,'Include product costs, marketplace/payment fees, postage and expected returns. Exclude ad spend.'),field('incremental','Share of attributed orders caused by ads','percent',75,'100% assumes every attributed order is additional. Attribution alone does not establish that.')],
      label:'Estimated incremental profit after ads',positive:'Estimated extra sales cover the ads',negative:'Estimated extra sales do not cover the ads',even:'About break even',
      metrics:[['Contribution per order before ads','margin','money'],['Profit if every attributed order is additional','attributedProfit','money'],['Estimated additional orders','extraOrders','number'],['Cost per click','cpc','money'],['Cost per attributed order','cpa','money'],['Attributed revenue / ad spend (ROAS)','roas','ratio'],['Attributed orders needed to cover spend','breakOrders','count']],
      assumption:'This covers Etsy Ads, the onsite cost per click product. It does not calculate Offsite Ads fees. Revenue divided by ad spend is not profit. Reporting delays, refunds and orders that would have happened anyway can change the result.',
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
      label:'Estimated net membership value per month',positive:'Your estimated use covers membership',negative:'Your estimated use falls short',even:'About break even',
      metrics:[['Monthly membership cost','monthlyFee','money'],['Monthly cash savings before membership','cashSavings','money'],['Value of credits you expect to use','usedCredits','money'],['Extra spending included','extra','money'],['Net value over 12 similar months','annualNet','money'],['Eligible orders needed per month','breakOrders','count']],
      assumption:'Credit value is included only at the usage rate you enter and assumes it replaces spending you would make anyway. An annual fee is divided by 12 for comparison, but is paid upfront. Benefits, minimums and eligible stores vary; this does not verify your eligibility.',
      formula:'Monthly net value = orders × cash saving + ride cash savings + usable credits − monthly membership cost − extra spending.',
      source:'https://www.uber.com/au/en/uber-one/',sourceLabel:'Uber One benefits and eligibility',sourceNote:'Check your own offer and eligible checkout totals. The examples here are illustrative and are not current Uber prices or promised savings.',
      scenarioKey:'orders',scenarioLabel:'Eligible orders per month',scenarioKind:'count'
    },
    fasttrack: {
      name:'Airport fast track',title:'What is the shorter queue worth to you?',
      intro:'Compare the fee with your personal value of the time saved. Queue times are estimates, and a priority lane can still have a wait.',
      fields:[field('fee','Fast track price per paying person','money',12),field('people','People paying and saving time','people',2),field('normal','Expected normal queue','minutes',35),field('fast','Expected fast track queue','minutes',10),field('hourValue','Value of an hour per person','money',20,'This is how much the time is worth to you, not necessarily your hourly wage.')],
      label:'Time value minus the fast track fee',positive:'Your time valuation exceeds the fee',negative:'The fee exceeds your time valuation',even:'About break even',
      metrics:[['Total fee','totalFee','money'],['Minutes saved per person','minutesSaved','minutes'],['Total person minutes saved','personMinutes','minutes'],['Personal value of the time saved','timeValue','money'],['Minutes per person needed to break even','breakMinutes','minutes'],['Break even value of an hour per person','breakHourly','money']],
      assumption:'Time value is not a cash saving. Both queue estimates must cover the same stage of the airport journey. Travellers can value time differently; this model assumes the same fee, wait and time value for everyone counted.',
      formula:'Net personal value = people × ((normal wait − fast track wait) ÷ 60 × hourly time value − price per person).',
      source:'https://www.heathrow.com/at-the-airport/airport-services/fast track',sourceLabel:'Example airport fast track information (Heathrow)',sourceNote:'Check your own airport’s price, eligibility, opening times and booking conditions. This calculator does not predict queues.',
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
    if(id==='seats'&&values.paidSeats>values.people)errors.paidSeats='Paid seats cannot exceed the party size.';
    if(id==='wifi'&&values.sea+values.port>values.billed)errors.sea='Useful days cannot exceed billed days.';
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
      if(requiredChance>100)r.notes.push('The break even chance exceeds 100%, so this bump cannot pay back within this time window at this margin.');
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
    } else if(id==='seats') {
      const totalFee=v.paidSeats*v.legs*v.fee,benefit=(v.before-v.after)/100*v.splitValue*v.legs;
      r={net:benefit-totalFee,totalFee,benefit,breakFee:v.paidSeats&&v.legs&&benefit>=0?benefit/(v.paidSeats*v.legs):null,requiredLift:totalFee===0?0:v.splitValue>0?v.paidSeats*v.fee/v.splitValue*100:null,notes:[]};
      if(v.people===1){r.benefit=0;r.net=-totalFee;r.breakFee=v.paidSeats&&v.legs?0:null;r.requiredLift=totalFee?null:0;r.notes.push('A solo traveller cannot be split from their party. Seat preference itself is outside this calculation.');}
      if(v.child==='yes')r.notes.push('Confirm an adult will sit beside the child. Check free family seating first; a probability calculation cannot replace that arrangement.');
      if(r.requiredLift!==null&&r.requiredLift>100-v.after)r.notes.push('The reduction needed exceeds the possible probability range. These fees cannot break even under this valuation.');
    } else if(id==='bags') {
      const units=v.bags*v.legs,checked=units*v.fee,allocated=v.purchase/v.trips,gate=units*v.risk/100*v.gateFee,cabin=units*v.cabinFee+allocated+gate,timeValue=(v.checkedMinutes-v.cabinMinutes)*v.legs/60*v.hourValue;
      r={net:checked-cabin+timeValue,checked,allocated,gate,cabin,cashSaved:checked-cabin,timeValue,breakFee:units?Math.max(0,(cabin-timeValue)/units):null,breakRisk:units&&v.gateFee?(checked-units*v.cabinFee-allocated+timeValue)/(units*v.gateFee)*100:null,notes:[]};
      if(r.breakRisk!==null&&(r.breakRisk<0||r.breakRisk>100))r.notes.push(r.breakRisk<0?'Carry on is more costly even with no gate check.':'Carry on stays favourable even with a 100% gate check rate under these assumptions.');
    } else if(id==='wifi') {
      const cost=v.fee*v.billed*v.devices,useful=v.sea+v.port,benefit=useful*v.value,shared=v.fee*v.billed;
      r={net:benefit-cost,cost,useful,benefit,shared,sharingSaving:cost-shared,perDay:useful?cost/useful:null,perPerson:cost/v.people,breakDays:threshold(cost,v.value),notes:[]};
      if(r.breakDays!==null&&r.breakDays>v.billed)r.notes.push('The required useful days exceed the billed period. Even daily use does not cover this package at your valuation.');
      if(v.use==='calls')r.notes.push('Check streaming, calls and VPN support before buying. A cheaper messaging plan may not do the job, and work calls may still be unreliable.');
      if(v.people>1&&v.devices===1)r.notes.push('This is the shared connection case: everyone takes turns. Confirm the plan permits your intended use.');
    } else if(id==='parking') {
      const used=Math.min(v.days,v.covered),dailyTotal=v.days*(v.daily+v.driving),passTotal=v.pass+used*v.residual+(v.days-used)*v.daily+v.days*v.driving,alternativeTotal=v.days*v.alternative,needed=threshold(v.pass,v.daily-v.residual);
      r={net:dailyTotal-passTotal,dailyTotal,passTotal,alternativeTotal,alternativeSaving:alternativeTotal-passTotal,breakDays:needed===null||needed>v.covered?null:needed,notes:[]};
      if(r.breakDays===null)r.notes.push('The pass cannot recover its price within the covered days you entered.');
      if(alternativeTotal<Math.min(dailyTotal,passTotal))r.notes.push('Your shuttle or rideshare estimate is cheaper than either parking option.');
    } else {
      const minutesSaved=v.normal-v.fast,totalFee=v.fee*v.people,personMinutes=minutesSaved*v.people,timeValue=personMinutes/60*v.hourValue;
      r={net:timeValue-totalFee,totalFee,minutesSaved,personMinutes,timeValue,breakMinutes:v.fee===0?0:v.hourValue>0?v.fee/v.hourValue*60:null,breakHourly:v.fee===0?0:minutesSaved>0?v.fee/minutesSaved*60:null,notes:[]};
      if(minutesSaved<=0)r.notes.push('Your fast track estimate saves no time. There is no time benefit to offset a positive fee.');
    }
    // Avoid showing negative zero or a verdict that contradicts the rounded money result.
    r.direction=Math.abs(r.net)<.005?'even':r.net>0?'positive':'negative';
    return r;
  }
  function scenarios(id, raw) {
    const d=calculators[id], {values,errors}=validate(id,raw);if(Object.keys(errors).length)return [];
    const key=d.scenarioKey, n=values[key],max=d.fields.find(f=>f.key===key).max;
    const candidates=d.scenarioKind==='percent'?[Math.max(0,n-25),n,Math.min(100,n+25)]:d.scenarioKind==='minutes'?[Math.max(0,n-15),n,Math.min(max,n+15)]:[Math.floor(n/2),n,Math.min(max,n+Math.max(4,n))];
    if(id==='wifi')candidates.push(Math.max(0,values.billed-values.port));
    return [...new Set(candidates)].filter(value=>!Object.keys(validate(id,{...values,[key]:value}).errors).length).sort((a,b)=>a-b).map(value=>({value,current:value===n,net:calculate(id,{...values,[key]:value}).net}));
  }
  const api={calculators,validate,calculate,scenarios};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.WorthCore=api;
})(typeof globalThis!=='undefined'?globalThis:this);
