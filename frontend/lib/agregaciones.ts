import type {
  ConsumoRow,
  ExportacionRow,
  HojaVerdeRow,
  ImportacionRow,
  PrecioRow,
  ProduccionRow,
  SalidaMolinoRow,
} from "@/lib/types";

const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

export interface SerieMensualPunto {
  etiqueta: string;
  produccion_kg: number;
}

export function agregarProduccionMensual(filas: ProduccionRow[]): SerieMensualPunto[] {
  const totales = new Map<string, number>();
  for (const fila of filas) {
    const clave = `${fila.anio}-${String(fila.mes).padStart(2, "0")}`;
    totales.set(clave, (totales.get(clave) ?? 0) + fila.produccion_kg);
  }
  return Array.from(totales.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([clave, produccion_kg]) => {
      const [anio, mes] = clave.split("-");
      return { etiqueta: `${MESES[Number(mes) - 1].slice(0, 3)} ${anio.slice(2)}`, produccion_kg };
    });
}

export interface ProduccionPorCiudad {
  provincia: string;
  ciudad: string;
  produccion_kg: number;
  porcentaje: number;
}

export function agregarProduccionPorCiudad(filas: ProduccionRow[], anio: number): ProduccionPorCiudad[] {
  const delAnio = filas.filter((f) => f.anio === anio);
  const total = delAnio.reduce((acc, f) => acc + f.produccion_kg, 0);
  const porCiudad = new Map<string, { provincia: string; ciudad: string; produccion_kg: number }>();
  for (const fila of delAnio) {
    const clave = `${fila.provincia}|${fila.ciudad}`;
    const actual = porCiudad.get(clave);
    porCiudad.set(clave, {
      provincia: fila.provincia,
      ciudad: fila.ciudad,
      produccion_kg: (actual?.produccion_kg ?? 0) + fila.produccion_kg,
    });
  }
  return Array.from(porCiudad.values())
    .map((r) => ({ ...r, porcentaje: (r.produccion_kg / total) * 100 }))
    .sort((a, b) => b.produccion_kg - a.produccion_kg);
}

// ----------------------------------------------------------------------------
// Producción — tablas históricas nacionales (suma de todas las ciudades)
// ----------------------------------------------------------------------------

export interface ProduccionAnualRow {
  anio: number;
  produccion_kg: number;
  consumo_interno_kg: number;
  exportaciones_kg: number;
  precio_usd_kg_promedio: number;
  valor_fob_usd: number;
}

export function agregarProduccionAnual(filas: ProduccionRow[]): ProduccionAnualRow[] {
  const porAnio = new Map<number, { produccion_kg: number; consumo_interno_kg: number; exportaciones_kg: number; valor_fob_usd: number; sumaPrecio: number; n: number }>();
  for (const f of filas) {
    const acc = porAnio.get(f.anio) ?? { produccion_kg: 0, consumo_interno_kg: 0, exportaciones_kg: 0, valor_fob_usd: 0, sumaPrecio: 0, n: 0 };
    acc.produccion_kg += f.produccion_kg;
    acc.consumo_interno_kg += f.consumo_interno_kg;
    acc.exportaciones_kg += f.exportaciones_kg;
    acc.valor_fob_usd += f.valor_fob_usd;
    acc.sumaPrecio += f.precio_usd_kg;
    acc.n += 1;
    porAnio.set(f.anio, acc);
  }
  return Array.from(porAnio.entries())
    .map(([anio, a]) => ({
      anio,
      produccion_kg: a.produccion_kg,
      consumo_interno_kg: a.consumo_interno_kg,
      exportaciones_kg: a.exportaciones_kg,
      precio_usd_kg_promedio: a.sumaPrecio / a.n,
      valor_fob_usd: a.valor_fob_usd,
    }))
    .sort((a, b) => b.anio - a.anio);
}

export interface ProduccionMensualNacionalRow {
  anio: number;
  mes: number;
  mes_nombre: string;
  produccion_kg: number;
  consumo_interno_kg: number;
  exportaciones_kg: number;
  precio_usd_kg_promedio: number;
  valor_fob_usd: number;
}

export function agregarProduccionMensualNacional(filas: ProduccionRow[]): ProduccionMensualNacionalRow[] {
  const porMes = new Map<string, { anio: number; mes: number; produccion_kg: number; consumo_interno_kg: number; exportaciones_kg: number; valor_fob_usd: number; sumaPrecio: number; n: number }>();
  for (const f of filas) {
    const clave = `${f.anio}-${f.mes}`;
    const acc = porMes.get(clave) ?? { anio: f.anio, mes: f.mes, produccion_kg: 0, consumo_interno_kg: 0, exportaciones_kg: 0, valor_fob_usd: 0, sumaPrecio: 0, n: 0 };
    acc.produccion_kg += f.produccion_kg;
    acc.consumo_interno_kg += f.consumo_interno_kg;
    acc.exportaciones_kg += f.exportaciones_kg;
    acc.valor_fob_usd += f.valor_fob_usd;
    acc.sumaPrecio += f.precio_usd_kg;
    acc.n += 1;
    porMes.set(clave, acc);
  }
  return Array.from(porMes.values())
    .map((a) => ({
      anio: a.anio,
      mes: a.mes,
      mes_nombre: MESES[a.mes - 1],
      produccion_kg: a.produccion_kg,
      consumo_interno_kg: a.consumo_interno_kg,
      exportaciones_kg: a.exportaciones_kg,
      precio_usd_kg_promedio: a.sumaPrecio / a.n,
      valor_fob_usd: a.valor_fob_usd,
    }))
    .sort((a, b) => b.anio - a.anio || b.mes - a.mes);
}

// ----------------------------------------------------------------------------
// Exportaciones — tablas históricas nacionales (suma de todos los destinos)
// ----------------------------------------------------------------------------

export interface ExportacionAnualRow {
  anio: number;
  volumen_kg: number;
  valor_fob_usd: number;
  precio_fob_usd_kg_promedio: number;
}

export function agregarExportacionesAnual(filas: ExportacionRow[]): ExportacionAnualRow[] {
  const porAnio = new Map<number, { volumen_kg: number; valor_fob_usd: number }>();
  for (const f of filas) {
    const acc = porAnio.get(f.anio) ?? { volumen_kg: 0, valor_fob_usd: 0 };
    acc.volumen_kg += f.volumen_kg;
    acc.valor_fob_usd += f.valor_fob_usd;
    porAnio.set(f.anio, acc);
  }
  return Array.from(porAnio.entries())
    .map(([anio, a]) => ({
      anio,
      volumen_kg: a.volumen_kg,
      valor_fob_usd: a.valor_fob_usd,
      precio_fob_usd_kg_promedio: a.valor_fob_usd / a.volumen_kg,
    }))
    .sort((a, b) => b.anio - a.anio);
}

export interface ExportacionMensualRow {
  anio: number;
  mes: number;
  mes_nombre: string;
  volumen_kg: number;
  valor_fob_usd: number;
  precio_fob_usd_kg_promedio: number;
}

export function agregarExportacionesMensual(filas: ExportacionRow[]): ExportacionMensualRow[] {
  const porMes = new Map<string, { anio: number; mes: number; volumen_kg: number; valor_fob_usd: number }>();
  for (const f of filas) {
    const clave = `${f.anio}-${f.mes}`;
    const acc = porMes.get(clave) ?? { anio: f.anio, mes: f.mes, volumen_kg: 0, valor_fob_usd: 0 };
    acc.volumen_kg += f.volumen_kg;
    acc.valor_fob_usd += f.valor_fob_usd;
    porMes.set(clave, acc);
  }
  return Array.from(porMes.values())
    .map((a) => ({
      anio: a.anio,
      mes: a.mes,
      mes_nombre: MESES[a.mes - 1],
      volumen_kg: a.volumen_kg,
      valor_fob_usd: a.valor_fob_usd,
      precio_fob_usd_kg_promedio: a.valor_fob_usd / a.volumen_kg,
    }))
    .sort((a, b) => b.anio - a.anio || b.mes - a.mes);
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
  volumen_kg: number;
}

export function agregarImportacionesAnual(filas: ImportacionRow[]): ImportacionAnualRow[] {
  const porAnio = new Map<number, number>();
  for (const f of filas) {
    porAnio.set(f.anio, (porAnio.get(f.anio) ?? 0) + f.volumen_kg);
  }
  return Array.from(porAnio.entries())
    .map(([anio, volumen_kg]) => ({ anio, volumen_kg }))
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
