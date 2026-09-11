import { resolveInstrument } from "./instruments.js";
const ranges = new Set(["1d", "5d", "1mo", "6mo", "1y"]);
export function parseCommand(input) {
  const text = input.trim(),
    parts = text.split(/\s+/),
    verb = parts[0].toUpperCase();
  if (!text) return { type: "empty" };
  if (["HELP", "?"].includes(verb)) return { type: "help" };
  if (["MON", "MONITOR"].includes(verb))
    return { type: "desk", desk: "monitor" };
  if (["STATUS", "FEEDS"].includes(verb))
    return { type: "desk", desk: "status" };
  if (["BOOK", "SAVED"].includes(verb)) return { type: "saved" };
  if (verb === "ENERGY") return { type: "desk", desk: "energy" };
  if (["HOME", "MARKETS"].includes(verb))
    return { type: "desk", desk: "markets" };
  if (verb === "NEWS")
    return parts.length > 1
      ? { type: "news", query: parts.slice(1).join(" ") }
      : { type: "desk", desk: "news" };
  if (["GEO", "DES"].includes(verb)) {
    const symbol = parts[1]?.toUpperCase();
    if (!["NVDA", "AAPL", "TSLA"].includes(symbol))
      return {
        type: "error",
        message:
          "Curated geographic coverage: NVDA, AAPL, TSLA. Use a ticker alone for other market quotes.",
      };
    return { type: "geo", symbol };
  }
  if (["COMPARE", "COMP"].includes(verb)) {
    const symbols = [
      ...new Set(
        parts
          .slice(1)
          .join(" ")
          .split(/[\s,]+/)
          .filter(Boolean)
          .map((s) => s.toUpperCase()),
      ),
    ];
    if (
      symbols.length < 2 ||
      symbols.length > 4 ||
      symbols.some((s) => !resolveInstrument(s))
    )
      return {
        type: "error",
        message:
          "Use COMPARE with two to four tickers, for example COMPARE NVDA AAPL TSLA.",
      };
    return { type: "compare", symbols };
  }
  if (verb === "GP") {
    const instrument = parts[1] && resolveInstrument(parts[1]);
    const range = (parts[2] || "1mo").toLowerCase();
    if (!instrument || !ranges.has(range))
      return {
        type: "error",
        message: "Use GP NVDA 1mo. Ranges: 1d, 5d, 1mo, 6mo, 1y.",
      };
    return { type: "chart", symbol: instrument.symbol, range };
  }
  return { type: "research", text };
}
export function compareSeries(series) {
  const valid = series.filter((s) => s.points?.length > 1),
    maps = valid.map(
      (s) =>
        new Map(
          s.points
            .filter((p) => Number.isFinite(p.close) && p.close > 0)
            .map((p) => [new Date(p.time).toISOString().slice(0, 10), p.close]),
        ),
    );
  if (valid.length < 2) return [];
  const common = [...maps[0].keys()]
    .filter((day) => maps.every((m) => m.has(day)))
    .sort();
  if (common.length < 2) return [];
  return valid.map((s, i) => ({
    symbol: s.symbol,
    baseline: maps[i].get(common[0]),
    points: common.map((day) => ({
      day,
      returnPercent: 100 * (maps[i].get(day) / maps[i].get(common[0]) - 1),
    })),
  }));
}
export function sortQuotes(rows, key = "symbol", direction = 1) {
  return [...rows].sort((a, b) => {
    const x = a[key],
      y = b[key];
    if (x == null) return y == null ? 0 : 1;
    if (y == null) return -1;
    return typeof x === "number"
      ? (x - y) * direction
      : String(x).localeCompare(String(y)) * direction;
  });
}
