import { describe, expect, it } from "vitest";
import { calcularConcentracion } from "./metricas-competencia";

describe("calcularConcentracion", () => {
  it("caso a mano: 4 empresas iguales al 25% -> HHI = 2500 (umbral 'altamente concentrado')", () => {
    const r = calcularConcentracion([25, 25, 25, 25]);
    expect(r.hhi).toBe(2500);
    expect(r.cr4).toBe(100);
    expect(r.empresasConDato).toBe(4);
    expect(r.coberturaPct).toBe(100);
  });

  it("caso a mano: monopolio (100%) -> HHI = 10000", () => {
    const r = calcularConcentracion([100]);
    expect(r.hhi).toBe(10000);
    expect(r.cr4).toBe(100);
  });

  it("excluye NULL en vez de tratarlo como 0", () => {
    const r = calcularConcentracion([50, null, 30, 20]);
    // HHI = 50^2 + 30^2 + 20^2 = 2500 + 900 + 400 = 3800
    expect(r.hhi).toBe(3800);
    expect(r.cr4).toBe(100); // solo 3 empresas con dato, cr4 toma las que haya
    expect(r.empresasConDato).toBe(3);
    expect(r.empresasTotal).toBe(4);
    expect(r.coberturaPct).toBe(100);
  });

  it("cobertura parcial se refleja en coberturaPct (no se infla a 100%)", () => {
    const r = calcularConcentracion([14.4, 2.8, null, null, null]);
    expect(r.coberturaPct).toBe(17.2);
    expect(r.empresasConDato).toBe(2);
    expect(r.empresasTotal).toBe(5);
  });

  it("CR4 con más de 4 empresas toma solo las 4 mayores", () => {
    const r = calcularConcentracion([10, 40, 5, 20, 25]);
    // ordenadas desc: 40,25,20,10,5 -> top4 = 40+25+20+10 = 95
    expect(r.cr4).toBe(95);
  });

  it("array vacío o todo NULL no rompe (HHI/CR4 = 0, cobertura = 0)", () => {
    const r = calcularConcentracion([null, null, undefined]);
    expect(r.hhi).toBe(0);
    expect(r.cr4).toBe(0);
    expect(r.coberturaPct).toBe(0);
    expect(r.empresasConDato).toBe(0);
  });
});
