// Keep last-good data through a local network outage. Each result remains explicitly stale.
export class MarketClient {
  constructor({
    fetcher = (...args) => globalThis.fetch(...args),
    now = Date.now,
  } = {}) {
    this.fetcher = fetcher;
    this.now = now;
    this.lastGood = new Map();
    this.inflight = new Map();
  }
  async request(params) {
    const key = new URLSearchParams(params).toString();
    if (this.inflight.has(key)) return this.inflight.get(key);
    const task = (async () => {
      try {
        const response = await this.fetcher("/api/marketeye/market?" + key, {
          signal: AbortSignal.timeout(25000),
        });
        if (!response.ok) throw Error(`Feed HTTP ${response.status}`);
        const data = await response.json();
        if (!["ready", "cached", "stale", "unavailable"].includes(data.status))
          throw Error("Invalid market provider response");
        if (data.status === "unavailable")
          throw Error(data.error || "Provider unavailable");
        if (data.status !== "stale") {
          this.lastGood.set(key, { data, time: this.now() });
          while (this.lastGood.size > 180)
            this.lastGood.delete(this.lastGood.keys().next().value);
        }
        return data;
      } catch (error) {
        const old = this.lastGood.get(key);
        if (old && this.now() - old.time < 86400000)
          return { ...old.data, status: "stale", error: error.message };
        return {
          status: "unavailable",
          error: error.message,
          retrievedAt: null,
        };
      }
    })();
    this.inflight.set(key, task);
    try {
      return await task;
    } finally {
      this.inflight.delete(key);
    }
  }
}
