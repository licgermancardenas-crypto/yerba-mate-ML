"use client";

import { useEffect, useState } from "react";
import { Mountain, Satellite, Map as MapIcon, Factory } from "lucide-react";
import { ProduccionMapa, type VistaMapa } from "@/components/produccion-mapa";

interface DeptoFeature {
  type: "Feature";
  geometry: GeoJSON.Geometry;
  properties: { pcia: string; depto: string; sup_ym: number; superficie: number };
}

export function ProduccionMapaClient() {
  const [vista, setVista] = useState<VistaMapa>("coropletico");
  const [basemap, setBasemap] = useState<"topo" | "satelital">("topo");
  const [coropletico, setCoropletico] = useState<GeoJSON.FeatureCollection | null>(null);
  const [secaderos, setSecaderos] = useState<GeoJSON.FeatureCollection | null>(null);
  const [maxPct, setMaxPct] = useState(0);

  useEffect(() => {
    fetch("/api/geo/view_superficie_por_departamentos")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { features: DeptoFeature[] } | null) => {
        if (!data) return;
        const features = data.features
          .filter((f) => f.properties.superficie > 0)
          .map((f) => {
            const valor = (f.properties.sup_ym / f.properties.superficie) * 100;
            return { ...f, properties: { ...f.properties, valor } };
          });
        setMaxPct(Math.max(...features.map((f) => f.properties.valor), 0));
        setCoropletico({ type: "FeatureCollection", features } as GeoJSON.FeatureCollection);
      })
      .catch(() => setCoropletico(null));

    fetch("/api/geo/view_mat_gis_marketing_puntos_secaderos")
      .then((res) => (res.ok ? res.json() : null))
      .then(setSecaderos)
      .catch(() => setSecaderos(null));
  }, []);

  const nSecaderos = secaderos?.features.length ?? 0;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center rounded-lg border border-border bg-card p-0.5">
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

        <div className="flex items-center rounded-lg border border-border bg-card p-0.5">
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
            ? "% de superficie departamental cultivada con yerba mate (INYM)"
            : `${nSecaderos} secaderos/plantas de secado — agrupados por zoom (INYM)`}
        </span>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden h-[620px] relative">
        <ProduccionMapa vista={vista} coropletico={coropletico} secaderos={secaderos} basemap={basemap} />

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
            <div className="flex justify-between text-muted-foreground mt-0.5">
              <span>0%</span>
              <span>{maxPct.toFixed(0)}%</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
