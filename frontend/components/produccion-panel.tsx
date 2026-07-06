"use client";

import { KpiRow, PanelCard, RankingChart } from "@/components/mapa-kpi";
import { formatNumero, formatPct } from "@/lib/format";
import { tituloCase } from "@/lib/texto";
import type { VistaMapa } from "@/components/produccion-mapa";

interface DeptoDatoProps {
  pcia: string;
  depto: string;
  sup_ym: number;
  superficie: number;
  valor: number;
  depto_norm: string;
}

export interface BurbujaSeleccionada {
  ciudad: string;
  provincia: string;
  produccion_kg: number;
}

export interface RutaFlujo {
  ciudad: string;
  produccion_kg: number;
  distancia_km: number;
}

const nf0 = (v: number) => formatNumero(v, 0);

function ordinal(n: number): string {
  return `${n}°`;
}

export function ProduccionPanel({
  vista,
  anio,
  departamentosDatos,
  deptoNormActivo,
  deptoEsHover,
  burbujas,
  ciudadActiva,
  ciudadEsHover,
  flujo,
  rutaActiva,
  rutaEsHover,
  nSecaderos,
}: {
  vista: VistaMapa;
  anio: number;
  departamentosDatos: GeoJSON.FeatureCollection | null;
  deptoNormActivo: string | null;
  deptoEsHover: boolean;
  burbujas: { ciudad: string; provincia: string; produccion_kg: number }[];
  ciudadActiva: BurbujaSeleccionada | null;
  ciudadEsHover: boolean;
  flujo: RutaFlujo[];
  rutaActiva: RutaFlujo | null;
  rutaEsHover: boolean;
  nSecaderos: number;
}) {
  if (vista === "coropletico") {
    const feats = (departamentosDatos?.features ?? []) as unknown as { properties: DeptoDatoProps }[];
    const totalSupYm = feats.reduce((acc, f) => acc + (f.properties.sup_ym || 0), 0);
    const totalSuperficie = feats.reduce((acc, f) => acc + (f.properties.superficie || 0), 0);
    const pctAgregado = totalSuperficie ? (totalSupYm / totalSuperficie) * 100 : 0;
    const ranking = feats
      .map((f) => ({ nombre: tituloCase(f.properties.depto), valor: f.properties.valor }))
      .sort((a, b) => b.valor - a.valor)
      .slice(0, 8);
    const activo = deptoNormActivo ? feats.find((f) => f.properties.depto_norm === deptoNormActivo)?.properties : undefined;

    let insight: string | null = null;
    if (activo) {
      const mismaProvincia = feats.filter((f) => f.properties.pcia === activo.pcia);
      const totalProvincia = mismaProvincia.reduce((acc, f) => acc + f.properties.sup_ym, 0);
      const participacion = totalProvincia ? (activo.sup_ym / totalProvincia) * 100 : 0;
      const posicion = [...mismaProvincia].sort((a, b) => b.properties.valor - a.properties.valor).findIndex((f) => f.properties.depto_norm === activo.depto_norm) + 1;
      insight = `Concentra el ${formatPct(participacion)} de la superficie con yerba mate de ${tituloCase(activo.pcia)}, y es el ${ordinal(posicion)} departamento de ${mismaProvincia.length} por % cultivado en la provincia.`;
    }

    return (
      <div className="flex flex-col gap-4 lg:w-[340px] lg:shrink-0">
        <PanelCard titulo="Resumen coroplético" subtitulo="Departamentos con dato de superficie del INYM">
          <KpiRow label="Departamentos con dato" valor={nf0(feats.length)} />
          <KpiRow label="Superficie con yerba mate" valor={`${nf0(totalSupYm)} ha`} />
          <KpiRow label="% agregado cultivado" valor={formatPct(pctAgregado)} />
        </PanelCard>

        {ranking.length > 0 && (
          <PanelCard titulo="Ranking" subtitulo="% de superficie cultivada por departamento">
            <RankingChart data={ranking} />
          </PanelCard>
        )}

        <PanelCard titulo={activo ? (deptoEsHover ? "En vivo — pasando el mouse" : "Departamento seleccionado") : "Departamento seleccionado"}>
          {!activo ? (
            <p className="text-xs text-muted-foreground">Pasá el mouse o clickeá un departamento en el mapa para ver su detalle acá.</p>
          ) : (
            <>
              <div className="text-sm font-semibold text-card-foreground mb-2">{tituloCase(activo.depto)}</div>
              <KpiRow label="Superficie con yerba mate" valor={`${nf0(activo.sup_ym)} ha`} />
              <KpiRow label="Superficie total" valor={`${nf0(activo.superficie)} ha`} />
              <KpiRow label="% cultivada" valor={formatPct(activo.valor)} />
              {insight && (
                <p className="text-xs text-foreground/80 leading-snug mt-2 pt-2 border-t border-border">{insight}</p>
              )}
            </>
          )}
        </PanelCard>
      </div>
    );
  }

  if (vista === "burbujas") {
    const total = burbujas.reduce((acc, b) => acc + b.produccion_kg, 0);
    const lider = [...burbujas].sort((a, b) => b.produccion_kg - a.produccion_kg)[0];
    const ranking = burbujas
      .map((b) => ({ nombre: b.ciudad, valor: b.produccion_kg }))
      .sort((a, b) => b.valor - a.valor)
      .slice(0, 8);

    let insight: string | null = null;
    if (ciudadActiva) {
      const participacion = total ? (ciudadActiva.produccion_kg / total) * 100 : 0;
      const posicion = [...burbujas].sort((a, b) => b.produccion_kg - a.produccion_kg).findIndex((b) => b.ciudad === ciudadActiva.ciudad) + 1;
      insight = `Representa el ${formatPct(participacion)} de la producción nacional de ${anio}, siendo la ${ordinal(posicion)} ciudad productora de ${burbujas.length}.`;
    }

    return (
      <div className="flex flex-col gap-4 lg:w-[340px] lg:shrink-0">
        <PanelCard titulo="Resumen de producción" subtitulo={`Ciudades productoras, año ${anio}`}>
          <KpiRow label="Ciudades con producción" valor={nf0(burbujas.length)} />
          <KpiRow label="Producción total" valor={`${nf0(total)} kg`} />
          {lider && <KpiRow label="Ciudad líder" valor={lider.ciudad} />}
        </PanelCard>

        {ranking.length > 0 && (
          <PanelCard titulo="Ranking" subtitulo="Producción por ciudad (kg)">
            <RankingChart data={ranking} color="#ea580c" />
          </PanelCard>
        )}

        <PanelCard titulo={ciudadActiva ? (ciudadEsHover ? "En vivo — pasando el mouse" : "Ciudad seleccionada") : "Ciudad seleccionada"}>
          {!ciudadActiva ? (
            <p className="text-xs text-muted-foreground">Pasá el mouse o clickeá una burbuja en el mapa para ver su detalle acá.</p>
          ) : (
            <>
              <div className="text-sm font-semibold text-card-foreground">{ciudadActiva.ciudad}</div>
              <div className="text-xs text-muted-foreground mb-2">{ciudadActiva.provincia}</div>
              <KpiRow label="Producción" valor={`${nf0(ciudadActiva.produccion_kg)} kg`} />
              {insight && (
                <p className="text-xs text-foreground/80 leading-snug mt-2 pt-2 border-t border-border">{insight}</p>
              )}
            </>
          )}
        </PanelCard>
      </div>
    );
  }

  if (vista === "flujo") {
    const totalProd = flujo.reduce((acc, f) => acc + f.produccion_kg, 0);
    const distProm = flujo.length ? flujo.reduce((acc, f) => acc + f.distancia_km, 0) / flujo.length : 0;
    const masLejos = [...flujo].sort((a, b) => b.distancia_km - a.distancia_km)[0];
    const ranking = flujo
      .map((f) => ({ nombre: f.ciudad, valor: f.distancia_km }))
      .sort((a, b) => b.valor - a.valor)
      .slice(0, 8);

    let insight: string | null = null;
    if (rutaActiva && distProm) {
      const diffPct = ((rutaActiva.distancia_km - distProm) / distProm) * 100;
      const comparacion = diffPct >= 0 ? "más lejos" : "más cerca";
      insight = `Su secadero más cercano está a ${formatPct(Math.abs(diffPct))} ${comparacion} que el promedio de las ciudades productoras (${formatNumero(distProm, 1)} km).`;
    }

    return (
      <div className="flex flex-col gap-4 lg:w-[340px] lg:shrink-0">
        <PanelCard titulo="Resumen de flujo" subtitulo={`Ciudad → secadero más cercano, año ${anio}`}>
          <KpiRow label="Rutas calculadas" valor={nf0(flujo.length)} />
          <KpiRow label="Distancia promedio" valor={`${formatNumero(distProm, 1)} km`} />
          {masLejos && <KpiRow label="Ciudad más alejada de un secadero" valor={masLejos.ciudad} />}
          <KpiRow label="Producción total de origen" valor={`${nf0(totalProd)} kg`} />
        </PanelCard>

        {ranking.length > 0 && (
          <PanelCard titulo="Ranking" subtitulo="Distancia al secadero más cercano (km)">
            <RankingChart data={ranking} color="#1d4ed8" />
          </PanelCard>
        )}

        <PanelCard titulo={rutaActiva ? (rutaEsHover ? "En vivo — pasando el mouse" : "Ruta seleccionada") : "Ruta seleccionada"}>
          {!rutaActiva ? (
            <p className="text-xs text-muted-foreground">Pasá el mouse o clickeá una línea en el mapa para ver su detalle acá.</p>
          ) : (
            <>
              <div className="text-sm font-semibold text-card-foreground mb-2">{rutaActiva.ciudad}</div>
              <KpiRow label="Distancia en línea recta" valor={`${formatNumero(rutaActiva.distancia_km, 1)} km`} />
              <KpiRow label="Producción de origen" valor={`${nf0(rutaActiva.produccion_kg)} kg`} />
              {insight && (
                <p className="text-xs text-foreground/80 leading-snug mt-2 pt-2 border-t border-border">{insight}</p>
              )}
              <p className="text-[10px] text-muted-foreground italic mt-2 pt-2 border-t border-border">
                Proximidad geográfica calculada, no es una ruta logística verificada.
              </p>
            </>
          )}
        </PanelCard>
      </div>
    );
  }

  // heatmap / secaderos (clústeres): el dataset de secaderos del INYM no
  // trae departamento/municipio asignado (ver docs), así que no hay un
  // desglose territorial real para mostrar -- solo el total, sin inventar
  // ninguna categoría adicional.
  return (
    <div className="flex flex-col gap-4 lg:w-[340px] lg:shrink-0">
      <PanelCard titulo={vista === "heatmap" ? "Densidad de secaderos" : "Secaderos"} subtitulo="Plantas de secado del INYM">
        <KpiRow label="Secaderos totales" valor={nf0(nSecaderos)} />
      </PanelCard>
      <p className="text-xs text-muted-foreground rounded-2xl border border-border bg-card p-4 shadow-sm">
        El dataset de secaderos no tiene departamento/municipio asignado en el INYM, así que no hay un desglose territorial
        real para mostrar acá.
      </p>
    </div>
  );
}
