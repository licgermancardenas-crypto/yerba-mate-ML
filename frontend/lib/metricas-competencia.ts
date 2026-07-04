// Métricas de concentración de mercado (Fase 8, auditoría 2026-07-04).
//
// HHI (Herfindahl-Hirschman Index) = suma de (cuota_i en puntos porcentuales)^2,
// excluyendo empresas sin dato (NULL) — nunca tratarlas como 0. Como "Others"
// agrega el resto del ranking real que no se desglosa, el HHI calculado acá
// es una COTA INFERIOR del HHI real (si "Others" fueran muchas empresas chicas,
// el HHI real sería más alto de lo que da esta fórmula con Others como un solo bloque).
//
// Umbrales estándar (guías de fusiones, ej. DOJ/FTC de EE.UU., referencia
// habitual en literatura de organización industrial):
//   HHI < 1500            -> mercado no concentrado
//   1500 <= HHI <= 2500    -> moderadamente concentrado
//   HHI > 2500             -> altamente concentrado

export interface ResultadoConcentracion {
  hhi: number;
  cr4: number;
  empresasConDato: number;
  empresasTotal: number;
  /** Suma de las cuotas conocidas (0-100). Si es << 100, el HHI/CR4 son poco confiables. */
  coberturaPct: number;
}

export function calcularConcentracion(shares: (number | null | undefined)[]): ResultadoConcentracion {
  const conocidos = shares.filter((s): s is number => s !== null && s !== undefined);
  const hhi = conocidos.reduce((acc, s) => acc + s * s, 0);
  const cr4 = [...conocidos]
    .sort((a, b) => b - a)
    .slice(0, 4)
    .reduce((acc, s) => acc + s, 0);
  const coberturaPct = conocidos.reduce((acc, s) => acc + s, 0);

  return {
    hhi: Math.round(hhi * 10) / 10,
    cr4: Math.round(cr4 * 100) / 100,
    empresasConDato: conocidos.length,
    empresasTotal: shares.length,
    coberturaPct: Math.round(coberturaPct * 100) / 100,
  };
}

export const HHI_UMBRAL_MODERADO = 1500;
export const HHI_UMBRAL_ALTO = 2500;
