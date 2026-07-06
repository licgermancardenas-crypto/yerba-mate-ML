"use client";

import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef } from "react";

export type VistaMapa = "coropletico" | "secaderos";

interface Props {
  vista: VistaMapa;
  jurisdicciones: GeoJSON.FeatureCollection | null;
  departamentosContexto: GeoJSON.FeatureCollection | null; // INDEC, todos los deptos (gris)
  departamentosDatos: GeoJSON.FeatureCollection | null; // INYM, solo los que tienen dato real (color)
  municipios: GeoJSON.FeatureCollection | null;
  secaderos: GeoJSON.FeatureCollection | null;
  basemap: "topo" | "satelital";
  provinciaFiltro: string | null; // 'MISIONES' | 'CORRIENTES' | null (todas)
  bboxFoco: GeoJSON.FeatureCollection | null; // feature(s) a los que hacer fitBounds cuando cambia el filtro
}

const CENTRO_INICIAL: [number, number] = [-54.9, -27.1];

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

const TEXT_PAINT = {
  "text-color": "#ffffff",
  "text-halo-color": "#052e16",
  "text-halo-width": 1.4,
};

function extenderBounds(bounds: maplibregl.LngLatBounds, coords: unknown) {
  if (!Array.isArray(coords)) return;
  if (typeof coords[0] === "number" && typeof coords[1] === "number") {
    bounds.extend([coords[0], coords[1]] as [number, number]);
  } else {
    for (const c of coords) extenderBounds(bounds, c);
  }
}

function fitBoundsA(map: maplibregl.Map, fc: GeoJSON.FeatureCollection, opts?: maplibregl.FitBoundsOptions) {
  const bounds = new maplibregl.LngLatBounds();
  for (const f of fc.features) {
    if (f.geometry && "coordinates" in f.geometry) extenderBounds(bounds, f.geometry.coordinates);
  }
  if (!bounds.isEmpty()) map.fitBounds(bounds, { padding: 40, duration: 600, ...opts });
}

export function ProduccionMapa({
  vista,
  jurisdicciones,
  departamentosContexto,
  departamentosDatos,
  municipios,
  secaderos,
  basemap,
  provinciaFiltro,
  bboxFoco,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const popupRef = useRef<maplibregl.Popup | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: ESTILO_BASE,
      center: CENTRO_INICIAL,
      zoom: 6.8,
    });
    map.addControl(new maplibregl.NavigationControl(), "top-right");
    map.addControl(new maplibregl.ScaleControl({ unit: "metric" }), "bottom-right");
    popupRef.current = new maplibregl.Popup({ closeButton: true, maxWidth: "260px" });

    map.on("click", "deptos-datos-fill", (e) => {
      const f = e.features?.[0];
      if (!f) return;
      const p = f.properties as { depto: string; pcia: string; valor: number; sup_ym: number };
      popupRef.current
        ?.setLngLat(e.lngLat)
        .setHTML(
          `<div class="p-1 text-sm">
            <div class="font-semibold">${p.depto}</div>
            <div class="text-xs text-muted-foreground mb-1">${p.pcia}</div>
            <div>${new Intl.NumberFormat("es-AR", { maximumFractionDigits: 1 }).format(p.valor)}% de superficie cultivada</div>
            <div class="text-xs text-muted-foreground">${new Intl.NumberFormat("es-AR").format(p.sup_ym)} ha</div>
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

    for (const layerId of ["deptos-datos-fill", "secaderos-puntos", "secaderos-clusters"]) {
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

  // Jurisdicciones (provincias) — contorno grueso + label grande, siempre visible
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    function render() {
      if (!map) return;
      for (const id of ["jurisdicciones-outline", "jurisdicciones-label"]) {
        if (map.getLayer(id)) map.removeLayer(id);
      }
      if (map.getSource("jurisdicciones")) map.removeSource("jurisdicciones");
      if (!jurisdicciones) return;

      map.addSource("jurisdicciones", { type: "geojson", data: jurisdicciones });
      map.addLayer({
        id: "jurisdicciones-outline",
        type: "line",
        source: "jurisdicciones",
        paint: { "line-color": "#052e16", "line-width": 2.2 },
      });
      map.addLayer({
        id: "jurisdicciones-label",
        type: "symbol",
        source: "jurisdicciones",
        layout: {
          "text-field": ["get", "nam"],
          "text-size": 16,
          "text-font": ["Open Sans Bold", "Arial Unicode MS Bold"],
          "text-transform": "uppercase",
          "text-letter-spacing": 0.05,
        },
        paint: TEXT_PAINT,
      });
    }
    if (map.isStyleLoaded()) render();
    else map.once("load", render);
  }, [jurisdicciones]);

  // Departamentos — contexto gris (todos, INDEC) por debajo del color con datos
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    function render() {
      if (!map) return;
      for (const id of ["deptos-contexto-fill", "deptos-contexto-outline", "deptos-contexto-label"]) {
        if (map.getLayer(id)) map.removeLayer(id);
      }
      if (map.getSource("deptos-contexto")) map.removeSource("deptos-contexto");
      if (!departamentosContexto) return;

      map.addSource("deptos-contexto", { type: "geojson", data: departamentosContexto });
      // Se inserta antes de jurisdicciones-outline para que el borde de provincia quede arriba
      const antesDe = map.getLayer("jurisdicciones-outline") ? "jurisdicciones-outline" : undefined;
      map.addLayer(
        {
          id: "deptos-contexto-fill",
          type: "fill",
          source: "deptos-contexto",
          paint: { "fill-color": "#94a3b8", "fill-opacity": 0.18 },
        },
        antesDe
      );
      map.addLayer(
        {
          id: "deptos-contexto-outline",
          type: "line",
          source: "deptos-contexto",
          paint: { "line-color": "#475569", "line-width": 0.8, "line-opacity": 0.7 },
        },
        antesDe
      );
      map.addLayer({
        id: "deptos-contexto-label",
        type: "symbol",
        source: "deptos-contexto",
        minzoom: 7,
        layout: {
          "text-field": ["get", "nam"],
          "text-size": 11,
          "text-font": ["Open Sans Regular", "Arial Unicode MS Regular"],
        },
        paint: { "text-color": "#1e293b", "text-halo-color": "#ffffff", "text-halo-width": 1.2 },
      });
    }
    if (map.isStyleLoaded()) render();
    else map.once("load", render);
  }, [departamentosContexto]);

  // Departamentos con dato real (INYM) — coloreados por % cultivado, SOLO estos
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    function render() {
      if (!map) return;
      if (map.getLayer("deptos-datos-fill")) map.removeLayer("deptos-datos-fill");
      if (map.getLayer("deptos-datos-outline")) map.removeLayer("deptos-datos-outline");
      if (map.getSource("deptos-datos")) map.removeSource("deptos-datos");
      if (!departamentosDatos || departamentosDatos.features.length === 0) return;

      const valores = departamentosDatos.features.map((f) => (f.properties?.valor as number) ?? 0);
      const max = Math.max(...valores, 0.01);
      const antesDe = map.getLayer("jurisdicciones-outline") ? "jurisdicciones-outline" : undefined;

      map.addSource("deptos-datos", { type: "geojson", data: departamentosDatos });
      map.addLayer(
        {
          id: "deptos-datos-fill",
          type: "fill",
          source: "deptos-datos",
          paint: {
            "fill-color": [
              "interpolate", ["linear"], ["get", "valor"],
              0, "#f0fdf4",
              max * 0.25, "#bbf7d0",
              max * 0.5, "#4ade80",
              max * 0.75, "#16a34a",
              max, "#14532d",
            ],
            "fill-opacity": 0.88,
          },
        },
        antesDe
      );
      map.addLayer(
        {
          id: "deptos-datos-outline",
          type: "line",
          source: "deptos-datos",
          paint: { "line-color": "#052e16", "line-width": 1.1 },
        },
        antesDe
      );
    }
    if (map.isStyleLoaded()) render();
    else map.once("load", render);
  }, [departamentosDatos]);

  // Municipios — solo contorno fino + nombre, aparece al acercar el zoom
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    function render() {
      if (!map) return;
      for (const id of ["municipios-outline", "municipios-label"]) {
        if (map.getLayer(id)) map.removeLayer(id);
      }
      if (map.getSource("municipios")) map.removeSource("municipios");
      if (!municipios) return;

      map.addSource("municipios", { type: "geojson", data: municipios });
      const antesDe = map.getLayer("jurisdicciones-outline") ? "jurisdicciones-outline" : undefined;
      map.addLayer(
        {
          id: "municipios-outline",
          type: "line",
          source: "municipios",
          minzoom: 9,
          paint: { "line-color": "#065f46", "line-width": 0.6, "line-dasharray": [2, 1.5] },
        },
        antesDe
      );
      map.addLayer({
        id: "municipios-label",
        type: "symbol",
        source: "municipios",
        minzoom: 9.5,
        layout: {
          "text-field": ["get", "municipio"],
          "text-size": 10,
          "text-font": ["Open Sans Regular", "Arial Unicode MS Regular"],
        },
        paint: { "text-color": "#052e16", "text-halo-color": "#ffffff", "text-halo-width": 1.2 },
      });
    }
    if (map.isStyleLoaded()) render();
    else map.once("load", render);
  }, [municipios]);

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

      map.addSource("secaderos", { type: "geojson", data: secaderos, cluster: true, clusterMaxZoom: 12, clusterRadius: 45 });

      map.addLayer({
        id: "secaderos-clusters",
        type: "circle",
        source: "secaderos",
        filter: ["has", "point_count"],
        paint: {
          "circle-color": ["step", ["get", "point_count"], "#fdba74", 5, "#fb923c", 15, "#ea580c"],
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
        paint: { "circle-radius": 7, "circle-color": "#ea580c", "circle-stroke-width": 1.5, "circle-stroke-color": "#ffffff" },
      });
    }
    if (map.isStyleLoaded()) render();
    else map.once("load", render);
  }, [secaderos]);

  // Vista activa: coroplético vs secaderos
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    function aplicar() {
      if (!map) return;
      const visCoropletico = vista === "coropletico" ? "visible" : "none";
      const visSecaderos = vista === "secaderos" ? "visible" : "none";
      for (const id of ["deptos-datos-fill", "deptos-datos-outline"]) {
        if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", visCoropletico);
      }
      for (const id of ["secaderos-clusters", "secaderos-cluster-count", "secaderos-puntos"]) {
        if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", visSecaderos);
      }
    }
    if (map.isStyleLoaded()) aplicar();
    else map.once("load", aplicar);
  }, [vista, departamentosDatos, secaderos]);

  // Filtro de provincia: atenúa lo que no pertenece a la selección
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    function aplicar() {
      if (!map) return;
      const activo = provinciaFiltro !== null;
      const opacidadFuera = activo ? 0.08 : 0.18;
      const opacidadDentro = 0.18;
      const filtroGris: number | maplibregl.ExpressionSpecification = activo
        ? ["case", ["==", ["upcase", ["get", "jur"]], provinciaFiltro as string], opacidadDentro, opacidadFuera]
        : opacidadDentro;
      if (map.getLayer("deptos-contexto-fill")) map.setPaintProperty("deptos-contexto-fill", "fill-opacity", filtroGris);

      const opacidadColor: number | maplibregl.ExpressionSpecification = activo
        ? ["case", ["==", ["upcase", ["get", "pcia"]], provinciaFiltro as string], 0.88, 0.12]
        : 0.88;
      if (map.getLayer("deptos-datos-fill")) map.setPaintProperty("deptos-datos-fill", "fill-opacity", opacidadColor);
    }
    if (map.isStyleLoaded()) aplicar();
    else map.once("load", aplicar);
  }, [provinciaFiltro]);

  // Foco (fitBounds) cuando cambia el filtro de provincia/departamento
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !bboxFoco || bboxFoco.features.length === 0) return;
    if (map.isStyleLoaded()) fitBoundsA(map, bboxFoco);
    else map.once("load", () => fitBoundsA(map, bboxFoco));
  }, [bboxFoco]);

  return <div ref={containerRef} className="w-full h-full" />;
}
