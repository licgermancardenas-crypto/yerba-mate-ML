"use client";

import { useEffect, useMemo, useState } from "react";
import { Mountain, Satellite } from "lucide-react";
import { ProduccionMapa, type BurbujaProduccion } from "@/components/produccion-mapa";
import { formatKg } from "@/lib/format";

interface ProduccionPorCiudadAnio {
  anio: number;
  ciudad: string;
  provincia: string;
  produccion_kg: number;
  lng: number;
  lat: number;
}

export function ProduccionMapaClient({ produccionPorCiudadAnio }: { produccionPorCiudadAnio: ProduccionPorCiudadAnio[] }) {
  const anios = useMemo(
    () => Array.from(new Set(produccionPorCiudadAnio.map((f) => f.anio))).sort((a, b) => a - b),
    [produccionPorCiudadAnio]
  );
  const [anio, setAnio] = useState(anios[anios.length - 1]);
  const [basemap, setBasemap] = useState<"topo" | "satelital">("satelital");
  const [limites, setLimites] = useState<GeoJSON.FeatureCollection | null>(null);

  useEffect(() => {
    fetch("/api/geo/view_superficie_por_municipios")
      .then((res) => (res.ok ? res.json() : null))
      .then(setLimites)
      .catch(() => setLimites(null));
  }, []);

  const burbujas: BurbujaProduccion[] = produccionPorCiudadAnio
    .filter((f) => f.anio === anio)
    .map((f) => ({ ciudad: f.ciudad, provincia: f.provincia, produccion_kg: f.produccion_kg, lng: f.lng, lat: f.lat }));

  const maxProd = Math.max(1, ...burbujas.map((b) => b.produccion_kg));

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
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

        <div className="flex items-center gap-2">
          <label htmlFor="mapa-anio" className="text-xs text-muted-foreground">
            Año
          </label>
          <select
            id="mapa-anio"
            value={anio}
            onChange={(e) => setAnio(Number(e.target.value))}
            className="text-sm rounded-lg border border-border bg-card px-2.5 py-1.5 text-card-foreground"
          >
            {anios.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </div>

        <span className="text-xs text-muted-foreground ml-auto">
          Verde: superficie cultivada (por municipio, INYM) · Naranja: producción por ciudad, {anio}
        </span>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden h-[620px] relative">
        <ProduccionMapa burbujas={burbujas} limites={limites} basemap={basemap} />
        <div className="absolute bottom-3 left-3 rounded-lg border border-border bg-card/95 backdrop-blur px-3 py-2 text-xs shadow-lg">
          <div className="font-medium text-card-foreground mb-1">Producción {anio}</div>
          <div className="flex items-center gap-2">
            <span className="inline-block rounded-full bg-orange-600" style={{ width: 8, height: 8 }} />
            <span className="text-muted-foreground">Ciudad menor</span>
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="inline-block rounded-full bg-orange-600" style={{ width: 18, height: 18 }} />
            <span className="text-muted-foreground">{formatKg(maxProd)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
