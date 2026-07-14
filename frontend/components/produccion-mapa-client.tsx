"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Map as MapIcon, Factory, Flame, Circle, Route, Info, Loader2 } from "lucide-react";
import { ProduccionMapa, type VistaMapa, type Basemap, type BurbujaProduccion } from "@/components/produccion-mapa";
import { ProduccionPanel, type BurbujaSeleccionada, type RutaFlujo } from "@/components/produccion-panel";
import { MapErrorBoundary } from "@/components/map-error-boundary";
import { GrupoControl, BasemapToggle, pillClass, SELECT_CLASS, LEYENDA_CLASS } from "@/components/mapa-controles";
import { normalizar } from "@/lib/texto";
import { formatNumero } from "@/lib/format";

interface DeptoContextoFeature {
  type: "Feature";
  geometry: GeoJSON.Geometry;
  properties: { nam: string; jur: string; cde: string; nam_norm: string };
}

interface DeptoDatoFeature {
  type: "Feature";
  geometry: GeoJSON.Geometry;
  properties: { pcia: string; depto: string; sup_ym: number; superficie: number; depto_norm?: string };
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
  // Neutro (CARTO Positron) por default -- ver Fase 9, C1.
  const [basemap, setBasemap] = useState<Basemap>("calles");
  const [provincia, setProvincia] = useState<string>(""); // "" = todas
  const [departamento, setDepartamento] = useState<string>(""); // "" = todos

  const [jurisdicciones, setJurisdicciones] = useState<GeoJSON.FeatureCollection | null>(null);
  const [departamentosContexto, setDepartamentosContexto] = useState<GeoJSON.FeatureCollection | null>(null);
  const [departamentosDatos, setDepartamentosDatos] = useState<GeoJSON.FeatureCollection | null>(null);
  const [municipios, setMunicipios] = useState<GeoJSON.FeatureCollection | null>(null);
  const [secaderos, setSecaderos] = useState<GeoJSON.FeatureCollection | null>(null);
  const [maxPct, setMaxPct] = useState(0);
  const [ciudadSeleccionada, setCiudadSeleccionada] = useState<BurbujaSeleccionada | null>(null);
  const [rutaSeleccionada, setRutaSeleccionada] = useState<RutaFlujo | null>(null);
  // Hover: scrubbing en vivo mientras el mouse se mueve por el mapa, sin
  // necesidad de click. Tiene prioridad sobre la selección "fija" (dropdown
  // o último click) mientras el mouse está sobre una feature; al salir,
  // vuelve a mostrar lo que esté fijado.
  const [deptoHover, setDeptoHover] = useState<string | null>(null);
  const [ciudadHover, setCiudadHover] = useState<BurbujaSeleccionada | null>(null);
  const [rutaHover, setRutaHover] = useState<RutaFlujo | null>(null);

  // Limpia la selección puntual (burbuja/ruta) al cambiar de vista o de año
  // -- evita mostrar en el panel el detalle de una ciudad que ya no
  // corresponde al año/capa que se está mirando.
  useEffect(() => {
    setCiudadSeleccionada(null);
    setRutaSeleccionada(null);
    setDeptoHover(null);
    setCiudadHover(null);
    setRutaHover(null);
  }, [vista, anio]);

  useEffect(() => {
    fetchGeo("indec_jurisdicciones").then(setJurisdicciones);
    fetchGeo<GeoJSON.FeatureCollection>("indec_departamentos").then((data) => {
      if (!data) return;
      const features = data.features.map((f) => ({
        ...f,
        properties: { ...(f.properties as object), nam_norm: normalizar((f.properties as { nam: string }).nam) },
      }));
      setDepartamentosContexto({ ...data, features } as GeoJSON.FeatureCollection);
    });
    fetchGeo("view_superficie_por_municipios").then(setMunicipios);
    fetchGeo("view_mat_gis_marketing_puntos_secaderos").then(setSecaderos);
    fetchGeo<{ features: DeptoDatoFeature[] } & GeoJSON.FeatureCollection>("view_superficie_por_departamentos").then(
      (data) => {
        if (!data) return;
        const features = data.features
          .filter((f) => f.properties.superficie > 0)
          .map((f) => {
            const valor = (f.properties.sup_ym / f.properties.superficie) * 100;
            return { ...f, properties: { ...f.properties, valor, depto_norm: normalizar(f.properties.depto) } };
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

  // Varias provincias argentinas tienen un departamento llamado "Capital" (u
  // otros nombres repetidos, ej. "Concepción") -- con "Provincia: todas" el
  // nombre solo no alcanza como value/key de <option> (colisión real, no solo
  // un warning de React: sin esto, elegir "Capital" es ambiguo y el mapa no
  // sabría cuál resaltar). value = "nombre|provincia" (único siempre); el
  // label solo aclara la provincia entre paréntesis cuando el nombre repite
  // dentro de la lista que se está mostrando.
  const departamentos = useMemo(() => {
    if (!departamentosContexto) return [];
    const feats = departamentosContexto.features as unknown as DeptoContextoFeature[];
    const filtrados = feats.filter((f) => !provincia || f.properties.jur.toUpperCase() === provincia.toUpperCase());
    const porNombre = new Map<string, number>();
    for (const f of filtrados) porNombre.set(f.properties.nam, (porNombre.get(f.properties.nam) ?? 0) + 1);
    const vistos = new Set<string>();
    return filtrados
      .filter((f) => {
        const clave = `${f.properties.nam}|${f.properties.jur}`;
        if (vistos.has(clave)) return false;
        vistos.add(clave);
        return true;
      })
      .map((f) => ({
        value: `${f.properties.nam}|${f.properties.jur}`,
        nam: f.properties.nam,
        jur: f.properties.jur,
        label: (porNombre.get(f.properties.nam) ?? 0) > 1 ? `${f.properties.nam} (${f.properties.jur})` : f.properties.nam,
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [departamentosContexto, provincia]);

  // Reset de departamento si deja de pertenecer a la provincia elegida
  useEffect(() => {
    if (departamento && !departamentos.some((d) => d.nam === departamento)) setDepartamento("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provincia]);

  // Sincronización mapa -> UI: al clickear un departamento directamente sobre
  // el mapa (capa de contexto o coroplético), se resuelve su nombre exacto
  // (con tilde) y su provincia, y se reflejan en los selectores de arriba.
  const manejarClickDepartamentoEnMapa = useCallback(
    (deptoNorm: string) => {
      if (!departamentosContexto) return;
      const feats = departamentosContexto.features as unknown as DeptoContextoFeature[];
      const match = feats.find((f) => f.properties.nam_norm === deptoNorm);
      if (!match) return;
      const provMatch = provincias.find((p) => normalizar(p) === normalizar(match.properties.jur));
      if (provMatch) setProvincia(provMatch);
      setDepartamento(match.properties.nam);
    },
    [departamentosContexto, provincias]
  );

  const bboxFoco = useMemo((): GeoJSON.FeatureCollection | null => {
    if (departamento && departamentosContexto) {
      // Filtra también por provincia cuando está disponible -- el nombre solo
      // ("Capital", "Concepción") no es único entre provincias.
      const feats = (departamentosContexto.features as unknown as DeptoContextoFeature[]).filter(
        (f) => f.properties.nam === departamento && (!provincia || normalizar(f.properties.jur) === normalizar(provincia))
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

  // Memoizado: sin esto, cada render de este componente (p. ej. tildar otro
  // basemap) generaba un array nuevo y disparaba de nuevo el efecto que
  // reconstruye la capa de burbujas en produccion-mapa.tsx sin necesidad.
  const burbujas: BurbujaProduccion[] = useMemo(
    () =>
      produccionPorCiudadAnio
        .filter((f) => f.anio === anio)
        .map((f) => ({ ciudad: f.ciudad, provincia: f.provincia, produccion_kg: f.produccion_kg, lng: f.lng, lat: f.lat })),
    [produccionPorCiudadAnio, anio]
  );

  // Flow map: cada ciudad productora -> su secadero más cercano en línea recta.
  // Es una aproximación geográfica real (distancia calculada entre coordenadas
  // reales), NO una ruta logística verificada — no tenemos el dato de qué
  // secadero procesa la hoja verde de cada ciudad (municipio_id/departamento_id
  // de inym_gis.secaderos están sin completar, ver docs).
  const flujo = useMemo((): GeoJSON.FeatureCollection | null => {
    if (!secaderos || burbujas.length === 0) return null;
    const puntos = secaderos.features as unknown as { geometry: { type: "Point"; coordinates: [number, number] } }[];
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

  const flujoPlano: RutaFlujo[] = (flujo?.features ?? []).map((f) => f.properties as unknown as RutaFlujo);

  const deptoNormActivo = deptoHover ?? (departamento ? normalizar(departamento) : null);
  const ciudadActiva = ciudadHover ?? ciudadSeleccionada;
  const rutaActiva = rutaHover ?? rutaSeleccionada;

  // Cada capa es un fetch cliente aparte (el coroplético en particular
  // pesa ~2,8MB de polígonos) -- sin este indicador el mapa queda con el
  // lienzo en blanco y el panel en "0" varios segundos, como si estuviera
  // roto en vez de cargando.
  const cargandoCapa =
    vista === "coropletico"
      ? !departamentosContexto || !departamentosDatos
      : vista === "burbujas"
      ? false
      : !secaderos;

  const leyendaTexto =
    vista === "coropletico"
      ? "Color = % de superficie departamental cultivada con yerba mate (gris = sin dato en el INYM). Click en un departamento para seleccionarlo."
      : vista === "burbujas"
      ? `Producción por ciudad, año ${anio} — el tamaño del círculo es proporcional a los kg producidos.`
      : vista === "heatmap"
      ? `Densidad de ${nSecaderos} secaderos/plantas de secado del INYM — degradé de concentración, no puntos individuales.`
      : vista === "secaderos"
      ? `${nSecaderos} secaderos agrupados en clústeres dinámicos: se agrupan al alejar el zoom y se desglosan al acercarlo.`
      : "Ciudad productora → secadero más cercano. Es una aproximación por proximidad geográfica, no una ruta logística verificada.";

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-4 shadow-sm">
        <div className="flex flex-wrap items-start gap-x-6 gap-y-4">
          <GrupoControl titulo="Filtros">
            <select
              id="mapa-provincia"
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

            <select
              id="mapa-departamento"
              aria-label="Departamento"
              value={departamento ? departamentos.find((d) => d.nam === departamento)?.value ?? "" : ""}
              onChange={(e) => {
                const elegido = departamentos.find((d) => d.value === e.target.value);
                if (!elegido) {
                  setDepartamento("");
                  return;
                }
                setDepartamento(elegido.nam);
                // Nombre ambiguo entre provincias (ej. "Capital") -- fija la
                // provincia también, sino el mapa no puede saber cuál mostrar.
                if (!provincia) setProvincia(elegido.jur);
              }}
              className={SELECT_CLASS}
            >
              <option value="">Departamento: todos</option>
              {departamentos.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </select>

            {(vista === "burbujas" || vista === "flujo") && (
              <select
                id="mapa-anio"
                aria-label="Año"
                value={anio}
                onChange={(e) => setAnio(Number(e.target.value))}
                className={SELECT_CLASS}
              >
                {anios.map((a) => (
                  <option key={a} value={a}>
                    Año {a}
                  </option>
                ))}
              </select>
            )}
          </GrupoControl>

          <div className="hidden sm:block w-px self-stretch bg-border" aria-hidden="true" />

          <GrupoControl titulo="Capas / tipo de análisis">
            {VISTAS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setVista(id)}
                aria-label={label}
                aria-pressed={vista === id}
                title={label}
                className={pillClass(vista === id)}
              >
                <Icon size={14} aria-hidden="true" />
                <span className="hidden xl:inline">{label}</span>
              </button>
            ))}
          </GrupoControl>

          <div className="hidden sm:block w-px self-stretch bg-border" aria-hidden="true" />

          <BasemapToggle basemap={basemap} onChange={setBasemap} />
        </div>

        <div className="flex items-start gap-2 rounded-2xl border border-border bg-muted px-3.5 py-2.5">
          <Info size={14} className="text-foreground/70 mt-0.5 shrink-0" aria-hidden="true" />
          <span className="text-xs text-foreground/90 leading-snug">{leyendaTexto}</span>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-4 items-start">
        <ProduccionPanel
          vista={vista}
          anio={anio}
          departamentosDatos={departamentosDatos}
          deptoNormActivo={deptoNormActivo}
          deptoEsHover={deptoHover !== null}
          burbujas={burbujas}
          ciudadActiva={ciudadActiva}
          ciudadEsHover={ciudadHover !== null}
          flujo={flujoPlano}
          rutaActiva={rutaActiva}
          rutaEsHover={rutaHover !== null}
          nSecaderos={nSecaderos}
        />

        <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm h-[720px] w-full flex-1 relative">
        {cargandoCapa && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 bg-card/80 backdrop-blur-sm">
            <Loader2 size={24} className="animate-spin text-primary" aria-hidden="true" />
            <span className="text-sm text-muted-foreground">Cargando capas del mapa…</span>
          </div>
        )}
        <MapErrorBoundary>
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
            departamentoFiltro={departamento ? normalizar(departamento) : null}
            bboxFoco={bboxFoco}
            onSeleccionarDepartamento={manejarClickDepartamentoEnMapa}
            onSeleccionarBurbuja={setCiudadSeleccionada}
            onSeleccionarFlujo={setRutaSeleccionada}
            onHoverDepartamento={setDeptoHover}
            onHoverBurbuja={setCiudadHover}
            onHoverFlujo={setRutaHover}
          />
        </MapErrorBoundary>

        {vista === "coropletico" && (
          <div className={LEYENDA_CLASS}>
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
              <span>{formatNumero(maxPct, 0)}%</span>
            </div>
            <div className="flex items-center gap-1.5 pt-1.5 border-t border-border">
              <span className="inline-block w-3 h-3 rounded-sm" style={{ backgroundColor: "#94a3b8", opacity: 0.4 }} />
              <span className="text-muted-foreground">Sin dato en el INYM</span>
            </div>
          </div>
        )}

        {vista === "heatmap" && (
          <div className={LEYENDA_CLASS}>
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

        {vista === "secaderos" && (
          <div className={LEYENDA_CLASS}>
            <div className="font-medium text-card-foreground mb-1.5">Secaderos</div>
            <div className="flex items-center gap-2 mb-1">
              <span className="inline-block w-3 h-3 rounded-full" style={{ backgroundColor: "#ea580c" }} />
              <span className="text-muted-foreground">Planta individual</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1">
                <span className="inline-block w-3 h-3 rounded-full" style={{ backgroundColor: "#fdba74" }} />
                <span className="inline-block w-4 h-4 rounded-full" style={{ backgroundColor: "#ea580c" }} />
              </span>
              <span className="text-muted-foreground">Clúster (el número = cantidad agrupada)</span>
            </div>
          </div>
        )}

        {vista === "burbujas" && (
          <div className={LEYENDA_CLASS}>
            <div className="font-medium text-card-foreground mb-1.5">Producción por ciudad</div>
            <div className="flex items-end gap-2">
              <span className="rounded-full" style={{ width: 8, height: 8, backgroundColor: "#ea580c" }} />
              <span className="rounded-full" style={{ width: 16, height: 16, backgroundColor: "#ea580c" }} />
              <span className="rounded-full" style={{ width: 26, height: 26, backgroundColor: "#ea580c" }} />
            </div>
            <div className="text-muted-foreground mt-1">Menor → mayor volumen (kg)</div>
          </div>
        )}

        {vista === "flujo" && (
          <div className={LEYENDA_CLASS}>
            <div className="font-medium text-card-foreground mb-1.5">Flujo ciudad → secadero</div>
            <div className="flex items-center gap-2 mb-1">
              <span className="inline-block w-6 h-0.5" style={{ backgroundColor: "#1d4ed8" }} />
              <span className="text-muted-foreground">Grosor ∝ producción de origen</span>
            </div>
            <div className="text-muted-foreground italic leading-snug">Proximidad geográfica, no ruta logística verificada.</div>
          </div>
        )}
        </div>
      </div>
    </div>
  );
}
