"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import type { GeoJSONSource, Map as MapLibreMap, Marker, RasterTileSource } from "maplibre-gl";
import type { Facility } from "@/lib/types";
import type { MapGeometry, OfficialAlert } from "@/lib/weather-types";
import { geometryBounds, hasAlertShape } from "@/lib/geo";
import { hasCoordinates } from "@/lib/operator";
import { radarTileUrl } from "@/lib/radar-frames";
import "maplibre-gl/dist/maplibre-gl.css";

type MapLibreModule = typeof import("maplibre-gl");

let mapLibreLoad: Promise<MapLibreModule> | null = null;

const loadMapLibre = (): Promise<MapLibreModule> => {
  if (mapLibreLoad) return mapLibreLoad;
  mapLibreLoad = new Promise((resolve, reject) => {
    const host = window as Window & { __maplibre?: MapLibreModule };
    if (host.__maplibre) {
      resolve(host.__maplibre);
      return;
    }
    const timer = window.setTimeout(() => reject(new Error("MapLibre did not load")), 12000);
    window.addEventListener("maplibre-ready", () => {
      window.clearTimeout(timer);
      if (host.__maplibre) resolve(host.__maplibre);
      else reject(new Error("MapLibre did not load"));
    }, { once: true });
    const script = document.createElement("script");
    script.type = "module";
    script.textContent = `import * as maplibregl from "/vendor/maplibre-gl.mjs"; window.__maplibre = maplibregl; window.dispatchEvent(new Event("maplibre-ready"));`;
    document.head.appendChild(script);
  });
  mapLibreLoad.catch(() => { mapLibreLoad = null; });
  return mapLibreLoad;
};

const STYLE_URL = "https://tiles.openfreemap.org/styles/dark";
export const NATIONAL_BOUNDS: [[number, number], [number, number]] = [[-125, 24.2], [-66.5, 49.6]];

export type StormMapStatus = "loading" | "ready" | "error";
export type StormMapApi = {
  national: () => void;
  fitGeometry: (geometry: MapGeometry) => void;
  fitFacilities: () => void;
  locate: () => void;
  zoomBy: (factor: number) => void;
};

const readToken = (name: string, fallback: string) =>
  getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;

const HALO = "#05070b";

const paintSafe = (map: MapLibreMap, id: string, name: string, value: unknown) => {
  try { map.setPaintProperty(id, name as never, value as never); } catch { /* this layer does not use the property */ }
};

const PATTERN_PROPS = ["fill-pattern", "fill-extrusion-pattern", "line-pattern"] as const;
const VEGETATION = /wood|forest|grass|park|garden|scrub|wetland|pitch|vegetation|landcover_wood|landuse_park/;

const restyleNight = (map: MapLibreMap) => {
  const layers = map.getStyle()?.layers ?? [];
  const sample = layers.find(layer => layer.type === "symbol" && Array.isArray(layer.layout?.["text-font"]));
  const textFont = (sample && sample.type === "symbol" && Array.isArray(sample.layout?.["text-font"])
    ? sample.layout["text-font"]
    : ["Noto Sans Regular"]) as string[];
  for (const layer of layers) {
    const id = layer.id.toLowerCase();
    for (const prop of PATTERN_PROPS) paintSafe(map, layer.id, prop, null);
    const icon = layer.type === "symbol" ? layer.layout?.["icon-image"] : undefined;
    if (typeof icon === "string" && VEGETATION.test(icon) && !/parking/.test(icon)) paintSafe(map, layer.id, "icon-opacity", 0);
    if (layer.type === "background") paintSafe(map, layer.id, "background-color", "#05070b");
    if (layer.type === "fill" || layer.type === "fill-extrusion") {
      const key = layer.type === "fill" ? "fill-color" : "fill-extrusion-color";
      const vegetation = VEGETATION.test(id) && !/parking|water/.test(id);
      if (/water|ocean|sea|river|lake/.test(id)) paintSafe(map, layer.id, key, "#070b12");
      else paintSafe(map, layer.id, key, "#121820");
      if (vegetation) paintSafe(map, layer.id, layer.type === "fill" ? "fill-opacity" : "fill-extrusion-opacity", 1);
    }
    if (layer.type === "line") {
      if (/water/.test(id)) paintSafe(map, layer.id, "line-color", "#121820");
      else if (/road|street|bridge|tunnel|path|rail|transit|transport/.test(id)) paintSafe(map, layer.id, "line-color", "#3a4556");
      else if (/boundary|admin|border/.test(id)) paintSafe(map, layer.id, "line-color", "#2c3646");
    }
    if (layer.type === "symbol") {
      paintSafe(map, layer.id, "text-color", "#f7f2e8");
      paintSafe(map, layer.id, "text-halo-color", HALO);
      paintSafe(map, layer.id, "text-halo-width", 2.8);
      paintSafe(map, layer.id, "text-halo-blur", 0);
      paintSafe(map, layer.id, "icon-color", "#d5dbe3");
      paintSafe(map, layer.id, "icon-halo-color", HALO);
      paintSafe(map, layer.id, "icon-halo-width", 1.6);
    }
  }
  return textFont;
};

const keepWeatherReadable = (map: MapLibreMap) => {
  if (!map.getLayer("iem-radar")) return;
  const layers = map.getStyle()?.layers ?? [];
  const road = layers.find(layer => layer.type === "line" && /highway|road|railway|aeroway|boundary/.test(layer.id));
  if (road) {
    try { map.moveLayer("iem-radar", road.id); } catch { /* the style is swapping layers */ }
  }
  for (const id of ["alert-fill", "alert-halo", "alert-line", "alert-label"]) {
    if (map.getLayer(id)) {
      try { map.moveLayer(id); } catch { /* the alert layer has not settled */ }
    }
  }
  const symbols = (map.getStyle()?.layers ?? [])
    .filter(layer => layer.type === "symbol" && !layer.id.startsWith("alert-"))
    .map(layer => layer.id);
  for (const id of symbols) {
    try { map.moveLayer(id); } catch { /* a label layer left during the restyle */ }
  }
};

const alertCollection = (alerts: OfficialAlert[]) => ({
  type: "FeatureCollection" as const,
  features: alerts.filter(alert => hasAlertShape(alert.geometry)).map(alert => ({
    type: "Feature" as const,
    id: alert.id,
    properties: { id: alert.id, severity: alert.severity ?? "Unknown", event: alert.event ?? "Alert" },
    geometry: alert.geometry as MapGeometry,
  })),
});

type LocatedFacility = Facility & { lat: number; lon: number };
const markerGroups = (rows: Facility[], zoom: number): LocatedFacility[][] => {
  const located = rows.filter(hasCoordinates);
  if (zoom >= 8 || located.length < 2) return located.map(row => [row]);
  const cell = zoom < 5 ? 1.5 : 0.6;
  const groups = new Map<string, LocatedFacility[]>();
  for (const row of located) {
    const key = `${Math.round(row.lat / cell)}:${Math.round(row.lon / cell)}`;
    const list = groups.get(key);
    if (list) list.push(row);
    else groups.set(key, [row]);
  }
  return [...groups.values()];
};

export const StormMap = forwardRef<StormMapApi, {
  alerts: OfficialAlert[];
  facilities: Facility[];
  countyName?: string;
  countyState?: string;
  selectedAlertId: string;
  selectedFacilityId: string;
  frameId: string;
  radarVisible: boolean;
  radarOpacity: number;
  playing: boolean;
  porchId: string;
  alertsVisible: boolean;
  radarRetry: number;
  reducedMotion: boolean;
  onSelectAlert: (id: string) => void;
  onSelectFacility: (id: string) => void;
  onBasemapStatus: (status: StormMapStatus) => void;
  onRadarStatus: (status: StormMapStatus) => void;
  onLocateResult: (message: string) => void;
}>((props, ref) => {
  const shell = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const libRef = useRef<MapLibreModule | null>(null);
  const markers = useRef<Marker[]>([]);
  const locateMarker = useRef<Marker | null>(null);
  const radarBook = useRef({ ok: false, errors: 0 });
  const propsRef = useRef(props);
  propsRef.current = props;
  const [mapReady, setMapReady] = useState(false);
  const [markerZoom, setMarkerZoom] = useState(4);

  const motion = (ms: number) => props.reducedMotion ? 0 : ms;

  useImperativeHandle(ref, () => ({
    national: () => mapRef.current?.fitBounds(NATIONAL_BOUNDS, { padding: 24, duration: motion(0), maxZoom: 4.2 }),
    fitGeometry: geometry => {
      const bounds = geometryBounds(geometry);
      if (bounds) mapRef.current?.fitBounds(bounds, { padding: 56, duration: motion(480), maxZoom: 12 });
    },
    fitFacilities: () => {
      const map = mapRef.current;
      const lib = libRef.current;
      if (!map || !lib) return;
      const points = propsRef.current.facilities.filter(hasCoordinates);
      if (!points.length) return;
      const bounds = new lib.LngLatBounds();
      points.forEach(row => bounds.extend([row.lon, row.lat]));
      map.fitBounds(bounds, {
        padding: { top: 72, right: 24, bottom: 48, left: 24 },
        duration: motion(480),
        maxZoom: 14,
      });
    },
    locate: () => {
      const map = mapRef.current;
      if (!map) return;
      if (!navigator.geolocation) {
        propsRef.current.onLocateResult("This browser has no location service. No point was guessed.");
        return;
      }
      propsRef.current.onLocateResult("Asking this browser for a location.");
      navigator.geolocation.getCurrentPosition(async position => {
        const current = mapRef.current;
        const lib = libRef.current;
        if (!current || !lib) return;
        const lngLat: [number, number] = [position.coords.longitude, position.coords.latitude];
        current.flyTo({ center: lngLat, zoom: Math.max(current.getZoom(), 11), duration: motion(480) });
        locateMarker.current?.remove();
        const element = document.createElement("div");
        element.className = "locate-pin";
        element.textContent = "Here";
        locateMarker.current = new lib.Marker({ element, anchor: "center" }).setLngLat(lngLat).addTo(current);
        propsRef.current.onLocateResult("Browser location is on the chart. It is not a facility.");
      }, error => {
        propsRef.current.onLocateResult(error.code === error.PERMISSION_DENIED
          ? "Location permission was denied. No point was guessed."
          : "This browser couldn't read a location. No point was guessed.");
      }, { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 });
    },
    zoomBy: factor => {
      const map = mapRef.current;
      if (!map) return;
      map.easeTo({ zoom: map.getZoom() + Math.log2(factor), around: map.getCenter(), duration: motion(180) });
    },
  }));

  useEffect(() => {
    const node = canvas.current;
    const shellNode = shell.current;
    if (!node || !shellNode) return;
    let map: MapLibreMap | undefined;
    let cancelled = false;
    const loadTimer = window.setTimeout(() => {
      if (!cancelled && map && !map.isStyleLoaded()) propsRef.current.onBasemapStatus("error");
    }, 10000);
    propsRef.current.onBasemapStatus("loading");
    propsRef.current.onRadarStatus("loading");

    void (async () => {
      const maplibregl = await loadMapLibre();
      if (cancelled) return;
      libRef.current = maplibregl;
      try {
        map = new maplibregl.Map({
          container: node,
          style: STYLE_URL,
          bounds: NATIONAL_BOUNDS,
          fitBoundsOptions: { padding: 24 },
          attributionControl: false,
          dragRotate: false,
          pitchWithRotate: false,
          touchPitch: false,
          keyboard: true,
          maxPitch: 0,
          fadeDuration: propsRef.current.reducedMotion ? 0 : 280,
          refreshExpiredTiles: false,
        });
      } catch {
        if (!cancelled) propsRef.current.onBasemapStatus("error");
        return;
      }
      if (cancelled) { map.remove(); return; }
      mapRef.current = map;
      map.touchZoomRotate.disableRotation();
      map.keyboard.disableRotation();
      map.addControl(new maplibregl.AttributionControl({
        compact: true,
        customAttribution: "Base map © OpenStreetMap, © OpenMapTiles, © OpenFreeMap. Radar © Iowa Environmental Mesonet.",
      }), "bottom-right");
      map.getContainer().querySelector(".maplibregl-ctrl-attrib")?.classList.remove("maplibregl-compact-show");
      const surface = map.getCanvas();
      surface.setAttribute("aria-label", "Storm Watch chart with a dark street map, NEXRAD radar, and official alert shapes");
      surface.tabIndex = 0;
      const sync = () => {
        if (!map) return;
        const center = map.getCenter();
        shellNode.dataset.loaded = map.isStyleLoaded() ? "true" : "false";
        shellNode.dataset.zoom = map.getZoom().toFixed(3);
        shellNode.dataset.lng = center.lng.toFixed(5);
        shellNode.dataset.lat = center.lat.toFixed(5);
        shellNode.dataset.tilesLoaded = String(map.areTilesLoaded());
      };
      map.on("moveend", sync);
      map.on("zoomend", () => { if (!cancelled && map) setMarkerZoom(map.getZoom()); });
      map.on("idle", sync);
      map.on("load", () => {
        if (!map || cancelled) return;
        window.clearTimeout(loadTimer);
        const textFont = restyleNight(map);
        let woodPattern: unknown;
        try { woodPattern = map.getLayer("landcover_wood") ? map.getPaintProperty("landcover_wood", "fill-pattern") : undefined; }
        catch { woodPattern = undefined; }
        shellNode.dataset.woodPattern = woodPattern ? String(woodPattern) : "off";
        const severe = {
          Extreme: readToken("--color-severity-extreme", "#ff5a36"),
          Severe: readToken("--color-severity-severe", "#ef7a5f"),
          Moderate: readToken("--color-severity-moderate", "#ebe4cf"),
          Minor: readToken("--color-severity-minor", "#8fd3ff"),
          Unknown: readToken("--color-severity-unknown", "#a8b0bc"),
        };
        const match = ["match", ["get", "severity"], "Extreme", severe.Extreme, "Severe", severe.Severe, "Moderate", severe.Moderate, "Minor", severe.Minor, severe.Unknown] as const;
        const placeLabels = map.getStyle().layers?.find(layer => layer.type === "symbol")?.id;
        const opacity = propsRef.current.radarVisible ? propsRef.current.radarOpacity : 0;
        map.addSource("iem-radar", { type: "raster", tiles: [radarTileUrl(propsRef.current.frameId)], tileSize: 256, maxzoom: 12 });
        map.addLayer({
          id: "iem-radar", type: "raster", source: "iem-radar",
          paint: { "raster-opacity": opacity, "raster-fade-duration": 0, "raster-resampling": "linear" },
        }, placeLabels);
        map.addSource("alerts", { type: "geojson", data: alertCollection(propsRef.current.alerts) });
        map.addLayer({ id: "alert-fill", type: "fill", source: "alerts", paint: { "fill-color": match as never, "fill-opacity": 0.28 } });
        map.addLayer({ id: "alert-halo", type: "line", source: "alerts", paint: { "line-color": HALO, "line-width": 8, "line-opacity": 1 } });
        map.addLayer({ id: "alert-line", type: "line", source: "alerts", paint: { "line-color": match as never, "line-width": 2.8, "line-blur": 0 } });
        try {
          map.addLayer({
            id: "alert-label", type: "symbol", source: "alerts",
            layout: {
              "text-field": ["concat", ["get", "event"], " · ", ["get", "severity"]],
              "text-size": 12,
              "text-font": textFont,
              "text-max-width": 14,
              "text-allow-overlap": false,
              "text-padding": 2,
            },
            paint: { "text-color": "#fffaf0", "text-halo-color": HALO, "text-halo-width": 3.2, "text-halo-blur": 0.2 },
          });
        } catch { /* strokes still sit above the radar if the style font rejects the label */ }
        keepWeatherReadable(map);
        map.once("idle", () => { if (!cancelled && map) keepWeatherReadable(map); });
        map.on("click", "alert-fill", event => {
          const id = event.features?.[0]?.properties?.id;
          if (typeof id === "string") propsRef.current.onSelectAlert(id);
        });
        map.on("mouseenter", "alert-fill", () => { map?.getCanvas().style.setProperty("cursor", "pointer"); });
        map.on("mouseleave", "alert-fill", () => { map?.getCanvas().style.setProperty("cursor", ""); });
        shellNode.dataset.ready = "true";
        propsRef.current.onBasemapStatus("ready");
        sync();
        if (!cancelled) {
          setMarkerZoom(map.getZoom());
          setMapReady(true);
        }
      });
      map.on("error", event => {
        const sourceId = "sourceId" in event ? String((event as { sourceId?: string }).sourceId ?? "") : "";
        if (sourceId === "iem-radar") {
          radarBook.current.errors += 1;
          propsRef.current.onRadarStatus("error");
          return;
        }
        if (!sourceId && map && !map.isStyleLoaded()) propsRef.current.onBasemapStatus("error");
      });
      map.on("sourcedata", event => {
        if (event.sourceId === "iem-radar" && event.isSourceLoaded && radarBook.current.errors === 0) {
          radarBook.current.ok = true;
          propsRef.current.onRadarStatus("ready");
        }
      });
    })().catch(() => { if (!cancelled) propsRef.current.onBasemapStatus("error"); });

    return () => {
      cancelled = true;
      window.clearTimeout(loadTimer);
      markers.current.forEach(marker => marker.remove());
      markers.current = [];
      locateMarker.current?.remove();
      locateMarker.current = null;
      map?.remove();
      mapRef.current = null;
      shellNode.dataset.ready = "false";
      shellNode.dataset.loaded = "false";
      setMapReady(false);
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const source = map?.getSource("alerts") as GeoJSONSource | undefined;
    if (!mapReady || !source) return;
    source.setData(alertCollection(props.alerts));
  }, [mapReady, props.alerts]);

  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map?.getLayer("alert-line")) return;
    const selected = props.selectedAlertId || "";
    if (map.getLayer("alert-halo")) map.setPaintProperty("alert-halo", "line-width", ["case", ["==", ["get", "id"], selected], 10, 8]);
    map.setPaintProperty("alert-line", "line-width", ["case", ["==", ["get", "id"], selected], 4.2, 2.8]);
  }, [mapReady, props.selectedAlertId]);

  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map?.getLayer("iem-radar")) return;
    map.setPaintProperty("iem-radar", "raster-opacity", props.radarVisible ? props.radarOpacity : 0);
    map.setPaintProperty("iem-radar", "raster-fade-duration", props.reducedMotion || !props.playing ? 0 : 160);
    const visibility = props.alertsVisible ? "visible" : "none";
    for (const id of ["alert-fill", "alert-halo", "alert-line", "alert-label"]) {
      if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", visibility);
    }
  }, [mapReady, props.radarVisible, props.radarOpacity, props.alertsVisible, props.playing, props.reducedMotion]);

  useEffect(() => {
    const map = mapRef.current;
    const lib = libRef.current;
    if (!mapReady || !map || !lib) return;
    markers.current.forEach(marker => marker.remove());
    const place = [props.countyName, props.countyState].filter(Boolean).join(", ");
    markers.current = markerGroups(props.facilities, markerZoom).map(group => {
      const element = document.createElement("button");
      element.type = "button";
      const porch = group.some(row => row.id === props.porchId);
      const lat = group.reduce((sum, row) => sum + row.lat, 0) / group.length;
      const lon = group.reduce((sum, row) => sum + row.lon, 0) / group.length;
      if (group.length === 1) {
        const row = group[0];
        element.className = `facility-pin${row.id === props.selectedFacilityId ? " is-selected" : ""}${row.id === props.porchId ? " is-porch" : ""}`;
        element.dataset.facilityId = row.id;
        element.dataset.type = row.type;
        element.textContent = String(row.rank);
        element.setAttribute("aria-label", `Rank ${row.rank}, ${row.name}`);
        element.setAttribute("aria-pressed", row.id === props.selectedFacilityId ? "true" : "false");
        element.addEventListener("click", () => propsRef.current.onSelectFacility(row.id));
      } else {
        element.className = "facility-cluster";
        element.dataset.count = String(group.length);
        const count = document.createElement("span");
        count.className = "facility-cluster-count";
        count.textContent = String(group.length);
        element.append(count);
        element.setAttribute("aria-label", `${group.length} retrospective facilities located in ${place || "this county"}. Not a live alert count.`);
        element.addEventListener("click", () => {
          const current = mapRef.current;
          const currentLib = libRef.current;
          if (!current || !currentLib) return;
          const bounds = new currentLib.LngLatBounds();
          group.forEach(row => bounds.extend([row.lon, row.lat]));
          current.fitBounds(bounds, { padding: 72, duration: propsRef.current.reducedMotion ? 0 : 480, maxZoom: 12 });
        });
      }
      const marker = new lib.Marker({ element, anchor: "center" }).setLngLat([lon, lat]).addTo(map);
      const parent = element.parentElement;
      if (parent) parent.style.zIndex = porch ? "5" : "4";
      return marker;
    });
    return () => { markers.current.forEach(marker => marker.remove()); };
  }, [mapReady, markerZoom, props.facilities, props.selectedFacilityId, props.porchId, props.countyName, props.countyState]);

  useEffect(() => {
    const map = mapRef.current;
    const source = map?.getSource("iem-radar") as RasterTileSource | undefined;
    if (!mapReady || !source) return;
    radarBook.current = { ok: false, errors: 0 };
    propsRef.current.onRadarStatus("loading");
    source.setTiles([radarTileUrl(props.frameId)]);
  }, [mapReady, props.frameId, props.radarRetry]);

  return (
    <div ref={shell} className="storm-map" data-loaded="false" data-ready={mapReady ? "true" : "false"} data-frame={props.frameId} data-playing={props.playing ? "true" : "false"} data-radar-opacity={props.radarOpacity.toFixed(2)} data-markers={markerGroups(props.facilities, markerZoom).some(group => group.length > 1) ? "cluster" : "pins"}>
      <div ref={canvas} className="storm-map-canvas" />
    </div>
  );
});
StormMap.displayName = "StormMap";
