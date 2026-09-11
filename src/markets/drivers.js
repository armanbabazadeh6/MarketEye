// Headline triage, never a claim that correlation proves causation.
const channels=[
 {id:'refining',label:'Refining & fuel supply',pattern:/refiner|gasoline|diesel|fuel shortage/i,path:['Refinery capacity / inventories','Wholesale fuel availability','Fuel costs and refining margins'],symbols:['RB=F','VLO','XOM','DAL'],explanation:'Refining outages can reduce fuel supply. Higher fuel costs can pressure transport margins; refinery effects depend on which facility is affected.'},
 {id:'shipping',label:'Shipping & chokepoints',pattern:/hormuz|suez|red sea|shipping|port\b|tanker|canal/i,path:['Transport route or port constraint','Transit time / delivered supply','Freight and energy costs'],symbols:['CL=F','BZ=F','FDX','XOM'],explanation:'A verified route disruption can delay deliveries or raise freight costs. A headline alone does not establish closure, duration or shipment ownership.'},
 {id:'supply',label:'Energy supply & policy',pattern:/opec|production cut|oil supply|crude|barrel|sanction|pipeline|lng/i,path:['Supply or export policy','Available energy supply','Producer revenue / input costs'],symbols:['CL=F','BZ=F','NG=F','XOM','CVX'],explanation:'Supply changes can affect energy prices. Producers and energy consumers may have different exposures; hedges and demand can offset the effect.'},
 {id:'incident',label:'Operational disruption',pattern:/explosion|fire\b|accident|shutdown|shut down|closure|closed|outage|evacuat|strike/i,path:['Reported operational incident','Facility capacity / service availability','Output, deliveries or costs'],symbols:[],explanation:'Verify the operator’s notice, exact facility, duration and affected production before drawing a market conclusion.'},
 {id:'technology',label:'Technology & manufacturing',pattern:/chip|semiconductor|nvidia|tsmc|apple|tesla|factory|export control|tariff/i,path:['Demand, policy or manufacturing change','Components / production schedules','Company sales and margins'],symbols:['NVDA','TSM','AAPL','TSLA','AMD'],explanation:'Demand and supply-chain developments may affect delivery schedules or margins. Company-specific allocation needs separate evidence.'},
 {id:'macro',label:'Rates, inflation & earnings',pattern:/inflation|interest rate|federal reserve|earnings|profit|revenue|jobs|payroll|dollar/i,path:['Economic release / company results','Expected growth and discount rates','Equity or commodity repricing'],symbols:['SPY','QQQ','GC=F'],explanation:'Markets can respond to surprises relative to expectations. Headlines and price direction alone cannot isolate the driver.'},
];
const places=[{pattern:/hormuz/i,name:'Strait of Hormuz',latitude:26.6,longitude:56.3},{pattern:/suez|red sea/i,name:'Suez / Red Sea region',latitude:29.9,longitude:32.55},{pattern:/taiwan|tsmc|hualien/i,name:'Taiwan',latitude:23.8,longitude:120.8},{pattern:/houston|texas|gulf coast/i,name:'Texas / Gulf Coast context',latitude:29.76,longitude:-95.37},{pattern:/baltimore/i,name:'Baltimore',latitude:39.27,longitude:-76.58},{pattern:/rotterdam/i,name:'Rotterdam',latitude:51.94,longitude:4.14},{pattern:/singapore/i,name:'Singapore',latitude:1.3,longitude:103.8}];
export function classifyHeadline(article){const matches=channels.filter(c=>c.pattern.test(article.title));return {...article,channels:matches,location:places.find(p=>p.pattern.test(article.title))||null,relationship:'Headline-based thematic link; not verified causation'};}
export function explainMove(instrument,quote,articles){
 const change=quote?.changePercent;
 const observed=Number.isFinite(change)?`${instrument.name} is ${change>=0?'up':'down'} ${Math.abs(change).toFixed(2)}% versus the previous session close in the available quote.`:'A reliable session change is not available yet.';
 const evidence=articles.map(classifyHeadline).filter(a=>a.channels.length).slice(0,6);
 const groups=[...new Map(evidence.flatMap(a=>a.channels.map(c=>[c.id,c])).filter(([id])=>instrument.channel!=='gasoline'||['refining','shipping','supply','incident','macro'].includes(id))).values()];
 return {observed,evidence,channels:groups.slice(0,4),conclusion:evidence.length?'These reports are candidates to investigate alongside the price move. Their timing and subject matter do not prove that they caused it.':'No relevant headline evidence was returned. A cause cannot be established from the available data.',
   caveat:instrument.symbol==='RB=F'?'RBOB is a wholesale gasoline futures contract, not the price at your local pump. Retail prices also reflect crude, refining, taxes and distribution.':instrument.group==='Energy'?'Continuous front-month futures can change contract; rollover can affect longer charts. Energy moves do not map one-for-one to stock returns.':'The displayed move is a session comparison. News may refer to a different timeframe.',
   sourceUrl:'https://www.eia.gov/energyexplained/gasoline/factors-affecting-gasoline-prices.php'};
}
export function routeQuestion(text){
 const q=text.toLowerCase();
 if(/natural gas|\blng\b/.test(q))return {symbol:'NG=F',query:'natural gas prices LNG supply storage when:3d'};
 if(/gasoline|\bgas\b|pump|petrol|diesel/.test(q))return {symbol:'RB=F',query:'gasoline prices refinery supply when:3d'};
 if(/oil|crude|opec|hormuz/.test(q))return {symbol:'CL=F',query:text+' when:3d'};
 return {query:text+' when:7d'};
}
