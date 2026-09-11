import * as Cesium from "cesium";
import { MapStackController } from "../mapStackController.js";
import { installRenderGovernor } from "../renderGovernor.js";
import { registerDataCredits } from "../data/dataCredits.js";
import { configureCreditKeyboardAccess } from "../creditKeyboard.js";
import { loadPhotorealisticTileset } from "../mapStartup.js";

export async function createMarketGlobe(onSelect, onStatus) {
  Cesium.Ion.defaultAccessToken = import.meta.env.CESIUM_ION_TOKEN || "";
  const viewer = new Cesium.Viewer("cesiumContainer", {
    animation: false,
    timeline: false,
    baseLayerPicker: false,
    geocoder: false,
    homeButton: false,
    sceneModePicker: false,
    navigationHelpButton: false,
    fullscreenButton: false,
    selectionIndicator: false,
    infoBox: false,
    baseLayer: false,
    creditContainer: "cesium-credits",
  });
  viewer.targetFrameRate = 40;
  viewer.scene.globe.baseColor = Cesium.Color.fromCssColorString("#172d35");
  viewer.scene.backgroundColor = Cesium.Color.fromCssColorString("#070c11");
  viewer.scene.globe.enableLighting = false;
  viewer.scene.skyAtmosphere.brightnessShift = -0.25;
  installRenderGovernor(viewer);
  registerDataCredits(viewer);
  configureCreditKeyboardAccess(document);
  const maps = new MapStackController(viewer, {
    cesiumToken: import.meta.env.CESIUM_ION_TOKEN,
    onError: (message) => onStatus(message),
  });
  // Map failure must never prevent company interaction.
  maps
    .setStack("esri-imagery")
    .then((state) =>
      onStatus(
        state.lastError
          ? `Map degraded: ${state.lastError}`
          : "Satellite imagery · Esri",
      ),
    );
  const assets = new Cesium.CustomDataSource("company-assets");
  const paths = new Cesium.CustomDataSource("dependency-paths");
  const signals = new Cesium.CustomDataSource("market-events");
  await Promise.all([
    viewer.dataSources.add(assets),
    viewer.dataSources.add(paths),
    viewer.dataSources.add(signals),
  ]);
  viewer.screenSpaceEventHandler.setInputAction((movement) => {
    const entity = viewer.scene.pick(movement.position)?.id;
    if (entity?.marketRecord) onSelect(entity.marketRecord);
  }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
  const position = (p) =>
    Cesium.Cartesian3.fromDegrees(p.longitude, p.latitude, 1500);
  const flyTo = (p, height = 650000, duration = 1.8) =>
    new Promise((resolve) => {
      viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(
          p.longitude,
          p.latitude,
          p.height || height,
        ),
        orientation: { heading: 0, pitch: -Math.PI / 2, roll: 0 },
        duration,
        complete: () => resolve(true),
        cancel: () => resolve(false),
      });
    });
  function showCompany(company) {
    assets.entities.removeAll();
    paths.entities.removeAll();
    const color = Cesium.Color.fromCssColorString(company.color);
    for (const location of company.locations) {
      const context = location.relationship === "context-only";
      const entity = assets.entities.add({
        id: location.id,
        position: position(location),
        point: {
          pixelSize: context ? 8 : 11,
          color: context ? Cesium.Color.fromCssColorString("#8ca6b9") : color,
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 2,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
        label: {
          text: location.name,
          font: "12px sans-serif",
          fillColor: Cesium.Color.WHITE,
          showBackground: true,
          backgroundColor:
            Cesium.Color.fromCssColorString("#101a24").withAlpha(0.88),
          pixelOffset: new Cesium.Cartesian2(14, -5),
          horizontalOrigin: Cesium.HorizontalOrigin.LEFT,
          distanceDisplayCondition: new Cesium.DistanceDisplayCondition(
            0,
            4000000,
          ),
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
      });
      entity.marketRecord = { kind: "location", record: location };
    }
    const anchor = company.locations[0];
    for (const loc of company.locations
      .slice(1)
      .filter((l) => l.relationship !== "context-only")) {
      paths.entities.add({
        polyline: {
          positions: [position(anchor), position(loc)],
          width: 1.5,
          material: new Cesium.PolylineDashMaterialProperty({
            color: color.withAlpha(0.5),
          }),
          arcType: Cesium.ArcType.GEODESIC,
        },
      });
    }
    viewer.scene.requestRender();
  }
  function showEvents(events) {
    signals.entities.removeAll();
    for (const event of events) {
      const entity = signals.entities.add({
        id: event.id,
        position: position(event),
        point: {
          pixelSize: 8 + event.severity * 7,
          color: Cesium.Color.fromCssColorString("#f1ad69"),
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 2,
        },
        ellipse: {
          semiMajorAxis: Math.min(event.radiusKm || 80, 150) * 1000,
          semiMinorAxis: Math.min(event.radiusKm || 80, 150) * 1000,
          material: Cesium.Color.fromCssColorString("#e6a16b").withAlpha(0.1),
          height: 500,
        },
      });
      entity.marketRecord = { kind: "event", record: event };
    }
    viewer.scene.requestRender();
  }
  return {
    viewer,
    maps,
    flyTo,
    showCompany,
    showEvents,
    async enablePhotorealistic() {
      if (maps.googleTileset) return maps.setStack("photoreal");
      const { tileset, errors } = await loadPhotorealisticTileset(Cesium, {
        googleApiKey: import.meta.env.GOOGLE_MAPS_API_KEY,
        cesiumToken: import.meta.env.CESIUM_ION_TOKEN,
      });
      if (!tileset)
        throw new Error(
          errors[0]?.message ||
            "Set a Google Maps API key or Cesium ion token in .env, then restart.",
        );
      viewer.scene.primitives.add(tileset);
      maps.googleTileset = tileset;
      return maps.setStack("photoreal");
    },
    toggle: (name, visible) => {
      ({ assets, paths, signals })[name].show = visible;
      viewer.scene.requestRender();
    },
    highlight: (location) => {
      viewer.selectedEntity = assets.entities.getById(location.id);
      return flyTo(location);
    },
    connect: (event, location) => {
      paths.entities.add({
        polyline: {
          positions: [position(event), position(location)],
          width: 3,
          material: Cesium.Color.fromCssColorString("#f1ad69"),
        },
      });
      viewer.scene.requestRender();
    },
  };
}
