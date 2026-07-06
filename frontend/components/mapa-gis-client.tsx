"use client";

import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { GisMap } from "@/components/gis-map";
import { GisPanel } from "@/components/gis-panel";
import type { CapaCatalogo, GeoFeatureCollection } from "@/lib/types";

const CATEGORIA_LABELS: Record<string, string> = {
  limites: "Superficie cultivada",
  edad: "Edad de plantación",
  densidad: "Densidad de plantación",
  consociado: "Cultivo consociado",
  secaderos: "Secaderos",
  indec_jurisdicciones: "INDEC — Provincias",
  indec_departamentos: "INDEC — Departamentos",
  indec_fracciones: "INDEC — Fracciones censales",
  indec_radios_censales: "INDEC — Radios censales",
  indec_localidades: "INDEC — Localidades",
};

const NIVEL_LABELS: Record<string, string> = {
  municipio: "Municipio",
  departamento: "Departamento",
  provincia: "Provincia",
  zona: "Zona",
  punto: "Puntual",
  fraccion: "Fracción censal",
  radio: "Radio censal",
  localidad: "Localidad",
};

export function MapaGisClient({
  catalogo,
  capaInicial,
  datosIniciales,
}: {
  catalogo: CapaCatalogo[];
  capaInicial: CapaCatalogo;
  datosIniciales: GeoFeatureCollection;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [capaActual, setCapaActual] = useState(capaInicial);
  const [datos, setDatos] = useState(datosIniciales);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [featureSeleccionada, setFeatureSeleccionada] = useState<Record<string, unknown> | null>(null);

  async function cambiarCapa(layerName: string) {
    const capa = catalogo.find((c) => c.layer_name === layerName);
    if (!capa) return;
    setCapaActual(capa);
    setFeatureSeleccionada(null);
    setCargando(true);
    setError(null);

    const params = new URLSearchParams(searchParams.toString());
    params.set("capa", layerName);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });

    try {
      const res = await fetch(`/api/geo/${layerName}`);
      if (!res.ok) throw new Error("Sin datos cargados para esta capa todavía");
      const data: GeoFeatureCollection = await res.json();
      setDatos(data);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setCargando(false);
    }
  }

  const porCategoria = new Map<string, CapaCatalogo[]>();
  for (const capa of catalogo) {
    if (!capa.activa) continue;
    const lista = porCategoria.get(capa.categoria) ?? [];
    lista.push(capa);
    porCategoria.set(capa.categoria, lista);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm">
        <label className="text-sm font-medium text-foreground" htmlFor="capa-select">
          Capa
        </label>
        <select
          id="capa-select"
          value={capaActual.layer_name}
          onChange={(e) => cambiarCapa(e.target.value)}
          className="text-sm rounded-lg border border-border bg-background px-3 py-2 text-foreground"
        >
          {Array.from(porCategoria.entries()).map(([categoria, capas]) => (
            <optgroup key={categoria} label={CATEGORIA_LABELS[categoria] ?? categoria}>
              {capas.map((capa) => (
                <option key={capa.layer_name} value={capa.layer_name}>
                  {NIVEL_LABELS[capa.nivel_espacial] ?? capa.nivel_espacial}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        {cargando && <span className="text-xs text-muted-foreground">Cargando…</span>}
        <p className="text-xs text-muted-foreground ml-auto">{capaActual.descripcion}</p>
      </div>

      <div className="flex flex-col lg:flex-row gap-4 items-start">
        <GisPanel capa={capaActual} datos={datos} featureSeleccionada={featureSeleccionada} />

        <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm h-[720px] w-full flex-1">
          {error ? (
            <div className="flex items-center justify-center h-full text-sm text-muted-foreground">{error}</div>
          ) : (
            <GisMap data={datos} geomType={capaActual.geom_type} onSeleccionarFeature={setFeatureSeleccionada} />
          )}
        </div>
      </div>
    </div>
  );
}
