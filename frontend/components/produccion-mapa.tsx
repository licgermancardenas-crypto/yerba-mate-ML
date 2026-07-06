"use client";

import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef } from "react";

export type VistaMapa = "coropletico" | "secaderos";

interface Props {
  vista: VistaMapa;
  coropletico: GeoJSON.FeatureCollection | null;
  secaderos: GeoJSON.FeatureCollection | null;
  basemap: "topo" | "satelital";
}

const CENTRO_INICIAL: [number, number] = [-54.9, -27.1];

// Fuentes raster gratuitas, sin API key — el IGN (ign.gob.ar / wms.ign.gob.ar)
// no es alcanzable desde este entorno (timeout de red confirmado, reintentado
// dos sesiones distintas).
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

export function ProduccionMapa({ vista, coropletico, secaderos, basemap }: Props) {
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
    });
    map.addControl(new maplibregl.NavigationControl(), "top-right");
    popupRef.current = new maplibregl.Popup({ closeButton: true, maxWidth: "260px" });

    map.on("click", "coropletico-fill", (e) => {
      const f = e.features?.[0];
      if (!f) return;
      const p = f.properties as { depto: string; pcia: string; valor: number; sup_ym: number };
      popupRef.current
        ?.setLngLat(e.lngLat)
        .setHTML(
          `<div class="p-1 text-sm">
            <div class="font-semibold">${p.depto}</div>
            <div class="text-xs text-muted-foreground mb-1">${p.pcia}</div>
            <div>${new Intl.NumberFormat("es-AR", { maximumFractionDigits: 1 }).format(p.valor)}%</div>
            <div class="text-xs text-muted-foreground">${new Intl.NumberFormat("es-AR").format(p.sup_ym)} ha cultivadas</div>
          </div>`
        )
        .addTo(map);
    });

    map.on("click", "secaderos-puntos", (e) => {
      const f = e.features?.[0];
      if (!f) return;
      const p = f.properties as { idplanta: number; dir_catastral: string | null };
      popupRef.current
        ?.setLngLat(e.lngLat)
        .setHTML(
          `<div class="p-1 text-sm">
            <div class="font-semibold">Secadero #${p.idplanta}</div>
            ${p.dir_catastral ? `<div class="text-xs text-muted-foreground">${p.dir_catastral}</div>` : ""}
          </div>`
        )
        .addTo(map);
    });

    map.on("click", "secaderos-clusters", (e) => {
      const f = e.features?.[0];
      if (!f) return;
      const clusterId = f.properties?.cluster_id;
      const source = map.getSource("secaderos") as maplibregl.GeoJSONSource;
      source.getClusterExpansionZoom(clusterId).then((zoom) => {
        map.easeTo({ center: (f.geometry as GeoJSON.Point).coordinates as [number, number], zoom });
      });
    });

    for (const layerId of ["coropletico-fill", "secaderos-puntos", "secaderos-clusters"]) {
      map.on("mouseenter", layerId, () => {
        map.getCanvas().style.cursor = "pointer";
      });
      map.on("mouseleave", layerId, () => {
        map.getCanvas().style.cursor = "";
      });
    }

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

  // Capa coroplética — departamentos coloreados por % de superficie cultivada
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    function render() {
      if (!map) return;
      if (map.getLayer("coropletico-fill")) map.removeLayer("coropletico-fill");
      if (map.getLayer("coropletico-outline")) map.removeLayer("coropletico-outline");
      if (map.getSource("coropletico")) map.removeSource("coropletico");
      if (!coropletico || coropletico.features.length === 0) return;

      const valores = coropletico.features.map((f) => (f.properties?.valor as number) ?? 0);
      const max = Math.max(...valores, 0.01);

      map.addSource("coropletico", { type: "geojson", data: coropletico });
      map.addLayer({
        id: "coropletico-fill",
        type: "fill",
        source: "coropletico",
        paint: {
          "fill-color": [
            "interpolate", ["linear"], ["get", "valor"],
            0, "#f0fdf4",
            max * 0.25, "#bbf7d0",
            max * 0.5, "#4ade80",
            max * 0.75, "#16a34a",
            max, "#14532d",
          ],
          "fill-opacity": 0.85,
        },
      });
      map.addLayer({
        id: "coropletico-outline",
        type: "line",
        source: "coropletico",
        paint: { "line-color": "#052e16", "line-width": 1 },
      });
    }

    if (map.isStyleLoaded()) render();
    else map.once("load", render);
  }, [coropletico]);

  // Clústeres de secaderos
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    function render() {
      if (!map) return;
      for (const id of ["secaderos-clusters", "secaderos-cluster-count", "secaderos-puntos"]) {
        if (map.getLayer(id)) map.removeLayer(id);
      }
      if (map.getSource("secaderos")) map.removeSource("secaderos");
      if (!secaderos) return;

      map.addSource("secaderos", {
        type: "geojson",
        data: secaderos,
        cluster: true,
        clusterMaxZoom: 12,
        clusterRadius: 45,
      });

      map.addLayer({
        id: "secaderos-clusters",
        type: "circle",
        source: "secaderos",
        filter: ["has", "point_count"],
        paint: {
          "circle-color": [
            "step", ["get", "point_count"],
            "#fdba74", 5,
            "#fb923c", 15,
            "#ea580c",
          ],
          "circle-radius": ["step", ["get", "point_count"], 16, 5, 22, 15, 28],
          "circle-stroke-width": 2,
          "circle-stroke-color": "#ffffff",
        },
      });
      map.addLayer({
        id: "secaderos-cluster-count",
        type: "symbol",
        source: "secaderos",
        filter: ["has", "point_count"],
        layout: {
          "text-field": ["get", "point_count_abbreviated"],
          "text-size": 12,
          "text-font": ["Open Sans Bold", "Arial Unicode MS Bold"],
        },
        paint: { "text-color": "#ffffff" },
      });
      map.addLayer({
        id: "secaderos-puntos",
        type: "circle",
        source: "secaderos",
        filter: ["!", ["has", "point_count"]],
        paint: {
          "circle-radius": 7,
          "circle-color": "#ea580c",
          "circle-stroke-width": 1.5,
          "circle-stroke-color": "#ffffff",
        },
      });
    }

    if (map.isStyleLoaded()) render();
    else map.once("load", render);
  }, [secaderos]);

  // Mostrar/ocultar según la vista elegida
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    function aplicar() {
      if (!map) return;
      const visCoropletico = vista === "coropletico" ? "visible" : "none";
      const visSecaderos = vista === "secaderos" ? "visible" : "none";
      for (const id of ["coropletico-fill", "coropletico-outline"]) {
        if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", visCoropletico);
      }
      for (const id of ["secaderos-clusters", "secaderos-cluster-count", "secaderos-puntos"]) {
        if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", visSecaderos);
      }
    }
    if (map.isStyleLoaded()) aplicar();
    else map.once("load", aplicar);
  }, [vista, coropletico, secaderos]);

  return <div ref={containerRef} className="w-full h-full" />;
}
