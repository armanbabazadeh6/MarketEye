import puppeteer from 'puppeteer';import assert from 'node:assert/strict';
const browser=await puppeteer.launch({headless:true});
try{
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.setViewport({width:1512,height:982});await page.goto(process.env.MARKETEYE_QA_URL||'http://127.0.0.1:4173/',{waitUntil:'domcontentloaded'});
 await page.waitForSelector('#security-heading h1');const command=async text=>{await page.$eval('#market-query',(e,v)=>e.value=v,text);await page.click('#market-command button');};
 await page.click('[data-topic="US alerts"]');await page.waitForFunction(()=>['READY','CACHED'].includes(document.querySelector('#news-state').textContent),{timeout:45000});
 const count=await page.$$eval('.news-row',rows=>rows.length);console.log('Official NWS alerts:',count);
 if(count){await page.click('.news-row');await page.waitForSelector('.official-alert-details');assert.match(await page.$eval('.official-alert-details',e=>e.textContent),/Certainty/);await page.screenshot({path:'docs/images/official-alerts.png'});}
 await command('NEWS Taiwan semiconductor');await page.waitForFunction(()=>['READY','CACHED'].includes(document.querySelector('#news-state').textContent),{timeout:45000});
 const located=await page.$$eval('.news-row',rows=>rows.findIndex(r=>/taiwan|tsmc/i.test(r.textContent)));
 if(located>=0){await page.click(`.wire-entry:nth-child(${located+1}) .news-row`);await page.waitForSelector('.regional-links');await page.click('#headline-map');assert.equal(await page.$eval('#map-ticker',e=>e.textContent),'NEWS');await page.click('[data-desk="markets"]');}
 await page.evaluate(()=>{const original=URL.createObjectURL.bind(URL);URL.createObjectURL=blob=>{if(blob.type==='text/markdown')blob.text().then(t=>window.lastDossier=t);return original(blob);};});
 await command('BRIEF NVDA');await page.waitForFunction(()=>window.lastDossier?.includes('Geographic evidence'),{timeout:60000});assert.match(await page.evaluate(()=>window.lastDossier),/NVIDIA/);assert.match(await page.evaluate(()=>window.lastDossier),/TSMC/);
 await command('ANALYST Why is NVIDIA exposed to Taiwan?');await page.waitForFunction(()=>document.querySelector('#tab-content')?.textContent.includes('Taiwan'),{timeout:45000});
 await page.click('[data-desk="markets"]');await command('INV AAPL');await page.waitForSelector('#investigation-panel',{timeout:45000});await page.waitForFunction(()=>document.querySelector('#company-head h2').textContent==='Apple');await page.click('#dismiss-investigation');
 assert.equal(errors.length,0,errors.join('\n'));console.log('PASS: official alerts, regional company links, news globe context, combined dossier, analyst and cross-company investigation.');
}finally{await browser.close();}
