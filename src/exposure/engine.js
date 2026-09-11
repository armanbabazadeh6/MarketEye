// Screening model v1. Scores rank evidence; they are not probabilities or losses.
export const MODEL_VERSION = "1.0.0";
const clamp = (n) => Math.max(0, Math.min(1, Number.isFinite(n) ? n : 0));
export function distanceKm(a, b) {
  if (
    ![a?.latitude, b?.latitude, a?.longitude, b?.longitude].every(
      Number.isFinite,
    ) ||
    Math.abs(a.latitude) > 90 ||
    Math.abs(b.latitude) > 90 ||
    Math.abs(a.longitude) > 180 ||
    Math.abs(b.longitude) > 180
  )
    return Infinity;
  const rad = Math.PI / 180,
    dlat = (b.latitude - a.latitude) * rad,
    dlon = (b.longitude - a.longitude) * rad;
  const h =
    Math.sin(dlat / 2) ** 2 +
    Math.cos(a.latitude * rad) *
      Math.cos(b.latitude * rad) *
      Math.sin(dlon / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(clamp(h)));
}
export function freshness(timestamp, now = Date.now(), halfLifeHours = 24) {
  const time = Date.parse(timestamp);
  if (!Number.isFinite(time) || time > now + 300000) return 0;
  return 2 ** (-Math.max(0, now - time) / (halfLifeHours * 3600000));
}
export const severityLabel = (score) =>
  score >= 75
    ? "critical"
    : score >= 50
      ? "high"
      : score >= 25
        ? "medium"
        : "low";
export function correlateEvent(company, event, now = Date.now()) {
  if (!Number.isFinite(event.severity) || event.severity <= 0) return null;
  if (!Number.isFinite(event.radiusKm) || event.radiusKm <= 0) return null;
  const age = freshness(
    event.timestamp,
    now,
    event.type === "weather" ? 6 : 24,
  );
  const rows = company.locations
    .filter((l) => l.relationship !== "context-only")
    .map((location) => {
      const distance = distanceKm(location, event);
      const proximity = clamp(1 - distance / event.radiusKm);
      const supplier = company.suppliers.find(
        (s) => s.id === location.supplierId,
      );
      const dependency = company.dependencies.find(
        (d) => d.id === location.dependencyId,
      );
      const importance =
        0.5 * clamp(location.importance) +
        0.3 * clamp(dependency?.importance ?? location.importance) +
        0.2 * clamp(supplier?.criticality ?? location.importance);
      const confidence = Math.min(
        clamp(event.confidence),
        clamp(location.confidence),
        clamp(supplier?.confidence ?? 1),
      );
      const factors = {
        severity: clamp(event.severity),
        proximity,
        importance,
        confidence,
        freshness: age,
      };
      const score = Math.round(
        100 * Object.values(factors).reduce((a, b) => a * b, 1),
      );
      return {
        location,
        distanceKm: Math.round(distance),
        score,
        factors,
        dependency,
        supplier,
      };
    })
    .filter(
      (row) =>
        row.distanceKm < event.radiusKm && row.factors.proximity > 0 && age > 0,
    )
    .sort((a, b) => b.score - a.score || a.distanceKm - b.distanceKm);
  if (!rows.length) return null;
  const lead = rows[0];
  return {
    companyTicker: company.ticker,
    eventId: event.id,
    score: lead.score,
    severity: severityLabel(lead.score),
    distanceKm: lead.distanceKm,
    affectedLocations: rows.map((r) => r.location.id),
    affectedDependencies: [
      ...new Set(rows.map((r) => r.dependency?.id).filter(Boolean)),
    ],
    confidence: lead.factors.confidence,
    rows,
    factors: lead.factors,
    positiveFactors: [
      `${event.title}`,
      `${lead.distanceKm} km from ${lead.location.name}`,
      `${Math.round(lead.factors.importance * 100)}% curated dependency importance`,
    ],
    mitigatingFactors: [
      `Freshness multiplier: ${lead.factors.freshness.toFixed(2)}`,
      `Evidence confidence multiplier: ${lead.factors.confidence.toFixed(2)}`,
    ],
    unknowns: [
      "No facility operating-status feed is connected. Proximity does not confirm an interruption.",
      ...(lead.location.relationship === "supplier-context"
        ? ["Company allocation to this specific supplier campus is unknown."]
        : []),
    ],
    explanation: `${event.title} is approximately ${lead.distanceKm} km from ${lead.location.name}. ${lead.dependency?.potentialImpact || "Operational consequences require independent verification."}`,
  };
}
export function assessCompany(company, events, now = Date.now()) {
  const exposures = events
    .map((e) => correlateEvent(company, e, now))
    .filter(Boolean)
    .sort((a, b) => b.score - a.score || a.eventId.localeCompare(b.eventId));
  return {
    companyTicker: company.ticker,
    modelVersion: MODEL_VERSION,
    calculatedAt: new Date(now).toISOString(),
    score: exposures[0]?.score ?? 0,
    exposures,
  };
}
