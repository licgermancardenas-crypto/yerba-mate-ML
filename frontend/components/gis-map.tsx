"use client";

import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef } from "react";
import type { GeoFeatureCollection } from "@/lib/types";
import { ESTILO_BASE, CENTRO_ZONA_YERBATERA, aplicarBasemap, type Basemap } from "@/lib/basemap";
import { extenderBounds, fitBoundsA, popupHTML } from "@/lib/mapa-geo-utils";
import { nombreFeature } from "@/lib/gis-resumen";
import { formatNumero } from "@/lib/format";

// Infraestructura de transporte (IGN, Misiones+Corrientes) -- contexto
// opcional independiente del selector "Capa": se fetchea una sola vez al
// montar el mapa y se prende/apaga con checkboxes (ver mapa-gis-client.tsx),
// para poder combinarla con cualquier capa activa en vez de reemplazarla.
export interface CapasTransporte {
  vialNacional: GeoJSON.FeatureCollection | null;
  vialProvincial: GeoJSON.FeatureCollection | null;
  ferrocarril: GeoJSON.FeatureCollection | null;
}

export interface TransporteActivo {
  vialNacional: boolean;
  vialProvincial: boolean;
  ferrocarril: boolean;
}

interface Props {
  data: GeoFeatureCollection;
  // "MultiLineString" nunca llega acá en la práctica -- las 3 capas de
  // transporte quedan excluidas del selector "Capa" (ver mapa-gis/page.tsx),
  // se manejan aparte vía la prop `transporte`. Se incluye en el tipo solo
  // para que coincida con CapaCatalogo.geom_type sin un cast en el caller.
  geomType: "MultiPolygon" | "Point" | "MultiLineString";
  // Campo numérico a colorear en el coroplético (sup_ym/sup_cons/cant, según
  // la capa activa) -- null cuando la capa no trae ningún valor cuantitativo
  // propio (administrativas puras del INDEC), en cuyo caso se pinta lisa.
  campoValor: string | null;
  // Provincias (contorno grueso + label), siempre visible como referencia.
  jurisdicciones: GeoJSON.FeatureCollection | null;
  // Radios censales INDEC 2010 (Misiones/Corrientes) -- malla de contexto
  // gris de fondo, más fina que el departamento, SIEMPRE visible debajo de
  // la capa activa. Es solo referencia geográfica: no se colorea por sus
  // propias variables censales (eso quedaría para una vista de análisis
  // aparte, no pedida todavía) -- ver docs/censo2010_radios.md.
  radiosContexto: GeoJSON.FeatureCollection | null;
  transporte: CapasTransporte;
  transporteActivo: TransporteActivo;
  basemap: Basemap;
  provinciaFiltro: string | null; // 'MISIONES' | 'CORRIENTES' | null (todas)
  bboxFoco: GeoJSON.FeatureCollection | null; // feature(s) a los que hacer fitBounds cuando cambia el filtro
  // El detalle de la zona clickeada se muestra en el panel lateral (ver
  // GisPanel), no solo en el popup -- el popup es un adelanto liviano.
  onSeleccionarFeature?: (props: Record<string, unknown>) => void;
}

const CENTRO_INICIAL = CENTRO_ZONA_YERBATERA;

const TEXT_PAINT = {
  "text-color": "#ffffff",
  "text-halo-color": "#052e16",
  "text-halo-width": 1.4,
};

// Mismo degradé verde que el coroplético de Producción -- consistencia
// visual entre ambos mapas para el mismo tipo de dato (hectáreas de yerba).
function expresionColor(campo: string, max: number): maplibregl.ExpressionSpecification {
  return [
    "interpolate", ["linear"], ["get", campo],
    0, "#f0fdf4",
    max * 0.25, "#bbf7d0",
    max * 0.5, "#4ade80",
    max * 0.75, "#16a34a",
    max, "#14532d",
  ];
}

const TRANSPORTE_PAINT: Record<keyof CapasTransporte, { "line-color": string; "line-width": number; "line-dasharray"?: number[] }> = {
  // Rojo carretero clásico -- máximo contraste contra el coroplético verde.
  vialNacional: { "line-color": "#dc2626", "line-width": 1.8 },
  vialProvincial: { "line-color": "#f59e0b", "line-width": 1.1 },
  // Rayado, convención cartográfica estándar para vías férreas.
  ferrocarril: { "line-color": "#1e293b", "line-width": 1.4, "line-dasharray": [3, 2] },
};

const TRANSPORTE_LAYER_ID: Record<keyof CapasTransporte, string> = {
  vialNacional: "transporte-vial-nacional",
  vialProvincial: "transporte-vial-provincial",
  ferrocarril: "transporte-ferrocarril",
};

// Encadenar cada grupo de capas de contexto a un ancla "de arriba" con
// fallback (en vez de que todas apunten a "jurisdicciones-outline") evita
// que el orden real de inserción -- que depende de qué fetch async resuelve
// primero, o de qué efecto se re-dispara último al cambiar de capa -- termine
// reordenando visualmente radios/capa/transporte entre sí. Cada grupo queda
// fijo relativo al de arriba sin importar cuántas veces se reconstruya.
function primeraCapaTransporteExistente(map: maplibregl.Map): string | undefined {
  return (Object.values(TRANSPORTE_LAYER_ID) as string[]).find((id) => map.getLayer(id));
}

export function GisMap({
  data,
  geomType,
  campoValor,
  jurisdicciones,
  radiosContexto,
  transporte,
  transporteActivo,
  basemap,
  provinciaFiltro,
  bboxFoco,
  onSeleccionarFeature,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const popupRef = useRef<maplibregl.Popup | null>(null);
  const encuadreInicialHecho = useRef(false);
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
      style: ESTILO_BASE,
      center: CENTRO_INICIAL,
      zoom: 6.8,
    });
    map.addControl(new maplibregl.NavigationControl(), "top-right");
    map.addControl(new maplibregl.ScaleControl({ unit: "metric" }), "bottom-right");
    popupRef.current = new maplibregl.Popup({ closeButton: true, maxWidth: "280px" });

    function seleccionar(id: string | number | undefined, props: Record<string, unknown>, lngLat: maplibregl.LngLat) {
      const idOrNone = id ?? "__ninguno__";
      if (map.getLayer("capa-seleccionada-outline")) map.setFilter("capa-seleccionada-outline", ["==", ["id"], idOrNone]);
      if (map.getLayer("capa-seleccionada-punto")) map.setFilter("capa-seleccionada-punto", ["==", ["id"], idOrNone]);
      onSeleccionarFeatureRef.current?.(props);

      const nombre = nombreFeature(props);
      const filas: { label: string; valor: string }[] = [];
      if (campoValor && typeof props[campoValor] === "number") {
        filas.push({ label: campoValor === "cant" ? "Secaderos" : "Superficie", valor: `${formatNumero(props[campoValor] as number, 0)} ha` });
      }
      popupRef.current
        ?.setLngLat(lngLat)
        .setHTML(popupHTML(nombre, typeof props.pcia === "string" ? props.pcia : typeof props.jur === "string" ? props.jur : null, filas))
        .addTo(map);
    }

    map.on("click", "capa-fill", (e) => {
      const f = e.features?.[0];
      if (!f) return;
      seleccionar(f.id, f.properties ?? {}, e.lngLat);
    });
    map.on("click", "capa-puntos", (e) => {
      const f = e.features?.[0];
      if (!f) return;
      seleccionar(f.id, f.properties ?? {}, e.lngLat);
    });
    map.on("click", "capa-clusters", (e) => {
      const f = e.features?.[0];
      if (!f) return;
      const clusterId = f.properties?.cluster_id;
      const source = map.getSource("capa") as maplibregl.GeoJSONSource;
      source.getClusterExpansionZoom(clusterId).then((zoom) => {
        map.easeTo({ center: (f.geometry as GeoJSON.Point).coordinates as [number, number], zoom });
      });
    });

    // Transporte: popup liviano con nombre de ruta/ramal, sin tocar el panel
    // lateral (esas capas son contexto, no "la capa activa" -- GisPanel/
    // detalleFeature están pensados para la capa del selector).
    function popupTransporte(e: maplibregl.MapLayerMouseEvent) {
      const f = e.features?.[0];
      if (!f) return;
      const props = f.properties ?? {};
      popupRef.current?.setLngLat(e.lngLat).setHTML(popupHTML(nombreFeature(props), typeof props.gna === "string" ? props.gna : null, [])).addTo(map);
    }
    for (const layerId of Object.values(TRANSPORTE_LAYER_ID)) {
      map.on("click", layerId, popupTransporte);
    }

    for (const layerId of ["capa-fill", "capa-puntos", "capa-clusters", ...Object.values(TRANSPORTE_LAYER_ID)]) {
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
    const aplicar = () => aplicarBasemap(map, basemap);
    if (map.isStyleLoaded()) aplicar();
    // "load" solo dispara una vez en toda la vida del mapa -- si ese evento
    // ya pasó mientras isStyleLoaded() da false (pasa seguido: ese flag
    // vuelve a false cada vez que se refetchean tiles del basemap, no solo
    // al montar), el callback quedaba registrado para un evento que ya no
    // iba a volver a ocurrir nunca. "idle" sí se repite (dispara en cada
    // ciclo en que el mapa no tiene requests pendientes), así que sirve como
    // reintento real en vez de una apuesta de una sola vez.
    else map.once("idle", aplicar);
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
    else map.once("idle", render); // ver comentario en el efecto de basemap
  }, [jurisdicciones]);

  // Radios censales INDEC 2010 — malla de contexto gris, siempre debajo de
  // la capa activa. Sin labels: a esta densidad (3.064 polígonos) satura el
  // mapa; el contorno fino ya transmite la granularidad real del territorio.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    function render() {
      if (!map) return;
      for (const id of ["radios-contexto-fill", "radios-contexto-outline"]) {
        if (map.getLayer(id)) map.removeLayer(id);
      }
      if (map.getSource("radios-contexto")) map.removeSource("radios-contexto");
      if (!radiosContexto) return;

      const antesDe = map.getLayer("capa-fill")
        ? "capa-fill"
        : map.getLayer("jurisdicciones-outline")
          ? "jurisdicciones-outline"
          : undefined;
      map.addSource("radios-contexto", { type: "geojson", data: radiosContexto });
      map.addLayer(
        {
          id: "radios-contexto-fill",
          type: "fill",
          source: "radios-contexto",
          paint: { "fill-color": "#94a3b8", "fill-opacity": 0.12 },
        },
        antesDe
      );
      map.addLayer(
        {
          id: "radios-contexto-outline",
          type: "line",
          source: "radios-contexto",
          paint: { "line-color": "#64748b", "line-width": 0.4, "line-opacity": 0.5 },
        },
        antesDe
      );
    }
    if (map.isStyleLoaded()) render();
    else map.once("idle", render); // ver comentario en el efecto de basemap
  }, [radiosContexto]);

  // Infraestructura de transporte (IGN) -- una fuente/capa por tipo (vial
  // nacional/provincial, ferrocarril), siempre por encima del coroplético de
  // la capa activa (para que se vea sobre el relleno) pero por debajo de las
  // jurisdicciones y de los puntos/clústeres. Visibilidad controlada por
  // checkbox (transporteActivo), no por presencia/ausencia de la fuente --
  // así el toggle es instantáneo sin re-parsear el GeoJSON.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    function render() {
      if (!map) return;
      const antesDe = map.getLayer("jurisdicciones-outline") ? "jurisdicciones-outline" : undefined;
      (Object.keys(TRANSPORTE_LAYER_ID) as (keyof CapasTransporte)[]).forEach((key) => {
        const layerId = TRANSPORTE_LAYER_ID[key];
        const sourceId = layerId;
        if (map.getLayer(layerId)) map.removeLayer(layerId);
        if (map.getSource(sourceId)) map.removeSource(sourceId);
        const geojson = transporte[key];
        if (!geojson) return;
        map.addSource(sourceId, { type: "geojson", data: geojson });
        map.addLayer(
          {
            id: layerId,
            type: "line",
            source: sourceId,
            layout: { visibility: transporteActivo[key] ? "visible" : "none" },
            paint: TRANSPORTE_PAINT[key],
          },
          antesDe
        );
      });
    }
    if (map.isStyleLoaded()) render();
    else map.once("idle", render); // ver comentario en el efecto de basemap
    // transporteActivo se lee acá solo para la visibilidad INICIAL al crear
    // la capa -- las actualizaciones posteriores las maneja el efecto de
    // abajo (setLayoutProperty). Incluirlo en las deps volvería a disparar
    // este efecto pesado (recrea 3 fuentes/capas) en cada click de
    // checkbox, exactamente lo que ese segundo efecto existe para evitar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transporte]);

  // Toggle de visibilidad de transporte -- separado del efecto de arriba
  // para no reconstruir fuente+capa en cada click de checkbox. Sin gating
  // por isStyleLoaded/idle a propósito: `setLayoutProperty` sobre una capa
  // que ya existe no necesita esperar nada del ciclo de carga del estilo (a
  // diferencia de `addSource`/`addLayer`) -- gatearlo causó un bug real acá:
  // si el click llegaba mientras `isStyleLoaded()` daba false, quedaba
  // esperando un "idle" que podía no volver a disparar nunca (el mapa ya
  // estaba quieto, sin nada pendiente que gatille una nueva transición), y
  // las 3 capas quedaban invisibles para siempre pese al checkbox activado.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    (Object.keys(TRANSPORTE_LAYER_ID) as (keyof CapasTransporte)[]).forEach((key) => {
      const layerId = TRANSPORTE_LAYER_ID[key];
      if (map.getLayer(layerId)) map.setLayoutProperty(layerId, "visibility", transporteActivo[key] ? "visible" : "none");
    });
  }, [transporteActivo]);

  // Capa activa (selector) — coroplético cuando trae un campo numérico real,
  // clústeres cuando son puntos, relleno liso cuando es una capa
  // administrativa pura sin dato cuantitativo propio.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    function render() {
      if (!map) return;
      for (const id of [
        "capa-fill",
        "capa-outline",
        "capa-seleccionada-outline",
        "capa-clusters",
        "capa-cluster-count",
        "capa-puntos",
        "capa-seleccionada-punto",
      ]) {
        if (map.getLayer(id)) map.removeLayer(id);
      }
      if (map.getSource("capa")) map.removeSource("capa");
      if (!data.features.length) return;

      const antesDe =
        primeraCapaTransporteExistente(map) ?? (map.getLayer("jurisdicciones-outline") ? "jurisdicciones-outline" : undefined);

      if (geomType === "Point") {
        map.addSource("capa", { type: "geojson", data: data as unknown as GeoJSON.FeatureCollection, cluster: true, clusterMaxZoom: 12, clusterRadius: 45 });
        map.addLayer({
          id: "capa-clusters",
          type: "circle",
          source: "capa",
          filter: ["has", "point_count"],
          paint: {
            "circle-color": ["step", ["get", "point_count"], "#fdba74", 5, "#fb923c", 15, "#ea580c"],
            "circle-radius": ["step", ["get", "point_count"], 16, 5, 22, 15, 28],
            "circle-stroke-width": 2,
            "circle-stroke-color": "#ffffff",
          },
        });
        map.addLayer({
          id: "capa-cluster-count",
          type: "symbol",
          source: "capa",
          filter: ["has", "point_count"],
          layout: {
            "text-field": ["get", "point_count_abbreviated"],
            "text-size": 12,
            "text-font": ["Open Sans Bold", "Arial Unicode MS Bold"],
          },
          paint: { "text-color": "#ffffff" },
        });
        map.addLayer({
          id: "capa-puntos",
          type: "circle",
          source: "capa",
          filter: ["!", ["has", "point_count"]],
          paint: { "circle-radius": 7, "circle-color": "#ea580c", "circle-stroke-width": 1.5, "circle-stroke-color": "#ffffff" },
        });
        map.addLayer({
          id: "capa-seleccionada-punto",
          type: "circle",
          source: "capa",
          filter: ["==", ["id"], "__ninguno__"],
          paint: { "circle-radius": 11, "circle-color": "#ea580c", "circle-stroke-width": 3, "circle-stroke-color": "#eab308" },
        });
      } else {
        map.addSource("capa", { type: "geojson", data: data as unknown as GeoJSON.FeatureCollection });

        const valores = campoValor ? data.features.map((f) => Number(f.properties[campoValor]) || 0) : [];
        const max = Math.max(...valores, 0.01);

        map.addLayer(
          {
            id: "capa-fill",
            type: "fill",
            source: "capa",
            paint: {
              "fill-color": campoValor ? expresionColor(campoValor, max) : "#22c55e",
              "fill-opacity": 0.82,
            },
          },
          antesDe
        );
        map.addLayer(
          {
            id: "capa-outline",
            type: "line",
            source: "capa",
            paint: { "line-color": "#052e16", "line-width": 1 },
          },
          antesDe
        );
        map.addLayer(
          {
            id: "capa-seleccionada-outline",
            type: "line",
            source: "capa",
            filter: ["==", ["id"], "__ninguno__"],
            paint: { "line-color": "#eab308", "line-width": 3.5 },
          },
          antesDe
        );
      }

      const bounds = new maplibregl.LngLatBounds();
      for (const feature of data.features) {
        if (feature.geometry && "coordinates" in feature.geometry) extenderBounds(bounds, feature.geometry.coordinates);
      }
      if (!bounds.isEmpty()) map.fitBounds(bounds, { padding: 40, maxZoom: 11, duration: 400 });
    }

    if (map.isStyleLoaded()) render();
    else map.once("idle", render); // ver comentario en el efecto de basemap
  }, [data, geomType, campoValor]);

  // Filtro de provincia: atenúa la malla de radios que no pertenece a la
  // selección y hace foco (fitBounds) en la jurisdicción elegida.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    function aplicar() {
      if (!map) return;
      const opacidad: number | maplibregl.ExpressionSpecification = provinciaFiltro
        ? ["case", ["==", ["upcase", ["get", "provincia"]], provinciaFiltro as string], 0.12, 0.03]
        : 0.12;
      if (map.getLayer("radios-contexto-fill")) map.setPaintProperty("radios-contexto-fill", "fill-opacity", opacidad);
    }
    if (map.isStyleLoaded()) aplicar();
    else map.once("idle", aplicar); // ver comentario en el efecto de basemap
  }, [provinciaFiltro]);

  // Foco (fitBounds) cuando cambia el filtro de provincia. A diferencia de
  // los efectos que agregan fuentes/capas, fitBounds es puramente una
  // animación de cámara -- no depende de que el estilo esté cargado, así
  // que se llama directo. Esperar a `isStyleLoaded()` acá era un bug real:
  // ese flag vuelve a `false` mientras cargan tiles del basemap (algo
  // frecuente, no solo en el montaje), y el fallback `map.once("load", ...)`
  // nunca vuelve a disparar porque el evento "load" ya ocurrió una sola vez
  // -- el fitBounds quedaba mudo cada vez que coincidía con una carga de tiles.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !bboxFoco || bboxFoco.features.length === 0) return;
    fitBoundsA(map, bboxFoco);
  }, [bboxFoco]);

  // Encuadre inicial real: CENTRO_ZONA_YERBATERA es una aproximación fija
  // que dejaba media pantalla mostrando Paraguay -- en cuanto llega la
  // primera capa con datos reales, se encuadra la cámara a su extensión.
  // Una sola vez (ref, no state) para no pelear con el zoom/pan manual del
  // usuario en switches de capa posteriores, y solo si no hay un filtro de
  // provincia activo (ese caso ya lo encuadra el efecto de arriba).
  useEffect(() => {
    const map = mapRef.current;
    if (!map || encuadreInicialHecho.current) return;
    if (provinciaFiltro) return;
    if (!data || data.features.length === 0) return;
    fitBoundsA(map, data as unknown as GeoJSON.FeatureCollection, { duration: 0 });
    encuadreInicialHecho.current = true;
  }, [data, provinciaFiltro]);

  return <div ref={containerRef} className="w-full h-full" />;
}
