import {test} from 'node:test';import assert from 'node:assert/strict';
import {normalizeUsgs,normalizeWeather} from './normalize.js';
test('USGS adapter preserves source, UTC time and magnitude, rejects bad feeds',()=>{
 const [event]=normalizeUsgs({features:[{id:'us123',geometry:{type:'Point',coordinates:[121,24,10]},properties:{mag:6.5,place:'Taiwan',time:1700000000000}}]});
 assert.equal(event.metadata.magnitude,6.5);assert.equal(event.source,'USGS');assert.equal(event.timestamp,'2023-11-14T22:13:20.000Z');
 assert.throws(()=>normalizeUsgs({features:[{geometry:{coordinates:[Infinity,24]},properties:{mag:5}}]}));
 assert.throws(()=>normalizeUsgs({}));assert.deepEqual(normalizeUsgs({features:[]}),[]);
});
test('normal weather is zero-severity context; severe conditions are model estimates',()=>{
 const location={id:'campus',name:'Campus',latitude:24,longitude:121};
 const payload={weather:{observedAt:'2026-09-11T12:00:00Z',windKph:10,precipitationMm:0,weatherCode:0}};
 assert.equal(normalizeWeather(payload,location).severity,0);
 const severe=normalizeWeather({status:'stale',weather:{...payload.weather,windKph:90}},location);
 assert.equal(severe.severity,.75);assert.equal(severe.evidenceType,'model-estimate');assert.equal(severe.stale,true);
 assert.throws(()=>normalizeWeather({weather:{...payload.weather,windKph:null}},location));
});
