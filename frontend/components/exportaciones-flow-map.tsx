"use client";

import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useMemo, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { formatKg, formatPct, formatUsd } from "@/lib/format";
import { ORIGEN_ARGENTINA, PAISES_DESTINO, arcoGeodesico } from "@/lib/paises-destino";

const BASEMAP_STYLE = "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";
const COLOR_FLUJO = "#4ade80";
const COLOR_SELECCIONADO = "#eab308";
const PASOS_ARCO = 48;

export interface DestinoFlujo {
  destino: string;
  volumen_kg: number;
  valor_fob_usd: number;
  porcentaje: number;
}

function construirArcos(destinos: DestinoFlujo[]): GeoJSON.FeatureCollection<GeoJSON.LineString> {
  const features: GeoJSON.Feature<GeoJSON.LineString>[] = [];
  for (const d of destinos) {
    const pais = PAISES_DESTINO[d.destino];
    if (!pais) continue; // "Others" no es un país geocodificable -- se excluye del mapa a propósito
    features.push({
      type: "Feature",
      geometry: { type: "LineString", coordinates: arcoGeodesico(ORIGEN_ARGENTINA, pais.coords, PASOS_ARCO) },
      properties: {
        destino: d.destino,
        label: pais.label,
        volumen_kg: d.volumen_kg,
        valor_fob_usd: d.valor_fob_usd,
        porcentaje: d.porcentaje,
      },
    });
  }
  return { type: "FeatureCollection", features };
}

function construirNodos(destinos: DestinoFlujo[]): GeoJSON.FeatureCollection<GeoJSON.Point> {
  const features: GeoJSON.Feature<GeoJSON.Point>[] = [];
  for (const d of destinos) {
    const pais = PAISES_DESTINO[d.destino];
    if (!pais) continue;
    features.push({
      type: "Feature",
      geometry: { type: "Point", coordinates: pais.coords },
      properties: {
        destino: d.destino,
        label: pais.label,
        volumen_kg: d.volumen_kg,
        valor_fob_usd: d.valor_fob_usd,
        porcentaje: d.porcentaje,
      },
    });
  }
  return { type: "FeatureCollection", features };
}

export function ExportacionesFlowMap({
  destinos,
  destinoFiltro,
}: {
  destinos: DestinoFlujo[];
  destinoFiltro: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const popupRef = useRef<maplibregl.Popup | null>(null);
  const animRef = useRef<number | null>(null);

  // Memoizado: los arcos son geometría geodésica calculada (48 puntos c/u) --
  // sin esto se recalcularían en cada render (p. ej. al mover el mouse) en
  // vez de solo cuando cambia el dataset real de destinos.
  const arcos = useMemo(() => construirArcos(destinos), [destinos]);
  const nodos = useMemo(() => construirNodos(destinos), [destinos]);
  const maxPorcentaje = useMemo(() => Math.max(...destinos.map((d) => d.porcentaje), 1), [destinos]);
  const sinGeocodificar = useMemo(() => destinos.find((d) => !PAISES_DESTINO[d.destino]), [destinos]);

  function toggleDestino(destino: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (params.get("destino") === destino) params.delete("destino");
    else params.set("destino", destino);
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  useEffect(() => {
    if (!containerRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: BASEMAP_STYLE,
      center: [-20, 5],
      zoom: 1.1,
    });
    map.addControl(new maplibregl.NavigationControl(), "top-right");
    popupRef.current = new maplibregl.Popup({ closeButton: false, closeOnClick: false, maxWidth: "240px" });

    function render() {
      map.addSource("flujo-arcos", { type: "geojson", data: arcos });
      map.addLayer({
        id: "flujo-arcos-linea",
        type: "line",
        source: "flujo-arcos",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": COLOR_FLUJO,
          "line-width": ["interpolate", ["linear"], ["get", "porcentaje"], 0, 1.5, maxPorcentaje, 6],
          "line-opacity": ["interpolate", ["linear"], ["get", "porcentaje"], 0, 0.35, maxPorcentaje, 0.85],
        },
      });

      map.addSource("flujo-nodos", { type: "geojson", data: nodos });
      map.addLayer({
        id: "flujo-nodos-halo",
        type: "circle",
        source: "flujo-nodos",
        paint: {
          "circle-radius": ["interpolate", ["linear"], ["get", "porcentaje"], 0, 8, maxPorcentaje, 22],
          "circle-color": COLOR_FLUJO,
          "circle-opacity": 0.18,
        },
      });
      map.addLayer({
        id: "flujo-nodos-punto",
        type: "circle",
        source: "flujo-nodos",
        paint: {
          "circle-radius": ["interpolate", ["linear"], ["get", "porcentaje"], 0, 4, maxPorcentaje, 10],
          "circle-color": COLOR_FLUJO,
          "circle-stroke-width": 1.5,
          "circle-stroke-color": "#0f172a",
        },
      });
      map.addLayer({
        id: "flujo-nodos-label",
        type: "symbol",
        source: "flujo-nodos",
        layout: {
          "text-field": ["get", "label"],
          "text-size": 11,
          "text-font": ["Open Sans Bold", "Arial Unicode MS Bold"],
          "text-offset": [0, 1.4],
          "text-anchor": "top",
        },
        paint: { "text-color": "#f8fafc", "text-halo-color": "#0f172a", "text-halo-width": 1.4 },
      });

      map.addSource("flujo-origen", {
        type: "geojson",
        data: { type: "Feature", geometry: { type: "Point", coordinates: ORIGEN_ARGENTINA }, properties: { label: "Argentina" } },
      });
      map.addLayer({
        id: "flujo-origen-punto",
        type: "circle",
        source: "flujo-origen",
        paint: { "circle-radius": 6, "circle-color": "#f8fafc", "circle-stroke-width": 2, "circle-stroke-color": COLOR_FLUJO },
      });
      map.addLayer({
        id: "flujo-origen-label",
        type: "symbol",
        source: "flujo-origen",
        layout: {
          "text-field": ["get", "label"],
          "text-size": 11,
          "text-font": ["Open Sans Bold", "Arial Unicode MS Bold"],
          "text-offset": [0, 1.3],
          "text-anchor": "top",
        },
        paint: { "text-color": "#f8fafc", "text-halo-color": "#0f172a", "text-halo-width": 1.4 },
      });

      // Punto animado por arco -- simula el "flujo" viajando de Argentina al
      // destino, en loop continuo (no depende de deck.gl: se actualiza la
      // posición del punto a mano vía requestAnimationFrame).
      map.addSource("flujo-pulsos", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      map.addLayer({
        id: "flujo-pulsos-punto",
        type: "circle",
        source: "flujo-pulsos",
        paint: { "circle-radius": 4, "circle-color": "#ffffff", "circle-opacity": 0.9 },
      });

      const arcosData = arcos.features;
      let frame = 0;
      function animar() {
        frame += 1;
        const features: GeoJSON.Feature<GeoJSON.Point>[] = arcosData.map((f, i) => {
          const n = f.geometry.coordinates.length;
          // Se desfasa cada arco un poco entre sí para que no viajen todos sincronizados.
          const idx = Math.floor((frame * 0.6 + i * 7) % n);
          return { type: "Feature", geometry: { type: "Point", coordinates: f.geometry.coordinates[idx] }, properties: {} };
        });
        const source = map.getSource("flujo-pulsos") as maplibregl.GeoJSONSource | undefined;
        source?.setData({ type: "FeatureCollection", features });
        animRef.current = requestAnimationFrame(animar);
      }
      animar();

      for (const layerId of ["flujo-nodos-punto", "flujo-arcos-linea"]) {
        map.on("mouseenter", layerId, () => {
          map.getCanvas().style.cursor = "pointer";
        });
        map.on("mouseleave", layerId, () => {
          map.getCanvas().style.cursor = "";
          popupRef.current?.remove();
        });
        map.on("mousemove", layerId, (e) => {
          const f = e.features?.[0];
          if (!f) return;
          const p = f.properties as { label: string; volumen_kg: number; valor_fob_usd: number; porcentaje: number };
          popupRef.current
            ?.setLngLat(e.lngLat)
            .setHTML(
              `<div class="px-3 py-2 text-xs min-w-[160px]">
                <div class="text-sm font-semibold text-card-foreground mb-1">${p.label}</div>
                <div class="flex justify-between gap-3 py-0.5"><span class="text-muted-foreground">Volumen</span><span class="font-semibold text-card-foreground">${formatKg(p.volumen_kg)}</span></div>
                <div class="flex justify-between gap-3 py-0.5"><span class="text-muted-foreground">Valor FOB</span><span class="font-semibold text-card-foreground">${formatUsd(p.valor_fob_usd)}</span></div>
                <div class="flex justify-between gap-3 py-0.5"><span class="text-muted-foreground">% del total</span><span class="font-semibold text-card-foreground">${formatPct(p.porcentaje)}</span></div>
              </div>`
            )
            .addTo(map);
        });
        map.on("click", layerId, (e) => {
          const f = e.features?.[0];
          const destino = f?.properties?.destino as string | undefined;
          if (destino) toggleDestino(destino);
        });
      }
    }

    if (map.isStyleLoaded()) render();
    else map.once("load", render);

    mapRef.current = map;
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Resalta el destino filtrado (URL / FilterBar) y atenúa el resto -- mismo
  // patrón de "seleccionar y sombrear" que el mapa de Producción.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    function aplicar() {
      if (!map) return;
      if (map.getLayer("flujo-arcos-linea")) {
        map.setPaintProperty(
          "flujo-arcos-linea",
          "line-color",
          destinoFiltro ? ["case", ["==", ["get", "destino"], destinoFiltro], COLOR_SELECCIONADO, COLOR_FLUJO] : COLOR_FLUJO
        );
        map.setPaintProperty(
          "flujo-arcos-linea",
          "line-opacity",
          destinoFiltro
            ? ["case", ["==", ["get", "destino"], destinoFiltro], 0.95, 0.12]
            : ["interpolate", ["linear"], ["get", "porcentaje"], 0, 0.35, maxPorcentaje, 0.85]
        );
      }
      if (map.getLayer("flujo-nodos-punto")) {
        map.setPaintProperty(
          "flujo-nodos-punto",
          "circle-color",
          destinoFiltro ? ["case", ["==", ["get", "destino"], destinoFiltro], COLOR_SELECCIONADO, COLOR_FLUJO] : COLOR_FLUJO
        );
      }
    }
    if (map.isStyleLoaded()) aplicar();
    else map.once("load", aplicar);
  }, [destinoFiltro, maxPorcentaje]);

  return (
    <div className="relative w-full h-full">
      <div ref={containerRef} className="w-full h-full" />
      <div className="absolute bottom-3 left-3 z-10 max-w-[230px] rounded-lg border border-border bg-card/95 backdrop-blur px-3 py-2 text-xs shadow-lg">
        <div className="font-medium text-card-foreground mb-1">Volumen exportado por destino</div>
        <div className="flex items-center gap-2 mb-1">
          <span className="inline-block w-6 h-0.5" style={{ backgroundColor: COLOR_FLUJO }} />
          <span className="text-muted-foreground">Grosor y opacidad ∝ % del total</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLOR_SELECCIONADO }} />
          <span className="text-muted-foreground">Destino filtrado</span>
        </div>
        {sinGeocodificar && (
          <p className="text-muted-foreground italic leading-snug mt-1.5 pt-1.5 border-t border-border">
            No incluye &quot;{sinGeocodificar.destino}&quot; ({formatPct(sinGeocodificar.porcentaje)}): agrupa varios destinos
            menores sin desagregar, no es un país puntual.
          </p>
        )}
        <p className="text-muted-foreground italic leading-snug mt-1.5 pt-1.5 border-t border-border">
          Origen ilustrativo: Puerto de Buenos Aires (no la ubicación real de cada embarque).
        </p>
      </div>
    </div>
  );
}
