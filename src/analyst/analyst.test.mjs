import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {planLocally,executeTool} from './tools.js';import {runInvestigation} from './investigation.js';
import {generateBrief} from './brief.js';import {assessCompany} from '../exposure/engine.js';
const companies=['nvda','aapl','tsla'].map(t=>JSON.parse(fs.readFileSync(new URL(`../../data/companies/${t}.json`,import.meta.url))));
test('show me maps to a real globe tool; unsupported tools and companies fail',async()=>{
 assert.equal(planLocally('Show me','NVDA',companies).name,'showCompanyAssets');assert.equal(planLocally('Show Apple manufacturing','NVDA',companies).arguments.ticker,'AAPL');
 const ctx={companies,snapshot:{events:[],sources:[]},showCompany:async()=>false};
 assert.deepEqual(await executeTool({name:'showCompanyAssets',arguments:{ticker:'NVDA'}},ctx),{success:false});
 await assert.rejects(executeTool({name:'madeUp'},ctx));await assert.rejects(executeTool({name:'getCompanyExposure',arguments:{ticker:'NOPE'}},ctx));
});
test('investigation does not claim cancelled camera moves succeeded',async()=>{
 const states=[];const done=await runInvestigation([{title:'move',location:{}}],{flyTo:async()=>false,onStep:(_i,state)=>states.push(state),signal:new AbortController().signal,pace:0});
 assert.equal(done,false);assert.deepEqual(states,['running','cancelled']);
});
test('investigation abort prevents subsequent steps',async()=>{
 const c=new AbortController();c.abort();let count=0;
 assert.equal(await runInvestigation([{title:'move'}],{flyTo:async()=>true,onStep:()=>count++,signal:c.signal,pace:0}),false);assert.equal(count,0);
});
test('brief marks missing coverage unavailable and includes provenance and unknowns',()=>{
 const b=generateBrief(companies[0],assessCompany(companies[0],[]),{events:[],sources:[]});assert.match(b,/UNAVAILABLE/);assert.match(b,/Unknowns/);assert.match(b,/nvidia.com/);assert.match(b,/Not investment advice/);
});
test('historical replay is explicit in exported briefs',()=>{
 const b=generateBrief(companies[0],assessCompany(companies[0],[]),{events:[],sources:[],mode:'replay'});
 assert.match(b,/HISTORICAL REPLAY/);assert.match(b,/current curated company footprint/);
});
