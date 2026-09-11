import { test } from "node:test";
import assert from "node:assert/strict";
import { buildDossier } from "./dossier.js";
test("dossier preserves unavailable and stale evidence rather than inventing a cause", () => {
  const text = buildDossier(
    { symbol: "TEST", name: "Test", query: "Test", unit: "USD" },
    { status: "unavailable" },
    { status: "stale", retrievedAt: "2026-09-10", articles: [] },
    "No curated footprint.",
    "2026-09-11",
  );
  assert.match(text, /Price: Unavailable/);
  assert.match(text, /Feed status: stale/);
  assert.match(text, /No headlines available/);
  assert.match(text, /No curated footprint/);
  assert.match(text, /cause cannot be established/);
});
