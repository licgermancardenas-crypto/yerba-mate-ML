"use client";

import { useEffect, useMemo, useState } from "react";
import { Mountain, Satellite, Map as MapIcon, Factory } from "lucide-react";
import { ProduccionMapa, type VistaMapa } from "@/components/produccion-mapa";

interface DeptoContextoFeature {
  type: "Feature";
  geometry: GeoJSON.Geometry;
  properties: { nam: string; jur: string; cde: string };
}

interface DeptoDatoFeature {
  type: "Feature";
  geometry: GeoJSON.Geometry;
  properties: { pcia: string; depto: string; sup_ym: number; superficie: number };
}

async function fetchGeo<T = GeoJSON.FeatureCollection>(layer: string): Promise<T | null> {
  try {
    const res = await fetch(`/api/geo/${layer}`);
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export function ProduccionMapaClient() {
  const [vista, setVista] = useState<VistaMapa>("coropletico");
  const [basemap, setBasemap] = useState<"topo" | "satelital">("topo");
  const [provincia, setProvincia] = useState<string>(""); // "" = todas
  const [departamento, setDepartamento] = useState<string>(""); // "" = todos

  const [jurisdicciones, setJurisdicciones] = useState<GeoJSON.FeatureCollection | null>(null);
  const [departamentosContexto, setDepartamentosContexto] = useState<GeoJSON.FeatureCollection | null>(null);
  const [departamentosDatos, setDepartamentosDatos] = useState<GeoJSON.FeatureCollection | null>(null);
  const [municipios, setMunicipios] = useState<GeoJSON.FeatureCollection | null>(null);
  const [secaderos, setSecaderos] = useState<GeoJSON.FeatureCollection | null>(null);
  const [maxPct, setMaxPct] = useState(0);

  useEffect(() => {
    fetchGeo("indec_jurisdicciones").then(setJurisdicciones);
    fetchGeo("indec_departamentos").then(setDepartamentosContexto);
    fetchGeo("view_superficie_por_municipios").then(setMunicipios);
    fetchGeo("view_mat_gis_marketing_puntos_secaderos").then(setSecaderos);
    fetchGeo<{ features: DeptoDatoFeature[] } & GeoJSON.FeatureCollection>("view_superficie_por_departamentos").then(
      (data) => {
        if (!data) return;
        const features = data.features
          .filter((f) => f.properties.superficie > 0)
          .map((f) => {
            const valor = (f.properties.sup_ym / f.properties.superficie) * 100;
            return { ...f, properties: { ...f.properties, valor } };
          });
        setMaxPct(Math.max(...features.map((f) => f.properties.valor), 0));
        setDepartamentosDatos({ type: "FeatureCollection", features } as GeoJSON.FeatureCollection);
      }
    );
  }, []);

  const provincias = useMemo(() => {
    if (!jurisdicciones) return [];
    return (jurisdicciones.features as unknown as { properties: { nam: string } }[]).map((f) => f.properties.nam).sort();
  }, [jurisdicciones]);

  const departamentos = useMemo(() => {
    if (!departamentosContexto) return [];
    const feats = departamentosContexto.features as unknown as DeptoContextoFeature[];
    return feats
      .filter((f) => !provincia || f.properties.jur.toUpperCase() === provincia.toUpperCase())
      .map((f) => f.properties.nam)
      .sort();
  }, [departamentosContexto, provincia]);

  // Reset de departamento si deja de pertenecer a la provincia elegida
  useEffect(() => {
    if (departamento && !departamentos.includes(departamento)) setDepartamento("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provincia]);

  const bboxFoco = useMemo((): GeoJSON.FeatureCollection | null => {
    if (departamento && departamentosContexto) {
      const feats = (departamentosContexto.features as unknown as DeptoContextoFeature[]).filter(
        (f) => f.properties.nam === departamento
      );
      if (feats.length) return { type: "FeatureCollection", features: feats } as GeoJSON.FeatureCollection;
    }
    if (provincia && jurisdicciones) {
      const feats = (jurisdicciones.features as unknown as { properties: { nam: string } }[]).filter(
        (f) => f.properties.nam.toUpperCase() === provincia.toUpperCase()
      );
      if (feats.length) return { type: "FeatureCollection", features: feats } as unknown as GeoJSON.FeatureCollection;
    }
    return null;
  }, [provincia, departamento, jurisdicciones, departamentosContexto]);

  const nSecaderos = secaderos?.features.length ?? 0;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm">
        <div className="flex flex-col gap-1">
          <label htmlFor="mapa-provincia" className="text-xs text-muted-foreground">
            Provincia
          </label>
          <select
            id="mapa-provincia"
            value={provincia}
            onChange={(e) => setProvincia(e.target.value)}
            className="text-sm rounded-lg border border-border bg-background px-2.5 py-1.5 text-foreground"
          >
            <option value="">Todas</option>
            {provincias.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="mapa-departamento" className="text-xs text-muted-foreground">
            Departamento
          </label>
          <select
            id="mapa-departamento"
            value={departamento}
            onChange={(e) => setDepartamento(e.target.value)}
            className="text-sm rounded-lg border border-border bg-background px-2.5 py-1.5 text-foreground"
          >
            <option value="">Todos</option>
            {departamentos.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center rounded-lg border border-border bg-background p-0.5">
          <button
            type="button"
            onClick={() => setVista("coropletico")}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md transition-colors ${
              vista === "coropletico" ? "bg-primary text-on-primary" : "text-foreground/70 hover:text-foreground"
            }`}
          >
            <MapIcon size={14} aria-hidden="true" />
            Coroplético
          </button>
          <button
            type="button"
            onClick={() => setVista("secaderos")}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md transition-colors ${
              vista === "secaderos" ? "bg-primary text-on-primary" : "text-foreground/70 hover:text-foreground"
            }`}
          >
            <Factory size={14} aria-hidden="true" />
            Secaderos
          </button>
        </div>

        <div className="flex items-center rounded-lg border border-border bg-background p-0.5">
          <button
            type="button"
            onClick={() => setBasemap("topo")}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md transition-colors ${
              basemap === "topo" ? "bg-primary text-on-primary" : "text-foreground/70 hover:text-foreground"
            }`}
          >
            <Mountain size={14} aria-hidden="true" />
            Topográfico
          </button>
          <button
            type="button"
            onClick={() => setBasemap("satelital")}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md transition-colors ${
              basemap === "satelital" ? "bg-primary text-on-primary" : "text-foreground/70 hover:text-foreground"
            }`}
          >
            <Satellite size={14} aria-hidden="true" />
            Satelital
          </button>
        </div>

        <span className="text-xs text-muted-foreground ml-auto">
          {vista === "coropletico"
            ? "Color = % de superficie departamental cultivada con yerba mate (solo deptos con dato del INYM; gris = sin dato)"
            : `${nSecaderos} secaderos/plantas de secado (INYM), agrupados por zoom`}
        </span>
      </div>

      <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm h-[640px] relative">
        <ProduccionMapa
          vista={vista}
          jurisdicciones={jurisdicciones}
          departamentosContexto={departamentosContexto}
          departamentosDatos={departamentosDatos}
          municipios={municipios}
          secaderos={secaderos}
          basemap={basemap}
          provinciaFiltro={provincia ? provincia.toUpperCase() : null}
          bboxFoco={bboxFoco}
        />

        {vista === "coropletico" && (
          <div className="absolute bottom-3 left-3 rounded-lg border border-border bg-card/95 backdrop-blur px-3 py-2 text-xs shadow-lg">
            <div className="font-medium text-card-foreground mb-1">% superficie cultivada</div>
            <div className="flex items-center gap-1">
              <span className="inline-block w-4 h-3" style={{ backgroundColor: "#f0fdf4" }} />
              <span className="inline-block w-4 h-3" style={{ backgroundColor: "#bbf7d0" }} />
              <span className="inline-block w-4 h-3" style={{ backgroundColor: "#4ade80" }} />
              <span className="inline-block w-4 h-3" style={{ backgroundColor: "#16a34a" }} />
              <span className="inline-block w-4 h-3" style={{ backgroundColor: "#14532d" }} />
            </div>
            <div className="flex justify-between text-muted-foreground mt-0.5 mb-1.5">
              <span>0%</span>
              <span>{maxPct.toFixed(0)}%</span>
            </div>
            <div className="flex items-center gap-1.5 pt-1.5 border-t border-border">
              <span className="inline-block w-3 h-3 rounded-sm" style={{ backgroundColor: "#94a3b8", opacity: 0.4 }} />
              <span className="text-muted-foreground">Sin dato en el INYM</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
