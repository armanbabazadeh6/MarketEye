import { distanceKm } from "../exposure/engine.js";
export function linkRegionalFootprint(location, companies, radiusKm = 250) {
  if (!location) return [];
  return companies
    .flatMap((company) =>
      company.locations
        .filter((l) => l.relationship !== "context-only")
        .map((asset) => ({
          ticker: company.ticker,
          company: company.name,
          asset,
          distanceKm: distanceKm(location, asset),
          evidence: "Regional proximity only; no confirmed interruption",
        })),
    )
    .filter((r) => r.distanceKm <= radiusKm)
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, 8);
}
