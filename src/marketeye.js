import { companies, searchCompanies } from "./companies/catalog.js";
import { createMarketGlobe } from "./globe/marketGlobe.js";
import { WorldEventProvider } from "./providers/worldEvents.js";
import { assessCompany, severityLabel } from "./exposure/engine.js";
import { buildImpactGraph } from "./impact/graph.js";
import { generateBrief } from "./analyst/brief.js";
import { planLocally, executeTool, summarizeTool } from "./analyst/tools.js";
import {
  planInvestigation,
  runInvestigation,
} from "./analyst/investigation.js";
import { attachContextLayers } from "./globe/contextLayers.js";
import { normalizeUsgs } from "./events/normalize.js";
import taiwanReplay from "../data/events/taiwan-2024.json";
import { registerMarketTools } from "./ui/webmcp.js";
import "./ui/terminal.css";
const $ = (id) => document.getElementById(id);
const esc = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
let selected = companies[0],
  globe = null,
  activeTab = "assets";
const provider = new WorldEventProvider();
let snapshot = { sources: [], events: [] },
  assessment = assessCompany(selected, []),
  requestGeneration = 0;
let investigationController = null,
  investigationSteps = [],
  investigationStatus = "",
  selectedEvent = null;
let aiAvailable = false,
  chatHistory = [],
  chatBusy = false;
let dataMode = "live",
  contextLayers = null;
$("app").innerHTML = `
<header class="app-header"><div class="brand"><img src="/marketeye.svg" alt=""/>Market<span>Eye</span></div><div class="nav-label">Intelligence workspace</div><div class="search"><label class="sr-only" for="company-search">Search company or ticker</label><input id="company-search" placeholder="Search company or ticker…" autocomplete="off"/><div id="search-results" class="search-results"></div></div><div class="header-meta mono">PHYSICAL-WORLD INTELLIGENCE</div></header>
<main class="workspace"><aside class="left-rail" aria-label="Watchlist and signals"><section class="rail-section"><div class="section-title"><span class="eyebrow">Watchlist</span><span class="count">03</span></div><div id="watchlist"></div></section><section class="rail-section"><div class="section-title"><span class="eyebrow">World signals</span><span id="signal-count" class="count">—</span></div><div id="signals"><p class="empty">Connecting to public event sources…</p></div><button id="refresh" class="secondary">↻ Refresh sources</button></section><section class="rail-section"><div class="section-title"><span class="eyebrow">Map layers</span></div><label class="layer"><input type="checkbox" data-layer="assets" checked/> Company footprint</label><label class="layer"><input type="checkbox" data-layer="paths" checked/> Dependency paths</label><label class="layer"><input type="checkbox" data-layer="signals" checked/> World events</label><div id="extra-layers"></div></section><section class="rail-section"><div class="eyebrow">Evidence, before inference</div><p class="empty">Physical proximity identifies potential exposure. It does not confirm disruption.</p><button id="methodology" class="secondary">Scoring & methodology ↗</button></section></aside>
<section class="globe-area" aria-label="Interactive company exposure globe"><div id="cesiumContainer"></div><div class="globe-top"><div class="eyebrow">Global exposure / <span id="map-ticker">NVDA</span></div><h1 id="map-heading">The semiconductor network</h1><small>Explore the physical world behind the company.</small></div><div class="globe-tools"><button id="reset-view">◎ Overview</button><button id="basemap">Satellite / Street</button></div><div class="map-caption"><div class="eyebrow" id="region-caption">Taiwan · Focus region</div><strong id="map-subtitle">A critical link in the compute economy.</strong><div class="legend"><span><i></i> Company / supplier</span><span><i class="amber"></i> World event</span></div></div><section class="impact-dock"><span class="eyebrow">Impact path</span><span id="impact-status" class="impact-status">STRUCTURAL DEPENDENCY</span><div id="impact-chain" class="impact-chain"></div></section><div id="cesium-credits"></div></section>
<aside class="right-rail" aria-label="Company intelligence"><div id="company-head" class="company-head"></div><section class="score-card"><div class="eyebrow">Event-linked exposure</div><div class="score-line"><div class="score" id="score">— <span>/ 100</span></div><span id="score-badge" class="badge">CONNECTING</span></div><div class="meter"><div id="score-meter" style="width:0%"></div></div><p id="score-explanation">Waiting for source coverage. This is a screening score, not a loss forecast.</p></section><section class="rail-section" style="padding-top:0"><div class="eyebrow">Key dependencies</div><div id="dependencies"></div><button id="investigate" class="primary">Investigate exposure ↗</button><button id="export-brief" class="secondary">↓ Export intelligence brief</button></section><div class="tabbar" role="tablist" aria-label="Company details"><button class="active" data-tab="assets" role="tab" aria-selected="true">Assets</button><button data-tab="evidence" role="tab" aria-selected="false">Evidence</button><button data-tab="analyst" role="tab" aria-selected="false">Analyst</button></div><div id="tab-content" class="tab-content" role="tabpanel"></div></aside></main>
<footer class="statusbar"><span><i class="dot"></i>MarketEye</span><span id="source-status">Sources connecting</span><span id="map-status">Globe initializing</span><span>INFORMATIONAL ANALYSIS · NOT INVESTMENT ADVICE</span></footer>
<dialog id="detail-dialog" class="dialog"><header><h2 id="dialog-title"></h2><button id="close-dialog" aria-label="Close dialog">✕</button></header><div id="dialog-content"></div></dialog>`;
function showDialog(title, html) {
  $("dialog-title").textContent = title;
  $("dialog-content").innerHTML = html;
  if (!$("detail-dialog").open) $("detail-dialog").showModal();
}
$("close-dialog").onclick = () => $("detail-dialog").close();
function renderTab() {
  if (activeTab === "analyst") {
    renderAnalyst();
    return;
  }
  $("tab-content").innerHTML =
    activeTab === "assets"
      ? selected.locations
          .map(
            (l) =>
              `<button class="asset-row" data-location="${l.id}"><strong>${esc(l.name)} ↗</strong><small>${esc(l.region)} · ${esc(l.type)} · ${l.relationship === "context-only" ? "Context only" : l.relationship === "supplier-context" ? "Allocation unknown" : "Documented footprint"}</small></button>`,
          )
          .join("")
      : activeTab === "evidence"
        ? `<p class="empty">Reviewed ${selected.reviewedAt}. ${esc(selected.coordinatePolicy)}</p>${[...selected.suppliers, ...selected.locations].map((r) => `<div class="evidence"><p>${esc(r.statement || r.description)}</p><a href="${esc(r.sourceUrl)}" target="_blank" rel="noopener noreferrer">${esc(r.source)} ↗</a></div>`).join("")}<h3>Unknowns</h3>${selected.unknowns.map((u) => `<p class="empty">• ${esc(u)}</p>`).join("")}`
        : "";
  if (activeTab === "evidence") {
    const coverage = document.createElement("section");
    coverage.innerHTML = `<h3>Current evidence coverage</h3>${snapshot.sources.map((s) => `<p class="empty"><strong>${esc(s.key)}</strong> · ${esc(s.status)}<br/>${esc(s.retrievedAt || "No successful retrieval")}${s.error ? `<br/>${esc(s.error)}` : ""}</p>`).join("") || '<p class="empty">Sources are connecting.</p>'}${snapshot.events
      .filter((e) => e.type === "weather")
      .map(
        (e) =>
          `<div class="evidence"><p>${esc(e.title)}<br/>${esc(e.description)}</p><small>${esc(e.timestamp)}${e.stale ? " · STALE" : ""}</small><br/><a href="${esc(e.sourceUrl)}" target="_blank" rel="noopener noreferrer">${esc(e.source)} ↗</a></div>`,
      )
      .join("")}<h3>Curated company evidence</h3>`;
    $("tab-content").prepend(coverage);
  }
  document
    .querySelectorAll("[data-location]")
    .forEach(
      (b) =>
        (b.onclick = () =>
          selectLocation(
            selected.locations.find((l) => l.id === b.dataset.location),
          )),
    );
}
function selectLocation(l) {
  globe?.flyTo(l);
  showDialog(
    l.name,
    `<span class="badge">${esc(l.relationship)}</span><p style="margin-top:16px">${esc(l.description)}</p><p class="muted">Approximate campus / regional coordinates. Evidence confidence: ${Math.round(l.confidence * 100)}%.</p><a href="${esc(l.sourceUrl)}" target="_blank" rel="noopener noreferrer">${esc(l.source)} ↗</a>`,
  );
}
function renderCompany() {
  $("watchlist").innerHTML = companies
    .map(
      (c) =>
        `<button class="watch ${c === selected ? "active" : ""}" data-company="${c.ticker}"><div class="watch-top"><span class="ticker">${c.ticker}</span><span style="color:${c.color}">↗</span></div><small>${c.name} · ${c.sector}</small></button>`,
    )
    .join("");
  document
    .querySelectorAll("[data-company]")
    .forEach((b) => (b.onclick = () => selectCompany(b.dataset.company)));
  $("company-head").innerHTML =
    `<div class="company-badge" style="color:${selected.color}">${selected.ticker.slice(0, 2)}</div><h2>${selected.name}</h2><small class="company-sub mono">${selected.exchange}: ${selected.ticker} / ${selected.sector.toUpperCase()}</small><p class="thesis">${selected.thesis}</p>`;
  $("dependencies").innerHTML = selected.regions
    .map(
      (r) =>
        `<div class="dependency"><strong>${r.name}</strong><small>${r.role}</small><div class="eyebrow">${r.level}</div></div>`,
    )
    .join("");
  $("map-ticker").textContent = selected.ticker;
  $("map-heading").textContent =
    selected.ticker === "TSLA"
      ? "The manufacturing footprint"
      : "The semiconductor network";
  $("region-caption").textContent =
    selected.regions[0].name + " · Focus region";
  $("map-subtitle").textContent =
    selected.ticker === "NVDA"
      ? "A critical link in the compute economy."
      : selected.ticker === "AAPL"
        ? "The geography behind the devices."
        : "Where manufacturing meets the world.";
  $("impact-chain").innerHTML = [
    ["Region", selected.regions[0].name],
    ["Dependency", selected.dependencies[0].name],
    ["Company", selected.name],
  ]
    .map(
      ([type, label]) =>
        `<div class="impact-node"><small>${type}</small>${label}</div>`,
    )
    .join('<span class="arrow">→</span>');
  renderTab();
}
function selectCompany(ticker) {
  cancelInvestigation();
  selected = companies.find((c) => c.ticker === ticker) || selected;
  selectedEvent = null;
  chatHistory = [];
  snapshot = { sources: [], events: [] };
  assessment = assessCompany(selected, []);
  renderCompany();
  renderIntelligence();
  globe?.showCompany(selected);
  globe?.showEvents([]);
  globe?.flyTo(selected.focus);
  $("search-results").innerHTML = "";
  $("company-search").value = "";
  void refreshSources();
}
$("company-search").oninput = (e) => {
  $("search-results").innerHTML =
    searchCompanies(e.target.value)
      .map(
        (c) =>
          `<button data-result="${c.ticker}">${c.ticker} · ${c.name}</button>`,
      )
      .join("") || '<p class="empty">No match. Coverage: NVDA, AAPL, TSLA.</p>';
  document
    .querySelectorAll("[data-result]")
    .forEach((b) => (b.onclick = () => selectCompany(b.dataset.result)));
};
$("company-search").onkeydown = (e) => {
  if (e.key === "Enter") {
    const match = searchCompanies(e.target.value)[0];
    if (match) selectCompany(match.ticker);
  }
  if (e.key === "Escape") $("search-results").innerHTML = "";
};
document.querySelectorAll("[data-tab]").forEach(
  (b) =>
    (b.onclick = () => {
      activeTab = b.dataset.tab;
      document.querySelectorAll("[data-tab]").forEach((t) => {
        t.classList.toggle("active", t === b);
        t.setAttribute("aria-selected", String(t === b));
      });
      renderTab();
    }),
);
document
  .querySelectorAll("[data-layer]")
  .forEach(
    (c) => (c.onchange = () => globe?.toggle(c.dataset.layer, c.checked)),
  );
$("reset-view").onclick = () => globe?.flyTo(selected.focus);
$("basemap").onclick = () =>
  globe?.maps.setStack(
    globe.maps.getState().activeId === "osm" ? "esri-imagery" : "osm",
  );
renderCompany();
try {
  globe = await createMarketGlobe(
    ({ kind, record }) =>
      kind === "location" ? selectLocation(record) : selectEvent(record),
    (message) => ($("map-status").textContent = message),
  );
  globe.showCompany(selected);
  globe.flyTo(selected.focus, 1600000, 0);
} catch (error) {
  $("map-status").textContent = "Globe unavailable";
  const notice = document.createElement("div");
  notice.className = "globe-error";
  notice.textContent = `The globe could not start: ${error.message}. Company evidence remains available. Enable WebGL and reload to explore the map.`;
  document.querySelector(".globe-area").append(notice);
}

function renderPath(event, exposure) {
  const graph = buildImpactGraph(selected, event, exposure);
  if (!graph.nodes.length) {
    $("impact-status").textContent = "STRUCTURAL DEPENDENCY";
    return;
  }
  $("impact-status").textContent = "POTENTIAL EXPOSURE · INFERENCE";
  $("impact-chain").innerHTML = graph.nodes
    .map(
      (n, i) =>
        `<div class="impact-node"><small>${esc(n.type)}</small>${esc(n.label)}</div>${i < graph.nodes.length - 1 ? `<span class="arrow" title="${esc(graph.edges[i].type)}">→</span>` : ""}`,
    )
    .join("");
}
function renderIntelligence() {
  assessment = assessCompany(
    selected,
    snapshot.events,
    snapshot.analysisTime || Date.now(),
  );
  const usable = snapshot.sources.some(
    (s) => s.status === "ready" || s.status === "cached",
  );
  const stale = snapshot.sources.some((s) => s.status === "stale");
  const lead = assessment.exposures[0];
  $("score").innerHTML =
    `${usable || stale ? assessment.score : "—"} <span>/ 100</span>`;
  $("score-badge").textContent =
    dataMode === "replay"
      ? `${severityLabel(assessment.score).toUpperCase()} · REPLAY`
      : usable
        ? severityLabel(assessment.score).toUpperCase()
        : stale
          ? "STALE EVIDENCE"
          : snapshot.sources.length
            ? "UNAVAILABLE"
            : "CONNECTING";
  $("score-meter").style.width = `${usable || stale ? assessment.score : 0}%`;
  $("score-explanation").textContent = lead
    ? `${lead.distanceKm} km from ${lead.rows[0].location.name}. ${snapshot.sources.some((s) => !["ready", "cached"].includes(s.status)) ? "Partial or stale coverage. " : ""}Potential exposure; disruption unconfirmed.`
    : usable
      ? "No event intersects the mapped footprint within screening radii. This does not establish safe operations."
      : "Awaiting usable coverage. Unknown does not mean low risk.";
  const relatedIds = new Set(assessment.exposures.map((e) => e.eventId));
  const ranked = [...snapshot.events].sort(
    (a, b) =>
      Number(relatedIds.has(b.id)) - Number(relatedIds.has(a.id)) ||
      b.severity - a.severity,
  );
  $("signal-count").textContent = String(snapshot.events.length);
  $("signals").innerHTML =
    ranked
      .slice(0, 5)
      .map(
        (e) =>
          `<button class="signal" data-event="${esc(e.id)}"><span class="eyebrow">${e.type} · ${e.stale ? "STALE" : dataMode === "replay" ? "HISTORICAL" : e.evidenceType === "model-estimate" ? "MODEL ESTIMATE" : "OBSERVED"}</span><strong>${esc(e.title)}</strong><small>${e.source} · ${new Date(e.timestamp).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}${relatedIds.has(e.id) ? " · Near footprint" : ""}</small></button>`,
      )
      .join("") ||
    '<p class="empty">No usable events in this snapshot. Check source coverage below.</p>';
  document
    .querySelectorAll("[data-event]")
    .forEach(
      (b) =>
        (b.onclick = () =>
          selectEvent(snapshot.events.find((e) => e.id === b.dataset.event))),
    );
  $("source-status").textContent =
    dataMode === "replay"
      ? "HISTORICAL REPLAY · 03 APR 2024 TAIWAN"
      : snapshot.sources.length
        ? `${snapshot.sources.filter((s) => ["ready", "cached"].includes(s.status)).length}/${snapshot.sources.length} sources available${stale ? " · stale evidence" : ""}`
        : "Sources connecting";
  $("source-status").title = snapshot.sources
    .map((s) => `${s.key}: ${s.status} ${s.retrievedAt || ""} ${s.error || ""}`)
    .join("\n");
  if (lead)
    renderPath(
      snapshot.events.find((e) => e.id === lead.eventId),
      lead,
    );
  else {
    $("impact-status").textContent = "STRUCTURAL DEPENDENCY";
    $("impact-chain").innerHTML = [
      ["Region", selected.regions[0].name],
      ["Dependency", selected.dependencies[0].name],
      ["Company", selected.name],
    ]
      .map(
        ([type, label]) =>
          `<div class="impact-node"><small>${type}</small>${esc(label)}</div>`,
      )
      .join('<span class="arrow">→</span>');
  }
  globe?.showEvents(snapshot.events.filter((e) => e.severity > 0));
  if (activeTab === "evidence") renderTab();
}
async function refreshSources(force = false) {
  const generation = ++requestGeneration,
    company = selected;
  if (dataMode === "replay") {
    const events = normalizeUsgs(taiwanReplay).map((e) => ({
      ...e,
      evidenceType: "historical observation",
    }));
    snapshot = {
      events,
      analysisTime: Date.parse(events[0].timestamp) + 3600000,
      mode: "replay",
      sources: [
        {
          key: "USGS historical archive",
          status: "ready",
          retrievedAt: taiwanReplay.retrievedAt,
        },
      ],
    };
    renderIntelligence();
    $("refresh").disabled = false;
    $("refresh").textContent = "↻ Refresh sources";
    return;
  }
  $("refresh").disabled = true;
  $("refresh").textContent = "Refreshing…";
  try {
    const result = await provider.refresh(company, { force });
    if (generation !== requestGeneration) return;
    snapshot = result;
    renderIntelligence();
  } catch (error) {
    if (generation === requestGeneration)
      $("source-status").textContent = `Sources unavailable: ${error.message}`;
  } finally {
    if (generation === requestGeneration) {
      $("refresh").disabled = false;
      $("refresh").textContent = "↻ Refresh sources";
    }
  }
}
function selectEvent(event) {
  if (!event) return;
  selectedEvent = event;
  cancelInvestigation();
  globe?.flyTo(event);
  const exposure = assessment.exposures.find((e) => e.eventId === event.id);
  if (exposure) {
    renderPath(event, exposure);
    globe?.connect(event, exposure.rows[0].location);
  }
  showDialog(
    event.title,
    `<span class="badge">${esc(event.evidenceType)}${event.stale ? " · STALE" : ""}</span><p style="margin-top:18px">${esc(event.description)}</p><p class="muted">${esc(event.timestamp)} · ${event.radiusKm} km heuristic screening radius</p>${
      exposure
        ? `<h3>Why ${exposure.score} / 100?</h3><p>${esc(exposure.explanation)}</p><div class="factor-grid">${Object.entries(
            exposure.factors,
          )
            .map(
              ([k, v]) =>
                `<div><small>${k}</small><strong>${v.toFixed(2)}</strong></div>`,
            )
            .join(
              "",
            )}</div><h3>Affected asset candidates</h3>${exposure.rows.map((r) => `<p>${esc(r.location.name)} · ${r.distanceKm} km · ${r.score}/100</p>`).join("")}<p class="notice">${exposure.unknowns.map(esc).join(" ")}</p>`
        : "<p>No mapped company asset intersects this event’s screening radius.</p>"
    }<a href="${esc(event.sourceUrl)}" target="_blank" rel="noopener noreferrer">${esc(event.source)} ↗</a>`,
  );
}
function cancelInvestigation() {
  investigationController?.abort();
  investigationController = null;
  globe?.viewer.camera.cancelFlight();
  $("investigation-panel")?.remove();
  $("investigate").textContent = "Investigate exposure ↗";
  $("investigate").onclick = () => void investigate();
}
async function investigate(ticker = selected.ticker) {
  if (ticker !== selected.ticker) selectCompany(ticker);
  if (!globe) {
    showDialog(
      "Globe unavailable",
      "<p>Investigation tours require WebGL. Evidence and brief export remain available.</p>",
    );
    return false;
  }
  cancelInvestigation();
  const controller = new AbortController();
  investigationController = controller;
  // Snapshot evidence once: updates cannot rewrite an investigation mid-tour.
  const company = selected,
    evidence = structuredClone(snapshot),
    analysis = assessCompany(
      company,
      evidence.events,
      evidence.analysisTime || Date.now(),
    );
  investigationSteps = planInvestigation(
    company,
    analysis,
    evidence.events,
    selectedEvent?.id,
  ).map((s) => ({ ...s, status: "pending" }));
  investigationStatus = "Investigation in progress";
  renderInvestigation();
  $("investigate").textContent = "■ Stop investigation";
  $("investigate").onclick = () => {
    cancelInvestigation();
    investigationStatus = "Investigation stopped";
    renderInvestigation();
  };
  const ok = await runInvestigation(investigationSteps, {
    signal: controller.signal,
    flyTo: (location) =>
      globe.flyTo(
        location,
        800000,
        window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 1.5,
      ),
    onStep: (index, status, step) => {
      investigationSteps[index].status = status;
      if (step.event && step.location && step.event.id !== step.location.id)
        globe.connect(step.event, step.location);
      renderInvestigation();
    },
  });
  if (selected === company && investigationController === controller) {
    investigationStatus = ok ? "Assessment complete" : "Investigation stopped";
    renderInvestigation();
    $("investigate").textContent = "Investigate exposure ↗";
    $("investigate").onclick = () => void investigate();
    if (ok) {
      $("investigation-brief").hidden = false;
      $("investigation-brief").onclick = () =>
        showDialog(
          `${company.name} intelligence brief`,
          `<pre>${esc(generateBrief(company, analysis, evidence))}</pre>`,
        );
    }
  }
  if (investigationController === controller) investigationController = null;
  return ok;
}
function renderInvestigation() {
  let panel = $("investigation-panel");
  if (!panel) {
    panel = document.createElement("section");
    panel.id = "investigation-panel";
    panel.className = "investigation-panel";
    document.querySelector(".globe-area").append(panel);
  }
  panel.innerHTML = `<header><span class="eyebrow">${esc(investigationStatus)}</span><button id="dismiss-investigation" aria-label="Close investigation">✕</button></header><ol class="timeline">${investigationSteps.map((s, i) => `<li class="${s.status}"><span class="step-index">${s.status === "complete" ? "✓" : String(i + 1).padStart(2, "0")}</span><strong>${esc(s.title)}</strong>${s.status !== "pending" ? `<small>${esc(s.detail)}</small>` : ""}</li>`).join("")}</ol><button id="investigation-brief" class="primary" hidden>Read intelligence brief ↗</button>`;
  $("dismiss-investigation").onclick = () => {
    cancelInvestigation();
    panel.remove();
    $("investigate").textContent = "Investigate exposure ↗";
    $("investigate").onclick = () => void investigate();
  };
}
function renderAnalyst() {
  $("tab-content").innerHTML =
    `<div class="eyebrow">${aiAvailable ? "AI tool routing" : "Local structured analyst"}</div><p class="empty">${aiAvailable ? "AI selects tools; sourced calculations produce the answer." : "No API key required. Uses a bounded command interpreter and deterministic tools."}</p><div class="suggestions">${["Why Taiwan?", "Show me", "Compare Apple and NVIDIA"].map((q) => `<button data-question="${q}">${q}</button>`).join("")}</div><div id="chatlog" class="chatlog" role="log" aria-live="polite">${chatHistory.map((m) => `<p><small>${esc(m.role)}</small><br/>${esc(m.text)}</p>`).join("")}</div><form id="chat-form" class="chat-form"><input id="chat-input" aria-label="Ask analyst" placeholder="Ask about this footprint…" maxlength="2000"/><button ${chatBusy ? "disabled" : ""}>${chatBusy ? "…" : "↑"}</button></form>`;
  $("chat-form").onsubmit = (e) => {
    e.preventDefault();
    void askAnalyst($("chat-input").value);
  };
  document
    .querySelectorAll("[data-question]")
    .forEach((b) => (b.onclick = () => void askAnalyst(b.dataset.question)));
}
async function askAnalyst(question) {
  if (!question.trim() || chatBusy) return;
  chatBusy = true;
  const company = selected;
  chatHistory.push({ role: "You", text: question });
  renderAnalyst();
  try {
    let call = planLocally(question, selected.ticker, companies),
      mode = "Local tool";
    if (aiAvailable) {
      try {
        const response = await fetch("/api/marketeye/analyst", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            question,
            ticker: selected.ticker,
            context: {
              selectedEvent,
              activeLayers: [
                ...document.querySelectorAll("[data-layer]:checked"),
              ].map((c) => c.dataset.layer),
              exposure: assessment.score,
              sources: snapshot.sources,
            },
          }),
          signal: AbortSignal.timeout(30000),
        });
        if (!response.ok) throw new Error("AI unavailable");
        call = await response.json();
        mode = "AI-selected tool";
      } catch {
        mode = "AI unavailable · local fallback";
      }
    }
    if (selected !== company) return;
    let toolSnapshot = snapshot;
    if (dataMode === "live" && call.name === "compareCompanies") {
      const results = await Promise.all(
        companies.map((c) => provider.refresh(c)),
      );
      toolSnapshot = {
        events: [
          ...new Map(
            results.flatMap((r) => r.events).map((e) => [e.id, e]),
          ).values(),
        ],
        sources: [
          ...new Map(
            results.flatMap((r) => r.sources).map((s) => [s.key, s]),
          ).values(),
        ],
      };
    } else if (
      dataMode === "live" &&
      call.arguments.ticker !== selected.ticker
    ) {
      const target = companies.find((c) => c.ticker === call.arguments.ticker);
      if (target) toolSnapshot = await provider.refresh(target);
    }
    if (selected !== company) return;
    const result = await executeTool(call, {
      companies,
      snapshot: toolSnapshot,
      showCompany: async (ticker) => {
        if (ticker !== selected.ticker) selectCompany(ticker);
        globe?.showCompany(selected);
        return globe ? await globe.flyTo(selected.focus) : false;
      },
      investigate,
    });
    chatHistory.push({
      role: `${mode} · ${call.name}`,
      text: summarizeTool(call.name, result),
    });
  } catch (error) {
    chatHistory.push({ role: "Tool failed", text: error.message });
  } finally {
    chatBusy = false;
    if (activeTab === "analyst") renderAnalyst();
  }
}
$("refresh").onclick = () => void refreshSources(true);
$("investigate").onclick = () => void investigate();
$("export-brief").onclick = () => {
  const url = URL.createObjectURL(
    new Blob([generateBrief(selected, assessment, snapshot)], {
      type: "text/markdown",
    }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = `MarketEye-${selected.ticker}-${new Date().toISOString().slice(0, 10)}.md`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
$("methodology").onclick = () =>
  showDialog(
    "How exposure is calculated",
    `<p>MarketEye ranks possible physical exposure using a deterministic, inspectable screening model. It does not estimate investment returns or the probability of a loss.</p><pre>100 × severity × proximity × importance\n    × confidence × freshness</pre><p>Proximity = max(0, 1 − distance / screening radius). Importance = 50% asset + 30% dependency + 20% supplier criticality. Confidence is the minimum of event, location and supplier confidence. These are curated screening weights, not statistically calibrated probabilities.</p><p>Freshness halves every 24 hours for earthquakes and 6 hours for weather. Company score is the largest asset-event score, avoiding duplicate-facility inflation. Context-only ports and airports do not contribute. Thresholds: low &lt;25, medium 25–49, high 50–74, critical ≥75.</p><p>Earthquake radius = magnitude² × 8 km, bounded to 50–700 km. Weather uses a 75 km screen. These radii are not hazard or damage boundaries. Weather is an Open-Meteo model estimate, not an official alert.</p><h3>Current source coverage</h3>${snapshot.sources.map((s) => `<p>${esc(s.key)} — ${esc(s.status)}<br/><small>${esc(s.retrievedAt || "No successful retrieval")} ${esc(s.error || "")}</small></p>`).join("")}`,
  );
const replayButton = document.createElement("button");
replayButton.id = "replay-toggle";
replayButton.className = "secondary";
replayButton.textContent = "↶ Explore Taiwan 2024 replay";
$("refresh").after(replayButton);
const mobileTools = document.createElement("button");
mobileTools.className = "mobile-tools-toggle";
mobileTools.textContent = "Signals & map layers ↓";
mobileTools.setAttribute("aria-expanded", "false");
document.querySelector(".left-rail .rail-section").after(mobileTools);
mobileTools.onclick = () => {
  const open = document
    .querySelector(".left-rail")
    .classList.toggle("expanded");
  mobileTools.setAttribute("aria-expanded", String(open));
  mobileTools.textContent = open
    ? "Close signals & layers ↑"
    : "Signals & map layers ↓";
};
const modeNotice = document.createElement("div");
modeNotice.className = "mode-notice";
modeNotice.hidden = true;
modeNotice.id = "replay-notice";
modeNotice.textContent =
  "HISTORICAL REPLAY · Apr 2024 earthquake × current curated footprint · Not live";
document.querySelector(".globe-area").append(modeNotice);
replayButton.onclick = () => {
  cancelInvestigation();
  dataMode = dataMode === "live" ? "replay" : "live";
  modeNotice.hidden = dataMode !== "replay";
  replayButton.textContent =
    dataMode === "live"
      ? "↶ Explore Taiwan 2024 replay"
      : "● Return to live sources";
  globe?.showCompany(selected);
  void refreshSources();
};
const threeD = document.createElement("button");
threeD.textContent = "3D";
threeD.title = "Optional photorealistic imagery";
document.querySelector(".globe-tools").append(threeD);
threeD.onclick = async () => {
  threeD.disabled = true;
  try {
    await globe?.enablePhotorealistic();
  } catch (error) {
    showDialog("Photorealistic imagery", `<p>${esc(error.message)}</p>`);
  } finally {
    threeD.disabled = false;
  }
};
if (globe) contextLayers = attachContextLayers(globe, $("extra-layers"));
void refreshSources();
setInterval(() => {
  if (!document.hidden && !investigationController) void refreshSources();
}, 300000);
fetch("/api/marketeye/analyst")
  .then((r) => r.json())
  .then((s) => {
    aiAvailable = s.available === true;
    if (activeTab === "analyst") renderAnalyst();
  })
  .catch(() => {});
registerMarketTools({
  getState: () => ({
    ticker: selected.ticker,
    mode: dataMode,
    score: assessment.score,
    sources: snapshot.sources,
    exposures: assessment.exposures.map((e) => ({
      eventId: e.eventId,
      score: e.score,
      explanation: e.explanation,
    })),
  }),
  selectCompany: async (ticker) => {
    selectCompany(ticker);
    const moved = globe ? await globe.flyTo(selected.focus) : false;
    return { ticker: selected.ticker, moved };
  },
  investigate: async () => ({ completed: await investigate() }),
});
