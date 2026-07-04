// Datos de muestra con la misma forma que las respuestas reales de
// backend/api/routers/*.py — reemplazar por fetch real una vez que la API
// esté corriendo contra la base de datos poblada.

const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

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

const CIUDADES: { provincia: string; ciudad: string; peso: number }[] = [
  { provincia: "Misiones", ciudad: "Apóstoles", peso: 0.32 },
  { provincia: "Corrientes", ciudad: "Colonia Liebig", peso: 0.13 },
  { provincia: "Misiones", ciudad: "Montecarlo", peso: 0.14 },
  { provincia: "Misiones", ciudad: "Oberá", peso: 0.1 },
  { provincia: "Misiones", ciudad: "Santo Pipó", peso: 0.09 },
  { provincia: "Corrientes", ciudad: "Gobernador Virasoro", peso: 0.11 },
  { provincia: "Misiones", ciudad: "Otros", peso: 0.11 },
];

function estacionalidad(mes: number): number {
  // la cosecha se concentra en meses cálidos (oct-jun), cae en invierno
  const factores = [1.05, 1.0, 1.1, 1.15, 1.2, 0.9, 0.75, 0.7, 0.85, 1.0, 1.05, 1.1];
  return factores[mes - 1];
}

export function getProduccionMock(): ProduccionRow[] {
  const filas: ProduccionRow[] = [];
  const base = 18_000_000; // kg/mes nacional aprox., orden de magnitud real
  for (let anio = 2021; anio <= 2025; anio++) {
    const crecimiento = 1 + (anio - 2021) * 0.02;
    for (let mes = 1; mes <= 12; mes++) {
      const totalMes = base * crecimiento * estacionalidad(mes);
      for (const { provincia, ciudad, peso } of CIUDADES) {
        const produccion_kg = Math.round(totalMes * peso);
        const consumo_interno_kg = Math.round(produccion_kg * 0.58);
        const exportaciones_kg = Math.round(produccion_kg * 0.09);
        const precio_usd_kg = 1.8 + (anio - 2021) * 0.15;
        filas.push({
          anio,
          mes,
          mes_nombre: MESES[mes - 1],
          provincia,
          ciudad,
          produccion_kg,
          consumo_interno_kg,
          exportaciones_kg,
          precio_usd_kg: Number(precio_usd_kg.toFixed(2)),
          valor_fob_usd: Math.round(exportaciones_kg * precio_usd_kg),
        });
      }
    }
  }
  return filas;
}

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

const CONSUMO_PER_CAPITA_ANUAL: Record<number, number> = {
  2021: 6.21,
  2022: 6.07,
  2023: 6.27,
  2024: 5.62,
  2025: 5.59,
};

export function getConsumoMock(): ConsumoRow[] {
  const filas: ConsumoRow[] = [];
  for (let anio = 2021; anio <= 2025; anio++) {
    for (let mes = 1; mes <= 12; mes++) {
      filas.push({
        anio,
        mes,
        mes_nombre: MESES[mes - 1],
        consumo_per_capita_kg: CONSUMO_PER_CAPITA_ANUAL[anio],
        envase_05kg_pct: 55.2,
        envase_1kg_pct: 38.1,
        envase_2kg_pct: 1.6,
        envase_025kg_pct: 0.85,
        otros_envases_pct: 0.6,
        sin_estampillas_pct: 3.65,
      });
    }
  }
  return filas;
}
