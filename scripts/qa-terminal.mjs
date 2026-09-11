import puppeteer from "puppeteer";
import assert from "node:assert/strict";
const browser = await puppeteer.launch({ headless: true });
try {
  const page = await browser.newPage(),
    errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.setViewport({ width: 1512, height: 982 });
  await page.goto(process.env.MARKETEYE_QA_URL || "http://127.0.0.1:4173/", {
    waitUntil: "domcontentloaded",
  });
  await page.waitForFunction(
    () =>
      ["READY", "CACHED"].includes(
        document.querySelector("#quote-state")?.textContent,
      ),
    { timeout: 60000 },
  );
  await page.waitForSelector("#price-chart svg", { timeout: 60000 });
  await page.waitForSelector(".news-row", { timeout: 60000 });
  console.log(
    "Quote:",
    await page.$eval("#security-heading", (e) => e.innerText),
  );
  await page.screenshot({ path: "docs/images/terminal.png" });
  await page.type("#market-query", "why is gas up");
  await page.keyboard.press("Enter");
  await page.waitForFunction(
    () => document.querySelector(".security-code").textContent === "RB=F",
  );
  await page.waitForFunction(
    () =>
      ["READY", "CACHED"].includes(
        document.querySelector("#news-state").textContent,
      ),
    { timeout: 60000 },
  );
  assert.match(
    await page.$eval("#market-drivers", (e) => e.textContent),
    /not the price at your local pump/,
  );
  await page.click('[data-range="1mo"]');
  await page.waitForSelector("#price-chart svg", { timeout: 60000 });
  await page.click(".news-row");
  assert.ok(await page.$(".article-detail a"));
  await page.screenshot({ path: "docs/images/energy-terminal.png" });
  await page.click('[data-desk="globe"]');
  assert.equal(await page.$eval("#market-terminal", (e) => e.hidden), true);
  await page.click('[data-desk="markets"]');
  await page.setViewport({ width: 390, height: 844 });
  await page.screenshot({
    path: "docs/images/terminal-mobile.png",
    fullPage: true,
  });
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth + 1,
    ),
    "Mobile must not overflow horizontally",
  );
  await page.setRequestInterception(true);
  page.on("request", (r) =>
    r.url().includes("/api/marketeye/market") ? r.abort() : r.continue(),
  );
  await page.click("#market-refresh");
  await page.waitForFunction(
    () => document.querySelector("#news-state").textContent === "UNAVAILABLE",
    { timeout: 30000 },
  );
  assert.equal(errors.length, 0, errors.join("\n"));
  console.log(
    "PASS: real quotes, chart, news, gasoline research, article, globe, mobile, outage.",
  );
} finally {
  await browser.close();
}
