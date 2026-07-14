export function formatKg(valor: number): string {
  return `${new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 }).format(valor)} kg`;
}

export function formatToneladas(valor: number): string {
  return `${new Intl.NumberFormat("es-AR", { maximumFractionDigits: 1 }).format(valor / 1000)} t`;
}

export type UnidadMasa = "kg" | "t";

/** Elige kg o toneladas según el toggle de la página (ver FilterBar `mostrarUnidad`). */
export function formatMasa(valorKg: number, unidad: UnidadMasa): string {
  return unidad === "t" ? formatToneladas(valorKg) : formatKg(valorKg);
}

export function formatNumero(valor: number, decimales = 0): string {
  return new Intl.NumberFormat("es-AR", {
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales,
  }).format(valor);
}

export function formatUsd(valor: number): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(valor);
}

export function formatPct(valor: number): string {
  return `${formatNumero(valor, 1)}%`;
}

const compactoFormatter = new Intl.NumberFormat("es-AR", { notation: "compact", maximumFractionDigits: 1 });
const usdCompactoFormatter = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 1,
});

/** Notación compacta es-AR ("889,3 M", "58 M") — para KPIs héroe, nunca para
 * tablas (ahí va precisión completa vía formatNumero). El valor exacto
 * siempre tiene que acompañarse en un tooltip (ver `KpiCard.valorExacto`). */
export function formatCompacto(valor: number): string {
  return compactoFormatter.format(valor);
}

export function formatKgCompacto(valor: number): string {
  return `${formatCompacto(valor)} kg`;
}

/** Versión compacta de `formatMasa`, para el card héroe de una página (ver A1). */
export function formatMasaCompacta(valorKg: number, unidad: UnidadMasa): string {
  return unidad === "t" ? `${formatCompacto(valorKg / 1000)} t` : formatKgCompacto(valorKg);
}

export function formatUsdCompacto(valor: number): string {
  return usdCompactoFormatter.format(valor);
}

/** Años anteriores al actual se consideran "cerrados" para comparar variación
 * interanual -- el año en curso casi nunca tiene los 12 meses publicados
 * (lag de las fuentes), así que compararlo contra un año anterior completo
 * da caídas/subas falsas por el desbalance de meses, no por el dato real. */
export function esAnioCompleto(anio: number): boolean {
  return anio < new Date().getFullYear();
}
