import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ResearchStore,
  parseResearch,
  filterStories,
  researchMarkdown,
} from "./store.js";
const story = {
  title: "Refinery operator reports shutdown",
  url: "https://example.com/report",
  domain: "Example",
  publishedAt: "2026-09-11T12:00:00Z",
};
const memory = () => {
  let raw = null;
  return {
    getItem: () => raw,
    setItem: (_, v) => {
      raw = v;
    },
  };
};
test("corrupt research is preserved for backup until an explicit repaired import", () => {
  let raw = "{broken";
  const store = new ResearchStore({
    getItem: () => raw,
    setItem: (_, value) => (raw = value),
  });
  assert.throws(() => store.save(story));
  assert.equal(raw, "{broken");
  assert.equal(store.export(), "{broken");
  store.import(JSON.stringify({ version: 1, stories: [], searches: [] }));
  assert.equal(JSON.parse(raw).version, 1);
});
test("research survives reload and saving a story preserves notes", () => {
  const disk = memory(),
    store = new ResearchStore(disk);
  store.save(story, "Check operator notice");
  store.save(story);
  assert.equal(
    new ResearchStore(disk).data.stories[0].note,
    "Check operator notice",
  );
});
test("failed persistence must not claim to save or mutate the library", () => {
  const store = new ResearchStore({
    getItem: () => null,
    setItem: () => {
      throw Error("quota");
    },
  });
  assert.throws(() => store.save(story));
  assert.equal(store.data.stories.length, 0);
});
test("imports merge by URL, reject executable links, and validate schema", () => {
  const store = new ResearchStore(memory());
  store.save(story);
  store.import(
    JSON.stringify({
      version: 1,
      stories: [{ ...story, note: "Imported note" }],
      searches: ["oil"],
    }),
  );
  assert.equal(store.data.stories.length, 1);
  assert.equal(store.data.stories[0].note, "Imported note");
  assert.throws(() =>
    parseResearch(
      JSON.stringify({
        version: 1,
        stories: [{ ...story, url: "javascript:alert(1)" }],
        searches: [],
      }),
    ),
  );
  assert.throws(() => parseResearch('{"version":2}'));
});
test("news filters use publication time and include research notes", () => {
  const rows = [
    story,
    {
      ...story,
      url: "https://example.com/2",
      title: "Older report",
      publishedAt: "2026-09-01",
      note: "operator",
    },
  ];
  assert.equal(
    filterStories(
      rows,
      { text: "operator", hours: 24 },
      Date.parse("2026-09-11T15:00:00Z"),
    ).length,
    1,
  );
  assert.match(researchMarkdown(rows), /My notes/);
});
