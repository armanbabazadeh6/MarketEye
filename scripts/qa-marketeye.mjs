import puppeteer from "puppeteer";
import assert from "node:assert/strict";
import fs from "node:fs";
const url = process.env.MARKETEYE_QA_URL || "http://127.0.0.1:4173/";
const browser = await puppeteer.launch({
  headless: true,
  args: ["--disable-dev-shm-usage"],
});
const errors = [];
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1512, height: 982 });
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(url, { waitUntil: "networkidle2" });
  await page.click('[data-desk="globe"]');
  await page.waitForFunction(
    () => !document.querySelector("#refresh").disabled,
    { timeout: 45000 },
  );
  assert.equal(await page.title(), "MarketEye — Market intelligence terminal");
  assert.equal(
    await page.$eval("#company-head h2", (e) => e.textContent),
    "NVIDIA",
  );
  assert.equal(
    await page.$$(".globe-error").then((x) => x.length),
    0,
    "WebGL globe must initialize",
  );
  console.log(
    "Live source status:",
    await page.$eval("#source-status", (e) => e.title),
  );
  await page.type("#company-search", "Tesla");
  await page.keyboard.press("Enter");
  await page.waitForFunction(
    () => document.querySelector("#company-head h2").textContent === "Tesla",
  );
  await page.type("#company-search", "not-a-company");
  assert.match(
    await page.$eval("#search-results", (e) => e.textContent),
    /No match/,
  );
  await page.keyboard.press("Escape");
  await page.click('[data-company="NVDA"]');
  await page.click("#replay-toggle");
  await page.waitForFunction(() =>
    document.querySelector("#score-badge").textContent.includes("REPLAY"),
  );
  assert.ok(
    Number.parseInt(await page.$eval("#score", (e) => e.textContent)) > 40,
  );
  assert.match(await page.$eval("#impact-chain", (e) => e.textContent), /TSMC/);
  await page.click("[data-event]");
  assert.match(
    await page.$eval("#dialog-content", (e) => e.textContent),
    /Why/,
  );
  await page.keyboard.press("Escape");
  await page.click("#reset-view");
  await page.click('[data-tab="analyst"]');
  await page.click('[data-question="Why Taiwan?"]');
  await page.waitForFunction(() =>
    document
      .querySelector("#chatlog")
      .textContent.includes("getCompanyExposure"),
  );
  assert.match(
    await page.$eval("#chatlog", (e) => e.textContent),
    /HISTORICAL REPLAY/,
  );
  await page.click('[data-question="Show me"]');
  await page.waitForFunction(() =>
    document.querySelector("#chatlog").textContent.includes("footprint shown"),
  );
  await page.click("#investigate");
  await page.waitForFunction(
    () =>
      document.querySelector("#investigation-brief") &&
      !document.querySelector("#investigation-brief").hidden,
    { timeout: 45000 },
  );
  assert.match(
    await page.$eval("#investigation-panel", (e) => e.textContent),
    /Assessment complete/,
  );
  fs.mkdirSync("docs/images", { recursive: true });
  await page.evaluate(() => {
    document.querySelector(".left-rail").scrollTop = 0;
    document.querySelector(".right-rail").scrollTop = 0;
  });
  await page.screenshot({ path: "docs/images/investigation.png" });
  await page.click("#investigation-brief");
  assert.match(
    await page.$eval("#dialog-content", (e) => e.textContent),
    /HISTORICAL REPLAY/,
  );
  await page.keyboard.press("Escape");
  await page.click("#dismiss-investigation");
  await page.click('[data-tab="assets"]');
  await page.click("#reset-view");
  await page.waitForFunction(
    () => document.querySelector("#investigation-panel") === null,
  );
  // Wait for the bounded camera flight before taking the actual historical-replay screenshot.
  await new Promise((r) => setTimeout(r, 2200));
  await page.screenshot({ path: "docs/images/marketeye.png" });
  await page.click("#investigate");
  await page.click('[data-company="AAPL"]');
  await new Promise((r) => setTimeout(r, 2000));
  assert.equal(
    await page.$eval("#company-head h2", (e) => e.textContent),
    "Apple",
  );
  assert.equal(
    await page.$$("#investigation-panel").then((x) => x.length),
    0,
    "Switching companies cancels the tour",
  );
  await page.setViewport({ width: 390, height: 844 });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    true,
    "Mobile layout must not overflow",
  );
  await page.screenshot({ path: "docs/images/mobile.png", fullPage: true });
  // Deliberate total outage must never create an apparently low live risk score.
  await page.setRequestInterception(true);
  page.on("request", (req) =>
    /earthquake\.usgs\.gov|\/api\/weather-effects/.test(req.url())
      ? req.abort()
      : req.continue(),
  );
  await page.reload({ waitUntil: "networkidle2" });
  await page.click('[data-desk="globe"]');
  await page.waitForFunction(
    () => !document.querySelector("#refresh").disabled,
    { timeout: 45000 },
  );
  assert.equal(
    await page.$eval("#score-badge", (e) => e.textContent),
    "UNAVAILABLE",
  );
  assert.match(await page.$eval("#score", (e) => e.textContent), /—/);
  assert.deepEqual(errors, [], "No uncaught browser errors");
  console.log(
    "MarketEye browser QA passed: live sources, search, replay, evidence, analyst actions, tour, cancellation, mobile, outage.",
  );
} finally {
  await browser.close();
}
