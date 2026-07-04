import type { ProduccionRow } from "@/lib/types";

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
