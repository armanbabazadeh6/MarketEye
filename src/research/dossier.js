import { explainMove } from "../markets/drivers.js";
export function buildDossier(
  instrument,
  quote,
  news,
  geographic = "Geographic coverage is not curated for this security.",
  now = new Date().toISOString(),
) {
  const explanation = explainMove(instrument, quote, news.articles || []);
  return `# MarketEye — ${instrument.name} (${instrument.symbol})\n\nResearch snapshot: ${now}\n\n## Market observation\n\n${explanation.observed}\n\nPrice: ${Number.isFinite(quote.price) ? quote.price : "Unavailable"} ${quote.currency || instrument.unit}\nSource time: ${quote.asOf || "Unknown"}\nFeed status: ${quote.status}\nQuote source: https://finance.yahoo.com/quote/${encodeURIComponent(instrument.symbol)}/\n\n${quote.dataNotice || "Indicative public feed; may be delayed."}\n\n## News evidence\n\nQuery: ${news.query || instrument.query}\nRetrieved: ${news.retrievedAt || "Unavailable"}\nFeed status: ${news.status}\n\n${
    (news.articles || [])
      .slice(0, 12)
      .map(
        (a) =>
          `- ${a.title}\n  Publisher: ${a.domain} | Published: ${a.publishedAt}\n  ${a.url}`,
      )
      .join("\n\n") || "No headlines available."
  }\n\n## Possible market connections\n\n${explanation.channels.map((c) => `### ${c.label}\n\n${c.path.join(" → ")}\n\n${c.explanation}`).join("\n\n") || "No classified channel in available reports."}\n\n${explanation.conclusion}\n\n${explanation.caveat}\n\n## Geographic evidence\n\n${geographic}\n\n---\nMarketEye provides informational research, not investment advice. Source facts, geographic proximity and possible economic effects are separate evidence levels. No confirmed closure or realized financial loss should be inferred from this report.\n`;
}
