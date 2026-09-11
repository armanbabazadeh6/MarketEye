import { assessCompany } from "../exposure/engine.js";
import { generateBrief } from "./brief.js";
export const TOOL_NAMES = [
  "getCompanyExposure",
  "getCompanyLocations",
  "getSuppliers",
  "getNearbyEvents",
  "compareCompanies",
  "showCompanyAssets",
  "investigateEvent",
  "generateCompanyBrief",
];
export const toolDefinitions = TOOL_NAMES.map((name) => ({
  type: "function",
  name,
  description: {
    getCompanyExposure:
      "Explain deterministic exposure, sources, uncertainty and structural dependencies.",
    getCompanyLocations:
      "List mapped company assets and approximate coordinates.",
    getSuppliers: "List documented supplier relationships and provenance.",
    getNearbyEvents: "Get events intersecting mapped assets.",
    compareCompanies:
      "Compare supported companies using the same event snapshot; identify coverage limitations.",
    showCompanyAssets:
      "Show me: move the globe to the selected company and show its assets.",
    investigateEvent: "Start a visual evidence investigation.",
    generateCompanyBrief: "Generate a sourced intelligence brief.",
  }[name],
  strict: true,
  parameters: {
    type: "object",
    properties: { ticker: { type: "string", enum: ["NVDA", "AAPL", "TSLA"] } },
    required: ["ticker"],
    additionalProperties: false,
  },
}));
export function planLocally(question, ticker, companies) {
  const q = question.toLowerCase();
  const named = companies.find(
    (c) =>
      q.includes(c.ticker.toLowerCase()) || q.includes(c.name.toLowerCase()),
  );
  ticker = named?.ticker || ticker;
  const name = /compare|which compan/.test(q)
    ? "compareCompanies"
    : /investigat/.test(q)
      ? "investigateEvent"
      : /show|fly|take me/.test(q)
        ? "showCompanyAssets"
        : /brief|report/.test(q)
          ? "generateCompanyBrief"
          : /supplier/.test(q)
            ? "getSuppliers"
            : /location|factor|manufactur.*where/.test(q)
              ? "getCompanyLocations"
              : /earthquake|weather|event/.test(q)
                ? "getNearbyEvents"
                : "getCompanyExposure";
  return { name, arguments: { ticker } };
}
export async function executeTool(call, context) {
  if (!TOOL_NAMES.includes(call.name))
    throw new Error("Unsupported analyst tool");
  const company = context.companies.find(
    (c) => c.ticker === call.arguments?.ticker,
  );
  if (!company) throw new Error("Unsupported company");
  const assessment = assessCompany(
    company,
    context.snapshot.events,
    context.snapshot.analysisTime || Date.now(),
  );
  switch (call.name) {
    case "getCompanyExposure":
      return {
        company: company.ticker,
        mode: context.snapshot.mode || "live",
        thesis: company.thesis,
        assessment,
        unknowns: company.unknowns,
        sources: context.snapshot.sources,
      };
    case "getCompanyLocations":
      return company.locations;
    case "getSuppliers":
      return company.suppliers.length
        ? company.suppliers
        : { message: "No verified supplier records in this curated dataset." };
    case "getNearbyEvents":
      return {
        events: assessment.exposures.map((e) => ({
          event: context.snapshot.events.find((x) => x.id === e.eventId),
          exposure: e,
        })),
        coverage: context.snapshot.sources,
      };
    case "compareCompanies":
      return context.companies.map((c) => ({
        ticker: c.ticker,
        score: assessCompany(
          c,
          context.snapshot.events,
          context.snapshot.analysisTime || Date.now(),
        ).score,
        thesis: c.thesis,
        warning: `${context.snapshot.mode === "replay" ? "Historical replay applied to current curated footprint. " : ""}Same available snapshot; weather coverage may differ by company. Not a revenue-weighted ranking.`,
      }));
    case "showCompanyAssets":
      return { success: await context.showCompany(company.ticker) };
    case "investigateEvent":
      return { success: await context.investigate(company.ticker) };
    case "generateCompanyBrief":
      return generateBrief(company, assessment, context.snapshot);
  }
}
export function summarizeTool(name, result) {
  if (name === "getCompanyExposure")
    return `${result.mode === "replay" ? "HISTORICAL REPLAY · April 2024 event × current curated footprint.\n\n" : ""}${result.thesis}\n\nScreening score: ${result.sources.some((s) => ["ready", "cached"].includes(s.status)) ? `${result.assessment.score}/100 (available evidence only)` : "unavailable or stale coverage"}. ${result.assessment.exposures[0]?.explanation || "No correlated event in the available snapshot."}\n\nUnknown: ${result.unknowns.join("; ")}.\nSources: ${result.sources.map((s) => `${s.key} (${s.status})`).join(", ")}.`;
  if (name === "compareCompanies")
    return (
      result
        .map((c) => `${c.ticker}: ${c.score}/100 — ${c.thesis}`)
        .join("\n\n") +
      "\n\n" +
      result[0].warning
    );
  if (name === "getCompanyLocations")
    return result
      .map(
        (l) =>
          `${l.name} — ${l.relationship}. ${l.description}\n${l.sourceUrl}`,
      )
      .join("\n\n");
  if (name === "getSuppliers")
    return Array.isArray(result)
      ? result
          .map((s) => `${s.name}: ${s.statement}\n${s.sourceUrl}`)
          .join("\n\n")
      : result.message;
  if (name === "getNearbyEvents")
    return result.events.length
      ? result.events
          .slice(0, 5)
          .map((e) => `${e.exposure.explanation}\n${e.event.sourceUrl}`)
          .join("\n\n")
      : "No correlated events in the available snapshot. This does not establish safe operations. Review source coverage.";
  if (name === "showCompanyAssets")
    return result.success
      ? "Company footprint shown on the globe."
      : "Globe movement was unavailable or cancelled.";
  if (name === "investigateEvent")
    return result.success
      ? "Investigation completed. The evidence timeline and brief are ready."
      : "Investigation cancelled or globe unavailable.";
  return String(result);
}
