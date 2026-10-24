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

const restyleNight = (map: MapLibreMap) => {
  const layers = map.getStyle()?.layers ?? [];
  const sample = layers.find(layer => layer.type === "symbol" && Array.isArray(layer.layout?.["text-font"]));
  const textFont = (sample && sample.type === "symbol" && Array.isArray(sample.layout?.["text-font"])
    ? sample.layout["text-font"]
    : ["Noto Sans Regular"]) as string[];
  for (const layer of layers) {
    const id = layer.id.toLowerCase();
    if (layer.type === "background") paintSafe(map, layer.id, "background-color", "#05070b");
    if (layer.type === "fill" || layer.type === "fill-extrusion") {
      const key = layer.type === "fill" ? "fill-color" : "fill-extrusion-color";
      if (/water|ocean|sea|river|lake/.test(id)) paintSafe(map, layer.id, key, "#070b12");
      else if (/park|landcover|wood|grass|forest|pitch|garden|scrub|wetland|sand|national/.test(id)) paintSafe(map, layer.id, key, "#10151d");
      else if (/landuse|land|earth|residential|industrial|commercial|building/.test(id)) paintSafe(map, layer.id, key, "#121820");
    }
    if (layer.type === "line") {
      if (/water/.test(id)) paintSafe(map, layer.id, "line-color", "#121820");
      else if (/road|street|bridge|tunnel|path|rail|transit|transport/.test(id)) paintSafe(map, layer.id, "line-color", "#3a4556");
      else if (/boundary|admin|border/.test(id)) paintSafe(map, layer.id, "line-color", "#2c3646");
    }
    if (layer.type === "symbol") {
      paintSafe(map, layer.id, "text-color", "#ebe4cf");
      paintSafe(map, layer.id, "text-halo-color", HALO);
      paintSafe(map, layer.id, "text-halo-width", 1.5);
      paintSafe(map, layer.id, "icon-color", "#c5ccd6");
    }
  }
  return textFont;
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

export const StormMap = forwardRef<StormMapApi, {
  alerts: OfficialAlert[];
  facilities: Facility[];
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
      map.on("idle", sync);
      map.on("load", () => {
        if (!map || cancelled) return;
        window.clearTimeout(loadTimer);
        const textFont = restyleNight(map);
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
          paint: { "raster-opacity": opacity, "raster-fade-duration": 0 },
        }, placeLabels);
        map.addSource("alerts", { type: "geojson", data: alertCollection(propsRef.current.alerts) });
        map.addLayer({ id: "alert-fill", type: "fill", source: "alerts", paint: { "fill-color": match as never, "fill-opacity": 0.18 } }, placeLabels);
        map.addLayer({ id: "alert-halo", type: "line", source: "alerts", paint: { "line-color": HALO, "line-width": 6.5, "line-opacity": 0.95 } }, placeLabels);
        map.addLayer({ id: "alert-line", type: "line", source: "alerts", paint: { "line-color": match as never, "line-width": 2.2, "line-blur": 0 } }, placeLabels);
        try {
          map.addLayer({
            id: "alert-label", type: "symbol", source: "alerts",
            layout: {
              "text-field": ["concat", ["get", "event"], " · ", ["get", "severity"]],
              "text-size": 13,
              "text-font": textFont,
              "text-max-width": 16,
            },
            paint: { "text-color": "#ebe4cf", "text-halo-color": HALO, "text-halo-width": 1.8 },
          }, placeLabels);
        } catch { /* strokes still sit above the radar if the style font rejects the label */ }
        map.on("click", "alert-fill", event => {
          const id = event.features?.[0]?.properties?.id;
          if (typeof id === "string") propsRef.current.onSelectAlert(id);
        });
        map.on("mouseenter", "alert-fill", () => { map?.getCanvas().style.setProperty("cursor", "pointer"); });
        map.on("mouseleave", "alert-fill", () => { map?.getCanvas().style.setProperty("cursor", ""); });
        shellNode.dataset.ready = "true";
        propsRef.current.onBasemapStatus("ready");
        sync();
        if (!cancelled) setMapReady(true);
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
    if (map.getLayer("alert-halo")) map.setPaintProperty("alert-halo", "line-width", ["case", ["==", ["get", "id"], selected], 8.5, 6.5]);
    map.setPaintProperty("alert-line", "line-width", ["case", ["==", ["get", "id"], selected], 3.6, 2.2]);
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
    let cancelled = false;
    markers.current.forEach(marker => marker.remove());
    markers.current = props.facilities.filter(hasCoordinates).map(row => {
      const element = document.createElement("button");
      element.type = "button";
      element.className = `facility-pin${row.id === props.selectedFacilityId ? " is-selected" : ""}${row.id === props.porchId ? " is-porch" : ""}`;
      element.dataset.facilityId = row.id;
      element.dataset.type = row.type;
      element.textContent = String(row.rank);
      element.setAttribute("aria-label", `Rank ${row.rank}, ${row.name}`);
      element.setAttribute("aria-pressed", row.id === props.selectedFacilityId ? "true" : "false");
      element.addEventListener("click", () => propsRef.current.onSelectFacility(row.id));
      const marker = new lib.Marker({ element, anchor: "center" }).setLngLat([row.lon, row.lat]).addTo(map);
      return marker;
    });
    return () => { cancelled = true; void cancelled; };
  }, [mapReady, props.facilities, props.selectedFacilityId, props.porchId]);

  useEffect(() => {
    const map = mapRef.current;
    const source = map?.getSource("iem-radar") as RasterTileSource | undefined;
    if (!mapReady || !source) return;
    radarBook.current = { ok: false, errors: 0 };
    propsRef.current.onRadarStatus("loading");
    source.setTiles([radarTileUrl(props.frameId)]);
  }, [mapReady, props.frameId, props.radarRetry]);

  return (
    <div ref={shell} className="storm-map" data-loaded="false" data-ready={mapReady ? "true" : "false"} data-frame={props.frameId} data-playing={props.playing ? "true" : "false"} data-radar-opacity={props.radarOpacity.toFixed(2)}>
      <div ref={canvas} className="storm-map-canvas" />
    </div>
  );
});
StormMap.displayName = "StormMap";
