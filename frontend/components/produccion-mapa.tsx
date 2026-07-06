"use client";

import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef } from "react";
import { tituloCase } from "@/lib/texto";

export type VistaMapa = "coropletico" | "secaderos" | "heatmap" | "burbujas" | "flujo";
export type Basemap = "topo" | "satelital" | "calles";

export interface BurbujaProduccion {
  ciudad: string;
  provincia: string;
  produccion_kg: number;
  lng: number;
  lat: number;
}

interface Props {
  vista: VistaMapa;
  jurisdicciones: GeoJSON.FeatureCollection | null;
  // INDEC, todos los departamentos (contexto gris) — properties enriquecidas
  // por el cliente con `nam_norm` (nombre sin acentos, mayúsculas) para poder
  // cruzar con la nomenclatura del INYM sin depender de que coincidan tildes.
  departamentosContexto: GeoJSON.FeatureCollection | null;
  // INYM, solo los departamentos con dato real (coroplético) — enriquecidas
  // con `depto_norm` por el mismo motivo.
  departamentosDatos: GeoJSON.FeatureCollection | null;
  municipios: GeoJSON.FeatureCollection | null;
  secaderos: GeoJSON.FeatureCollection | null;
  burbujas: BurbujaProduccion[];
  flujo: GeoJSON.FeatureCollection | null; // LineString ciudad -> secadero más cercano
  basemap: Basemap;
  provinciaFiltro: string | null; // 'MISIONES' | 'CORRIENTES' | null (todas)
  departamentoFiltro: string | null; // nombre normalizado (sin acentos, mayúsculas) o null (todos)
  bboxFoco: GeoJSON.FeatureCollection | null; // feature(s) a los que hacer fitBounds cuando cambia el filtro
  // Se dispara cuando el usuario clickea un departamento directamente en el
  // mapa (contexto o coroplético) — permite sincronizar los selectores de la
  // barra de control con la interacción sobre el mapa.
  onSeleccionarDepartamento?: (deptoNorm: string) => void;
  // Alimentan el panel lateral de KPIs/gráficos (ProduccionPanel) cuando el
  // usuario clickea una burbuja o una línea de flujo.
  onSeleccionarBurbuja?: (b: { ciudad: string; provincia: string; produccion_kg: number }) => void;
  onSeleccionarFlujo?: (r: { ciudad: string; produccion_kg: number; distancia_km: number }) => void;
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
    calles: {
      type: "raster",
      tiles: [
        "https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png",
        "https://b.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png",
        "https://c.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png",
        "https://d.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png",
      ],
      tileSize: 256,
      maxzoom: 20,
      attribution: "© CARTO, © OpenStreetMap contributors",
    },
  },
  layers: [
    { id: "topo", type: "raster", source: "topo", layout: { visibility: "visible" } },
    { id: "satelital", type: "raster", source: "satelital", layout: { visibility: "none" } },
    { id: "calles", type: "raster", source: "calles", layout: { visibility: "none" } },
  ],
};

const TEXT_PAINT = {
  "text-color": "#ffffff",
  "text-halo-color": "#052e16",
  "text-halo-width": 1.4,
};

const nf0 = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 });
const nf1 = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 1 });

function popupHTML(titulo: string, subtitulo: string | null, filas: { label: string; valor: string }[], nota?: string): string {
  const filasHtml = filas
    .map(
      (f) =>
        `<div class="flex items-baseline justify-between gap-4 text-xs py-0.5"><span class="text-muted-foreground">${f.label}</span><span class="font-semibold text-card-foreground tabular-nums">${f.valor}</span></div>`
    )
    .join("");
  return `
    <div class="px-3.5 py-3 min-w-[190px]">
      <div class="text-sm font-semibold text-card-foreground leading-tight">${titulo}</div>
      ${subtitulo ? `<div class="text-[11px] uppercase tracking-wide text-muted-foreground font-medium mt-0.5 mb-2">${subtitulo}</div>` : `<div class="mb-2"></div>`}
      ${filasHtml}
      ${nota ? `<div class="mt-1.5 pt-1.5 border-t border-border text-[10px] text-muted-foreground italic leading-snug">${nota}</div>` : ""}
    </div>`;
}

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

function crearPuntosBurbujas(burbujas: BurbujaProduccion[]): GeoJSON.FeatureCollection<GeoJSON.Point> {
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

export function ProduccionMapa({
  vista,
  jurisdicciones,
  departamentosContexto,
  departamentosDatos,
  municipios,
  secaderos,
  burbujas,
  flujo,
  basemap,
  provinciaFiltro,
  departamentoFiltro,
  bboxFoco,
  onSeleccionarDepartamento,
  onSeleccionarBurbuja,
  onSeleccionarFlujo,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const popupRef = useRef<maplibregl.Popup | null>(null);
  // El callback vive en un ref porque los listeners de MapLibre se registran
  // una sola vez (efecto de montaje con deps []); sin el ref quedarían
  // atados para siempre a la referencia de la primera renderización.
  const onSeleccionarDeptoRef = useRef(onSeleccionarDepartamento);
  useEffect(() => {
    onSeleccionarDeptoRef.current = onSeleccionarDepartamento;
  }, [onSeleccionarDepartamento]);
  const onSeleccionarBurbujaRef = useRef(onSeleccionarBurbuja);
  useEffect(() => {
    onSeleccionarBurbujaRef.current = onSeleccionarBurbuja;
  }, [onSeleccionarBurbuja]);
  const onSeleccionarFlujoRef = useRef(onSeleccionarFlujo);
  useEffect(() => {
    onSeleccionarFlujoRef.current = onSeleccionarFlujo;
  }, [onSeleccionarFlujo]);

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
    popupRef.current = new maplibregl.Popup({ closeButton: true, maxWidth: "280px" });

    // Contexto (gris, todos los departamentos): solo sincroniza el selector,
    // sin popup propio -- evita que compita con el popup rico de
    // deptos-datos-fill cuando ambas capas coinciden en el mismo punto.
    map.on("click", "deptos-contexto-fill", (e) => {
      const f = e.features?.[0];
      const norm = f?.properties?.nam_norm as string | undefined;
      if (norm) onSeleccionarDeptoRef.current?.(norm);
    });

    map.on("click", "deptos-datos-fill", (e) => {
      const f = e.features?.[0];
      if (!f) return;
      const p = f.properties as { depto: string; depto_norm: string; pcia: string; valor: number; sup_ym: number };
      popupRef.current
        ?.setLngLat(e.lngLat)
        .setHTML(
          popupHTML(tituloCase(p.depto), tituloCase(p.pcia), [
            { label: "Superficie cultivada", valor: `${nf1.format(p.valor)}%` },
            { label: "Superficie con yerba mate", valor: `${nf0.format(p.sup_ym)} ha` },
          ])
        )
        .addTo(map);
      if (p.depto_norm) onSeleccionarDeptoRef.current?.(p.depto_norm);
    });

    map.on("click", "secaderos-puntos", (e) => {
      const f = e.features?.[0];
      if (!f) return;
      const p = f.properties as { idplanta: number; dir_catastral: string | null };
      popupRef.current
        ?.setLngLat(e.lngLat)
        .setHTML(popupHTML(`Secadero #${p.idplanta}`, p.dir_catastral ? p.dir_catastral : null, []))
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

    map.on("click", "burbujas-puntos", (e) => {
      const f = e.features?.[0];
      if (!f) return;
      const p = f.properties as { ciudad: string; provincia: string; produccion_kg: number };
      popupRef.current
        ?.setLngLat(e.lngLat)
        .setHTML(popupHTML(p.ciudad, p.provincia, [{ label: "Producción", valor: `${nf0.format(p.produccion_kg)} kg` }]))
        .addTo(map);
      onSeleccionarBurbujaRef.current?.(p);
    });

    map.on("click", "flujo-lineas", (e) => {
      const f = e.features?.[0];
      if (!f) return;
      const p = f.properties as { ciudad: string; distancia_km: number; produccion_kg: number };
      popupRef.current
        ?.setLngLat(e.lngLat)
        .setHTML(
          popupHTML(
            p.ciudad,
            "Secadero más cercano",
            [
              { label: "Distancia en línea recta", valor: `${nf1.format(p.distancia_km)} km` },
              { label: "Producción de origen", valor: `${nf0.format(p.produccion_kg)} kg` },
            ],
            "Proximidad geográfica calculada, no es una ruta logística verificada."
          )
        )
        .addTo(map);
      onSeleccionarFlujoRef.current?.(p);
    });

    for (const layerId of [
      "deptos-contexto-fill",
      "deptos-datos-fill",
      "secaderos-puntos",
      "secaderos-clusters",
      "burbujas-puntos",
      "flujo-lineas",
    ]) {
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
      map!.setLayoutProperty("calles", "visibility", basemap === "calles" ? "visible" : "none");
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
      for (const id of ["deptos-contexto-fill", "deptos-contexto-outline", "deptos-contexto-label", "deptos-seleccionado-outline"]) {
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
      // Borde destacado del departamento elegido (se activa vía filter, ver efecto de filtros)
      map.addLayer(
        {
          id: "deptos-seleccionado-outline",
          type: "line",
          source: "deptos-contexto",
          filter: ["==", ["get", "nam_norm"], "__ninguno__"],
          paint: { "line-color": "#eab308", "line-width": 3.5 },
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

  // Clústeres de secaderos (dinámico: MapLibre reagrupa/desglosa solo con el zoom)
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

  // Heatmap de concentración de secaderos (densidad real de puntos)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    function render() {
      if (!map) return;
      if (map.getLayer("heatmap-secaderos")) map.removeLayer("heatmap-secaderos");
      if (map.getSource("heatmap-secaderos")) map.removeSource("heatmap-secaderos");
      if (!secaderos) return;

      map.addSource("heatmap-secaderos", { type: "geojson", data: secaderos });
      map.addLayer({
        id: "heatmap-secaderos",
        type: "heatmap",
        source: "heatmap-secaderos",
        paint: {
          "heatmap-weight": 1,
          "heatmap-intensity": ["interpolate", ["linear"], ["zoom"], 6, 1, 12, 3],
          "heatmap-radius": ["interpolate", ["linear"], ["zoom"], 6, 16, 12, 45],
          "heatmap-opacity": 0.85,
          "heatmap-color": [
            "interpolate", ["linear"], ["heatmap-density"],
            0, "rgba(240,253,244,0)",
            0.2, "#bbf7d0",
            0.4, "#4ade80",
            0.6, "#f59e0b",
            0.8, "#ea580c",
            1, "#7f1d1d",
          ],
        },
      });
    }
    if (map.isStyleLoaded()) render();
    else map.once("load", render);
  }, [secaderos]);

  // Burbujas proporcionales — producción por ciudad, tamaño = volumen real
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    function render() {
      if (!map) return;
      for (const id of ["burbujas-halo", "burbujas-puntos", "burbujas-label"]) {
        if (map.getLayer(id)) map.removeLayer(id);
      }
      if (map.getSource("burbujas")) map.removeSource("burbujas");
      if (!burbujas || burbujas.length === 0) return;

      const maxProd = Math.max(1, ...burbujas.map((b) => b.produccion_kg));
      map.addSource("burbujas", { type: "geojson", data: crearPuntosBurbujas(burbujas) });

      map.addLayer({
        id: "burbujas-halo",
        type: "circle",
        source: "burbujas",
        paint: {
          "circle-radius": ["interpolate", ["linear"], ["get", "produccion_kg"], 0, 12, maxProd, 60],
          "circle-color": "#f59e0b",
          "circle-opacity": 0.15,
        },
      });
      map.addLayer({
        id: "burbujas-puntos",
        type: "circle",
        source: "burbujas",
        paint: {
          "circle-radius": ["interpolate", ["linear"], ["get", "produccion_kg"], 0, 6, maxProd, 32],
          "circle-color": "#ea580c",
          "circle-opacity": 0.85,
          "circle-stroke-width": 1.5,
          "circle-stroke-color": "#ffffff",
        },
      });
      map.addLayer({
        id: "burbujas-label",
        type: "symbol",
        source: "burbujas",
        layout: {
          "text-field": ["get", "ciudad"],
          "text-size": 11,
          "text-font": ["Open Sans Bold", "Arial Unicode MS Bold"],
          "text-offset": [0, 1.8],
          "text-anchor": "top",
        },
        paint: { "text-color": "#7c2d12", "text-halo-color": "#ffffff", "text-halo-width": 1.3 },
      });
    }
    if (map.isStyleLoaded()) render();
    else map.once("load", render);
  }, [burbujas]);

  // Flow map — ciudad productora -> secadero más cercano (proximidad geográfica real, no ruta logística verificada)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    function render() {
      if (!map) return;
      for (const id of ["flujo-lineas", "flujo-origen"]) {
        if (map.getLayer(id)) map.removeLayer(id);
      }
      if (map.getSource("flujo")) map.removeSource("flujo");
      if (!flujo || flujo.features.length === 0) return;

      const volumenes = flujo.features.map((f) => (f.properties?.produccion_kg as number) ?? 0);
      const max = Math.max(1, ...volumenes);

      map.addSource("flujo", { type: "geojson", data: flujo });
      map.addLayer({
        id: "flujo-lineas",
        type: "line",
        source: "flujo",
        layout: { "line-cap": "round" },
        paint: {
          "line-color": "#1d4ed8",
          "line-width": ["interpolate", ["linear"], ["get", "produccion_kg"], 0, 1.5, max, 9],
          "line-opacity": 0.65,
        },
      });
      map.addLayer({
        id: "flujo-origen",
        type: "circle",
        source: "flujo",
        paint: { "circle-radius": 6, "circle-color": "#1d4ed8", "circle-stroke-width": 1.5, "circle-stroke-color": "#ffffff" },
      });
    }
    if (map.isStyleLoaded()) render();
    else map.once("load", render);
  }, [flujo]);

  // Vista activa
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    function aplicar() {
      if (!map) return;
      const vis = (v: VistaMapa) => (vista === v ? "visible" : "none");
      for (const id of ["deptos-datos-fill", "deptos-datos-outline"]) {
        if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", vis("coropletico"));
      }
      for (const id of ["secaderos-clusters", "secaderos-cluster-count", "secaderos-puntos"]) {
        if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", vis("secaderos"));
      }
      if (map.getLayer("heatmap-secaderos")) map.setLayoutProperty("heatmap-secaderos", "visibility", vis("heatmap"));
      for (const id of ["burbujas-halo", "burbujas-puntos", "burbujas-label"]) {
        if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", vis("burbujas"));
      }
      for (const id of ["flujo-lineas", "flujo-origen"]) {
        if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", vis("flujo"));
      }
    }
    if (map.isStyleLoaded()) aplicar();
    else map.once("load", aplicar);
  }, [vista, departamentosDatos, secaderos, burbujas, flujo]);

  // Filtro de provincia/departamento: atenúa lo que no pertenece a la selección
  // y resalta con borde amarillo el departamento elegido. Compara siempre por
  // los campos "_norm" (mayúsculas, sin acentos) para que la comparación no
  // dependa de que el INYM y el INDEC escriban el nombre igual (no lo hacen:
  // "OBERA" vs "Oberá").
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    function aplicar() {
      if (!map) return;
      const provActivo = provinciaFiltro !== null;
      const deptoActivo = departamentoFiltro !== null;

      // Contexto gris: si hay depto elegido, solo ese depto queda "presente";
      // si solo hay provincia, se atenúa el resto de provincias.
      let opacidadContexto: number | maplibregl.ExpressionSpecification = 0.18;
      if (deptoActivo) {
        opacidadContexto = ["case", ["==", ["get", "nam_norm"], departamentoFiltro as string], 0.05, 0.22];
      } else if (provActivo) {
        opacidadContexto = ["case", ["==", ["upcase", ["get", "jur"]], provinciaFiltro as string], 0.18, 0.06];
      }
      if (map.getLayer("deptos-contexto-fill")) map.setPaintProperty("deptos-contexto-fill", "fill-opacity", opacidadContexto);

      let opacidadDatos: number | maplibregl.ExpressionSpecification = 0.88;
      if (deptoActivo) {
        opacidadDatos = ["case", ["==", ["get", "depto_norm"], departamentoFiltro as string], 0.92, 0.06];
      } else if (provActivo) {
        opacidadDatos = ["case", ["==", ["upcase", ["get", "pcia"]], provinciaFiltro as string], 0.88, 0.1];
      }
      if (map.getLayer("deptos-datos-fill")) map.setPaintProperty("deptos-datos-fill", "fill-opacity", opacidadDatos);

      if (map.getLayer("deptos-seleccionado-outline")) {
        map.setFilter("deptos-seleccionado-outline", ["==", ["get", "nam_norm"], deptoActivo ? (departamentoFiltro as string) : "__ninguno__"]);
      }
    }
    if (map.isStyleLoaded()) aplicar();
    else map.once("load", aplicar);
  }, [provinciaFiltro, departamentoFiltro]);

  // Foco (fitBounds) cuando cambia el filtro de provincia/departamento
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !bboxFoco || bboxFoco.features.length === 0) return;
    if (map.isStyleLoaded()) fitBoundsA(map, bboxFoco);
    else map.once("load", () => fitBoundsA(map, bboxFoco));
  }, [bboxFoco]);

  return <div ref={containerRef} className="w-full h-full" />;
}
