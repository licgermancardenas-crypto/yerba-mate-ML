"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { SlidersHorizontal, X } from "lucide-react";

export interface DimensionFilter {
  param: string;
  label: string;
  opciones: string[];
}

export function FilterBar({
  anios,
  dimension,
  anioUnico = false,
}: {
  anios: number[];
  dimension?: DimensionFilter;
  /** Muestra un solo selector "Año" (setea anio_desde y anio_hasta al mismo valor) en vez de un rango Desde/Hasta. */
  anioUnico?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const anioDesde = searchParams.get("anio_desde") ?? String(anios[0] ?? "");
  const anioHasta = searchParams.get("anio_hasta") ?? String(anios[anios.length - 1] ?? "");
  const valorDimension = dimension ? searchParams.get(dimension.param) ?? "" : "";
  const hayFiltrosActivos = searchParams.toString().length > 0;

  function actualizar(param: string, valor: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (valor) params.set(param, valor);
    else params.delete(param);
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  function actualizarAnioUnico(valor: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("anio_desde", valor);
    params.set("anio_hasta", valor);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  return (
    <div className="flex flex-wrap items-end gap-3 mb-6 rounded-xl border border-border bg-card p-3">
      <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground mb-1.5 mr-1">
        <SlidersHorizontal size={13} aria-hidden="true" />
        Filtros
      </span>

      {anioUnico ? (
        <div className="flex flex-col gap-1">
          <label htmlFor="anio-unico" className="text-xs text-muted-foreground">
            Año
          </label>
          <select
            id="anio-unico"
            value={anioHasta}
            onChange={(e) => actualizarAnioUnico(e.target.value)}
            className="text-sm rounded-lg border border-border bg-background px-2.5 py-1.5 text-foreground"
          >
            {anios.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-1">
            <label htmlFor="anio-desde" className="text-xs text-muted-foreground">
              Desde
            </label>
            <select
              id="anio-desde"
              value={anioDesde}
              onChange={(e) => actualizar("anio_desde", e.target.value)}
              className="text-sm rounded-lg border border-border bg-background px-2.5 py-1.5 text-foreground"
            >
              {anios.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="anio-hasta" className="text-xs text-muted-foreground">
              Hasta
            </label>
            <select
              id="anio-hasta"
              value={anioHasta}
              onChange={(e) => actualizar("anio_hasta", e.target.value)}
              className="text-sm rounded-lg border border-border bg-background px-2.5 py-1.5 text-foreground"
            >
              {anios.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </div>
        </>
      )}

      {dimension && (
        <div className="flex flex-col gap-1">
          <label htmlFor={`filtro-${dimension.param}`} className="text-xs text-muted-foreground">
            {dimension.label}
          </label>
          <select
            id={`filtro-${dimension.param}`}
            value={valorDimension}
            onChange={(e) => actualizar(dimension.param, e.target.value)}
            className="text-sm rounded-lg border border-border bg-background px-2.5 py-1.5 text-foreground"
          >
            <option value="">Todas</option>
            {dimension.opciones.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </div>
      )}

      {hayFiltrosActivos && (
        <button
          type="button"
          onClick={() => router.replace(pathname, { scroll: false })}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive transition-colors mb-1.5"
        >
          <X size={13} aria-hidden="true" />
          Limpiar filtros
        </button>
      )}
    </div>
  );
}
