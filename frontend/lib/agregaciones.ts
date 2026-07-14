import type {
  ConsumoRow,
  ExportacionAnualRealRow,
  HojaVerdeRow,
  ImportacionRow,
  PrecioRow,
  ProduccionAnualRealRow,
  SalidaMolinoRow,
  SuperficieRow,
} from "@/lib/types";

export const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

// ----------------------------------------------------------------------------
// Producción mensual nacional — AUDITORÍA 2026-07-11: el desglose mensual de
// ym.dataset_principal era sintético y se anuló (ver docs/auditoria_datos.md).
// La fuente mensual real de cosecha es ym.inym_hoja_verde_zona (zona TOTAL).
// ----------------------------------------------------------------------------

export interface SerieMensualPunto {
  anio: number;
  etiqueta: string;
  produccion_kg: number;
}

export function agregarHojaVerdeMensualNacional(filas: HojaVerdeRow[]): SerieMensualPunto[] {
  return filas
    .filter((f) => f.zona === "TOTAL")
    .sort((a, b) => a.anio - b.anio || a.mes - b.mes)
    .map((f) => ({
      anio: f.anio,
      etiqueta: `${MESES[f.mes - 1].slice(0, 3)} ${String(f.anio).slice(2)}`,
      produccion_kg: f.hoja_verde_kg,
    }));
}

// ----------------------------------------------------------------------------
// Producción por ciudad — a partir de ym.dataset_principal_anual (real,
// preservado antes de anular el mensual). Son 7 "buckets" de reporte del
// INYM, no unidades geográficas reales -- ver caso E de la auditoría. No
// hay desglose por ciudad para años sin fila con provincia/ciudad propias
// (2025 en adelante): esos años solo tienen la fila '(nacional)'.
// ----------------------------------------------------------------------------

export interface ProduccionPorCiudad {
  provincia: string;
  ciudad: string;
  produccion_kg: number;
  porcentaje: number;
}

export function agregarProduccionPorCiudad(filasAnualReal: ProduccionAnualRealRow[], anio: number): ProduccionPorCiudad[] {
  const delAnio = filasAnualReal.filter((f) => f.anio === anio && f.ciudad !== "(nacional)" && f.produccion_kg != null);
  const total = delAnio.reduce((acc, f) => acc + (f.produccion_kg ?? 0), 0);
  if (total === 0) return [];
  return delAnio
    .map((f) => ({
      provincia: f.provincia,
      ciudad: f.ciudad,
      produccion_kg: f.produccion_kg!,
      porcentaje: (f.produccion_kg! / total) * 100,
    }))
    .sort((a, b) => b.produccion_kg - a.produccion_kg);
}

// ----------------------------------------------------------------------------
// Producción — histórico anual nacional, a partir de ym.dataset_principal_anual.
// Si el año tiene fila '(nacional)' (sin desglose por ciudad, ej. 2025) se usa
// directo; si no, se suman las ciudades.
// ----------------------------------------------------------------------------

export interface ProduccionAnualRow {
  anio: number;
  produccion_kg: number | null;
  consumo_interno_kg: number | null;
  exportaciones_kg: number | null;
  precio_usd_kg_promedio: number | null;
  valor_fob_usd: number | null;
}

export function agregarProduccionAnualNacional(filasAnualReal: ProduccionAnualRealRow[]): ProduccionAnualRow[] {
  const porAnio = new Map<number, ProduccionAnualRealRow[]>();
  for (const f of filasAnualReal) {
    const arr = porAnio.get(f.anio) ?? [];
    arr.push(f);
    porAnio.set(f.anio, arr);
  }
  const sumar = (filas: ProduccionAnualRealRow[], campo: keyof ProduccionAnualRealRow) => {
    const valores = filas.map((f) => f[campo]).filter((v): v is number => typeof v === "number");
    return valores.length ? valores.reduce((a, b) => a + b, 0) : null;
  };
  const promediar = (filas: ProduccionAnualRealRow[]) => {
    const valores = filas.map((f) => f.precio_usd_kg_promedio).filter((v): v is number => v != null);
    return valores.length ? valores.reduce((a, b) => a + b, 0) / valores.length : null;
  };
  return Array.from(porAnio.entries())
    .map(([anio, filas]) => {
      const nacional = filas.find((f) => f.ciudad === "(nacional)");
      if (nacional) {
        return {
          anio,
          produccion_kg: nacional.produccion_kg,
          consumo_interno_kg: nacional.consumo_interno_kg,
          exportaciones_kg: nacional.exportaciones_kg,
          precio_usd_kg_promedio: nacional.precio_usd_kg_promedio,
          valor_fob_usd: nacional.valor_fob_usd,
        };
      }
      return {
        anio,
        produccion_kg: sumar(filas, "produccion_kg"),
        consumo_interno_kg: sumar(filas, "consumo_interno_kg"),
        exportaciones_kg: sumar(filas, "exportaciones_kg"),
        precio_usd_kg_promedio: promediar(filas),
        valor_fob_usd: sumar(filas, "valor_fob_usd"),
      };
    })
    .sort((a, b) => b.anio - a.anio);
}

// ----------------------------------------------------------------------------
// Rendimiento — kg producidos por hectárea cultivada, por año (nacional)
// ----------------------------------------------------------------------------
// superficie_ha se publica con cadencia anual (se repite los 12 meses de
// cada año, ver ym.superficie_productores) — el rendimiento solo tiene
// sentido a nivel anual, promediar/sumar meses de superficie sería
// contar la misma hectárea varias veces.

export interface RendimientoAnualRow {
  anio: number;
  produccion_kg: number;
  superficie_ha: number;
  rendimiento_kg_ha: number;
}

export function agregarRendimientoAnual(
  filasAnualReal: ProduccionAnualRealRow[],
  filasSuperficie: SuperficieRow[]
): RendimientoAnualRow[] {
  const produccionPorAnio = new Map<number, number>();
  for (const f of agregarProduccionAnualNacional(filasAnualReal)) {
    if (f.produccion_kg != null) produccionPorAnio.set(f.anio, f.produccion_kg);
  }

  // Toma un solo mes por (año, ciudad) para no sumar la misma superficie 12 veces.
  const haPorAnioCiudad = new Map<string, number>();
  for (const f of filasSuperficie) {
    if (f.superficie_ha == null) continue;
    const clave = `${f.anio}|${f.provincia}|${f.ciudad}`;
    if (!haPorAnioCiudad.has(clave)) haPorAnioCiudad.set(clave, f.superficie_ha);
  }
  const superficiePorAnio = new Map<number, number>();
  for (const [clave, ha] of haPorAnioCiudad) {
    const anio = Number(clave.split("|")[0]);
    superficiePorAnio.set(anio, (superficiePorAnio.get(anio) ?? 0) + ha);
  }

  const anios = Array.from(produccionPorAnio.keys())
    .filter((anio) => superficiePorAnio.has(anio))
    .sort((a, b) => a - b);

  return anios.map((anio) => {
    const produccion_kg = produccionPorAnio.get(anio)!;
    const superficie_ha = superficiePorAnio.get(anio)!;
    return { anio, produccion_kg, superficie_ha, rendimiento_kg_ha: produccion_kg / superficie_ha };
  });
}

// ----------------------------------------------------------------------------
// Exportaciones — histórico anual por destino, a partir de
// ym.exportaciones_anual (real, preservado antes de anular el mensual
// sintético). No hay reemplazo mensual real todavía -- ver
// docs/auditoria_datos.md, tarea de investigación de fuente pendiente.
// ----------------------------------------------------------------------------

export interface ExportacionAnualRow {
  anio: number;
  volumen_kg: number | null;
  valor_fob_usd: number | null;
  precio_fob_usd_kg_promedio: number | null;
}

export function agregarExportacionesAnualNacional(filasAnualReal: ExportacionAnualRealRow[]): ExportacionAnualRow[] {
  const porAnio = new Map<number, ExportacionAnualRealRow[]>();
  for (const f of filasAnualReal) {
    const arr = porAnio.get(f.anio) ?? [];
    arr.push(f);
    porAnio.set(f.anio, arr);
  }
  const sumar = (filas: ExportacionAnualRealRow[], campo: "volumen_kg" | "valor_fob_usd") => {
    const valores = filas.map((f) => f[campo]).filter((v): v is number => v != null);
    return valores.length ? valores.reduce((a, b) => a + b, 0) : null;
  };
  return Array.from(porAnio.entries())
    .map(([anio, filas]) => {
      const nacional = filas.find((f) => f.destino === "(nacional)");
      const volumen_kg = nacional ? nacional.volumen_kg : sumar(filas, "volumen_kg");
      const valor_fob_usd = nacional ? nacional.valor_fob_usd : sumar(filas, "valor_fob_usd");
      return {
        anio,
        volumen_kg,
        valor_fob_usd,
        precio_fob_usd_kg_promedio: volumen_kg && valor_fob_usd ? valor_fob_usd / volumen_kg : null,
      };
    })
    .sort((a, b) => b.anio - a.anio);
}

// ----------------------------------------------------------------------------
// Comercio exterior INDEC — desglose mensual/por país REAL, compartido entre
// exportaciones e importaciones (mismo shape, misma fuente -- ver
// docs/fuentes_exportaciones_indec.md). 'ZZ' es el bucket de secreto
// estadístico que la propia fuente reporta agregado (no es un país real, no
// se geolocaliza) -- se incluye en los totales nacionales pero se separa del
// desglose por país.
// ----------------------------------------------------------------------------

interface ComexIndecRow {
  anio: number;
  mes: number;
  pais_iso2: string;
  pais_nombre: string;
  peso_kg: number | null;
  monto_fob_usd: number | null;
}

export function agregarComexIndecMensualNacional(filas: ComexIndecRow[]): SerieMensualPunto[] {
  const porMes = new Map<string, { anio: number; mes: number; suma: number; tieneDato: boolean }>();
  for (const f of filas) {
    const clave = `${f.anio}-${f.mes}`;
    const acc = porMes.get(clave) ?? { anio: f.anio, mes: f.mes, suma: 0, tieneDato: false };
    if (f.peso_kg != null) {
      acc.suma += f.peso_kg;
      acc.tieneDato = true;
    }
    porMes.set(clave, acc);
  }
  return Array.from(porMes.values())
    .filter((a) => a.tieneDato)
    .sort((a, b) => a.anio - b.anio || a.mes - b.mes)
    .map((a) => ({
      anio: a.anio,
      etiqueta: `${MESES[a.mes - 1].slice(0, 3)} ${String(a.anio).slice(2)}`,
      produccion_kg: a.suma,
    }));
}

export interface ComexIndecMensualNacionalRow {
  anio: number;
  mes: number;
  mes_nombre: string;
  volumen_kg: number | null;
}

export function agregarComexIndecMensualHistorico(filas: ComexIndecRow[]): ComexIndecMensualNacionalRow[] {
  const porMes = new Map<string, { anio: number; mes: number; suma: number; tieneDato: boolean }>();
  for (const f of filas) {
    const clave = `${f.anio}-${f.mes}`;
    const acc = porMes.get(clave) ?? { anio: f.anio, mes: f.mes, suma: 0, tieneDato: false };
    if (f.peso_kg != null) {
      acc.suma += f.peso_kg;
      acc.tieneDato = true;
    }
    porMes.set(clave, acc);
  }
  return Array.from(porMes.values())
    .map((a) => ({ anio: a.anio, mes: a.mes, mes_nombre: MESES[a.mes - 1], volumen_kg: a.tieneDato ? a.suma : null }))
    .sort((a, b) => b.anio - a.anio || b.mes - a.mes);
}

export interface ComexPorPais {
  pais_iso2: string;
  pais_nombre: string;
  volumen_kg: number;
  valor_fob_usd: number;
  porcentaje: number;
}

/** % calculado contra el total nacional (incluye 'ZZ' confidencial) -- por
 * eso los % de los países listados no suman 100, la diferencia es volumen
 * sin país publicado por secreto estadístico. */
export function agregarComexIndecPorPais(filas: ComexIndecRow[], anio: number): ComexPorPais[] {
  const delAnio = filas.filter((f) => f.anio === anio && f.peso_kg != null);
  const totalNacional = delAnio.reduce((acc, f) => acc + (f.peso_kg ?? 0), 0);
  if (totalNacional === 0) return [];
  const porPais = new Map<string, { pais_nombre: string; volumen_kg: number; valor_fob_usd: number }>();
  for (const f of delAnio) {
    if (f.pais_iso2 === "ZZ") continue;
    const acc = porPais.get(f.pais_iso2) ?? { pais_nombre: f.pais_nombre, volumen_kg: 0, valor_fob_usd: 0 };
    acc.volumen_kg += f.peso_kg!;
    acc.valor_fob_usd += f.monto_fob_usd ?? 0;
    porPais.set(f.pais_iso2, acc);
  }
  return Array.from(porPais.entries())
    .map(([pais_iso2, a]) => ({
      pais_iso2,
      pais_nombre: a.pais_nombre,
      volumen_kg: a.volumen_kg,
      valor_fob_usd: a.valor_fob_usd,
      porcentaje: (a.volumen_kg / totalNacional) * 100,
    }))
    .sort((a, b) => b.volumen_kg - a.volumen_kg);
}

export interface ComexAnualRow {
  anio: number;
  volumen_kg: number | null;
}

export function agregarComexIndecAnualNacional(filas: ComexIndecRow[]): ComexAnualRow[] {
  const porAnio = new Map<number, { suma: number; tieneDato: boolean }>();
  for (const f of filas) {
    const acc = porAnio.get(f.anio) ?? { suma: 0, tieneDato: false };
    if (f.peso_kg != null) {
      acc.suma += f.peso_kg;
      acc.tieneDato = true;
    }
    porAnio.set(f.anio, acc);
  }
  return Array.from(porAnio.entries())
    .map(([anio, a]) => ({ anio, volumen_kg: a.tieneDato ? a.suma : null }))
    .sort((a, b) => b.anio - a.anio);
}

// ----------------------------------------------------------------------------
// Consumo — la fuente publica el mismo valor los 12 meses del año (ver TODO.md),
// por eso la vista anual toma el primer mes de cada año en vez de promediar.
// ----------------------------------------------------------------------------

export type ConsumoAnualRow = ConsumoRow;

export function agregarConsumoAnual(filas: ConsumoRow[]): ConsumoAnualRow[] {
  const porAnio = new Map<number, ConsumoRow>();
  for (const f of filas) {
    if (!porAnio.has(f.anio)) porAnio.set(f.anio, f);
  }
  return Array.from(porAnio.values()).sort((a, b) => b.anio - a.anio);
}

// ----------------------------------------------------------------------------
// Precios — promedio anual (ignora meses sin dato publicado, ver schema.sql)
// ----------------------------------------------------------------------------

export interface PrecioAnualRow {
  anio: number;
  precio_hoja_verde_ars_promedio: number | null;
  precio_canchada_ars_promedio: number | null;
}

export function agregarPreciosAnual(filas: PrecioRow[]): PrecioAnualRow[] {
  const porAnio = new Map<number, { hojaVerde: number[]; canchada: number[] }>();
  for (const f of filas) {
    const acc = porAnio.get(f.anio) ?? { hojaVerde: [], canchada: [] };
    if (f.precio_hoja_verde_ars != null) acc.hojaVerde.push(f.precio_hoja_verde_ars);
    if (f.precio_canchada_ars != null) acc.canchada.push(f.precio_canchada_ars);
    porAnio.set(f.anio, acc);
  }
  const promedio = (arr: number[]) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null);
  return Array.from(porAnio.entries())
    .map(([anio, a]) => ({
      anio,
      precio_hoja_verde_ars_promedio: promedio(a.hojaVerde),
      precio_canchada_ars_promedio: promedio(a.canchada),
    }))
    .sort((a, b) => b.anio - a.anio);
}

// ----------------------------------------------------------------------------
// Importaciones — igual que exportaciones/producción, cantidad sumable
// ----------------------------------------------------------------------------

export interface ImportacionAnualRow {
  anio: number;
  volumen_kg: number | null;
}

export function agregarImportacionesAnual(filas: ImportacionRow[]): ImportacionAnualRow[] {
  const porAnio = new Map<number, number[]>();
  for (const f of filas) {
    const arr = porAnio.get(f.anio) ?? [];
    if (f.volumen_kg != null) arr.push(f.volumen_kg);
    porAnio.set(f.anio, arr);
  }
  return Array.from(porAnio.entries())
    .map(([anio, valores]) => ({ anio, volumen_kg: valores.length ? valores.reduce((a, b) => a + b, 0) : null }))
    .sort((a, b) => b.anio - a.anio);
}

// ----------------------------------------------------------------------------
// Cadena productiva — hoja verde por zona (fuente: PDFs INYM)
// ----------------------------------------------------------------------------
// La zona 'TOTAL' es el agregado nacional que ya publica la fuente — se usa
// directo para las vistas nacionales y se excluye del desglose por zona
// (sino se contaría dos veces).

export interface HojaVerdeAnualRow {
  anio: number;
  hoja_verde_kg: number;
}

export function agregarHojaVerdeAnual(filas: HojaVerdeRow[]): HojaVerdeAnualRow[] {
  const porAnio = new Map<number, number>();
  for (const f of filas.filter((f) => f.zona === "TOTAL")) {
    porAnio.set(f.anio, (porAnio.get(f.anio) ?? 0) + f.hoja_verde_kg);
  }
  return Array.from(porAnio.entries())
    .map(([anio, hoja_verde_kg]) => ({ anio, hoja_verde_kg }))
    .sort((a, b) => b.anio - a.anio);
}

// ----------------------------------------------------------------------------
// Cadena productiva — salida de molino (interno/externo, fuente: PDFs INYM)
// ----------------------------------------------------------------------------

export interface SalidaMolinoAnualRow {
  anio: number;
  interno_kg: number;
  externo_kg: number;
  total_kg: number;
}

export function agregarSalidaMolinoAnual(filas: SalidaMolinoRow[]): SalidaMolinoAnualRow[] {
  const porAnio = new Map<number, { interno: number; externo: number }>();
  for (const f of filas) {
    const acc = porAnio.get(f.anio) ?? { interno: 0, externo: 0 };
    if (f.destino === "interno") acc.interno += f.volumen_kg;
    else acc.externo += f.volumen_kg;
    porAnio.set(f.anio, acc);
  }
  return Array.from(porAnio.entries())
    .map(([anio, a]) => ({ anio, interno_kg: a.interno, externo_kg: a.externo, total_kg: a.interno + a.externo }))
    .sort((a, b) => b.anio - a.anio);
}

export interface SalidaMolinoMensualRow {
  anio: number;
  mes: number;
  mes_nombre: string;
  interno_kg: number;
  externo_kg: number;
  total_kg: number;
}

export function agregarSalidaMolinoMensual(filas: SalidaMolinoRow[]): SalidaMolinoMensualRow[] {
  const porMes = new Map<string, { anio: number; mes: number; interno: number; externo: number }>();
  for (const f of filas) {
    const clave = `${f.anio}-${f.mes}`;
    const acc = porMes.get(clave) ?? { anio: f.anio, mes: f.mes, interno: 0, externo: 0 };
    if (f.destino === "interno") acc.interno += f.volumen_kg;
    else acc.externo += f.volumen_kg;
    porMes.set(clave, acc);
  }
  return Array.from(porMes.values())
    .map((a) => ({
      anio: a.anio,
      mes: a.mes,
      mes_nombre: MESES[a.mes - 1],
      interno_kg: a.interno,
      externo_kg: a.externo,
      total_kg: a.interno + a.externo,
    }))
    .sort((a, b) => b.anio - a.anio || b.mes - a.mes);
}
