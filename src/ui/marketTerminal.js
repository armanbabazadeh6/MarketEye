import {
  instruments,
  defaultWatchlist,
  resolveInstrument,
  topics,
} from "../markets/instruments.js";
import {
  explainMove,
  classifyHeadline,
  routeQuestion,
} from "../markets/drivers.js";
import "./market-terminal.css";
import { Newsroom } from "./newsroom.js";
import { MarketMonitor } from "./marketMonitor.js";
import { parseCommand } from "../markets/terminalCommands.js";
import "./research-terminal.css";
const esc = (v) =>
  String(v ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const num = (v, d = 2) =>
  Number.isFinite(v)
    ? v.toLocaleString("en-US", {
        minimumFractionDigits: d,
        maximumFractionDigits: d,
      })
    : "—";
const pct = (v) =>
  Number.isFinite(v) ? `${v >= 0 ? "+" : ""}${num(v)}%` : "—";
const tone = (q) =>
  q?.changePercent > 0 ? "positive" : q?.changePercent < 0 ? "negative" : "";
const stamp = (v) =>
  v
    ? new Date(v).toLocaleString([], {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "No timestamp";
export function mountMarketTerminal({
  onCompany,
  onLocation,
  getWorldSources = () => [],
}) {
  let watch;
  try {
    watch = JSON.parse(localStorage.getItem("marketeye-watchlist"));
  } catch {}
  watch = Array.isArray(watch)
    ? watch
        .filter((s) => typeof s === "string" && resolveInstrument(s))
        .slice(0, 24)
    : [...defaultWatchlist];
  let selected = resolveInstrument("NVDA"),
    range = "1d",
    quotes = new Map(),
    chart = null,
    news = { articles: [] },
    generation = 0,
    chartGeneration = 0,
    newsGeneration = 0,
    mode = "markets",
    activeArticle = null;
  const root = document.createElement("main");
  root.id = "market-terminal";
  document.querySelector(".workspace").before(root);
  const nav = document.querySelector(".nav-label");
  nav.className = "terminal-nav";
  nav.innerHTML = ["markets", "globe", "news", "energy", "monitor", "status"]
    .map(
      (m, i) => `<button data-desk="${m}"><kbd>F${i + 1}</kbd> ${m}</button>`,
    )
    .join("");
  root.innerHTML = `<div class="terminal-command"><span class="command-prefix">ME &gt;</span><form id="market-command"><input id="market-query" aria-label="Ticker or market question" placeholder="Enter ticker, company, or ask why gas is up…" list="market-symbols" autocomplete="off" maxlength="180"><datalist id="market-symbols">${instruments.map((i) => `<option value="${esc(i.symbol)}">${esc(i.name)}</option>`).join("")}</datalist><button>RUN ↵</button></form><span id="terminal-clock"></span><button id="market-refresh" aria-label="Refresh market data">↻</button></div><div id="market-message" role="status"></div><div id="ticker-tape" class="ticker-tape"></div><div class="terminal-grid"><aside class="terminal-watch terminal-panel"><div class="panel-heading"><span>01 / WATCHLIST</span><span>PX · Δ%</span></div><div id="terminal-watchlist"></div><div class="panel-heading">MARKET UNIVERSE</div><div class="instrument-groups">${[
    "Indices",
    "Equities",
    "Energy",
    "Transport",
    "Macro",
  ]
    .map(
      (group) =>
        `<details ${group === "Energy" ? "open" : ""}><summary>${group}</summary>${instruments
          .filter((i) => i.group === group)
          .map(
            (i) =>
              `<button data-symbol="${esc(i.symbol)}"><b>${esc(i.symbol)}</b><span>${esc(i.name)}</span></button>`,
          )
          .join("")}</details>`,
    )
    .join(
      "",
    )}</div><div class="feed-note">PUBLIC DATA / PERSONAL RESEARCH<br>Quotes may be delayed. Every feed shows its source time.</div></aside><section class="terminal-center"><section class="terminal-panel price-panel"><div class="panel-heading"><span>02 / SECURITY MONITOR</span><span id="quote-state">CONNECTING</span></div><div id="security-heading"></div><div class="chart-toolbar"><span id="chart-caption">PRICE HISTORY</span><div>${["1d", "5d", "1mo", "6mo", "1y"].map((r) => `<button data-range="${r}">${r.toUpperCase()}</button>`).join("")}</div></div><div id="price-chart"></div><div id="quote-facts" class="quote-facts"></div></section><section class="terminal-panel wire-panel"><div class="panel-heading"><span>03 / NEWS WIRE</span><span id="news-state">CONNECTING</span></div><div class="news-controls">${Object.keys(
    topics,
  )
    .map((t) => `<button data-topic="${t}">${t}</button>`)
    .join(
      "",
    )}<button id="security-news">${selected.symbol}</button></div><div id="wire-query"></div><div id="news-wire"></div></section></section><aside class="terminal-panel driver-panel"><div class="panel-heading"><span>04 / EVENT → MARKET</span><span class="amber-text">RESEARCH</span></div><div id="market-drivers"></div></aside></div><div class="terminal-bottom"><span>MARKETEYE / LOCAL TERMINAL</span><span>YAHOO FINANCE · GOOGLE NEWS · PUBLIC WORLD SIGNALS</span><span>INDICATIVE DATA</span></div>`;
  const $ = (id) => document.getElementById(id);
  const message = (t) => ($("market-message").textContent = t);
  const newsroom = new Newsroom({
    onSelect: (article) => {
      activeArticle = article;
      renderDrivers();
    },
    onSearch: (query) => loadNews(query),
    onStatus: message,
  });
  const monitor = new MarketMonitor({
    root,
    api,
    onSelect: (symbol) => {
      desk("markets");
      select(symbol);
    },
    getState: () => ({ quotes, selected }),
    onMessage: message,
  });
  const utility = document.createElement("section");
  utility.id = "terminal-utility";
  utility.hidden = true;
  root.querySelector(".terminal-bottom").before(utility);
  let history = [],
    historyIndex = 0;
  try {
    history = JSON.parse(
      localStorage.getItem("marketeye-command-history") || "[]",
    )
      .filter((s) => typeof s === "string")
      .slice(-40);
  } catch {}
  function showUtility(kind) {
    if (kind === "help") {
      utility.innerHTML = `<div class="panel-heading">COMMAND REFERENCE</div><table class="command-table">${[
        ["NVDA", "Open a security and its news"],
        ["GP NVDA 6mo", "Open a historical chart"],
        ["NEWS Houston refinery fire", "Search recent reporting"],
        ["GEO NVDA", "Open a curated company footprint"],
        ["COMPARE NVDA AAPL TSLA", "Compare daily price returns"],
        ["MON", "Open the quote monitor"],
        ["ENERGY", "Open the energy desk"],
        ["BOOK", "Open saved research"],
        ["STATUS", "Inspect feed health"],
        ["/", "Focus the command line"],
        ["↑ / ↓ in command line", "Recall recent commands"],
        ["F1 – F6", "Switch desks"],
      ]
        .map(([c, d]) => `<tr><th>${c}</th><td>${d}</td></tr>`)
        .join(
          "",
        )}</table><p class="feed-note">News explanations are research leads, not proof of causation. Geographic coverage is curated for NVIDIA, Apple and Tesla. Your research and command history stay in this browser.</p>`;
      return;
    }
    const sources = [
      {
        key: "Market quotes / " + selected.symbol,
        ...quotes.get(selected.symbol),
      },
      { key: "Google News RSS", ...news },
      ...getWorldSources(),
    ];
    utility.innerHTML = `<div class="panel-heading">SOURCE HEALTH / CURRENT SESSION</div><table class="market-table"><thead><tr><th>Provider / coverage</th><th>State</th><th>Retrieved</th><th>Source timestamp</th><th>Details</th></tr></thead><tbody>${sources.map((s) => `<tr><td>${esc(s.key)}</td><td>${esc(s.status || "not loaded")}</td><td>${stamp(s.retrievedAt)}</td><td>${stamp(s.asOf)}</td><td>${esc(s.error || s.coverage || s.dataNotice || "")}</td></tr>`).join("")}</tbody></table><p class="feed-note">Ready/cached means a request succeeded; it does not guarantee real-time data or exhaustive coverage. Stale means a refresh failed and the previous successful snapshot is retained. Quotes cache for 60 seconds, headlines for 180 seconds. Saved research is independent of provider availability.</p>`;
  }
  async function api(params) {
    const response = await fetch(
      "/api/marketeye/market?" + new URLSearchParams(params),
      { signal: AbortSignal.timeout(25000) },
    );
    if (!response.ok) throw Error(`Feed HTTP ${response.status}`);
    return response.json();
  }
  function desk(value) {
    mode = value;
    document.body.classList.toggle("market-mode", value !== "globe");
    root.hidden = value === "globe";
    nav
      .querySelectorAll("button")
      .forEach((b) => b.classList.toggle("active", b.dataset.desk === value));
    root.classList.toggle("news-desk", value === "news");
    root.querySelector(".terminal-grid").hidden = [
      "monitor",
      "status",
      "help",
    ].includes(value);
    monitor.el.hidden = value !== "monitor";
    utility.hidden = !["status", "help"].includes(value);
    if (value === "monitor") monitor.render();
    if (["status", "help"].includes(value)) showUtility(value);
    if (value === "energy") {
      select("CL=F");
      loadNews(topics.energy);
    }
    if (value === "news") loadNews(topics.markets);
    if (value === "globe") window.dispatchEvent(new Event("resize"));
  }
  nav.onclick = (e) => {
    const b = e.target.closest("[data-desk]");
    if (b) desk(b.dataset.desk);
  };
  document.addEventListener("keydown", (e) => {
    if (["F1", "F2", "F3", "F4", "F5", "F6"].includes(e.key)) {
      e.preventDefault();
      desk(
        ["markets", "globe", "news", "energy", "monitor", "status"][
          Number(e.key[1]) - 1
        ],
      );
    }
    if (
      e.key === "/" &&
      !["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement.tagName)
    ) {
      e.preventDefault();
      if (mode === "globe") desk("markets");
      $("market-query").focus();
    }
  });
  function renderWatch() {
    monitor.render();
    if (mode === "status") showUtility("status");
    const row = (s) => {
      const q = quotes.get(s);
      return `<button class="quote-row ${s === selected.symbol ? "selected" : ""}" data-symbol="${esc(s)}"><span><b>${esc(s)}</b><small>${esc(resolveInstrument(s).name)}</small></span><span class="quote-values"><b>${num(q?.price, s === "RB=F" ? 4 : 2)}</b><small class="${tone(q)}">${pct(q?.changePercent)}${q?.status === "stale" ? " · STALE" : ""}</small></span></button>`;
    };
    $("terminal-watchlist").innerHTML =
      watch.map(row).join("") ||
      '<p class="feed-note">Add a security using + Watch.</p>';
    $("ticker-tape").innerHTML = ["SPY", "QQQ", "CL=F", "RB=F", "NG=F", "GC=F"]
      .map(
        (s) =>
          `<button data-symbol="${s}"><b>${s}</b><span>${num(quotes.get(s)?.price)}</span><span class="${tone(quotes.get(s))}">${pct(quotes.get(s)?.changePercent)}</span></button>`,
      )
      .join("");
  }
  function renderSecurity() {
    const q = quotes.get(selected.symbol);
    $("quote-state").textContent = (q?.status || "loading").toUpperCase();
    $("security-heading").innerHTML =
      `<div class="security-title"><div><span class="security-code">${esc(selected.symbol)}</span><h1>${esc(selected.name)}</h1><small>${esc(q?.exchange || selected.group)} / ${esc(q?.currency || selected.unit)}</small></div><button id="pin-security">${watch.includes(selected.symbol) ? "− Unwatch" : "+ Watch"}</button></div><div class="security-price ${tone(q)}">${num(q?.price, selected.symbol === "RB=F" ? 4 : 2)} <span>${pct(q?.changePercent)} <small>vs previous close</small></span></div><div class="quote-timestamp">${esc(q?.session || "Waiting for provider")} · ${stamp(q?.asOf)}${q?.status === "stale" ? " · STALE — REFRESH FAILED" : ""}</div>`;
    $("pin-security").onclick = () => {
      if (watch.includes(selected.symbol))
        watch = watch.filter((s) => s !== selected.symbol);
      else if (watch.length < 24) watch.push(selected.symbol);
      else return message("Watchlist limit: 24 securities. Remove one first.");
      try {
        localStorage.setItem("marketeye-watchlist", JSON.stringify(watch));
      } catch {}
      renderSecurity();
      renderWatch();
    };
    $("quote-facts").innerHTML = [
      ["Previous", num(q?.previousClose)],
      ["Day low", num(q?.low)],
      ["Day high", num(q?.high)],
      [
        "Volume",
        Number.isFinite(q?.volume)
          ? Intl.NumberFormat("en", { notation: "compact" }).format(q.volume)
          : "—",
      ],
    ]
      .map(([k, v]) => `<div><small>${k}</small><b>${v}</b></div>`)
      .join("");
    $("security-news").textContent = selected.symbol;
    renderDrivers();
  }
  function renderChart() {
    root
      .querySelectorAll("[data-range]")
      .forEach((b) => b.classList.toggle("active", b.dataset.range === range));
    const points = chart?.points || [];
    if (points.length < 2) {
      $("price-chart").innerHTML =
        `<div class="chart-empty">${chart?.status === "unavailable" ? "Price history unavailable. Try refresh or another symbol." : "Waiting for price history…"}</div>`;
      return;
    }
    const lo = Math.min(...points.map((p) => p.close)),
      hi = Math.max(...points.map((p) => p.close)),
      spread = hi - lo || hi * 0.01 || 1;
    const xy = points.map((p, i) => [
      12 + (i / (points.length - 1)) * 776,
      20 + ((hi - p.close) / spread) * 155,
    ]);
    const path = xy
      .map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(2)},${y.toFixed(2)}`)
      .join(" ");
    const color =
      points.at(-1).close >= points[0].close ? "#43d9a3" : "#ff6972";
    $("price-chart").innerHTML =
      `<svg viewBox="0 0 800 215" role="img" aria-label="${esc(selected.symbol)} ${range} price chart"><defs><linearGradient id="chart-fill" x1="0" y1="0" x2="0" y2="1"><stop stop-color="${color}" stop-opacity=".23"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></linearGradient></defs>${[20, 72, 124, 176].map((y) => `<path d="M12 ${y}H788" stroke="#263039" stroke-dasharray="3 5"/>`).join("")}<path d="${path} L788,185 L12,185 Z" fill="url(#chart-fill)"/><path d="${path}" fill="none" stroke="${color}" stroke-width="2"/><text x="12" y="207">${esc(stamp(points[0].time))}</text><text x="788" y="207" text-anchor="end">${esc(stamp(points.at(-1).time))}</text></svg><div class="chart-hover" aria-live="polite">${num(lo)} — ${num(hi)} · ${points.length} observations · ${esc(chart.status)}</div>`;
    $("price-chart").onpointermove = (e) => {
      const box = $("price-chart").getBoundingClientRect(),
        i = Math.max(
          0,
          Math.min(
            points.length - 1,
            Math.round(
              ((e.clientX - box.left) / box.width) * (points.length - 1),
            ),
          ),
        );
      $("price-chart").querySelector(".chart-hover").textContent =
        `${stamp(points[i].time)} · ${num(points[i].close, 4)} ${selected.unit}`;
    };
  }
  function renderNews() {
    newsroom.update(news, activeArticle);
  }
  function renderDrivers() {
    const q = quotes.get(selected.symbol),
      d = explainMove(selected, q, news.articles || []),
      article = activeArticle === null ? null : classifyHeadline(activeArticle);
    $("market-drivers").innerHTML =
      `<div class="driver-intro"><span class="eyebrow">OBSERVED PRICE</span><h2>${esc(selected.name)}</h2><p>${esc(d.observed)}</p><span class="research-badge">CAUSATION UNCONFIRMED</span></div>${article ? `<section class="article-detail"><span class="eyebrow">SELECTED REPORT</span><h3>${esc(article.title)}</h3><p>${esc(article.domain)} · ${stamp(article.publishedAt)}</p><a href="${esc(article.url)}" target="_blank" rel="noopener noreferrer">Read publisher report ↗</a>${article.location ? `<button id="headline-map">Locate ${esc(article.location.name)} ↗</button><small>Approximate region inferred from headline.</small>` : ""}</section>` : ""}<div class="driver-content"><span class="eyebrow">POSSIBLE TRANSMISSION CHANNELS</span>${(article ? article.channels : d.channels).map((c) => `<section class="transmission"><h3>${esc(c.label)}</h3><div class="transmission-path">${c.path.map((p) => `<span>${esc(p)}</span>`).join("<i>↓</i>")}</div><p>${esc(c.explanation)}</p><div class="related-symbols">${c.symbols.map((s) => `<button data-symbol="${s}">${s}</button>`).join("")}</div></section>`).join("") || "<p>Select a headline to inspect a possible market connection.</p>"}<p class="evidence-note">${esc(d.conclusion)}</p><p class="evidence-note">${esc(d.caveat)}</p>${selected.symbol === "RB=F" ? `<a href="${d.sourceUrl}" target="_blank" rel="noopener noreferrer">EIA: what determines pump prices ↗</a>` : ""}${["NVDA", "AAPL", "TSLA"].includes(selected.symbol) ? '<button id="company-map" class="map-link">Explore company supply network ↗</button>' : ""}<a class="quote-source" href="https://finance.yahoo.com/quote/${encodeURIComponent(selected.symbol)}/" target="_blank" rel="noopener noreferrer">Quote source: Yahoo Finance ↗</a><p class="evidence-note">Indicative public feed; may be delayed. Headline classification is deterministic research assistance, not verified causation.</p></div>`;
    newsroom.attachNotes(article);
    if ($("company-map"))
      $("company-map").onclick = () => {
        desk("globe");
        onCompany(selected.symbol);
      };
    if ($("headline-map"))
      $("headline-map").onclick = () => {
        desk("globe");
        onLocation(article.location);
      };
  }
  async function loadNews(query) {
    const g = ++newsGeneration;
    activeArticle = null;
    news = { status: "loading", query, articles: [] };
    renderNews();
    renderDrivers();
    try {
      const result = await api({ kind: "news", q: query });
      if (g !== newsGeneration) return;
      news = result;
      news.query = query;
    } catch (e) {
      if (g !== newsGeneration) return;
      news = { status: "unavailable", query, articles: [] };
    }
    renderNews();
    renderDrivers();
  }
  async function loadChart(g = generation) {
    const c = ++chartGeneration;
    chart = null;
    renderChart();
    try {
      const result = await api({
        kind: "quote",
        symbol: selected.symbol,
        range,
      });
      if (g !== generation || c !== chartGeneration) return;
      chart = result;
    } catch {
      if (g !== generation || c !== chartGeneration) return;
      chart = { status: "unavailable" };
    }
    renderChart();
  }
  async function select(symbol) {
    const instrument = resolveInstrument(symbol);
    if (!instrument)
      return message("Enter a valid ticker or a market question.");
    selected = instrument;
    const g = ++generation;
    activeArticle = null;
    renderWatch();
    renderSecurity();
    loadChart(g);
    loadNews(selected.query + " when:3d");
    try {
      const q = await api({ kind: "quote", symbol, range: "1d" });
      quotes.set(symbol, q);
      if (g === generation) {
        renderSecurity();
        renderWatch();
      }
    } catch (e) {
      if (g === generation) {
        quotes.set(symbol, { status: "unavailable" });
        renderSecurity();
        message(e.message);
      }
    }
  }
  async function refreshQuotes() {
    const list = [
      ...new Set([
        ...watch,
        "SPY",
        "QQQ",
        "CL=F",
        "RB=F",
        "NG=F",
        "GC=F",
        selected.symbol,
      ]),
    ];
    let index = 0;
    await Promise.all(
      Array.from({ length: 4 }, async () => {
        while (index < list.length) {
          const s = list[index++];
          try {
            quotes.set(s, await api({ kind: "quote", symbol: s, range: "1d" }));
          } catch {
            quotes.set(s, { status: "unavailable" });
          }
          renderWatch();
          if (s === selected.symbol) renderSecurity();
        }
      }),
    );
  }
  root.addEventListener("click", (e) => {
    const symbol = e.target.closest("[data-symbol]"),
      r = e.target.closest("[data-range]"),
      topic = e.target.closest("[data-topic]"),
      article = e.target.closest("[data-article]");
    if (symbol) select(symbol.dataset.symbol);
    if (r) {
      range = r.dataset.range;
      loadChart();
    }
    if (topic) loadNews(topics[topic.dataset.topic]);
    if (article) {
      activeArticle = news.articles[Number(article.dataset.article)];
      renderNews();
      renderDrivers();
    }
  });
  $("security-news").onclick = () => loadNews(selected.query + " when:3d");
  $("market-command").onsubmit = (e) => {
    e.preventDefault();
    const text = $("market-query").value.trim();
    if (!text) return;
    message("");
    history = [...history.filter((s) => s !== text), text].slice(-40);
    historyIndex = history.length;
    try {
      localStorage.setItem(
        "marketeye-command-history",
        JSON.stringify(history),
      );
    } catch {}
    const command = parseCommand(text);
    if (command.type === "help") {
      desk("help");
      return;
    }
    if (command.type === "error") {
      message(command.message);
      return;
    }
    if (command.type === "desk") {
      desk(command.desk);
      return;
    }
    if (command.type === "saved") {
      desk("news");
      newsroom.saved = true;
      newsroom.renderSources();
      newsroom.render();
      return;
    }
    if (command.type === "news") {
      desk("news");
      newsroom.saved = false;
      loadNews(command.query + " when:7d");
      return;
    }
    if (command.type === "geo") {
      desk("globe");
      onCompany(command.symbol);
      return;
    }
    if (command.type === "compare") {
      desk("monitor");
      monitor.compare(command.symbols);
      return;
    }
    if (command.type === "chart") {
      desk("markets");
      range = command.range;
      select(command.symbol);
      return;
    }
    if (["help", "status", "monitor"].includes(mode)) desk("markets");
    const instrument = resolveInstrument(text);
    if (instrument) select(instrument.symbol);
    else {
      const route = routeQuestion(text);
      if (route.symbol) select(route.symbol);
      loadNews(route.query);
      message(
        `Researching: ${text} · report links are evidence to investigate, not a confirmed explanation.`,
      );
    }
  };
  $("market-query").onkeydown = (e) => {
    if (["ArrowUp", "ArrowDown"].includes(e.key)) {
      e.preventDefault();
      historyIndex = Math.max(
        0,
        Math.min(history.length, historyIndex + (e.key === "ArrowUp" ? -1 : 1)),
      );
      e.target.value = history[historyIndex] || "";
    }
    if (e.key === "Escape") {
      e.target.value = "";
      message("");
    }
  };
  $("market-refresh").onclick = () => {
    refreshQuotes();
    loadChart();
    loadNews(news.query || selected.query + " when:3d");
  };
  setInterval(() => {
    $("terminal-clock").textContent =
      new Date().toLocaleTimeString("en-GB") + " LOCAL";
  }, 1000);
  setInterval(() => {
    if (!document.hidden && mode !== "globe") refreshQuotes();
  }, 60000);
  setInterval(() => {
    if (!document.hidden && mode !== "globe")
      loadNews(news.query || topics.markets);
  }, 180000);
  desk("markets");
  renderWatch();
  select("NVDA");
  refreshQuotes();
}
