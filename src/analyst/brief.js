import { severityLabel } from "../exposure/engine.js";
export function generateBrief(company, assessment, snapshot) {
  const lead = assessment.exposures[0];
  return [
    `# ${company.name} Geographic Exposure Brief`,
    `As of ${assessment.calculatedAt} · model ${assessment.modelVersion}`,
    ...(snapshot.mode === "replay"
      ? [
          "HISTORICAL REPLAY: April 2024 earthquake applied to the current curated company footprint. Not a contemporaneous reconstruction or a claim of realized financial loss.",
        ]
      : []),
    `## Current screening exposure\n${snapshot.sources.some((s) => s.status === "ready" || s.status === "cached") ? `${assessment.score}/100 · ${severityLabel(assessment.score).toUpperCase()}` : "UNAVAILABLE — insufficient source coverage"}`,
    "A screening score is not a probability of disruption, a price forecast, or a revenue estimate.",
    `## Structural dependency\n${company.thesis}`,
    `## Potential impact\n${lead?.explanation || "No event intersects the mapped assets within the model screening radii. This does not establish that operations are safe."}`,
    `## Active evidence\n${
      assessment.exposures
        .slice(0, 5)
        .map((e) => `- ${e.score}/100: ${e.explanation}`)
        .join("\n") || "- No correlated event evidence."
    }`,
    `## Source coverage\n${snapshot.sources.map((s) => `- ${s.key}: ${s.status}; last successful retrieval ${s.retrievedAt || "never"}${s.error ? `; ${s.error}` : ""}`).join("\n")}`,
    `## Method\n100 × severity × proximity × importance × confidence × freshness. Company score is the maximum asset-event score, avoiding duplicate-campus inflation. Geographic concentration is described qualitatively; precise revenue weights are not known.`,
    `## Unknowns\n${[...company.unknowns, "Proximity alone does not confirm a facility interruption.", "Port shutdowns, flight disruption and shipment attribution have not been verified."].map((x) => `- ${x}`).join("\n")}`,
    `## Evidence sources\n${[...new Set([...company.suppliers, ...company.locations, ...snapshot.events.filter((e) => assessment.exposures.some((x) => x.eventId === e.id))].map((s) => `- ${s.source}: ${s.sourceUrl}`))].join("\n")}`,
    "Informational analysis only. Not investment advice.",
  ].join("\n\n");
}
