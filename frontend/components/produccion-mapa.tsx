"use client";

import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef } from "react";

export interface BurbujaProduccion {
  ciudad: string;
  provincia: string;
  produccion_kg: number;
  lng: number;
  lat: number;
}

interface Props {
  burbujas: BurbujaProduccion[];
  limites: GeoJSON.FeatureCollection | null;
  radiosCensales: GeoJSON.FeatureCollection | null;
  basemap: "topo" | "satelital";
}

const CENTRO_INICIAL: [number, number] = [-54.9, -27.1];

// Fuentes raster gratuitas, sin API key — el IGN (ign.gob.ar / wms.ign.gob.ar)
// no es alcanzable desde este entorno (timeout de red confirmado 2026-07-04),
// se usan estas dos en su lugar:
const ESTILO_BASE: maplibregl.StyleSpecification = {
  version: 8,
  sources: {
    topo: {
      type: "raster",
      tiles: [
        "https://a.tile.opentopomap.org/{z}/{x}/{y}.png",
        "https://b.tile.opentopomap.org/{z}/{x}/{y}.png",
        "https://c.tile.opentopomap.org/{z}/{x}/{y}.png",
      ],
      tileSize: 256,
      maxzoom: 17,
      attribution: "© OpenTopoMap (CC-BY-SA), SRTM",
    },
    satelital: {
      type: "raster",
      tiles: ["https://services.arcgisonline.com/arcgis/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"],
      tileSize: 256,
      maxzoom: 19,
      attribution: "© Esri, Maxar, Earthstar Geographics",
    },
  },
  layers: [
    { id: "topo", type: "raster", source: "topo", layout: { visibility: "visible" } },
    { id: "satelital", type: "raster", source: "satelital", layout: { visibility: "none" } },
  ],
};

function crearPuntosGeoJSON(burbujas: BurbujaProduccion[]): GeoJSON.FeatureCollection<GeoJSON.Point> {
  return {
    type: "FeatureCollection",
    features: burbujas.map(
      (b): GeoJSON.Feature<GeoJSON.Point> => ({
        type: "Feature",
        geometry: { type: "Point", coordinates: [b.lng, b.lat] },
        properties: { ciudad: b.ciudad, provincia: b.provincia, produccion_kg: b.produccion_kg },
      })
    ),
  };
}

export function ProduccionMapa({ burbujas, limites, radiosCensales, basemap }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const popupRef = useRef<maplibregl.Popup | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: ESTILO_BASE,
      center: CENTRO_INICIAL,
      zoom: 7,
      pitch: 45,
      maxPitch: 70,
    });
    map.addControl(new maplibregl.NavigationControl(), "top-right");
    popupRef.current = new maplibregl.Popup({ closeButton: true, maxWidth: "260px" });

    map.on("click", "produccion-burbujas", (e) => {
      const f = e.features?.[0];
      if (!f) return;
      const p = f.properties as { ciudad: string; provincia: string; produccion_kg: number };
      popupRef.current
        ?.setLngLat(e.lngLat)
        .setHTML(
          `<div class="p-1 text-sm">
            <div class="font-semibold">${p.ciudad}</div>
            <div class="text-xs text-muted-foreground mb-1">${p.provincia}</div>
            <div>${new Intl.NumberFormat("es-AR").format(p.produccion_kg)} kg</div>
          </div>`
        )
        .addTo(map);
    });
    map.on("mouseenter", "produccion-burbujas", () => {
      map.getCanvas().style.cursor = "pointer";
    });
    map.on("mouseleave", "produccion-burbujas", () => {
      map.getCanvas().style.cursor = "";
    });

    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Toggle de basemap
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    function aplicar() {
      if (!map!.getLayer("topo")) return;
      map!.setLayoutProperty("topo", "visibility", basemap === "topo" ? "visible" : "none");
      map!.setLayoutProperty("satelital", "visibility", basemap === "satelital" ? "visible" : "none");
    }
    if (map.isStyleLoaded()) aplicar();
    else map.once("load", aplicar);
  }, [basemap]);

  // Capa de límites de superficie cultivada (por municipio)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    function render() {
      if (!map) return;
      if (map.getLayer("limites-fill")) map.removeLayer("limites-fill");
      if (map.getLayer("limites-outline")) map.removeLayer("limites-outline");
      if (map.getSource("limites")) map.removeSource("limites");
      if (!limites) return;

      map.addSource("limites", { type: "geojson", data: limites });
      map.addLayer({
        id: "limites-fill",
        type: "fill",
        source: "limites",
        paint: { "fill-color": "#15803d", "fill-opacity": 0.22 },
      });
      map.addLayer({
        id: "limites-outline",
        type: "line",
        source: "limites",
        paint: { "line-color": "#14532d", "line-width": 1.2 },
      });
    }

    if (map.isStyleLoaded()) render();
    else map.once("load", render);
  }, [limites]);

  // Radios censales (INDEC/GeoNode, Misiones+Corrientes) — solo contorno fino,
  // sin relleno, para que se vea el detalle del terreno debajo sin taparlo.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    function render() {
      if (!map) return;
      if (map.getLayer("radios-censales-outline")) map.removeLayer("radios-censales-outline");
      if (map.getSource("radios-censales")) map.removeSource("radios-censales");
      if (!radiosCensales) return;

      map.addSource("radios-censales", { type: "geojson", data: radiosCensales });
      map.addLayer({
        id: "radios-censales-outline",
        type: "line",
        source: "radios-censales",
        paint: { "line-color": "#facc15", "line-width": 0.6, "line-opacity": 0.75 },
      });
    }

    if (map.isStyleLoaded()) render();
    else map.once("load", render);
  }, [radiosCensales]);

  // Burbujas de producción por ciudad
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const maxProd = Math.max(1, ...burbujas.map((b) => b.produccion_kg));

    function render() {
      if (!map) return;
      if (map.getLayer("produccion-burbujas")) map.removeLayer("produccion-burbujas");
      if (map.getLayer("produccion-halo")) map.removeLayer("produccion-halo");
      if (map.getSource("produccion")) map.removeSource("produccion");

      map.addSource("produccion", { type: "geojson", data: crearPuntosGeoJSON(burbujas) });

      map.addLayer({
        id: "produccion-halo",
        type: "circle",
        source: "produccion",
        paint: {
          "circle-radius": [
            "interpolate", ["linear"], ["get", "produccion_kg"],
            0, 10,
            maxProd, 55,
          ],
          "circle-color": "#f59e0b",
          "circle-opacity": 0.15,
        },
      });

      map.addLayer({
        id: "produccion-burbujas",
        type: "circle",
        source: "produccion",
        paint: {
          "circle-radius": [
            "interpolate", ["linear"], ["get", "produccion_kg"],
            0, 5,
            maxProd, 28,
          ],
          "circle-color": "#ea580c",
          "circle-opacity": 0.85,
          "circle-stroke-width": 1.5,
          "circle-stroke-color": "#ffffff",
        },
      });
    }

    if (map.isStyleLoaded()) render();
    else map.once("load", render);
  }, [burbujas]);

  return <div ref={containerRef} className="w-full h-full" />;
}
