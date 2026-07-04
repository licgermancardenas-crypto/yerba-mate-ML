"use client";

import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef } from "react";
import type { GeoFeatureCollection } from "@/lib/types";

const BASEMAP_STYLE = "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json";
// Centro aproximado de la zona yerbatera (Misiones/Corrientes)
const CENTRO_INICIAL: [number, number] = [-54.9, -27.1];

function extenderBounds(bounds: maplibregl.LngLatBounds, coords: unknown) {
  if (!Array.isArray(coords)) return;
  if (typeof coords[0] === "number" && typeof coords[1] === "number") {
    bounds.extend([coords[0], coords[1]] as [number, number]);
  } else {
    for (const c of coords) extenderBounds(bounds, c);
  }
}

export function GisMap({ data, geomType }: { data: GeoFeatureCollection; geomType: "MultiPolygon" | "Point" }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const popupRef = useRef<maplibregl.Popup | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: BASEMAP_STYLE,
      center: CENTRO_INICIAL,
      zoom: 7,
    });
    map.addControl(new maplibregl.NavigationControl(), "top-right");

    popupRef.current = new maplibregl.Popup({ closeButton: true, maxWidth: "280px" });

    map.on("click", (e) => {
      const feature = map.queryRenderedFeatures(e.point).find((f) => f.source === "capa");
      if (!feature) return;
      const filas = Object.entries(feature.properties ?? {})
        .filter(([, v]) => v !== null && v !== undefined)
        .map(([k, v]) => `<div class="flex justify-between gap-3 text-xs py-0.5"><span class="text-muted-foreground">${k}</span><span class="font-medium">${v}</span></div>`)
        .join("");
      popupRef.current?.setLngLat(e.lngLat).setHTML(`<div class="p-1">${filas}</div>`).addTo(map);
    });

    map.on("mouseenter", () => {
      map.getCanvas().style.cursor = "default";
    });

    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    function render() {
      if (!map) return;
      for (const id of ["capa-fill", "capa-outline", "capa-puntos"]) {
        if (map.getLayer(id)) map.removeLayer(id);
      }
      if (map.getSource("capa")) map.removeSource("capa");

      map.addSource("capa", { type: "geojson", data: data as GeoJSON.FeatureCollection });

      if (geomType === "Point") {
        map.addLayer({
          id: "capa-puntos",
          type: "circle",
          source: "capa",
          paint: {
            "circle-radius": 5,
            "circle-color": "#15803d",
            "circle-stroke-width": 1.5,
            "circle-stroke-color": "#ffffff",
          },
        });
      } else {
        map.addLayer({
          id: "capa-fill",
          type: "fill",
          source: "capa",
          paint: { "fill-color": "#22c55e", "fill-opacity": 0.45 },
        });
        map.addLayer({
          id: "capa-outline",
          type: "line",
          source: "capa",
          paint: { "line-color": "#15803d", "line-width": 1 },
        });
      }

      const bounds = new maplibregl.LngLatBounds();
      for (const feature of data.features) {
        extenderBounds(bounds, feature.geometry.coordinates);
      }
      if (!bounds.isEmpty()) {
        map.fitBounds(bounds, { padding: 40, maxZoom: 11, duration: 400 });
      }
    }

    if (map.isStyleLoaded()) {
      render();
    } else {
      map.once("load", render);
    }
  }, [data, geomType]);

  return <div ref={containerRef} className="w-full h-full" />;
}
