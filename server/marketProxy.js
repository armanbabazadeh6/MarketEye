import {
  normalizeChart,
  normalizeHeadlines,
} from "../src/markets/normalize.js";
import { normalizeOfficialAlerts } from "../src/events/officialAlerts.js";
export function marketProxy({
  parseNews,
  fetcher = (...args) => fetch(...args),
  now = Date.now,
} = {}) {
  const cache = new Map(),
    inflight = new Map();
  let requests = [];
  async function cached(key, load, ttl) {
    const old = cache.get(key);
    if (old && now() - old.fetchedAt < ttl)
      return {
        ...old.data,
        status: "cached",
        retrievedAt: new Date(old.fetchedAt).toISOString(),
      };
    if (inflight.has(key)) return inflight.get(key);
    const promise = (async () => {
      try {
        const data = await load();
        const fetchedAt = now();
        cache.set(key, { data, fetchedAt });
        while (cache.size > 180) cache.delete(cache.keys().next().value);
        return {
          ...data,
          status: "ready",
          retrievedAt: new Date(fetchedAt).toISOString(),
        };
      } catch (error) {
        if (old)
          return {
            ...old.data,
            status: "stale",
            retrievedAt: new Date(old.fetchedAt).toISOString(),
            error: "Provider refresh failed",
          };
        return {
          status: "unavailable",
          error: error.message,
          retrievedAt: null,
        };
      }
    })();
    inflight.set(key, promise);
    try {
      return await promise;
    } finally {
      inflight.delete(key);
    }
  }
  async function request(url, extraHeaders = {}) {
    let last;
    for (let i = 0; i < 2; i++)
      try {
        const response = await fetcher(url, {
          headers: {
            "User-Agent": "MarketEye/0.3 (personal research terminal)",
            ...extraHeaders,
          },
          signal: AbortSignal.timeout(10000),
        });
        if (!response.ok) throw Error(`Provider HTTP ${response.status}`);
        const length = Number(response.headers?.get("content-length"));
        if (length > 2000000) throw Error("Response too large");
        const text = await response.text();
        if (text.length > 2000000) throw Error("Response too large");
        return text;
      } catch (e) {
        last = e;
      }
    throw last;
  }
  const install = (middlewares) => {
    middlewares.use("/api/marketeye/health", (_req, res) => {
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ app: "marketeye", version: "0.3.0" }));
    });
    middlewares.use("/api/marketeye/market", async (req, res) => {
      const reply = (status, data) => {
        res.writeHead(status, {
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
        });
        res.end(JSON.stringify(data));
      };
      if (req.method !== "GET") return reply(405, { error: "GET required" });
      requests = requests.filter((t) => now() - t < 60000);
      if (requests.length >= 180)
        return reply(429, { error: "Request limit reached" });
      requests.push(now());
      const url = new URL(req.url, "http://localhost"),
        kind = url.searchParams.get("kind");
      if (kind === "quote") {
        const symbol = (url.searchParams.get("symbol") || "").toUpperCase(),
          range = url.searchParams.get("range") || "1d";
        if (
          !/^[A-Z0-9^][A-Z0-9.^=-]{0,14}$/.test(symbol) ||
          !["1d", "5d", "1mo", "6mo", "1y"].includes(range)
        )
          return reply(400, { error: "Invalid symbol or range" });
        const interval = range === "1d" ? "5m" : range === "5d" ? "15m" : "1d";
        const result = await cached(
          `quote:${symbol}:${range}`,
          async () =>
            normalizeChart(
              JSON.parse(
                await request(
                  `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=${interval}&range=${range}`,
                ),
              ),
              symbol,
              range,
              now(),
            ),
          60000,
        );
        return reply(200, result);
      }
      if (kind === "news") {
        const q = (url.searchParams.get("q") || "").trim();
        if (!q || q.length > 220)
          return reply(400, { error: "News query must be 1–220 characters" });
        const result = await cached(
          `news:${q}`,
          async () => {
            const params = new URLSearchParams({
              q,
              hl: "en-US",
              gl: "US",
              ceid: "US:en",
            });
            const xml = await request(
              `https://news.google.com/rss/search?${params}`,
            );
            if (!/<rss\b/i.test(xml)) throw Error("Invalid news feed");
            return {
              query: q,
              articles: normalizeHeadlines(parseNews(xml, 100), now()),
              source: "Google News RSS",
              coverage:
                "Headline index; open publisher reporting to verify details.",
            };
          },
          180000,
        );
        return reply(200, result);
      }
      if (kind === "alerts") {
        const result = await cached(
          "nws:active:severe",
          async () => ({
            articles: normalizeOfficialAlerts(
              JSON.parse(
                await request(
                  "https://api.weather.gov/alerts/active?status=actual&severity=Extreme,Severe",
                  {
                    Accept: "application/geo+json",
                    "User-Agent":
                      "MarketEye (https://github.com/armanbabazadeh6/MarketEye)",
                  },
                ),
              ),
              now(),
            ),
            source: "National Weather Service",
            coverage:
              "Active US alerts with Severe or Extreme CAP severity. A watch or forecast alert is not confirmed facility damage.",
          }),
          120000,
        );
        return reply(200, result);
      }
      if (kind === "search") {
        const q = (url.searchParams.get("q") || "").trim();
        if (!q || q.length > 80)
          return reply(400, { error: "Search must contain 1–80 characters" });
        const result = await cached(
          "symbols:" + q.toLowerCase(),
          async () => {
            const payload = JSON.parse(
              await request(
                "https://query1.finance.yahoo.com/v1/finance/search?" +
                  new URLSearchParams({ q, quotesCount: "8", newsCount: "0" }),
              ),
            );
            return {
              matches: (payload.quotes || [])
                .filter(
                  (r) =>
                    typeof r.symbol === "string" &&
                    /^[A-Z0-9^][A-Z0-9.^=-]{0,14}$/.test(r.symbol),
                )
                .slice(0, 8)
                .map((r) => ({
                  symbol: r.symbol,
                  name: String(r.shortname || r.longname || r.symbol).slice(
                    0,
                    200,
                  ),
                  exchange: String(r.exchDisp || r.exchange || "").slice(0, 60),
                  type: String(r.quoteType || "").slice(0, 30),
                })),
            };
          },
          3600000,
        );
        return reply(200, result);
      }
      reply(400, { error: "Unknown market request" });
    });
  };
  return {
    name: "marketeye-market-data",
    configureServer(server) {
      install(server.middlewares);
    },
    configurePreviewServer(server) {
      install(server.middlewares);
    },
  };
}
