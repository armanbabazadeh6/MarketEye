import {test} from 'node:test';import assert from 'node:assert/strict';import {Readable} from 'node:stream';
import {analystProxy} from '../../server/analystProxy.js';
function endpoint(options){let handler;analystProxy(options).configureServer({middlewares:{use:(_path,h)=>handler=h}});return async(method,payload,origin='http://localhost:4173')=>{const req=Readable.from([JSON.stringify(payload)]);req.method=method;req.headers={origin,host:'localhost:4173'};let status,body;await handler(req,{writeHead:s=>status=s,end:b=>body=JSON.parse(b)});return {status,body};};}
test('AI endpoint is keyless-safe and denies cross-origin execution',async()=>{
 const call=endpoint({env:{}});assert.deepEqual(await call('GET',{}),{status:200,body:{available:false}});assert.equal((await call('POST',{})).status,503);assert.equal((await call('POST',{},'https://evil.example')).status,403);
});
test('AI endpoint validates requests and returns bounded tool calls without exposing keys',async()=>{
 let request;const call=endpoint({env:{OPENAI_API_KEY:'test-only-key',MARKETEYE_ANALYST_MODEL:'test-model'},fetcher:async(_url,init)=>{request=JSON.parse(init.body);return {ok:true,json:async()=>({output:[{type:'function_call',name:'showCompanyAssets',arguments:'{"ticker":"NVDA"}'}]})};}});
 assert.equal((await call('POST',{question:'x',ticker:'NOPE'})).status,400);
 const result=await call('POST',{question:'Show me',ticker:'NVDA'});assert.equal(result.status,200);assert.equal(result.body.name,'showCompanyAssets');assert.equal(request.store,false);assert.equal(request.tool_choice,'required');assert.ok(!JSON.stringify(result).includes('test-only-key'));
});
