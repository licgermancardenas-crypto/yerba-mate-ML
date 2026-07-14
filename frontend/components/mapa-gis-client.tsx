"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Info, Loader2 } from "lucide-react";
import { GisMap, type CapasTransporte, type TransporteActivo } from "@/components/gis-map";
import { GisPanel } from "@/components/gis-panel";
import { MapErrorBoundary } from "@/components/map-error-boundary";
import { GrupoControl, BasemapToggle, SELECT_CLASS, LEYENDA_CLASS, pillClass } from "@/components/mapa-controles";
import { campoChoropleto } from "@/lib/gis-resumen";
import { formatNumero } from "@/lib/format";
import type { Basemap } from "@/lib/basemap";
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

// Checkboxes de contexto de transporte (fuera del selector "Capa" -- son
// overlays combinables, no un reemplazo de la capa activa). Todas arrancan
// apagadas para no cambiar lo que ya se veía en el mapa por defecto.
const TRANSPORTE_TOGGLES: { key: keyof TransporteActivo; label: string; layerName: string }[] = [
  { key: "vialNacional", label: "Rutas nacionales", layerName: "ign_vial_nacional" },
  { key: "vialProvincial", label: "Rutas provinciales", layerName: "ign_vial_provincial" },
  { key: "ferrocarril", label: "Ferrocarril", layerName: "ign_ferrocarril" },
];

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

async function fetchGeo<T = GeoJSON.FeatureCollection>(layer: string): Promise<T | null> {
  try {
    const res = await fetch(`/api/geo/${layer}`);
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

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

  // Neutro (CARTO Positron) por default -- topográfico (verde) hacía que los
  // departamentos coropléticos no se distinguieran del terreno de fondo
  // (ver Fase 9, C1). Topográfico queda disponible como opción manual.
  const [basemap, setBasemap] = useState<Basemap>("calles");
  const [provincia, setProvincia] = useState<string>(""); // "" = todas
  const [jurisdicciones, setJurisdicciones] = useState<GeoJSON.FeatureCollection | null>(null);
  const [radiosContexto, setRadiosContexto] = useState<GeoJSON.FeatureCollection | null>(null);
  const [transporte, setTransporte] = useState<CapasTransporte>({ vialNacional: null, vialProvincial: null, ferrocarril: null });
  const [transporteActivo, setTransporteActivo] = useState<TransporteActivo>({
    vialNacional: false,
    vialProvincial: false,
    ferrocarril: false,
  });

  useEffect(() => {
    fetchGeo("indec_jurisdicciones").then(setJurisdicciones);
    fetchGeo("censo2010_radios").then(setRadiosContexto);
    fetchGeo("ign_vial_nacional").then((d) => setTransporte((t) => ({ ...t, vialNacional: d })));
    fetchGeo("ign_vial_provincial").then((d) => setTransporte((t) => ({ ...t, vialProvincial: d })));
    fetchGeo("ign_ferrocarril").then((d) => setTransporte((t) => ({ ...t, ferrocarril: d })));
  }, []);

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

  const provincias = useMemo(() => {
    if (!jurisdicciones) return [];
    return (jurisdicciones.features as unknown as { properties: { nam: string } }[]).map((f) => f.properties.nam).sort();
  }, [jurisdicciones]);

  const bboxFoco = useMemo((): GeoJSON.FeatureCollection | null => {
    if (!provincia || !jurisdicciones) return null;
    const feats = (jurisdicciones.features as unknown as { properties: { nam: string } }[]).filter(
      (f) => f.properties.nam.toUpperCase() === provincia.toUpperCase()
    );
    return feats.length ? ({ type: "FeatureCollection", features: feats } as unknown as GeoJSON.FeatureCollection) : null;
  }, [provincia, jurisdicciones]);

  const campoValor = campoChoropleto(capaActual.categoria, capaActual.geom_type);
  const maxValor = useMemo(() => {
    if (!campoValor) return 0;
    return datos.features.reduce((acc, f) => Math.max(acc, Number(f.properties[campoValor]) || 0), 0);
  }, [datos, campoValor]);

  const esClusterizada = capaActual.geom_type === "Point";

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-4 shadow-sm">
        <div className="flex flex-wrap items-start gap-x-6 gap-y-4">
          <GrupoControl titulo="Capa">
            <select
              id="capa-select"
              aria-label="Capa"
              value={capaActual.layer_name}
              onChange={(e) => cambiarCapa(e.target.value)}
              className={SELECT_CLASS}
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
          </GrupoControl>

          <div className="hidden sm:block w-px self-stretch bg-border" aria-hidden="true" />

          <GrupoControl titulo="Provincia">
            <select
              id="mapa-gis-provincia"
              aria-label="Provincia"
              value={provincia}
              onChange={(e) => setProvincia(e.target.value)}
              className={SELECT_CLASS}
            >
              <option value="">Provincia: todas</option>
              {provincias.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </GrupoControl>

          <div className="hidden sm:block w-px self-stretch bg-border" aria-hidden="true" />

          <GrupoControl titulo="Transporte">
            {TRANSPORTE_TOGGLES.map(({ key, label }) => (
              <button
                key={key}
                type="button"
                onClick={() => setTransporteActivo((t) => ({ ...t, [key]: !t[key] }))}
                aria-pressed={transporteActivo[key]}
                aria-label={label}
                title={label}
                className={pillClass(transporteActivo[key])}
              >
                <span>{label}</span>
              </button>
            ))}
          </GrupoControl>

          <div className="hidden sm:block w-px self-stretch bg-border" aria-hidden="true" />

          <BasemapToggle basemap={basemap} onChange={setBasemap} />
        </div>

        <div className="flex items-start gap-2 rounded-2xl border border-border bg-muted px-3.5 py-2.5">
          <Info size={14} className="text-foreground/70 mt-0.5 shrink-0" aria-hidden="true" />
          <span className="text-xs text-foreground/90 leading-snug">
            {capaActual.descripcion}
            {cargando && " — Cargando…"}
          </span>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-4 items-start">
        <GisPanel capa={capaActual} datos={datos} featureSeleccionada={featureSeleccionada} />

        <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm h-[720px] w-full flex-1 relative">
          {cargando && (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 bg-card/80 backdrop-blur-sm">
              <Loader2 size={24} className="animate-spin text-primary" aria-hidden="true" />
              <span className="text-sm text-muted-foreground">Cargando capa…</span>
            </div>
          )}
          {error ? (
            <div className="flex items-center justify-center h-full text-sm text-muted-foreground">{error}</div>
          ) : (
            <MapErrorBoundary>
              <GisMap
                data={datos}
                geomType={capaActual.geom_type}
                campoValor={campoValor}
                jurisdicciones={jurisdicciones}
                radiosContexto={radiosContexto}
                transporte={transporte}
                transporteActivo={transporteActivo}
                basemap={basemap}
                provinciaFiltro={provincia ? provincia.toUpperCase() : null}
                bboxFoco={bboxFoco}
                onSeleccionarFeature={setFeatureSeleccionada}
              />
            </MapErrorBoundary>
          )}

          {!error && campoValor && (
            <div className={LEYENDA_CLASS}>
              <div className="font-medium text-card-foreground mb-1">
                {campoValor === "cant" ? "Secaderos por zona" : "Superficie (ha)"}
              </div>
              <div className="flex items-center gap-1">
                <span className="inline-block w-4 h-3" style={{ backgroundColor: "#f0fdf4" }} />
                <span className="inline-block w-4 h-3" style={{ backgroundColor: "#bbf7d0" }} />
                <span className="inline-block w-4 h-3" style={{ backgroundColor: "#4ade80" }} />
                <span className="inline-block w-4 h-3" style={{ backgroundColor: "#16a34a" }} />
                <span className="inline-block w-4 h-3" style={{ backgroundColor: "#14532d" }} />
              </div>
              <div className="flex justify-between text-muted-foreground mt-0.5">
                <span>0</span>
                <span>{formatNumero(maxValor, 0)}</span>
              </div>
            </div>
          )}

          {!error && esClusterizada && (
            <div className={LEYENDA_CLASS}>
              <div className="font-medium text-card-foreground mb-1.5">{CATEGORIA_LABELS[capaActual.categoria] ?? "Puntos"}</div>
              <div className="flex items-center gap-2 mb-1">
                <span className="inline-block w-3 h-3 rounded-full" style={{ backgroundColor: "#ea580c" }} />
                <span className="text-muted-foreground">Punto individual</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1">
                  <span className="inline-block w-3 h-3 rounded-full" style={{ backgroundColor: "#fdba74" }} />
                  <span className="inline-block w-4 h-4 rounded-full" style={{ backgroundColor: "#ea580c" }} />
                </span>
                <span className="text-muted-foreground">Clúster (agrupa por zoom)</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
