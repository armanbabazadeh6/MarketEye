import {
  ResearchStore,
  filterStories,
  researchMarkdown,
} from "../research/store.js";
import { classifyHeadline } from "../markets/drivers.js";
const esc = (v) =>
  String(v ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const stamp = (v) =>
  v
    ? new Date(v).toLocaleString([], {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "Undated";
const queryLabel = (q) =>
  q === "@official-alerts" ? "NWS active US alerts / Severe and Extreme" : q;
export function downloadFile(name, content, type = "text/plain") {
  const url = URL.createObjectURL(new Blob([content], { type })),
    a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export class Newsroom {
  constructor({ onSelect, onSearch, onStatus }) {
    this.onSelect = onSelect;
    this.onSearch = onSearch;
    this.onStatus = onStatus;
    let storage;
    try {
      storage = localStorage;
    } catch {
      storage = {
        getItem() {
          throw Error("Browser storage unavailable");
        },
        setItem() {
          throw Error("Browser storage unavailable");
        },
      };
    }
    this.store = new ResearchStore(storage);
    this.news = { articles: [] };
    this.saved = false;
    this.selected = null;
    this.filters = { text: "", source: "", hours: 0 };
    this.visible = [];
    this.drafts = new Map();
    const controls = document.createElement("div");
    controls.className = "wire-tools";
    controls.innerHTML = `<div class="wire-filter-line"><input id="wire-filter" placeholder="Filter headlines / notes" aria-label="Filter headlines"><select id="wire-source" aria-label="Filter publisher"><option value="">All publishers</option></select><select id="wire-age" aria-label="Headline age"><option value="0">All returned</option><option value="24">24 hours</option><option value="72">3 days</option><option value="168">7 days</option></select></div><div class="wire-actions"><button id="wire-saved">Saved stories (0)</button><button id="wire-save-query">+ Save search</button><button id="wire-export">Export MD</button><button id="wire-backup">Backup JSON</button><button id="wire-import">Import</button><input id="wire-import-file" type="file" accept="application/json,.json" hidden><span id="wire-count"></span></div><div id="saved-searches"></div>`;
    document.getElementById("wire-query").after(controls);
    const $ = (id) => document.getElementById(id);
    $("wire-filter").oninput = (e) => {
      this.filters.text = e.target.value;
      this.render();
    };
    $("wire-source").onchange = (e) => {
      this.filters.source = e.target.value;
      this.render();
    };
    $("wire-age").onchange = (e) => {
      this.filters.hours = Number(e.target.value);
      this.render();
    };
    $("wire-saved").onclick = () => {
      this.saved = !this.saved;
      this.filters.source = "";
      this.renderSources();
      this.render();
    };
    $("wire-save-query").onclick = () =>
      this.act(() => this.store.saveSearch(this.news.query));
    $("wire-export").onclick = () =>
      downloadFile(
        "marketeye-research.md",
        researchMarkdown(
          this.visible,
          this.saved ? "Saved stories" : this.news.query,
        ),
        "text/markdown",
      );
    $("wire-backup").onclick = () =>
      downloadFile(
        "marketeye-research.json",
        this.store.export(),
        "application/json",
      );
    $("wire-import").onclick = () => $("wire-import-file").click();
    $("wire-import-file").onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        if (file.size > 2000000) throw Error("Maximum import size: 2 MB");
        this.store.import(await file.text());
        this.renderSources();
        this.render();
        onStatus("Research imported and merged with your local library.");
      } catch (error) {
        onStatus(error.message);
      } finally {
        e.target.value = "";
      }
    };
    $("saved-searches").onclick = (e) => {
      const b = e.target.closest("[data-search-index]");
      if (b)
        this.onSearch(this.store.data.searches[Number(b.dataset.searchIndex)]);
      const remove = e.target.closest("[data-remove-search]");
      if (remove)
        this.act(() =>
          this.store.removeSearch(
            this.store.data.searches[Number(remove.dataset.removeSearch)],
          ),
        );
    };
    $("news-wire").onclick = (e) => {
      const open = e.target.closest("[data-story-index]"),
        save = e.target.closest("[data-save-story]");
      if (open) {
        this.selected = this.visible[Number(open.dataset.storyIndex)];
        this.onSelect(this.selected);
        this.render();
      }
      if (save) {
        const story = this.visible[Number(save.dataset.saveStory)],
          exists = this.store.data.stories.some((s) => s.url === story.url);
        this.act(() =>
          exists ? this.store.remove(story.url) : this.store.save(story),
        );
      }
    };
    $("news-wire").onkeydown = (e) => {
      if (!["ArrowDown", "ArrowUp"].includes(e.key)) return;
      const rows = [...$("news-wire").querySelectorAll("[data-story-index]")],
        i = rows.indexOf(document.activeElement);
      if (i < 0) return;
      e.preventDefault();
      rows[
        Math.max(
          0,
          Math.min(rows.length - 1, i + (e.key === "ArrowDown" ? 1 : -1)),
        )
      ]?.focus();
    };
    if (this.store.error) onStatus(this.store.error);
  }
  act(fn) {
    try {
      fn();
      this.render();
    } catch (e) {
      this.onStatus("Could not save research: " + e.message);
    }
  }
  update(news, selected) {
    this.news = news;
    this.selected = selected;
    this.renderSources();
    this.render();
  }
  renderSources() {
    const rows = this.saved
        ? this.store.data.stories
        : this.news.articles || [],
      sources = [...new Set(rows.map((s) => s.domain))].sort();
    if (!sources.includes(this.filters.source)) this.filters.source = "";
    document.getElementById("wire-source").innerHTML =
      '<option value="">All publishers</option>' +
      sources
        .map(
          (s) =>
            `<option value="${esc(s)}" ${s === this.filters.source ? "selected" : ""}>${esc(s)}</option>`,
        )
        .join("");
  }
  render() {
    const $ = (id) => document.getElementById(id);
    this.visible = filterStories(
      this.saved ? this.store.data.stories : this.news.articles || [],
      this.filters,
    );
    $("news-state").textContent = this.saved
      ? "LOCAL LIBRARY"
      : (this.news.status || "loading").toUpperCase();
    $("wire-query").textContent = this.saved
      ? "Saved research / stored on this browser"
      : `${queryLabel(this.news.query) || "Loading…"}${this.news.retrievedAt ? " · fetched " + stamp(this.news.retrievedAt) : ""}`;
    $("wire-saved").textContent =
      `${this.saved ? "← Live wire" : "Saved stories"} (${this.store.data.stories.length})`;
    $("wire-saved").classList.toggle("active", this.saved);
    $("wire-count").textContent = `${this.visible.length} STORIES`;
    $("saved-searches").innerHTML = this.store.data.searches
      .map(
        (q, i) =>
          `<span><button data-search-index="${i}" title="${esc(queryLabel(q))}">${esc(queryLabel(q))}</button><button data-remove-search="${i}" aria-label="Remove saved search">×</button></span>`,
      )
      .join("");
    $("news-wire").innerHTML =
      this.visible
        .map((s, i) => {
          const c = classifyHeadline(s),
            saved = this.store.data.stories.some((r) => r.url === s.url);
          return `<div class="wire-entry"><button class="news-row ${s.url === this.selected?.url ? "active" : ""}" data-story-index="${i}"><time>${stamp(s.publishedAt)}</time><div><strong>${esc(s.title)}</strong><small>${esc(s.domain)}${c.channels[0] ? " / " + esc(c.channels[0].label) : ""}${s.note ? " / HAS NOTES" : ""}</small></div></button><button class="story-save ${saved ? "active" : ""}" data-save-story="${i}" aria-label="${saved ? "Remove saved story" : "Save story"}" title="${saved ? "Remove saved story" : "Save story"}">${saved ? "★" : "☆"}</button></div>`;
        })
        .join("") ||
      `<p class="feed-note">${this.news.status === "unavailable" && !this.saved ? "News feed unavailable. Refresh to retry; saved research remains accessible." : this.saved ? "No saved stories match. Use ☆ beside a headline to keep it." : "No headlines match these filters. Broaden the filter or run another search."}</p>`;
  }
  attachNotes(article) {
    if (!article) return;
    const box = document.querySelector(".article-detail");
    if (!box) return;
    const saved = this.store.data.stories.find((s) => s.url === article.url);
    const notes = document.createElement("div");
    notes.className = "research-notes";
    notes.innerHTML = `<label for="story-note">MY RESEARCH NOTES</label><textarea id="story-note" maxlength="6000" placeholder="What is confirmed? What still needs checking?">${esc(this.drafts.get(article.url) ?? saved?.note ?? "")}</textarea><button id="save-story-note">Save story & notes</button><span id="note-state" role="status"></span>`;
    box.append(notes);
    notes.querySelector("textarea").oninput = (e) =>
      this.drafts.set(article.url, e.target.value);
    notes.querySelector("button").onclick = () => {
      try {
        this.store.save(article, notes.querySelector("textarea").value);
        this.drafts.delete(article.url);
        notes.querySelector("#note-state").textContent = "Saved locally";
        this.render();
      } catch (e) {
        notes.querySelector("#note-state").textContent = e.message;
      }
    };
  }
}
