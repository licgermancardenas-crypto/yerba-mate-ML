"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";

// Único mecanismo de "zoom local" de gráfico en toda la app (ver Fase 9,
// A3) -- antes SerieChartConFiltro y AnnualChartConFiltro tenían cada uno
// su propio par de <select> Desde/Hasta, siempre visibles, indistinguibles
// de un filtro primario (el `data` que reciben YA viene filtrado por el
// FilterBar global de la página). Acá el zoom es subordinado: colapsado por
// default, mostrando explícitamente que hereda el rango global.
export function useZoomLocal(anios: number[]) {
  const primero = anios[0];
  const ultimo = anios[anios.length - 1];
  const [desde, setDesde] = useState(primero);
  const [hasta, setHasta] = useState(ultimo);
  const [activo, setActivo] = useState(false);

  // Se resetea (y se cierra el zoom) cada vez que cambia el rango que llega
  // desde afuera -- ej. el usuario tocó el filtro global de la página.
  useEffect(() => {
    setDesde(primero);
    setHasta(ultimo);
    setActivo(false);
  }, [primero, ultimo]);

  const dLo = desde ?? primero;
  const dHi = hasta ?? ultimo;

  return {
    anios,
    primero,
    ultimo,
    desde: dLo,
    hasta: dHi,
    activo,
    setActivo,
    setDesde,
    setHasta,
    enRango: (anio: string | number) => Number(anio) >= dLo && Number(anio) <= dHi,
  };
}

export type ZoomLocalState = ReturnType<typeof useZoomLocal>;

export function ZoomLocalControl({ zoom }: { zoom: ZoomLocalState }) {
  const { anios, primero, ultimo, activo, setActivo, desde, hasta, setDesde, setHasta } = zoom;
  if (anios.length === 0) return null;

  if (!activo) {
    return (
      <div className="flex items-center justify-end gap-2 mb-2">
        <span className="text-[11px] text-muted-foreground">
          Mostrando todo el rango filtrado ({primero}–{ultimo})
        </span>
        {anios.length > 2 && (
          <button
            type="button"
            onClick={() => setActivo(true)}
            className="text-[11px] font-medium text-primary hover:underline"
          >
            Zoom en este gráfico
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center justify-end gap-1.5 mb-2">
      <select
        aria-label="Año desde (zoom local)"
        value={desde}
        onChange={(e) => setDesde(Number(e.target.value))}
        className="text-xs rounded-md border border-border bg-background px-1.5 py-1 text-foreground"
      >
        {anios.map((a) => (
          <option key={a} value={a}>
            {a}
          </option>
        ))}
      </select>
      <span className="text-xs text-muted-foreground">–</span>
      <select
        aria-label="Año hasta (zoom local)"
        value={hasta}
        onChange={(e) => setHasta(Number(e.target.value))}
        className="text-xs rounded-md border border-border bg-background px-1.5 py-1 text-foreground"
      >
        {anios.map((a) => (
          <option key={a} value={a}>
            {a}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={() => setActivo(false)}
        aria-label="Cerrar zoom, volver a todo el rango filtrado"
        className="flex items-center justify-center size-5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
      >
        <X size={12} aria-hidden="true" />
      </button>
    </div>
  );
}
