import { normalizeUsgs,normalizeWeather,USGS_URL } from '../events/normalize.js';
export class WorldEventProvider {
  constructor({fetcher=(...args)=>globalThis.fetch(...args),now=Date.now}={}){this.fetcher=fetcher;this.now=now;this.cache=new Map();this.inflight=new Map();}
  async load(key,url,normalize,{force=false}={}) {
    const prior=this.cache.get(key);
    if(!force&&prior&&this.now()-prior.retrievedMs<300000)return {...prior,status:prior.status==='stale'?'stale':'cached'};
    if(this.inflight.has(key))return this.inflight.get(key);
    const work=(async()=>{
      let error;
      for(let attempt=0;attempt<2;attempt++)try{
        const response=await this.fetcher(url,{signal:AbortSignal.timeout(10000)});
        if(!response.ok)throw new Error(`HTTP ${response.status}`);
        const payload=await response.json(),events=normalize(payload);
        const retrievedMs=this.now();
        const result={key,events,status:payload.status==='stale'?'stale':'ready',retrievedMs,retrievedAt:new Date(retrievedMs).toISOString(),error:null};
        this.cache.set(key,result);return result;
      }catch(e){error=e.message;}
      return prior?{...prior,status:'stale',error}:{key,events:[],status:'unavailable',retrievedAt:null,error};
    })();
    this.inflight.set(key,work);
    try{return await work;}finally{this.inflight.delete(key);}
  }
  async refresh(company,{force=false}={}) {
    const locations=company.locations.filter(l=>l.relationship!=='context-only');
    const results=await Promise.all([
      this.load('usgs',USGS_URL,normalizeUsgs,{force}),
      ...locations.map(l=>this.load(`weather:${l.id}`,`/api/weather-effects?latitude=${l.latitude}&longitude=${l.longitude}`,p=>[normalizeWeather(p,l)],{force})),
    ]);
    return {sources:results.map(({events,...status})=>status),events:results.flatMap(r=>r.events.map(e=>({...e,stale:e.stale||r.status==='stale'}))),retrievedAt:new Date(this.now()).toISOString()};
  }
}
