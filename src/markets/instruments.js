export const instruments = [
  {symbol:'SPY',name:'S&P 500 ETF',group:'Indices',query:'S&P 500 stock market',unit:'USD',channel:'macro'},
  {symbol:'QQQ',name:'Nasdaq 100 ETF',group:'Indices',query:'Nasdaq technology stocks',unit:'USD',channel:'macro'},
  {symbol:'DIA',name:'Dow Jones ETF',group:'Indices',query:'Dow Jones stock market',unit:'USD',channel:'macro'},
  {symbol:'^VIX',name:'CBOE Volatility',group:'Indices',query:'VIX market volatility',unit:'index',channel:'macro'},
  ...[['NVDA','NVIDIA'],['AAPL','Apple'],['TSLA','Tesla'],['MSFT','Microsoft'],['AMZN','Amazon'],['GOOGL','Alphabet'],['META','Meta Platforms'],['AMD','AMD'],['TSM','TSMC']].map(([symbol,name])=>({symbol,name,group:'Equities',query:`${name} stock earnings supply chain`,unit:'USD',channel:'technology'})),
  {symbol:'CL=F',name:'WTI crude oil',group:'Energy',query:'crude oil prices supply OPEC',unit:'USD / barrel',channel:'oil'},
  {symbol:'BZ=F',name:'Brent crude oil',group:'Energy',query:'Brent oil prices shipping Hormuz',unit:'USD / barrel',channel:'oil'},
  {symbol:'RB=F',name:'RBOB gasoline',group:'Energy',query:'gasoline prices refinery outage',unit:'USD / gallon',channel:'gasoline'},
  {symbol:'NG=F',name:'Natural gas',group:'Energy',query:'natural gas prices LNG storage',unit:'USD / MMBtu',channel:'gas'},
  {symbol:'XOM',name:'Exxon Mobil',group:'Energy',query:'Exxon Mobil refinery production',unit:'USD',channel:'oil'},
  {symbol:'CVX',name:'Chevron',group:'Energy',query:'Chevron oil production',unit:'USD',channel:'oil'},
  {symbol:'VLO',name:'Valero Energy',group:'Energy',query:'Valero refinery outage gasoline',unit:'USD',channel:'gasoline'},
  {symbol:'DAL',name:'Delta Air Lines',group:'Transport',query:'Delta Air Lines flight disruption fuel costs',unit:'USD',channel:'transport'},
  {symbol:'FDX',name:'FedEx',group:'Transport',query:'FedEx logistics shipping disruption',unit:'USD',channel:'transport'},
  {symbol:'GC=F',name:'Gold futures',group:'Macro',query:'gold prices interest rates dollar',unit:'USD / troy oz',channel:'macro'},
  {symbol:'BTC-USD',name:'Bitcoin',group:'Macro',query:'bitcoin prices cryptocurrency',unit:'USD',channel:'macro'},
];
export const defaultWatchlist=['SPY','QQQ','NVDA','AAPL','TSLA','CL=F','RB=F','NG=F','XOM','GC=F'];
export function resolveInstrument(value){const q=value.trim().toUpperCase();return instruments.find(i=>i.symbol===q||i.name.toUpperCase()===q)||(/^[A-Z0-9^][A-Z0-9.^=-]{0,14}$/.test(q)?{symbol:q,name:q,group:'Equities',unit:'USD',query:`${q} stock`,channel:'general'}:null);}
export const topics={markets:'stock market economy when:2d',energy:'oil gasoline natural gas refinery prices when:3d',incidents:'refinery port factory airport (fire OR explosion OR shutdown OR closed OR outage OR accident) when:7d',technology:'semiconductor technology earnings supply chain when:3d'};
