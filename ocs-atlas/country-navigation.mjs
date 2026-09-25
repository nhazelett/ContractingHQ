// Country navigation sits beneath evidence overlays so research features keep
// their own click behavior. No nearest-country guess is made for ocean clicks.
export const EVIDENCE_LAYERS = [
  "atlas-origins",
  "atlas-target",
  "atlas-global",
  "atlas-flow",
  "logistics-airfields",
  "logistics-ports",
  "transport-roads",
  "transport-rail",
  "transport-borders",
];
export function navigationCountry(hits, validCodes) {
  if (hits.some((f) => EVIDENCE_LAYERS.includes(f.layer?.id))) return null;
  const hit = hits.find(
    (f) =>
      ["atlas-country-targets", "atlas-countries"].includes(f.layer?.id) &&
      validCodes.has(f.properties?.code),
  );
  return hit?.properties.code || null;
}
export function missingCountryTargets(countries, features) {
  const mapped = new Set(features.map((f) => f.properties.code));
  return countries
    .filter(
      (c) =>
        !mapped.has(c.code) &&
        c.latlng?.length === 2 &&
        c.latlng.every(Number.isFinite),
    )
    .map((c) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [c.latlng[1], c.latlng[0]] },
      properties: { code: c.code, name: c.name },
    }));
}
export function initCountryNavigation({
  map,
  countries,
  request,
  getSelected,
  onSelect,
  onStatus,
}) {
  const codes = new Set(countries.map((c) => c.code));
  const lookup = new Map(countries.map((c) => [c.code, c.name]));
  const allLayers = [
    "atlas-country-targets",
    "atlas-countries",
    ...EVIDENCE_LAYERS,
  ];
  let ready = false,
    hovered = "";
  const sync = () => {
    if (!ready) return;
    map.setFilter("atlas-country-selected", [
      "==",
      ["get", "code"],
      getSelected(),
    ]);
    map.setFilter("atlas-country-outline", [
      "==",
      ["get", "code"],
      getSelected(),
    ]);
  };
  const hits = (e) =>
    map.queryRenderedFeatures(e.point, {
      layers: allLayers.filter((id) => map.getLayer(id)),
    });
  request("ocs-atlas/data/country-boundaries.json")
    .then((data) => {
      if (
        data.type !== "FeatureCollection" ||
        !Array.isArray(data.features) ||
        !data.features.length
      )
        throw new Error("Boundary data unavailable");
      const features = data.features.filter(
        (f) =>
          codes.has(f.properties?.code) &&
          ["Polygon", "MultiPolygon"].includes(f.geometry?.type),
      );
      if (!features.length) throw new Error("Boundary data unavailable");
      const before = map.getLayer("atlas-global") ? "atlas-global" : undefined;
      map.addSource("atlas-country-areas", {
        type: "geojson",
        data: { type: "FeatureCollection", features },
        attribution:
          'Country navigation: <a href="https://www.naturalearthdata.com/" target="_blank" rel="noopener">Natural Earth</a>',
      });
      map.addLayer(
        {
          id: "atlas-countries",
          type: "fill",
          source: "atlas-country-areas",
          paint: { "fill-color": "#199e8a", "fill-opacity": 0.01 },
        },
        before,
      );
      map.addLayer(
        {
          id: "atlas-country-selected",
          type: "fill",
          source: "atlas-country-areas",
          filter: ["==", ["get", "code"], getSelected()],
          paint: { "fill-color": "#199e8a", "fill-opacity": 0.12 },
        },
        before,
      );
      map.addLayer(
        {
          id: "atlas-country-outline",
          type: "line",
          source: "atlas-country-areas",
          filter: ["==", ["get", "code"], getSelected()],
          paint: {
            "line-color": "#167c73",
            "line-width": 1.6,
            "line-opacity": 0.7,
          },
        },
        before,
      );
      map.addLayer(
        {
          id: "atlas-country-hover",
          type: "fill",
          source: "atlas-country-areas",
          filter: ["==", ["get", "code"], ""],
          paint: { "fill-color": "#199e8a", "fill-opacity": 0.14 },
        },
        before,
      );
      map.addSource("atlas-country-targets", {
        type: "geojson",
        data: {
          type: "FeatureCollection",
          features: missingCountryTargets(countries, features),
        },
      });
      map.addLayer(
        {
          id: "atlas-country-targets",
          type: "circle",
          source: "atlas-country-targets",
          paint: {
            "circle-radius": 6,
            "circle-color": "#486577",
            "circle-opacity": 0.8,
            "circle-stroke-width": 1,
            "circle-stroke-color": "#fff",
          },
        },
        before,
      );
      ready = true;
      sync();
      onStatus(
        "Click a country on the map to switch research country. Pins and dotted lines open their evidence.",
      );
      map.on("click", (e) => {
        const code = navigationCountry(hits(e), codes);
        if (code && code !== getSelected()) onSelect(code);
      });
      map.on("mousemove", (e) => {
        const code = navigationCountry(hits(e), codes) || "";
        if (code === hovered) return;
        if (code) map.getCanvas().style.cursor = "pointer";
        else if (
          hovered &&
          !hits(e).some((f) => EVIDENCE_LAYERS.includes(f.layer?.id))
        )
          map.getCanvas().style.cursor = "";
        hovered = code;
        map.setFilter("atlas-country-hover", ["==", ["get", "code"], code]);
        onStatus(
          code
            ? `${lookup.get(code)} · ${code === getSelected() ? "selected research country" : "click to research this country"}`
            : "Click a country on the map to switch research country. Pins and dotted lines open their evidence.",
        );
      });
      map.getCanvas().addEventListener("mouseleave", () => {
        hovered = "";
        map.setFilter("atlas-country-hover", ["==", ["get", "code"], ""]);
        map.getCanvas().style.cursor = "";
        onStatus(
          "Click a country on the map to switch research country. Pins and dotted lines open their evidence.",
        );
      });
    })
    .catch(() =>
      onStatus(
        "Country shapes are unavailable. Use the country dropdown to switch.",
      ),
    );
  return { sync };
}
