import { instruments, resolveInstrument } from "../markets/instruments.js";
import { compareSeries, sortQuotes } from "../markets/terminalCommands.js";
import { downloadFile } from "./newsroom.js";
const esc = (v) =>
  String(v ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const number = (v) =>
  Number.isFinite(v)
    ? v.toLocaleString("en-US", { maximumFractionDigits: 4 })
    : "—";
const percent = (v) =>
  Number.isFinite(v) ? `${v >= 0 ? "+" : ""}${v.toFixed(2)}%` : "—";
const when = (v) => (v ? new Date(v).toLocaleString() : "—");
export class MarketMonitor {
  constructor({ root, api, onSelect, getState, onMessage }) {
    this.api = api;
    this.onSelect = onSelect;
    this.getState = getState;
    this.onMessage = onMessage;
    this.sort = { key: "symbol", direction: 1 };
    this.generation = 0;
    this.comparison = [];
    this.el = document.createElement("section");
    this.el.id = "market-monitor";
    this.el.hidden = true;
    root.querySelector(".terminal-bottom").before(this.el);
    this.el.innerHTML = `<div class="monitor-toolbar"><strong>MARKET MONITOR</strong><button id="monitor-load">Load market universe</button><button id="monitor-export">Export quotes CSV</button><span id="monitor-status"></span></div><div class="monitor-layout"><section class="terminal-panel monitor-table-panel"><div class="panel-heading">INDICATIVE QUOTES / CLICK SECURITY TO OPEN</div><div class="table-scroll"><table class="market-table"><thead><tr>${[
      ["symbol", "Security"],
      ["price", "Last"],
      ["changePercent", "Change %"],
      ["change", "Net"],
      ["high", "High"],
      ["low", "Low"],
      ["volume", "Volume"],
      ["asOf", "Source time"],
    ]
      .map(
        ([k, label]) => `<th><button data-sort="${k}">${label}</button></th>`,
      )
      .join(
        "",
      )}<th>Feed</th></tr></thead><tbody id="monitor-quotes"></tbody></table></div></section><section class="terminal-panel comparison-panel"><div class="panel-heading">RELATIVE PRICE PERFORMANCE / COMMON DAILY OBSERVATIONS</div><form id="compare-form"><label for="compare-symbols">SECURITIES</label><input id="compare-symbols" value="NVDA AAPL TSLA" maxlength="70" aria-label="Comparison symbols"><select id="compare-range" aria-label="Comparison range"><option value="1mo">1 month</option><option value="6mo">6 months</option><option value="1y">1 year</option></select><button>COMPARE ↵</button></form><div id="compare-result"><p class="feed-note">Compare two to four securities over a common set of daily observations. Returns exclude dividends and transaction costs.</p></div></section></div>`;
    this.el.onclick = (e) => {
      const sort = e.target.closest("[data-sort]"),
        symbol = e.target.closest("[data-monitor-symbol]");
      if (sort) {
        const key = sort.dataset.sort;
        this.sort = {
          key,
          direction: this.sort.key === key ? -this.sort.direction : 1,
        };
        this.render();
      }
      if (symbol) onSelect(symbol.dataset.monitorSymbol);
    };
    document.getElementById("monitor-load").onclick = () => this.loadUniverse();
    document.getElementById("monitor-export").onclick = () => {
      const rows = this.rows(),
        fields = [
          "symbol",
          "name",
          "price",
          "change",
          "changePercent",
          "asOf",
          "status",
        ];
      const csv = [
        fields.join(","),
        ...rows.map((r) =>
          fields
            .map((k) => '"' + String(r[k] ?? "").replaceAll('"', '""') + '"')
            .join(","),
        ),
      ].join("\r\n");
      downloadFile("marketeye-quotes.csv", csv, "text/csv");
    };
    document.getElementById("compare-form").onsubmit = (e) => {
      e.preventDefault();
      this.compare(
        document
          .getElementById("compare-symbols")
          .value.split(/[\s,]+/)
          .filter(Boolean),
      );
    };
  }
  rows() {
    const { quotes } = this.getState();
    return [...quotes.entries()].map(([symbol, q]) => ({
      ...q,
      symbol,
      name: q.name || resolveInstrument(symbol)?.name || symbol,
    }));
  }
  render() {
    const rows = sortQuotes(this.rows(), this.sort.key, this.sort.direction);
    document.getElementById("monitor-quotes").innerHTML = rows
      .map(
        (q) =>
          `<tr><td><button data-monitor-symbol="${esc(q.symbol)}">${esc(q.symbol)}</button><small>${esc(q.name)}</small></td><td>${number(q.price)}</td><td class="${q.changePercent >= 0 ? "positive" : "negative"}">${percent(q.changePercent)}</td><td>${number(q.change)}</td><td>${number(q.high)}</td><td>${number(q.low)}</td><td>${number(q.volume)}</td><td class="source-time">${when(q.asOf)}</td><td class="feed-${esc(q.status)}">${esc(q.status || "loading")}</td></tr>`,
      )
      .join("");
    document.getElementById("monitor-status").textContent =
      `${rows.length} securities / ${rows.filter((q) => Number.isFinite(q.price)).length} with prices`;
  }
  async loadUniverse() {
    const button = document.getElementById("monitor-load");
    button.disabled = true;
    button.textContent = "Loading…";
    const { quotes } = this.getState();
    let i = 0;
    try {
      await Promise.all(
        Array.from({ length: 3 }, async () => {
          while (i < instruments.length) {
            const instrument = instruments[i++];
            try {
              quotes.set(
                instrument.symbol,
                await this.api({
                  kind: "quote",
                  symbol: instrument.symbol,
                  range: "1d",
                }),
              );
            } catch {
              quotes.set(instrument.symbol, { status: "unavailable" });
            }
            this.render();
          }
        }),
      );
    } finally {
      button.disabled = false;
      button.textContent = "Refresh market universe";
    }
  }
  async compare(input) {
    const symbols = [...new Set(input.map((s) => s.toUpperCase()))];
    if (
      symbols.length < 2 ||
      symbols.length > 4 ||
      symbols.some((s) => !resolveInstrument(s))
    )
      return this.onMessage("Compare two to four valid ticker symbols.");
    document.getElementById("compare-symbols").value = symbols.join(" ");
    const range = document.getElementById("compare-range").value,
      g = ++this.generation,
      target = document.getElementById("compare-result");
    target.innerHTML =
      '<p class="feed-note">Retrieving daily price history…</p>';
    const results = await Promise.all(
      symbols.map(async (symbol) => {
        try {
          return await this.api({ kind: "quote", symbol, range });
        } catch {
          return { symbol, status: "unavailable" };
        }
      }),
    );
    if (g !== this.generation) return;
    this.comparison = compareSeries(results);
    if (this.comparison.length < 2) {
      target.innerHTML =
        '<p class="feed-note">Not enough common price history. Try another range or check provider availability.</p>';
      return;
    }
    const colors = ["#f4c66b", "#67b5e5", "#62caa6", "#ce96d8"],
      values = this.comparison.flatMap((s) =>
        s.points.map((p) => p.returnPercent),
      ),
      low = Math.min(0, ...values),
      high = Math.max(0, ...values),
      span = high - low || 1,
      x = (i) => 45 + (i / (this.comparison[0].points.length - 1)) * 710,
      y = (v) => 20 + ((high - v) / span) * 215;
    target.innerHTML = `<svg viewBox="0 0 800 270" role="img" aria-label="Relative percentage price returns from first common observation">${[0, 0.25, 0.5, 0.75, 1].map((t) => `<path d="M45 ${20 + t * 215}H755" stroke="#263d4d"/><text x="38" y="${24 + t * 215}" text-anchor="end">${(high - t * span).toFixed(1)}%</text>`).join("")}${this.comparison.map((s, n) => `<path d="${s.points.map((p, i) => `${i ? "L" : "M"}${x(i)},${y(p.returnPercent)}`).join(" ")}" fill="none" stroke="${colors[n]}" stroke-width="1.8"/>`).join("")}<text x="45" y="258">${this.comparison[0].points[0].day}</text><text x="755" y="258" text-anchor="end">${this.comparison[0].points.at(-1).day}</text></svg><div class="comparison-legend">${this.comparison.map((s, i) => `<span style="color:${colors[i]}">${esc(s.symbol)} <b>${percent(s.points.at(-1).returnPercent)}</b></span>`).join("")}</div><p class="feed-note">Indexed to the first common date; daily calendar dates align different trading sessions. Price return, not total return. ${results
      .filter((r) => !r.points?.length)
      .map((r) => esc(r.symbol) + " unavailable.")
      .join(
        " ",
      )} ${results.some((r) => r.status === "stale") ? "STALE provider history." : ""} Futures rollovers can affect comparisons.</p>`;
  }
}
