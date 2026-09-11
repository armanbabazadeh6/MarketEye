import { test } from "node:test";
import assert from "node:assert/strict";
import { MarketClient } from "./client.js";
test("client retains last-good data with original timestamp through network failure", async () => {
  let fail = false,
    calls = 0,
    now = 0;
  const client = new MarketClient({
    now: () => now,
    fetcher: async () => {
      calls++;
      if (fail) throw Error("offline");
      return {
        ok: true,
        json: async () => ({
          status: "ready",
          price: 10,
          retrievedAt: "2026-09-11",
        }),
      };
    },
  });
  const params = { kind: "quote", symbol: "TEST" };
  await Promise.all([client.request(params), client.request(params)]);
  assert.equal(calls, 1);
  fail = true;
  const stale = await client.request(params);
  assert.equal(stale.status, "stale");
  assert.equal(stale.price, 10);
  assert.equal(stale.retrievedAt, "2026-09-11");
  now = 86400001;
  assert.equal((await client.request(params)).status, "unavailable");
});
test("a never-successful client reports unavailable instead of invented prices", async () => {
  const client = new MarketClient({
    fetcher: async () => {
      throw Error("offline");
    },
  });
  const result = await client.request({ kind: "quote", symbol: "TEST" });
  assert.equal(result.status, "unavailable");
  assert.equal(result.price, undefined);
});
