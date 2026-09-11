import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {distanceKm,freshness,correlateEvent,assessCompany} from './engine.js';
import {validateCompany} from '../companies/validate.js';
import {buildImpactGraph} from '../impact/graph.js';
const nvda=JSON.parse(fs.readFileSync(new URL('../../data/companies/nvda.json',import.meta.url)));
const now=Date.parse('2026-09-11T12:00:00Z');
const event={id:'test-quake',type:'earthquake',title:'Synthetic test earthquake',latitude:24.77,longitude:121.01,severity:1,confidence:1,radiusKm:300,timestamp:new Date(now).toISOString()};
test('haversine handles identical points, antipodes, dateline and invalid coordinates',()=>{
 assert.equal(distanceKm({latitude:0,longitude:0},{latitude:0,longitude:0}),0);
 assert.ok(Math.abs(distanceKm({latitude:0,longitude:0},{latitude:0,longitude:180})-20015.09)<.1);
 assert.ok(distanceKm({latitude:0,longitude:179.9},{latitude:0,longitude:-179.9})<23);
 assert.equal(distanceKm({latitude:100,longitude:0},{latitude:0,longitude:0}),Infinity);
});
test('freshness rejects invalid/future times and halves at 24 hours',()=>{
 assert.equal(freshness('invalid',now),0);assert.equal(freshness(new Date(now+3600000).toISOString(),now),0);
 assert.equal(freshness(new Date(now-86400000).toISOString(),now),.5);
});
test('scoring is bounded, deterministic, decreases with distance and age',()=>{
 const near=correlateEvent(nvda,event,now);assert.equal(near.score,85);assert.deepEqual(near,correlateEvent(nvda,event,now));
 const aged=correlateEvent(nvda,{...event,timestamp:new Date(now-86400000).toISOString()},now);assert.ok(aged.score<near.score);
 const distant=correlateEvent(nvda,{...event,longitude:123},now);assert.ok(distant.score<near.score);
 assert.equal(correlateEvent(nvda,{...event,latitude:-40,longitude:40},now),null);
 assert.ok(near.unknowns.some(s=>s.includes('allocation')));
});
test('context-only infrastructure is excluded and duplicate campuses do not inflate aggregate',()=>{
 const c=structuredClone(nvda);c.locations=c.locations.filter(l=>l.relationship==='context-only');assert.equal(correlateEvent(c,event,now),null);
 const duplicate=structuredClone(nvda);duplicate.locations.push({...duplicate.locations[1],id:'duplicate'});
 assert.equal(assessCompany(nvda,[event],now).score,assessCompany(duplicate,[event,event],now).score);
});
test('every company dataset validates and references resolve',()=>{
 for(const ticker of ['nvda','aapl','tsla'])assert.deepEqual(validateCompany(JSON.parse(fs.readFileSync(new URL(`../../data/companies/${ticker}.json`,import.meta.url)))),[]);
 const bad=structuredClone(nvda);bad.locations[0].sourceUrl='';bad.locations[0].latitude=99;assert.equal(validateCompany(bad).length,2);
});
test('graph edges reference existing nodes, proximity is not causal damage',()=>{
 const graph=buildImpactGraph(nvda,event,correlateEvent(nvda,event,now));
 const ids=new Set(graph.nodes.map(n=>n.id));assert.ok(graph.edges.every(e=>ids.has(e.from)&&ids.has(e.to)));assert.equal(graph.edges[0].type,'near');
 assert.equal(graph.nodes.at(-1).label,'NVIDIA');
});
