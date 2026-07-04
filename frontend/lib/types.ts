// Formas de fila devueltas por backend/api/routers/*.py

export interface ProduccionRow {
  anio: number;
  mes: number;
  mes_nombre: string;
  provincia: string;
  ciudad: string;
  produccion_kg: number;
  consumo_interno_kg: number;
  exportaciones_kg: number;
  precio_usd_kg: number;
  valor_fob_usd: number;
}

export interface ConsumoRow {
  anio: number;
  mes: number;
  mes_nombre: string;
  consumo_per_capita_kg: number;
  envase_05kg_pct: number;
  envase_1kg_pct: number;
  envase_2kg_pct: number;
  envase_025kg_pct: number;
  otros_envases_pct: number;
  sin_estampillas_pct: number;
}

export interface ExportacionRow {
  anio: number;
  mes: number;
  mes_nombre: string;
  destino: string;
  volumen_kg: number;
  valor_fob_usd: number;
  precio_fob_usd_kg: number;
}

export interface PrecioRow {
  anio: number;
  mes: number;
  mes_nombre: string;
  precio_hoja_verde_ars: number | null;
  precio_canchada_ars: number | null;
}

export interface CompetenciaRow {
  anio: number;
  empresa: string;
  cuota_mercado_pct: number | null;
  volumen_kg: number | null;
  cobertura_ranking: string | null;
  fuente_url: string | null;
  fuente_medio: string | null;
  fuente_fecha: string | null;
}

export interface ImportacionRow {
  anio: number;
  mes: number;
  mes_nombre: string;
  volumen_kg: number;
}

export interface HojaVerdeRow {
  anio: number;
  mes: number;
  zona: string;
  hoja_verde_kg: number;
}

export interface SalidaMolinoRow {
  anio: number;
  mes: number;
  destino: "interno" | "externo";
  volumen_kg: number;
}

export interface CapaCatalogo {
  layer_name: string;
  categoria: "limites" | "edad" | "densidad" | "consociado" | "secaderos";
  nivel_espacial: "municipio" | "departamento" | "provincia" | "zona" | "punto";
  geom_type: "MultiPolygon" | "Point";
  activa: boolean;
  descripcion: string;
}

export interface GeoFeatureCollection {
  type: "FeatureCollection";
  features: {
    type: "Feature";
    id: string;
    geometry: { type: string; coordinates: unknown };
    properties: Record<string, unknown>;
  }[];
}
