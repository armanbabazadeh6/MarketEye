// NWS CAP fields retain forecast certainty and onset; a watch is not observed damage.
export function normalizeOfficialAlerts(payload, now = Date.now()) {
  if (!Array.isArray(payload?.features))
    throw Error("Invalid NWS GeoJSON feed");
  return payload.features
    .flatMap((feature) => {
      const p = feature.properties || {},
        expires = Date.parse(p.expires),
        sent = Date.parse(p.sent);
      if (
        p.status !== "Actual" ||
        p.messageType === "Cancel" ||
        !Number.isFinite(expires) ||
        expires <= now ||
        !Number.isFinite(sent) ||
        sent > now + 300000
      )
        return [];
      const source = feature.id || p["@id"];
      if (
        typeof source !== "string" ||
        !source.startsWith("https://api.weather.gov/alerts/")
      )
        return [];
      let location = null;
      const ring =
        feature.geometry?.type === "Polygon"
          ? feature.geometry.coordinates?.[0]
          : null;
      if (
        ring?.length >= 4 &&
        ring.every(
          (v) =>
            Array.isArray(v) &&
            v.length >= 2 &&
            Number.isFinite(v[0]) &&
            Number.isFinite(v[1]) &&
            Math.abs(v[0]) <= 180 &&
            Math.abs(v[1]) <= 90,
        )
      ) {
        const longs = ring.map((v) => v[0]),
          lats = ring.map((v) => v[1]);
        // Do not place a misleading center for a polygon crossing the dateline.
        if (Math.max(...longs) - Math.min(...longs) < 180)
          location = {
            name: p.areaDesc || "NWS alert area",
            latitude: (Math.min(...lats) + Math.max(...lats)) / 2,
            longitude: (Math.min(...longs) + Math.max(...longs)) / 2,
            coordinatePolicy:
              "Bounding-box center of the published alert polygon; not an incident site.",
          };
      }
      return [
        {
          title: `${p.event || "Weather alert"} — ${p.areaDesc || p.headline || "United States"}`,
          url: source,
          domain: p.senderName || "National Weather Service",
          publishedAt: new Date(sent).toISOString(),
          official: true,
          description: String(p.description || "").slice(0, 8000),
          instruction: String(p.instruction || "").slice(0, 4000),
          severity: p.severity || "Unknown",
          certainty: p.certainty || "Unknown",
          urgency: p.urgency || "Unknown",
          onset: p.onset || null,
          expires: new Date(expires).toISOString(),
          location,
        },
      ];
    })
    .sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt));
}
