import { test } from "node:test";
import assert from "node:assert/strict";
import { parseCommand, compareSeries, sortQuotes } from "./terminalCommands.js";
test("commands validate ticker counts, ranges and geographic coverage", () => {
  assert.deepEqual(parseCommand("COMPARE NVDA AAPL NVDA"), {
    type: "compare",
    symbols: ["NVDA", "AAPL"],
  });
  assert.equal(parseCommand("COMPARE NVDA").type, "error");
  assert.equal(parseCommand("GEO MSFT").type, "error");
  assert.equal(parseCommand("GP NVDA 6mo").range, "6mo");
  assert.equal(parseCommand("GP NVDA 50y").type, "error");
  assert.equal(
    parseCommand("NEWS Houston refinery fire").query,
    "Houston refinery fire",
  );
});
test("comparison starts at common calendar dates rather than different baselines", () => {
  const p = (day, close) => ({
    time: Date.parse("2026-09-" + day + "T12:00:00Z"),
    close,
  });
  const result = compareSeries([
    { symbol: "A", points: [p("01", 50), p("02", 100), p("03", 110)] },
    { symbol: "B", points: [p("02", 200), p("03", 180)] },
  ]);
  assert.equal(result[0].baseline, 100);
  assert.ok(Math.abs(result[0].points[1].returnPercent - 10) < 1e-10);
  assert.ok(Math.abs(result[1].points[1].returnPercent + 10) < 1e-10);
});
test("missing quote values stay at the bottom in both sort directions", () => {
  const rows = [
    { symbol: "A", price: 3 },
    { symbol: "B", price: null },
    { symbol: "C", price: 5 },
  ];
  assert.equal(sortQuotes(rows, "price", -1).at(-1).symbol, "B");
  assert.equal(sortQuotes(rows, "price", 1).at(-1).symbol, "B");
  assert.equal(rows[0].symbol, "A");
});
