import { describe, expect, it } from "vitest";
import { calcularVarPct, agregarSuperficieProductoresAnual } from "./agregaciones";
import type { SuperficieRow } from "./types";

describe("calcularVarPct", () => {
  it("caso a mano: sube de 100 a 120 -> +20%", () => {
    expect(calcularVarPct(120, 100)).toBe(20);
  });

  it("caso a mano: baja de 100 a 80 -> -20%", () => {
    expect(calcularVarPct(80, 100)).toBe(-20);
  });

  it("actual null -> null (no fabrica un 0%)", () => {
    expect(calcularVarPct(null, 100)).toBeNull();
  });

  it("anterior null -> null (sin base de comparación, no salta el hueco)", () => {
    expect(calcularVarPct(100, null)).toBeNull();
  });

  it("ambos null -> null", () => {
    expect(calcularVarPct(null, null)).toBeNull();
  });

  it("anterior cero -> null (evita división por cero, no infinito ni NaN)", () => {
    expect(calcularVarPct(50, 0)).toBeNull();
  });

  it("sin cambio -> 0", () => {
    expect(calcularVarPct(100, 100)).toBe(0);
  });
});

describe("agregarSuperficieProductoresAnual", () => {
  function filaMensual(anio: number, ciudad: string, superficie_ha: number | null, productores: number | null): SuperficieRow[] {
    // La fuente publica el mismo valor los 12 meses del año -- el dedup por
    // (año,ciudad) debe tomar solo 1, no sumar 12 veces.
    return Array.from({ length: 12 }, (_, i) => ({
      anio,
      mes: i + 1,
      mes_nombre: "x",
      provincia: "Misiones",
      ciudad,
      superficie_ha,
      productores,
    }));
  }

  it("caso a mano: 2 ciudades, un año -> suma ambas y divide bien", () => {
    const filas = [...filaMensual(2018, "Apóstoles", 1000, 100), ...filaMensual(2018, "Oberá", 500, 50)];
    const r = agregarSuperficieProductoresAnual(filas);
    expect(r).toEqual([{ anio: 2018, superficie_ha: 1500, productores: 150, ha_por_productor: 10 }]);
  });

  it("dedup real: 12 filas mensuales repetidas -> no suma 12 veces", () => {
    const filas = filaMensual(2018, "Apóstoles", 1000, 100);
    const r = agregarSuperficieProductoresAnual(filas);
    expect(r[0].superficie_ha).toBe(1000);
    expect(r[0].productores).toBe(100);
  });

  it("año con solo superficie_ha (productores null) -> excluido, no aparece con productores=0", () => {
    const filas = [...filaMensual(2018, "Apóstoles", 1000, 100), ...filaMensual(2021, "Apóstoles", 2000, null)];
    const r = agregarSuperficieProductoresAnual(filas);
    expect(r.map((f) => f.anio)).toEqual([2018]);
  });

  it("año con solo productores (superficie_ha null) -> también excluido", () => {
    const filas = [...filaMensual(2018, "Apóstoles", 1000, 100), ...filaMensual(2021, "Apóstoles", null, 90)];
    const r = agregarSuperficieProductoresAnual(filas);
    expect(r.map((f) => f.anio)).toEqual([2018]);
  });

  it("array vacío -> array vacío, no rompe", () => {
    expect(agregarSuperficieProductoresAnual([])).toEqual([]);
  });
});
