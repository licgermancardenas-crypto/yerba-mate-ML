export interface PuntoInsight {
  // Series ya agregadas por mes-calendario (promedio entre todos los años)
  // no tienen una identidad de año por punto -- sin `anio`, la comparación
  // interanual simplemente se omite, el resto del insight sigue funcionando.
  anio?: number;
  etiqueta: string;
  valor: number;
}

const nf1 = new Intl.NumberFormat("es-AR", { minimumFractionDigits: 1, maximumFractionDigits: 1, signDisplay: "always" });

function formatDelta(pct: number): string {
  return `${nf1.format(pct)}%`;
}

// Movimientos consecutivos en la misma dirección que terminan en `idx`
// (incluido) -- 1 si el punto anterior no cambió de signo respecto al
// previo, o si no hay suficiente historia.
function calcularRacha(serie: PuntoInsight[], idx: number): number {
  if (idx <= 0) return 1;
  const dirActual = Math.sign(serie[idx].valor - serie[idx - 1].valor);
  if (dirActual === 0) return 1;
  let racha = 1;
  for (let i = idx; i > 0; i--) {
    const dir = Math.sign(serie[i].valor - serie[i - 1].valor);
    if (dir !== dirActual) break;
    racha++;
  }
  return racha;
}

// Insight reactivo para el punto `idx` de una serie temporal -- combina solo
// hechos calculados a partir de la propia serie mostrada (nunca datos fuera
// de rango ni proyecciones): variación vs. el período anterior, variación
// interanual (si la cadencia es mensual real, verificado con `anio`, no
// asumido por la posición del arreglo), si es el máximo/mínimo del tramo
// visible, y rachas de 3+ períodos consecutivos en la misma dirección.
// `anio` es opcional -- series ya agregadas por mes-calendario (promedio
// entre todos los años) no tienen una identidad de año por punto, y en ese
// caso se omite la comparación interanual sin romper el resto.
export function generarInsightHover(serie: PuntoInsight[], idx: number): string | null {
  if (idx < 0 || idx >= serie.length) return null;
  const punto = serie[idx];
  const partes: string[] = [];

  if (idx > 0) {
    const anterior = serie[idx - 1];
    if (anterior.valor !== 0) {
      const deltaPct = ((punto.valor - anterior.valor) / Math.abs(anterior.valor)) * 100;
      if (Number.isFinite(deltaPct) && Math.abs(deltaPct) >= 0.1) {
        partes.push(`${formatDelta(deltaPct)} vs. ${anterior.etiqueta}`);
      }
    }
  }

  const idxInteranual = idx - 12;
  if (idxInteranual >= 0 && punto.anio !== undefined && serie[idxInteranual].anio === punto.anio - 1) {
    const base = serie[idxInteranual];
    if (base.valor !== 0) {
      const deltaYoy = ((punto.valor - base.valor) / Math.abs(base.valor)) * 100;
      if (Number.isFinite(deltaYoy) && Math.abs(deltaYoy) >= 0.1) partes.push(`${formatDelta(deltaYoy)} interanual`);
    }
  }

  const valores = serie.map((p) => p.valor);
  const max = Math.max(...valores);
  const min = Math.min(...valores);
  if (max !== min) {
    if (punto.valor === max) partes.push("máximo de la serie mostrada");
    else if (punto.valor === min) partes.push("mínimo de la serie mostrada");
  }

  const racha = calcularRacha(serie, idx);
  if (racha >= 3) {
    const direccion = idx > 0 && serie[idx].valor >= serie[idx - 1].valor ? "en alza" : "en baja";
    partes.push(`${racha}° período consecutivo ${direccion}`);
  }

  return partes.length ? partes.join(" · ") : null;
}
