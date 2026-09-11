import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeOfficialAlerts } from "./officialAlerts.js";
import { linkRegionalFootprint } from "../research/geographicLinks.js";
const now = Date.parse("2026-09-11T12:00:00Z");
const alert = {
  id: "https://api.weather.gov/alerts/test",
  geometry: {
    type: "Polygon",
    coordinates: [
      [
        [-100, 30],
        [-99, 30],
        [-99, 31],
        [-100, 30],
      ],
    ],
  },
  properties: {
    status: "Actual",
    messageType: "Alert",
    sent: "2026-09-11T11:00:00Z",
    expires: "2026-09-11T14:00:00Z",
    event: "Flood Watch",
    certainty: "Possible",
    urgency: "Future",
  },
};
test("official alerts preserve forecast uncertainty and drop cancelled/expired/test alerts", () => {
  const rows = normalizeOfficialAlerts(
    {
      features: [
        alert,
        { ...alert, properties: { ...alert.properties, status: "Test" } },
        {
          ...alert,
          properties: { ...alert.properties, messageType: "Cancel" },
        },
        {
          ...alert,
          properties: { ...alert.properties, expires: "2026-09-10" },
        },
      ],
    },
    now,
  );
  assert.equal(rows.length, 1);
  assert.equal(rows[0].certainty, "Possible");
  assert.equal(rows[0].location.latitude, 30.5);
  assert.match(rows[0].location.coordinatePolicy, /not an incident/);
});
test("regional links exclude context-only infrastructure and do not assert damage", () => {
  const links = linkRegionalFootprint({ latitude: 30, longitude: -100 }, [
    {
      ticker: "TEST",
      locations: [
        { latitude: 30, longitude: -100, relationship: "direct" },
        { latitude: 30, longitude: -100, relationship: "context-only" },
      ],
    },
  ]);
  assert.equal(links.length, 1);
  assert.equal(links[0].distanceKm, 0);
  assert.match(links[0].evidence, /no confirmed/);
});
