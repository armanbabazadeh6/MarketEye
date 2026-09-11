export const RESEARCH_KEY = "marketeye-research-v1";
const clean = (value) => String(value ?? "").trim();
export function validateStory(value) {
  if (!value || typeof value !== "object") throw Error("Invalid story");
  const url = new URL(value.url);
  if (!["http:", "https:"].includes(url.protocol))
    throw Error("Story links must use HTTP or HTTPS");
  const title = clean(value.title).slice(0, 600);
  if (!title) throw Error("A story needs a title");
  return {
    url: url.href,
    title,
    domain: clean(value.domain).slice(0, 160),
    publishedAt: Number.isFinite(Date.parse(value.publishedAt))
      ? new Date(value.publishedAt).toISOString()
      : null,
    savedAt: Number.isFinite(Date.parse(value.savedAt))
      ? new Date(value.savedAt).toISOString()
      : new Date().toISOString(),
    note: clean(value.note).slice(0, 6000),
  };
}
export function parseResearch(text) {
  if (text.length > 2000000) throw Error("Research file exceeds 2 MB");
  const data = JSON.parse(text);
  if (
    data.version !== 1 ||
    !Array.isArray(data.stories) ||
    data.stories.length > 200 ||
    !Array.isArray(data.searches)
  )
    throw Error("Unsupported research file");
  const stories = [
    ...new Map(data.stories.map(validateStory).map((s) => [s.url, s])).values(),
  ];
  const searches = [
    ...new Set(
      data.searches.filter(
        (s) => typeof s === "string" && s.trim() && s.length <= 220,
      ),
    ),
  ].slice(0, 12);
  return { version: 1, stories, searches };
}
export class ResearchStore {
  constructor(storage) {
    this.storage = storage;
    this.data = { version: 1, stories: [], searches: [] };
    this.error = null;
    try {
      const raw = storage.getItem(RESEARCH_KEY);
      if (raw) this.data = parseResearch(raw);
    } catch {
      this.error =
        "Local research could not be loaded. Export a backup before making changes.";
    }
  }
  commit(next) {
    this.storage.setItem(RESEARCH_KEY, JSON.stringify(next));
    this.data = next;
    this.error = null;
  }
  save(story, note) {
    const old = this.data.stories.find((s) => s.url === story.url);
    const value = validateStory({
      ...story,
      savedAt: old?.savedAt,
      note: note ?? old?.note ?? "",
    });
    const stories = this.data.stories.filter((s) => s.url !== value.url);
    if (stories.length >= 200)
      throw Error(
        "Research limit: 200 stories. Export and remove old entries first.",
      );
    this.commit({ ...this.data, stories: [value, ...stories] });
    return value;
  }
  remove(url) {
    this.commit({
      ...this.data,
      stories: this.data.stories.filter((s) => s.url !== url),
    });
  }
  saveSearch(query) {
    const q = clean(query);
    if (!q || q.length > 220)
      throw Error("Search must contain 1–220 characters");
    this.commit({
      ...this.data,
      searches: [q, ...this.data.searches.filter((s) => s !== q)].slice(0, 12),
    });
  }
  removeSearch(query) {
    this.commit({
      ...this.data,
      searches: this.data.searches.filter((s) => s !== query),
    });
  }
  import(text) {
    const incoming = parseResearch(text),
      merged = [
        ...new Map(
          [...this.data.stories, ...incoming.stories].map((s) => [s.url, s]),
        ).values(),
      ];
    if (merged.length > 200)
      throw Error("Combined library exceeds 200 stories");
    this.commit({
      version: 1,
      stories: merged,
      searches: [
        ...new Set([...incoming.searches, ...this.data.searches]),
      ].slice(0, 12),
    });
  }
  export() {
    return JSON.stringify(this.data, null, 2);
  }
}
export function filterStories(
  stories,
  { text = "", source = "", hours = 0 } = {},
  now = Date.now(),
) {
  const q = text.toLowerCase().trim();
  return stories
    .filter(
      (s) =>
        (!q ||
          `${s.title} ${s.domain} ${s.note || ""}`.toLowerCase().includes(q)) &&
        (!source || s.domain === source) &&
        (!hours ||
          (Number.isFinite(Date.parse(s.publishedAt)) &&
            now - Date.parse(s.publishedAt) <= hours * 3600000)),
    )
    .sort(
      (a, b) =>
        Date.parse(b.publishedAt || b.savedAt) -
        Date.parse(a.publishedAt || a.savedAt),
    );
}
export function researchMarkdown(stories, query = "Saved research") {
  return (
    `# MarketEye research\n\nGenerated ${new Date().toISOString()}\n\nQuery: ${query}\n\nHeadlines are reports to verify, not proof of market causation. Notes are user-authored.\n\n` +
    stories
      .map(
        (s) =>
          `## ${s.title.replace(/[\r\n]/g, " ")}\n\nPublisher: ${s.domain}\nPublished: ${s.publishedAt || "Unknown"}\nSource: ${s.url}\n\n${s.note ? "### My notes\n\n" + s.note + "\n\n" : ""}`,
      )
      .join("---\n\n")
  );
}
