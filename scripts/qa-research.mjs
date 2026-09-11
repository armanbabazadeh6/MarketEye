import puppeteer from 'puppeteer';
import assert from 'node:assert/strict';
const browser=await puppeteer.launch({headless:true});
try{
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.setViewport({width:1512,height:982});
 await page.goto(process.env.MARKETEYE_QA_URL||'http://127.0.0.1:4173/',{waitUntil:'domcontentloaded'});await page.waitForSelector('.news-row',{timeout:60000});
 await page.click('.news-row');await page.type('#story-note','Verify the original operator notice before interpreting disruption.');await page.click('#save-story-note');assert.match(await page.$eval('#note-state',e=>e.textContent),/Saved/);
 await page.click('#wire-save-query');assert.equal(await page.$$eval('#saved-searches>span',e=>e.length),1);
 await page.click('#wire-saved');assert.equal(await page.$$eval('.news-row',e=>e.length),1);
 await page.type('#wire-filter','impossible-search-term');assert.equal(await page.$$eval('.news-row',e=>e.length),0);
 await page.$eval('#wire-filter',e=>{e.value='';e.dispatchEvent(new Event('input',{bubbles:true}));});
 await page.reload({waitUntil:'domcontentloaded'});await page.waitForSelector('#wire-saved');await page.click('#wire-saved');await page.waitForSelector('.news-row');await page.click('.news-row');assert.match(await page.$eval('#story-note',e=>e.value),/operator notice/);
 const command=async text=>{await page.$eval('#market-query',(e,value)=>e.value=value,text);await page.click('#market-command button');};
 await command('COMPARE NVDA AAPL TSLA');await page.waitForSelector('#compare-result svg',{timeout:60000});assert.equal(await page.$$eval('.comparison-legend span',e=>e.length),3);await page.screenshot({path:'docs/images/market-monitor.png'});
 await page.click('[data-sort="changePercent"]');await page.click('[data-sort="changePercent"]');assert.ok(await page.$$eval('#monitor-quotes tr',e=>e.length)>5);
 await command('STATUS');assert.match(await page.$eval('#terminal-utility',e=>e.textContent),/Google News RSS/);
 await command('HELP');assert.match(await page.$eval('#terminal-utility',e=>e.textContent),/COMMAND REFERENCE/);
 await command('BOOK');await page.waitForSelector('.news-row');await page.click('.news-row');await page.screenshot({path:'docs/images/research-notebook.png'});
 await page.setViewport({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1));
 assert.equal(errors.length,0,errors.join('\n'));console.log('PASS: saved stories, notes, filters, reload persistence, saved search, comparison, sort, source health, commands and mobile.');
}finally{await browser.close();}
