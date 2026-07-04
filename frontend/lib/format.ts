export function formatKg(valor: number): string {
  return `${new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 }).format(valor)} kg`;
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
