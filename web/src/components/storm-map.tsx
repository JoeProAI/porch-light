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
        padding: { top: 88, right: 24, bottom: 210, left: map.getContainer().clientWidth < 600 ? 24 : 210 },
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
        const severe = {
          Extreme: readToken("--color-severity-extreme", "#e07a5f"),
          Severe: readToken("--color-severity-severe", "#efb45e"),
          Moderate: readToken("--color-severity-moderate", "#e6c98a"),
          Minor: readToken("--color-severity-minor", "#92c6d1"),
          Unknown: readToken("--color-severity-unknown", "#abbcc2"),
        };
        const match = ["match", ["get", "severity"], "Extreme", severe.Extreme, "Severe", severe.Severe, "Moderate", severe.Moderate, "Minor", severe.Minor, severe.Unknown] as const;
        const placeLabels = map.getStyle().layers?.find(layer => layer.type === "symbol")?.id;
        map.addSource("iem-radar", { type: "raster", tiles: [radarTileUrl(propsRef.current.frameId)], tileSize: 256, maxzoom: 12 });
        map.addLayer({
          id: "iem-radar", type: "raster", source: "iem-radar",
          paint: { "raster-opacity": propsRef.current.radarVisible ? 0.72 : 0, "raster-fade-duration": propsRef.current.reducedMotion ? 0 : 180 },
        }, placeLabels);
        map.addSource("alerts", { type: "geojson", data: alertCollection(propsRef.current.alerts) });
        map.addLayer({ id: "alert-fill", type: "fill", source: "alerts", paint: { "fill-color": match as never, "fill-opacity": 0.28 } }, placeLabels);
        map.addLayer({ id: "alert-line", type: "line", source: "alerts", paint: { "line-color": match as never, "line-width": 1.4 } });
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
    map.setPaintProperty("alert-line", "line-width", ["case", ["==", ["get", "id"], props.selectedAlertId || ""], 3.2, 1.4]);
  }, [mapReady, props.selectedAlertId]);

  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map?.getLayer("iem-radar")) return;
    map.setPaintProperty("iem-radar", "raster-opacity", props.radarVisible ? 0.72 : 0);
    const visibility = props.alertsVisible ? "visible" : "none";
    map.setLayoutProperty("alert-fill", "visibility", visibility);
    map.setLayoutProperty("alert-line", "visibility", visibility);
  }, [mapReady, props.radarVisible, props.alertsVisible]);

  useEffect(() => {
    const map = mapRef.current;
    const lib = libRef.current;
    if (!mapReady || !map || !lib) return;
    let cancelled = false;
    markers.current.forEach(marker => marker.remove());
    markers.current = props.facilities.filter(hasCoordinates).map(row => {
      const element = document.createElement("button");
      element.type = "button";
      element.className = `facility-pin${row.id === props.selectedFacilityId ? " is-selected" : ""}`;
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
  }, [mapReady, props.facilities, props.selectedFacilityId]);

  useEffect(() => {
    const map = mapRef.current;
    const source = map?.getSource("iem-radar") as RasterTileSource | undefined;
    if (!mapReady || !source) return;
    radarBook.current = { ok: false, errors: 0 };
    propsRef.current.onRadarStatus("loading");
    source.setTiles([radarTileUrl(props.frameId)]);
  }, [mapReady, props.frameId, props.radarRetry]);

  return (
    <div ref={shell} className="storm-map" data-loaded="false" data-ready={mapReady ? "true" : "false"} data-frame={props.frameId}>
      <div ref={canvas} className="storm-map-canvas" />
    </div>
  );
});
StormMap.displayName = "StormMap";
