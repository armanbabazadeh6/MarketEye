import {test} from 'node:test';import assert from 'node:assert/strict';
import {WorldEventProvider} from './worldEvents.js';
test('provider caches, retries, retains stale snapshots and coalesces requests',async()=>{
 let calls=0,fail=false,now=1000000;
 const p=new WorldEventProvider({now:()=>now,fetcher:async()=>{calls++;if(fail)throw Error('offline');return {ok:true,json:async()=>({records:[1]})};}});
 const norm=d=>d.records;
 const [a,b]=await Promise.all([p.load('x','/x',norm),p.load('x','/x',norm)]);assert.equal(calls,1);assert.deepEqual(a,b);
 assert.equal((await p.load('x','/x',norm)).status,'cached');assert.equal(calls,1);
 now+=400000;fail=true;const stale=await p.load('x','/x',norm);assert.equal(stale.status,'stale');assert.deepEqual(stale.events,[1]);assert.equal(calls,3);
 const missing=await p.load('y','/y',norm);assert.equal(missing.status,'unavailable');assert.deepEqual(missing.events,[]);
});
