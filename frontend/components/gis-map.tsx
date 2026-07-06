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

interface Props {
  data: GeoFeatureCollection;
  geomType: "MultiPolygon" | "Point";
  // El detalle de la zona clickeada se muestra en el panel lateral (ver
  // GisPanel), no en un popup -- así que solo se necesita avisar cuál se
  // clickeó, no renderizar nada acá.
  onSeleccionarFeature?: (props: Record<string, unknown>) => void;
}

export function GisMap({ data, geomType, onSeleccionarFeature }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  // El listener de click se registra una sola vez (efecto de montaje); sin
  // el ref quedaría atado para siempre a la referencia de la primera
  // renderización.
  const onSeleccionarFeatureRef = useRef(onSeleccionarFeature);
  useEffect(() => {
    onSeleccionarFeatureRef.current = onSeleccionarFeature;
  }, [onSeleccionarFeature]);

  useEffect(() => {
    if (!containerRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: BASEMAP_STYLE,
      center: CENTRO_INICIAL,
      zoom: 7,
    });
    map.addControl(new maplibregl.NavigationControl(), "top-right");

    map.on("click", (e) => {
      const feature = map.queryRenderedFeatures(e.point).find((f) => f.source === "capa");
      const id = feature?.id ?? "__ninguno__";
      if (map.getLayer("capa-seleccionada-outline")) {
        map.setFilter("capa-seleccionada-outline", ["==", ["id"], id]);
      }
      if (map.getLayer("capa-seleccionada-punto")) {
        map.setFilter("capa-seleccionada-punto", ["==", ["id"], id]);
      }
      if (feature) onSeleccionarFeatureRef.current?.(feature.properties ?? {});
    });

    map.on("mouseenter", "capa-fill", () => {
      map.getCanvas().style.cursor = "pointer";
    });
    map.on("mouseleave", "capa-fill", () => {
      map.getCanvas().style.cursor = "";
    });
    map.on("mouseenter", "capa-puntos", () => {
      map.getCanvas().style.cursor = "pointer";
    });
    map.on("mouseleave", "capa-puntos", () => {
      map.getCanvas().style.cursor = "";
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
      for (const id of ["capa-fill", "capa-outline", "capa-seleccionada-outline", "capa-puntos", "capa-seleccionada-punto"]) {
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
        map.addLayer({
          id: "capa-seleccionada-punto",
          type: "circle",
          source: "capa",
          filter: ["==", ["id"], "__ninguno__"],
          paint: {
            "circle-radius": 9,
            "circle-color": "#15803d",
            "circle-stroke-width": 3,
            "circle-stroke-color": "#eab308",
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
        map.addLayer({
          id: "capa-seleccionada-outline",
          type: "line",
          source: "capa",
          filter: ["==", ["id"], "__ninguno__"],
          paint: { "line-color": "#eab308", "line-width": 3.5 },
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
