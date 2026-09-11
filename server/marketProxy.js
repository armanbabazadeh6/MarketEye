import {
  normalizeChart,
  normalizeHeadlines,
} from "../src/markets/normalize.js";
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
  async function request(url) {
    let last;
    for (let i = 0; i < 2; i++)
      try {
        const response = await fetcher(url, {
          headers: {
            "User-Agent": "MarketEye/0.2 (personal research terminal)",
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
      res.end(JSON.stringify({ app: "marketeye", version: "0.2.0" }));
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
              articles: normalizeHeadlines(parseNews(xml, 35), now()),
              source: "Google News RSS",
              coverage:
                "Headline index; open publisher reporting to verify details.",
            };
          },
          180000,
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
