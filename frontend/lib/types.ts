// Formas de fila devueltas por backend/api/routers/*.py

// AUDITORÍA 2026-07-11 (ver docs/auditoria_datos.md): el desglose mensual de
// produccion_kg/consumo_interno_kg/exportaciones_kg/valor_fob_usd era 100%
// sintético y quedó anulado (NULL) en la base -- estos 4 campos son nullable
// acá. precio_usd_kg no se tocó (dato real, cadencia anual publicada mensual).
// Para vistas anuales/nacionales usar ProduccionAnualRealRow, no sumar esto.
export interface ProduccionRow {
  anio: number;
  mes: number;
  mes_nombre: string;
  provincia: string;
  ciudad: string;
  produccion_kg: number | null;
  consumo_interno_kg: number | null;
  exportaciones_kg: number | null;
  precio_usd_kg: number;
  valor_fob_usd: number | null;
}

/** Totales anuales reales -- GET /produccion/anual-real (ym.dataset_principal_anual). */
export interface ProduccionAnualRealRow {
  anio: number;
  /** '(nacional)' en los años sin desglose real por ciudad (2025 en adelante). */
  provincia: string;
  ciudad: string;
  produccion_kg: number | null;
  consumo_interno_kg: number | null;
  exportaciones_kg: number | null;
  precio_usd_kg_promedio: number | null;
  valor_fob_usd: number | null;
  fuente: string;
  fuente_url: string | null;
}

// AUDITORÍA 2026-07-11: superficie_ha/productores nullable -- productores
// tenía 8 tramos de interpolación lineal perfecta (anulados, se conservan
// los años ancla); superficie_ha/productores 2025 anulado (clon de 2024).
export interface SuperficieRow {
  anio: number;
  mes: number;
  mes_nombre: string;
  provincia: string;
  ciudad: string;
  productores: number | null;
  superficie_ha: number | null;
}

// AUDITORÍA 2026-07-11: mix de envases nullable -- congelado idéntico
// 2011-2021 y otro valor fijo 2022-2024 (fabricado), anulado. Solo 2025
// queda con dato (sin fuente documentada todavía).
export interface ConsumoRow {
  anio: number;
  mes: number;
  mes_nombre: string;
  consumo_per_capita_kg: number;
  envase_05kg_pct: number | null;
  envase_1kg_pct: number | null;
  envase_2kg_pct: number | null;
  envase_025kg_pct: number | null;
  otros_envases_pct: number | null;
  sin_estampillas_pct: number | null;
}

// AUDITORÍA 2026-07-11: mismo tratamiento que ProduccionRow -- desglose
// mensual sintético anulado. Para el total anual real por destino usar
// ExportacionAnualRealRow.
export interface ExportacionRow {
  anio: number;
  mes: number;
  mes_nombre: string;
  destino: string;
  volumen_kg: number | null;
  valor_fob_usd: number | null;
  precio_fob_usd_kg: number | null;
}

/** Exportaciones reales por país, mensual -- GET /exportaciones/indec (ym.exportaciones_indec). */
export interface ExportacionIndecRow {
  anio: number;
  mes: number;
  pais_iso2: string;
  pais_nombre: string;
  peso_kg: number | null;
  monto_fob_usd: number | null;
  /** true = secreto estadístico (pocos operadores), peso_kg/monto_fob_usd son NULL, no 0. */
  es_confidencial: boolean;
}

/** Totales anuales reales por destino -- GET /exportaciones/anual-real (ym.exportaciones_anual). */
export interface ExportacionAnualRealRow {
  anio: number;
  /** '(nacional)' en los años sin desglose real por destino (2025 en adelante). */
  destino: string;
  volumen_kg: number | null;
  valor_fob_usd: number | null;
  precio_fob_usd_kg: number | null;
  fuente: string;
  fuente_url: string | null;
}

export interface PrecioRow {
  anio: number;
  mes: number;
  mes_nombre: string;
  precio_hoja_verde_ars: number | null;
  precio_canchada_ars: number | null;
  /** IPC Nacional nivel general, base dic-2016=100 (INDEC). */
  ipc_nacional: number | null;
  /** IPC-GBA específico de yerba mate, misma base dic-2016=100 (INDEC). */
  ipc_yerba_mate: number | null;
  /** RIPTE (remuneración imponible promedio trabajadores estables, INDEC/Trabajo), nominal ARS. */
  ripte: number | null;
}

export interface PrecioGondolaRow {
  fecha_snapshot: string;
  marca_gondola: string;
  /** Referencia informal a CompetenciaRow.empresa — null si la atribución no está confirmada. */
  empresa_ym: string | null;
  presentacion_kg: number;
  precio_ars_kg_promedio: number;
  precio_ars_kg_min: number;
  precio_ars_kg_max: number;
  n_observaciones: number;
  n_comercios: number;
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

// AUDITORÍA 2026-07-11: 2011-2018 anulado (congelado, sin fuente documentada).
// Reemplazada como fuente de verdad por ImportacionIndecRow (2026-07-12).
export interface ImportacionRow {
  anio: number;
  mes: number;
  mes_nombre: string;
  volumen_kg: number | null;
}

/** Importaciones reales por país de origen, mensual -- GET /importaciones/indec (ym.importaciones_indec). */
export interface ImportacionIndecRow {
  anio: number;
  mes: number;
  pais_iso2: string;
  pais_nombre: string;
  peso_kg: number | null;
  monto_fob_usd: number | null;
  es_confidencial: boolean;
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
  emae: number | null;
}

/** Salida de los 3 modelos de Fase 5 -- GET /predicciones (ym.ml_predicciones).
 * No es dato observado, es salida de modelo (declarado en `metodo`/`supuestos`). */
export interface PrediccionRow {
  modelo: "modelo1_produccion_zona" | "modelo2_consumo_interno" | "modelo3_exportaciones";
  /** zona (modelo1), '(nacional)' (modelo2), o pais_iso2 (modelo3). */
  dimension: string;
  anio: number;
  /** NULL en modelo3 (panel anual, no mensual). */
  mes: number | null;
  /** true = pronóstico/proyección futura; false = ajustado-vs-real histórico (solo modelo3 hoy). */
  es_pronostico: boolean;
  /** Solo no-NULL en filas es_pronostico=false. */
  valor_real: number | null;
  valor_predicho: number;
  /** NULL si el intervalo no se pudo calcular de forma confiable para ese punto (ver docs/modelo1_produccion_zona.md). */
  ic_inferior: number | null;
  ic_superior: number | null;
  nivel_confianza: number;
  unidad: string;
  metodo: string;
  /** Solo no-NULL en la proyección futura de modelo3 (ej. año de PBI congelado por país). */
  supuestos: string | null;
  generado_en: string;
}

export interface CapaCatalogo {
  layer_name: string;
  categoria:
    | "limites"
    | "edad"
    | "densidad"
    | "consociado"
    | "secaderos"
    | "indec_jurisdicciones"
    | "indec_departamentos"
    | "indec_fracciones"
    | "indec_radios_censales"
    | "indec_localidades"
    | "censo_poblacion"
    | "transporte";
  nivel_espacial:
    | "municipio"
    | "departamento"
    | "provincia"
    | "zona"
    | "punto"
    | "fraccion"
    | "radio"
    | "localidad"
    | "vial_nacional"
    | "vial_provincial"
    | "ferroviario";
  geom_type: "MultiPolygon" | "Point" | "MultiLineString";
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

/** Catálogo de fuentes de datos -- Etapa 4 regla 1, docs/auditoria_datos.md. */
export interface Fuente {
  id: number;
  codigo: string;
  nombre: string;
  organismo: string | null;
  url: string | null;
  cobertura: string | null;
  metodo_obtencion: string;
  notas: string | null;
}

export type FuentesPorTabla = Record<string, Fuente[]>;
