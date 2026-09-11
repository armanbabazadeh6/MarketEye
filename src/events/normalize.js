import { normalizeEarthquakeSnapshot } from "../data/earthquakes.js";
import { weatherCodeLabel } from "../data/regionalBrief.js";
export const USGS_URL =
  "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson";
export function normalizeUsgs(payload) {
  const rows = normalizeEarthquakeSnapshot(payload);
  if (!rows) throw new Error("USGS returned an invalid earthquake snapshot");
  return rows
    .filter((r) => Number.isFinite(r.time))
    .map((r) => ({
      id: `usgs:${r.stableId}`,
      type: "earthquake",
      title: `M${r.mag.toFixed(1)} · ${r.place || "Earthquake"}`,
      latitude: r.lat,
      longitude: r.lon,
      severity: Math.max(0, Math.min(1, (r.mag - 2) / 5)),
      confidence: 0.95,
      radiusKm: Math.min(700, Math.max(50, r.mag * r.mag * 8)),
      timestamp: new Date(r.time).toISOString(),
      source: "USGS",
      sourceUrl: r.usgsId
        ? `https://earthquake.usgs.gov/earthquakes/eventpage/${encodeURIComponent(r.usgsId)}`
        : USGS_URL,
      description:
        "Measured seismic event. Screening radius is a heuristic, not a shaking or damage boundary.",
      metadata: { magnitude: r.mag, depthKm: r.depthKm },
      evidenceType: "observation",
    }));
}
export function normalizeWeather(payload, location) {
  const w = payload?.weather;
  if (
    !w ||
    ![w.windKph, w.precipitationMm, w.weatherCode].every(Number.isFinite) ||
    !Number.isFinite(Date.parse(w.observedAt))
  )
    throw new Error("Weather conditions unavailable or malformed");
  // Open-Meteo current conditions are model estimates, not official hazard alerts.
  const severity = Math.min(
    1,
    Math.max(
      w.windKph >= 40 ? w.windKph / 120 : 0,
      w.precipitationMm >= 5 ? w.precipitationMm / 30 : 0,
      w.weatherCode >= 95 ? 0.55 : 0,
    ),
  );
  return {
    id: `weather:${location.id}`,
    type: "weather",
    title: `${weatherCodeLabel(w.weatherCode).toLowerCase()} · ${location.name}`,
    latitude: location.latitude,
    longitude: location.longitude,
    severity,
    confidence: 0.75,
    radiusKm: 75,
    timestamp: w.observedAt,
    source: "Open-Meteo",
    sourceUrl: "https://open-meteo.com/en/docs",
    description: `Model estimate: ${w.windKph} km/h wind, ${w.precipitationMm} mm precipitation. Not an official warning.`,
    metadata: w,
    evidenceType: "model-estimate",
    stale: payload.status === "stale",
  };
}
