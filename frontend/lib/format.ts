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

/** Años anteriores al actual se consideran "cerrados" para comparar variación
 * interanual -- el año en curso casi nunca tiene los 12 meses publicados
 * (lag de las fuentes), así que compararlo contra un año anterior completo
 * da caídas/subas falsas por el desbalance de meses, no por el dato real. */
export function esAnioCompleto(anio: number): boolean {
  return anio < new Date().getFullYear();
}
