export function planInvestigation(
  company,
  assessment,
  events,
  preferredEventId = null,
) {
  const lead =
      assessment.exposures.find((e) => e.eventId === preferredEventId) ||
      assessment.exposures[0],
    event = events.find((e) => e.id === lead?.eventId);
  const locations = lead
    ? lead.rows.slice(0, 2).map((r) => r.location)
    : company.locations
        .filter((l) => l.relationship !== "context-only")
        .slice(0, 2);
  return [
    {
      title: "Establish the company footprint",
      detail: company.thesis,
      location: company.focus,
    },
    ...(event
      ? [
          {
            title:
              preferredEventId === event.id
                ? "Locate the selected event evidence"
                : "Locate the strongest event evidence",
            detail: `${event.title}. ${event.description}`,
            location: event,
            event,
          },
        ]
      : [
          {
            title: "Check available world signals",
            detail:
              "No correlated event found in the available snapshot. Source gaps remain explicit.",
          },
        ]),
    ...locations.map((location) => ({
      title: `Inspect ${location.name}`,
      detail: location.description,
      location,
      event,
    })),
    {
      title: "Review logistics evidence",
      detail:
        "Nearby infrastructure is contextual only. No verified shipment attribution, port closure or airport disruption feed is connected.",
    },
    {
      title: "Calculate and qualify exposure",
      detail: `Screening score ${assessment.score}/100. Deterministic model ${assessment.modelVersion}; potential consequences are inferences, not confirmed losses.`,
    },
  ];
}
export async function runInvestigation(
  plan,
  { flyTo, onStep, signal, pace = 900 },
) {
  for (const [index, step] of plan.entries()) {
    if (signal.aborted) return false;
    onStep(index, "running", step);
    if (step.location) {
      const moved = await flyTo(step.location);
      if (signal.aborted) return false;
      if (!moved) {
        onStep(index, "cancelled", step);
        return false;
      }
    }
    if (signal.aborted) return false;
    onStep(index, "complete", step);
    await new Promise((resolve) => {
      const done = () => {
        clearTimeout(timer);
        signal.removeEventListener("abort", done);
        resolve();
      };
      const timer = setTimeout(done, pace);
      signal.addEventListener("abort", done, { once: true });
    });
  }
  return !signal.aborted;
}
