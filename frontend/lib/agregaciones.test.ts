import { describe, expect, it } from "vitest";
import { calcularVarPct } from "./agregaciones";

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
