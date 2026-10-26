"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import type { GeoJSONSource, Map as MapLibreMap, RasterTileSource } from "maplibre-gl";
import { geometryBounds, hasAlertShape } from "@/lib/geo";
import { radarTileUrl } from "@/lib/radar-frames";
import type { MapGeometry, OfficialAlert } from "@/lib/weather-types";

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

export const RADAR_OPACITY = 0.28;
export const ALERT_FILL_OPACITY = 0.18;

const VIEWS = {
  conus: [[-125, 24.2], [-66.5, 49.6]] as [[number, number], [number, number]],
  alaska: [[-170, 51], [-130, 71.5]] as [[number, number], [number, number]],
  hawaii: [[-160.5, 18.5], [-154.5, 22.5]] as [[number, number], [number, number]],
  "puerto-rico": [[-67.5, 17.8], [-65.2, 18.6]] as [[number, number], [number, number]],
};

export type CountyView = keyof typeof VIEWS;
export type CountyWeatherMapApi = {
  show: (view: CountyView) => void;
  fitGeometry: (geometry: MapGeometry) => void;
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

const readToken = (name: string, fallback: string) =>
  getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;

export const CountyWeatherMap = forwardRef<CountyWeatherMapApi, {
  alerts: OfficialAlert[];
  selectedId: string;
  highlighted: string[];
  shortlist: string[];
  frameId: string;
  radarVisible: boolean;
  radarRetry: number;
  onCountyClick: (fips: string, additive: boolean) => void;
  onBasemapStatus: (status: "loading" | "ready" | "error") => void;
  onRadarStatus: (status: "loading" | "ready" | "error") => void;
  onAtlasStatus: (status: "loading" | "ready" | "error") => void;
}>((props, ref) => {
  const shell = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const propsRef = useRef(props);
  propsRef.current = props;
  const applied = useRef({ affected: new Set<string>(), short: new Set<string>() });
  const radarBook = useRef({ errors: 0 });
  const [mapReady, setMapReady] = useState(false);

  useImperativeHandle(ref, () => ({
    show: view => mapRef.current?.fitBounds(VIEWS[view], { padding: 24, duration: 0, maxZoom: 6 }),
    fitGeometry: geometry => {
      const bounds = geometryBounds(geometry);
      if (bounds) mapRef.current?.fitBounds(bounds, { padding: 48, duration: 0, maxZoom: 8 });
    },
  }));

  useEffect(() => {
    const node = canvas.current;
    const shellNode = shell.current;
    if (!node || !shellNode) return;
    let map: MapLibreMap | undefined;
    let cancelled = false;
    propsRef.current.onBasemapStatus("loading");
    propsRef.current.onRadarStatus("loading");
    propsRef.current.onAtlasStatus("loading");

    void (async () => {
      const [maplibregl, atlasResponse] = await Promise.all([
        loadMapLibre(),
        fetch("/geo/us-counties-wgs84.json"),
      ]);
      if (cancelled) return;
      const atlas: unknown = await atlasResponse.json();
      const features = atlas && typeof atlas === "object" && Array.isArray((atlas as { features?: unknown }).features)
        ? (atlas as { features: unknown[] }).features : null;
      if (!atlasResponse.ok || !features?.length) {
        propsRef.current.onAtlasStatus("error");
        propsRef.current.onBasemapStatus("error");
        return;
      }
      try {
        map = new maplibregl.Map({
          container: node,
          style: {
            version: 8,
            sources: {},
            layers: [{ id: "background", type: "background", paint: { "background-color": "#05070b" } }],
          },
          bounds: VIEWS.conus,
          fitBoundsOptions: { padding: 24, duration: 0 },
          attributionControl: false,
          dragRotate: false,
          pitchWithRotate: false,
          touchPitch: false,
          maxPitch: 0,
          fadeDuration: 0,
          refreshExpiredTiles: false,
        });
      } catch {
        if (!cancelled) {
          propsRef.current.onAtlasStatus("error");
          propsRef.current.onBasemapStatus("error");
        }
        return;
      }
      if (cancelled) { map.remove(); return; }
      mapRef.current = map;
      map.touchZoomRotate.disableRotation();
      map.keyboard.disableRotation();
      map.addControl(new maplibregl.AttributionControl({
        compact: true,
        customAttribution: "Counties: US Census Bureau cb_2023_us_county_20m, NAD83 degrees. Radar © Iowa Environmental Mesonet.",
      }), "bottom-right");
      map.getContainer().querySelector(".maplibregl-ctrl-attrib")?.classList.remove("maplibregl-compact-show");
      const surface = map.getCanvas();
      surface.setAttribute("aria-label", "County outlines with a light radar wash and warning shapes. Clicks land on a county.");
      surface.tabIndex = 0;
      map.on("load", () => {
        if (!map || cancelled) return;
        const severe = {
          Extreme: readToken("--color-severity-extreme", "#ff5a36"),
          Severe: readToken("--color-severity-severe", "#ef7a5f"),
          Moderate: readToken("--color-severity-moderate", "#ebe4cf"),
          Minor: readToken("--color-severity-minor", "#8fd3ff"),
          Unknown: readToken("--color-severity-unknown", "#a8b0bc"),
        };
        const match = ["match", ["get", "severity"], "Extreme", severe.Extreme, "Severe", severe.Severe, "Moderate", severe.Moderate, "Minor", severe.Minor, severe.Unknown] as const;
        const opacity = propsRef.current.radarVisible ? RADAR_OPACITY : 0;
        map.addSource("iem-radar", { type: "raster", tiles: [radarTileUrl(propsRef.current.frameId)], tileSize: 256, maxzoom: 12 });
        map.addLayer({
          id: "iem-radar", type: "raster", source: "iem-radar",
          paint: { "raster-opacity": opacity, "raster-fade-duration": 0, "raster-resampling": "linear" },
        });
        map.addSource("alerts", { type: "geojson", data: alertCollection(propsRef.current.alerts) });
        map.addLayer({
          id: "alert-fill", type: "fill", source: "alerts",
          paint: { "fill-color": match as never, "fill-opacity": ALERT_FILL_OPACITY },
        });
        map.addSource("counties", { type: "geojson", data: atlas as never, promoteId: "fips" });
        map.addLayer({
          id: "county-fill", type: "fill", source: "counties",
          paint: {
            "fill-color": ["case",
              ["boolean", ["feature-state", "shortlisted"], false], "#f2a93b",
              ["boolean", ["feature-state", "affected"], false], "#ef7a5f",
              "#8fd3ff"],
            "fill-opacity": ["case",
              ["boolean", ["feature-state", "shortlisted"], false], 0.48,
              ["boolean", ["feature-state", "affected"], false], 0.3,
              0.03],
          },
        });
        map.addLayer({
          id: "county-line", type: "line", source: "counties",
          paint: {
            "line-color": ["case",
              ["boolean", ["feature-state", "shortlisted"], false], "#f2a93b",
              ["boolean", ["feature-state", "affected"], false], "#ef7a5f",
              "#8fd3ff"],
            "line-width": ["case",
              ["boolean", ["feature-state", "shortlisted"], false], 1.8,
              ["boolean", ["feature-state", "affected"], false], 1.15,
              0.7],
            "line-opacity": 0.95,
          },
        });
        map.addLayer({
          id: "alert-line", type: "line", source: "alerts",
          paint: { "line-color": match as never, "line-width": 1.6, "line-opacity": 0.9 },
        });
        map.on("click", event => {
          const hit = map?.queryRenderedFeatures(event.point, { layers: ["county-fill"] })[0];
          const fips = hit?.properties?.fips;
          if (typeof fips !== "string") return;
          const mouse = event.originalEvent;
          const additive = "shiftKey" in mouse && (mouse.shiftKey || mouse.metaKey || mouse.ctrlKey);
          propsRef.current.onCountyClick(fips, additive);
        });
        map.on("mousemove", event => {
          const hit = map?.queryRenderedFeatures(event.point, { layers: ["county-fill"] }).length;
          map?.getCanvas().style.setProperty("cursor", hit ? "pointer" : "");
        });
        shellNode.dataset.ready = "true";
        propsRef.current.onAtlasStatus("ready");
        propsRef.current.onBasemapStatus("ready");
        if (!cancelled) setMapReady(true);
      });
      map.on("error", event => {
        const sourceId = "sourceId" in event ? String((event as { sourceId?: string }).sourceId ?? "") : "";
        if (sourceId === "iem-radar") {
          radarBook.current.errors += 1;
          propsRef.current.onRadarStatus("error");
          return;
        }
        if (sourceId === "counties") propsRef.current.onAtlasStatus("error");
      });
      map.on("sourcedata", event => {
        if (event.sourceId === "iem-radar" && event.isSourceLoaded && radarBook.current.errors === 0) {
          propsRef.current.onRadarStatus("ready");
        }
      });
    })().catch(() => {
      if (!cancelled) {
        propsRef.current.onAtlasStatus("error");
        propsRef.current.onBasemapStatus("error");
      }
    });

    return () => {
      cancelled = true;
      map?.remove();
      mapRef.current = null;
      applied.current = { affected: new Set(), short: new Set() };
      shellNode.dataset.ready = "false";
      setMapReady(false);
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const source = map?.getSource("alerts") as GeoJSONSource | undefined;
    if (!mapReady || !map || !source) return;
    source.setData(alertCollection(props.alerts));
    const selected = props.selectedId || "";
    if (map.getLayer("alert-line")) {
      map.setPaintProperty("alert-line", "line-width", ["case", ["==", ["get", "id"], selected], 2.4, 1.6]);
    }
  }, [mapReady, props.alerts, props.selectedId]);

  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map?.getSource("counties")) return;
    const nextAffected = new Set(props.highlighted);
    const nextShort = new Set(props.shortlist);
    const prev = applied.current;
    for (const fips of new Set([...prev.affected, ...nextAffected, ...prev.short, ...nextShort])) {
      const affected = nextAffected.has(fips);
      const shortlisted = nextShort.has(fips);
      if (prev.affected.has(fips) === affected && prev.short.has(fips) === shortlisted) continue;
      map.setFeatureState({ source: "counties", id: fips }, { affected, shortlisted });
    }
    applied.current = { affected: nextAffected, short: nextShort };
  }, [mapReady, props.highlighted, props.shortlist]);

  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map?.getLayer("iem-radar")) return;
    map.setPaintProperty("iem-radar", "raster-opacity", props.radarVisible ? RADAR_OPACITY : 0);
    map.setPaintProperty("iem-radar", "raster-fade-duration", 0);
  }, [mapReady, props.radarVisible]);

  useEffect(() => {
    const map = mapRef.current;
    const source = map?.getSource("iem-radar") as RasterTileSource | undefined;
    if (!mapReady || !source) return;
    radarBook.current = { errors: 0 };
    propsRef.current.onRadarStatus("loading");
    source.setTiles([radarTileUrl(props.frameId)]);
  }, [mapReady, props.frameId, props.radarRetry]);

  const shapes = props.alerts.filter(alert => hasAlertShape(alert.geometry)).length;
  return <div ref={shell} className="storm-map county-weather-map" data-ready={mapReady ? "true" : "false"}
    data-radar-opacity={RADAR_OPACITY.toFixed(2)} data-weather-pointer="county" data-shapes={shapes}>
    <div ref={canvas} className="storm-map-canvas" />
  </div>;
});
CountyWeatherMap.displayName = "CountyWeatherMap";
