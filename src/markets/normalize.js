const finite = (n) => (typeof n === "number" && Number.isFinite(n) ? n : null);
export function normalizeChart(
  payload,
  symbol,
  range = "1d",
  now = Date.now(),
) {
  const row = payload?.chart?.result?.[0],
    m = row?.meta;
  if (!m || !Number.isFinite(m.regularMarketPrice))
    throw new Error(
      payload?.chart?.error?.description || "No valid quote returned",
    );
  const previous =
    finite(m.previousClose) ??
    (range === "1d" ? finite(m.chartPreviousClose) : null);
  const close = row.indicators?.quote?.[0]?.close || [],
    volume = row.indicators?.quote?.[0]?.volume || [];
  const points = (row.timestamp || []).flatMap((time, i) =>
    Number.isFinite(time) && Number.isFinite(close[i])
      ? [{ time: time * 1000, close: close[i], volume: finite(volume[i]) }]
      : [],
  );
  const period = m.currentTradingPeriod?.regular;
  return {
    symbol,
    name: m.shortName || m.longName || symbol,
    price: m.regularMarketPrice,
    previousClose: previous,
    change: previous !== null ? m.regularMarketPrice - previous : null,
    changePercent: previous
      ? (100 * (m.regularMarketPrice - previous)) / previous
      : null,
    currency: m.currency || null,
    exchange: m.fullExchangeName || m.exchangeName || null,
    type: m.instrumentType || null,
    asOf: Number.isFinite(m.regularMarketTime)
      ? new Date(m.regularMarketTime * 1000).toISOString()
      : null,
    session:
      period && now >= period.start * 1000 && now < period.end * 1000
        ? "Regular session window"
        : "Outside regular session / unknown",
    high: finite(m.regularMarketDayHigh),
    low: finite(m.regularMarketDayLow),
    volume: finite(m.regularMarketVolume),
    points,
    range,
    source: "Yahoo Finance",
    sourceUrl: `https://finance.yahoo.com/quote/${encodeURIComponent(symbol)}/`,
    dataNotice:
      "Indicative public feed; may be delayed. Not exchange-grade real-time data.",
  };
}
export function normalizeHeadlines(rows, now = Date.now()) {
  const seen = new Set();
  return rows
    .filter((r) => {
      const t = Date.parse(r.publishedAt);
      if (!Number.isFinite(t) || t > now + 300000 || now - t > 8 * 86400000)
        return false;
      const key = r.title.toLowerCase().replace(/[^a-z0-9]/g, "");
      if (seen.has(key)) return false;
      seen.add(key);
      return /^https?:\/\//.test(r.url);
    })
    .sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt));
}
