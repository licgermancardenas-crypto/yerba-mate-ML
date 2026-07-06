"use client";

import { useEffect, useMemo, useState } from "react";
import { Mountain, Satellite, Map as MapIcon, Factory, Flame, Circle, Route } from "lucide-react";
import { ProduccionMapa, type VistaMapa, type BurbujaProduccion } from "@/components/produccion-mapa";

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

interface SecaderoFeature {
  type: "Feature";
  geometry: { type: "Point"; coordinates: [number, number] };
  properties: { idplanta: number; dir_catastral: string | null };
}

interface ProduccionPorCiudadAnio {
  anio: number;
  ciudad: string;
  provincia: string;
  produccion_kg: number;
  lng: number;
  lat: number;
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

// Distancia geodésica (km) — suficiente para elegir el secadero más cercano,
// no hace falta una proyección exacta a esta escala regional.
function distanciaKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const VISTAS: { id: VistaMapa; label: string; icon: typeof MapIcon }[] = [
  { id: "coropletico", label: "Coroplético", icon: MapIcon },
  { id: "burbujas", label: "Burbujas", icon: Circle },
  { id: "heatmap", label: "Heatmap secaderos", icon: Flame },
  { id: "secaderos", label: "Clústeres", icon: Factory },
  { id: "flujo", label: "Flujo", icon: Route },
];

export function ProduccionMapaClient({ produccionPorCiudadAnio }: { produccionPorCiudadAnio: ProduccionPorCiudadAnio[] }) {
  const anios = useMemo(
    () => Array.from(new Set(produccionPorCiudadAnio.map((f) => f.anio))).sort((a, b) => a - b),
    [produccionPorCiudadAnio]
  );
  const [anio, setAnio] = useState(anios[anios.length - 1]);
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

  const burbujas: BurbujaProduccion[] = produccionPorCiudadAnio
    .filter((f) => f.anio === anio)
    .map((f) => ({ ciudad: f.ciudad, provincia: f.provincia, produccion_kg: f.produccion_kg, lng: f.lng, lat: f.lat }));

  // Flow map: cada ciudad productora -> su secadero más cercano en línea recta.
  // Es una aproximación geográfica real (distancia calculada entre coordenadas
  // reales), NO una ruta logística verificada — no tenemos el dato de qué
  // secadero procesa la hoja verde de cada ciudad (municipio_id/departamento_id
  // de inym_gis.secaderos están sin completar, ver docs).
  const flujo = useMemo((): GeoJSON.FeatureCollection | null => {
    if (!secaderos || burbujas.length === 0) return null;
    const puntos = secaderos.features as unknown as SecaderoFeature[];
    if (puntos.length === 0) return null;

    const features: GeoJSON.Feature[] = burbujas.map((b) => {
      let mejor = puntos[0];
      let mejorDist = Infinity;
      for (const s of puntos) {
        const d = distanciaKm(b.lat, b.lng, s.geometry.coordinates[1], s.geometry.coordinates[0]);
        if (d < mejorDist) {
          mejorDist = d;
          mejor = s;
        }
      }
      return {
        type: "Feature",
        geometry: {
          type: "LineString",
          coordinates: [
            [b.lng, b.lat],
            [mejor.geometry.coordinates[0], mejor.geometry.coordinates[1]],
          ],
        },
        properties: { ciudad: b.ciudad, produccion_kg: b.produccion_kg, distancia_km: mejorDist },
      };
    });
    return { type: "FeatureCollection", features };
  }, [secaderos, burbujas]);

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

        {(vista === "burbujas" || vista === "flujo") && (
          <div className="flex items-center gap-2">
            <label htmlFor="mapa-anio" className="text-xs text-muted-foreground">
              Año
            </label>
            <select
              id="mapa-anio"
              value={anio}
              onChange={(e) => setAnio(Number(e.target.value))}
              className="text-sm rounded-lg border border-border bg-background px-2.5 py-1.5 text-foreground"
            >
              {anios.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="flex items-center rounded-lg border border-border bg-background p-0.5">
          {VISTAS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setVista(id)}
              title={label}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 text-sm rounded-md transition-colors ${
                vista === id ? "bg-primary text-on-primary" : "text-foreground/70 hover:text-foreground"
              }`}
            >
              <Icon size={14} aria-hidden="true" />
              <span className="hidden xl:inline">{label}</span>
            </button>
          ))}
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
          {vista === "coropletico" && "Color = % de superficie departamental cultivada con yerba mate (gris = sin dato en el INYM)"}
          {vista === "burbujas" && `Producción por ciudad, ${anio} — tamaño proporcional a los kg`}
          {vista === "heatmap" && `Densidad de ${nSecaderos} secaderos/plantas de secado (INYM)`}
          {vista === "secaderos" && `${nSecaderos} secaderos — clústeres dinámicos, se desglosan al acercar el zoom`}
          {vista === "flujo" && "Ciudad productora → secadero más cercano (proximidad geográfica, no ruta logística verificada)"}
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
          burbujas={burbujas}
          flujo={flujo}
          basemap={basemap}
          provinciaFiltro={provincia ? provincia.toUpperCase() : null}
          departamentoFiltro={departamento || null}
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

        {vista === "heatmap" && (
          <div className="absolute bottom-3 left-3 rounded-lg border border-border bg-card/95 backdrop-blur px-3 py-2 text-xs shadow-lg">
            <div className="font-medium text-card-foreground mb-1">Concentración de secaderos</div>
            <div className="flex items-center gap-1">
              <span className="inline-block w-4 h-3" style={{ backgroundColor: "#bbf7d0" }} />
              <span className="inline-block w-4 h-3" style={{ backgroundColor: "#4ade80" }} />
              <span className="inline-block w-4 h-3" style={{ backgroundColor: "#f59e0b" }} />
              <span className="inline-block w-4 h-3" style={{ backgroundColor: "#ea580c" }} />
              <span className="inline-block w-4 h-3" style={{ backgroundColor: "#7f1d1d" }} />
            </div>
            <div className="flex justify-between text-muted-foreground mt-0.5">
              <span>Baja</span>
              <span>Alta</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
