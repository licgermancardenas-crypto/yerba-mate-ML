import type {
  CompetenciaRow,
  ConsumoRow,
  ExportacionRow,
  GeoFeatureCollection,
  PrecioRow,
  ProduccionRow,
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

export function getPrecios(params?: { anioDesde?: number; anioHasta?: number }) {
  const qs = new URLSearchParams();
  if (params?.anioDesde) qs.set("anio_desde", String(params.anioDesde));
  if (params?.anioHasta) qs.set("anio_hasta", String(params.anioHasta));
  const query = qs.toString();
  return apiFetch<PrecioRow[]>(`/precios${query ? `?${query}` : ""}`);
}

export function getCompetencia(params?: { anioDesde?: number; anioHasta?: number; empresa?: string }) {
  const qs = new URLSearchParams();
  if (params?.anioDesde) qs.set("anio_desde", String(params.anioDesde));
  if (params?.anioHasta) qs.set("anio_hasta", String(params.anioHasta));
  if (params?.empresa) qs.set("empresa", params.empresa);
  const query = qs.toString();
  return apiFetch<CompetenciaRow[]>(`/competencia${query ? `?${query}` : ""}`);
}

export function getGeoLayer(layer: string) {
  return apiFetch<GeoFeatureCollection>(`/geo/${layer}`);
}
