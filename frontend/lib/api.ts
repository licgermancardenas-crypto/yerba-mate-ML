import type {
  CapaCatalogo,
  CompetenciaRow,
  ConsumoRow,
  ExportacionAnualRealRow,
  ExportacionIndecRow,
  ExportacionRow,
  FuentesPorTabla,
  GeoFeatureCollection,
  HojaVerdeRow,
  ImportacionIndecRow,
  ImportacionRow,
  PrecioGondolaRow,
  PrecioRow,
  RemInflacionRow,
  PrediccionRow,
  ProduccionAnualRealRow,
  ProduccionRow,
  NdviZonaRow,
  SalidaMolinoRow,
  SuperficieRow,
} from "@/lib/types";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

// Los datos vienen de ETLs que corren periódicamente, no en tiempo real —
// una hora de revalidación evita pegarle a la API en cada request sin
// mostrar información desactualizada.
const REVALIDATE_SECONDS = 3600;

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    next: { revalidate: REVALIDATE_SECONDS },
  });
  if (!res.ok) {
    throw new Error(`API ${path} respondió ${res.status}: ${await res.text()}`);
  }
  return res.json() as Promise<T>;
}

export function getProduccion(params?: { anioDesde?: number; anioHasta?: number; provincia?: string }) {
  const qs = new URLSearchParams();
  if (params?.anioDesde) qs.set("anio_desde", String(params.anioDesde));
  if (params?.anioHasta) qs.set("anio_hasta", String(params.anioHasta));
  if (params?.provincia) qs.set("provincia", params.provincia);
  const query = qs.toString();
  return apiFetch<ProduccionRow[]>(`/produccion${query ? `?${query}` : ""}`);
}

export function getNdviZona() {
  return apiFetch<NdviZonaRow[]>("/produccion/ndvi-zona");
}

/** Totales anuales reales -- ver docs/auditoria_datos.md. Fuente correcta para vistas anuales/nacionales. */
export function getProduccionAnualReal(params?: { anioDesde?: number; anioHasta?: number }) {
  const qs = new URLSearchParams();
  if (params?.anioDesde) qs.set("anio_desde", String(params.anioDesde));
  if (params?.anioHasta) qs.set("anio_hasta", String(params.anioHasta));
  const query = qs.toString();
  return apiFetch<ProduccionAnualRealRow[]>(`/produccion/anual-real${query ? `?${query}` : ""}`);
}

export function getSuperficie(params?: { anioDesde?: number; anioHasta?: number; provincia?: string }) {
  const qs = new URLSearchParams();
  if (params?.anioDesde) qs.set("anio_desde", String(params.anioDesde));
  if (params?.anioHasta) qs.set("anio_hasta", String(params.anioHasta));
  if (params?.provincia) qs.set("provincia", params.provincia);
  const query = qs.toString();
  return apiFetch<SuperficieRow[]>(`/superficie${query ? `?${query}` : ""}`);
}

export function getConsumo(params?: { anioDesde?: number; anioHasta?: number }) {
  const qs = new URLSearchParams();
  if (params?.anioDesde) qs.set("anio_desde", String(params.anioDesde));
  if (params?.anioHasta) qs.set("anio_hasta", String(params.anioHasta));
  const query = qs.toString();
  return apiFetch<ConsumoRow[]>(`/consumo${query ? `?${query}` : ""}`);
}

export function getExportaciones(params?: { anioDesde?: number; anioHasta?: number; destino?: string }) {
  const qs = new URLSearchParams();
  if (params?.anioDesde) qs.set("anio_desde", String(params.anioDesde));
  if (params?.anioHasta) qs.set("anio_hasta", String(params.anioHasta));
  if (params?.destino) qs.set("destino", params.destino);
  const query = qs.toString();
  return apiFetch<ExportacionRow[]>(`/exportaciones${query ? `?${query}` : ""}`);
}

/** Exportaciones reales por país, mensual (INDEC) -- ver docs/fuentes_exportaciones_indec.md. */
export function getExportacionesIndec(params?: { anioDesde?: number; anioHasta?: number; paisIso2?: string }) {
  const qs = new URLSearchParams();
  if (params?.anioDesde) qs.set("anio_desde", String(params.anioDesde));
  if (params?.anioHasta) qs.set("anio_hasta", String(params.anioHasta));
  if (params?.paisIso2) qs.set("pais_iso2", params.paisIso2);
  const query = qs.toString();
  return apiFetch<ExportacionIndecRow[]>(`/exportaciones/indec${query ? `?${query}` : ""}`);
}

/** Totales anuales reales por destino -- ver docs/auditoria_datos.md. */
export function getExportacionesAnualReal(params?: { anioDesde?: number; anioHasta?: number }) {
  const qs = new URLSearchParams();
  if (params?.anioDesde) qs.set("anio_desde", String(params.anioDesde));
  if (params?.anioHasta) qs.set("anio_hasta", String(params.anioHasta));
  const query = qs.toString();
  return apiFetch<ExportacionAnualRealRow[]>(`/exportaciones/anual-real${query ? `?${query}` : ""}`);
}

export function getPrecios(params?: { anioDesde?: number; anioHasta?: number }) {
  const qs = new URLSearchParams();
  if (params?.anioDesde) qs.set("anio_desde", String(params.anioDesde));
  if (params?.anioHasta) qs.set("anio_hasta", String(params.anioHasta));
  const query = qs.toString();
  return apiFetch<PrecioRow[]>(`/precios${query ? `?${query}` : ""}`);
}

export function getPreciosGondola() {
  return apiFetch<PrecioGondolaRow[]>("/precios-gondola");
}

export function getRemInflacion() {
  return apiFetch<RemInflacionRow[]>("/precios/rem-inflacion");
}

export function getCompetencia(params?: { anioDesde?: number; anioHasta?: number; empresa?: string }) {
  const qs = new URLSearchParams();
  if (params?.anioDesde) qs.set("anio_desde", String(params.anioDesde));
  if (params?.anioHasta) qs.set("anio_hasta", String(params.anioHasta));
  if (params?.empresa) qs.set("empresa", params.empresa);
  const query = qs.toString();
  return apiFetch<CompetenciaRow[]>(`/competencia${query ? `?${query}` : ""}`);
}

export function getImportaciones(params?: { anioDesde?: number; anioHasta?: number }) {
  const qs = new URLSearchParams();
  if (params?.anioDesde) qs.set("anio_desde", String(params.anioDesde));
  if (params?.anioHasta) qs.set("anio_hasta", String(params.anioHasta));
  const query = qs.toString();
  return apiFetch<ImportacionRow[]>(`/importaciones${query ? `?${query}` : ""}`);
}

/** Importaciones reales por país de origen (INDEC) -- ver docs/fuentes_exportaciones_indec.md. */
export function getImportacionesIndec(params?: { anioDesde?: number; anioHasta?: number; paisIso2?: string }) {
  const qs = new URLSearchParams();
  if (params?.anioDesde) qs.set("anio_desde", String(params.anioDesde));
  if (params?.anioHasta) qs.set("anio_hasta", String(params.anioHasta));
  if (params?.paisIso2) qs.set("pais_iso2", params.paisIso2);
  const query = qs.toString();
  return apiFetch<ImportacionIndecRow[]>(`/importaciones/indec${query ? `?${query}` : ""}`);
}

export function getHojaVerde(params?: { anioDesde?: number; anioHasta?: number; zona?: string }) {
  const qs = new URLSearchParams();
  if (params?.anioDesde) qs.set("anio_desde", String(params.anioDesde));
  if (params?.anioHasta) qs.set("anio_hasta", String(params.anioHasta));
  if (params?.zona) qs.set("zona", params.zona);
  const query = qs.toString();
  return apiFetch<HojaVerdeRow[]>(`/cadena-productiva/hoja-verde${query ? `?${query}` : ""}`);
}

export function getSalidaMolino(params?: { anioDesde?: number; anioHasta?: number }) {
  const qs = new URLSearchParams();
  if (params?.anioDesde) qs.set("anio_desde", String(params.anioDesde));
  if (params?.anioHasta) qs.set("anio_hasta", String(params.anioHasta));
  const query = qs.toString();
  return apiFetch<SalidaMolinoRow[]>(`/cadena-productiva/salida-molino${query ? `?${query}` : ""}`);
}

export function getGeoLayer(layer: string) {
  return apiFetch<GeoFeatureCollection>(`/geo/${layer}`);
}

/** Propiedades de una capa GIS sin geometría -- para tablas, evita transferir los polígonos completos. */
export function getGeoLayerAtributos<T = Record<string, unknown>>(layer: string) {
  return apiFetch<T[]>(`/geo/${layer}/atributos`);
}

export function getGeoCatalogo() {
  return apiFetch<CapaCatalogo[]>("/geo");
}

/** Fuente(s) de una o más tablas, para el footer "Fuentes de esta vista". */
export function getFuentesPorTabla(tablas: string[]) {
  return apiFetch<FuentesPorTabla>(`/fuentes/por-tabla?tablas=${encodeURIComponent(tablas.join(","))}`);
}

/** Salida de los 3 modelos de Fase 5 (ym.ml_predicciones) -- ver Fase 5, /predicciones. */
export function getPredicciones(params: { modelo: string; dimension?: string; esPronostico?: boolean }) {
  const qs = new URLSearchParams({ modelo: params.modelo });
  if (params.dimension) qs.set("dimension", params.dimension);
  if (params.esPronostico !== undefined) qs.set("es_pronostico", String(params.esPronostico));
  return apiFetch<PrediccionRow[]>(`/predicciones?${qs.toString()}`);
}
