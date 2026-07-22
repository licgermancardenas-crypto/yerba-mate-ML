import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { KpiCard } from "@/components/kpi-card";
import { ReliabilityBadge } from "@/components/reliability-badge";
import { FooterFuentes } from "@/components/footer-fuentes";
import { InsightChapter } from "@/components/insight-chapter";
import { InsightsToc, type InsightTocItem } from "@/components/insights-toc";
import { Sprout, Ship, Coffee, Gauge, CloudRain, Globe2, Sparkles } from "lucide-react";
import { formatMasa, formatMasaCompacta, formatNumero, formatPct, esAnioCompleto } from "@/lib/format";
import {
  getProduccionAnualReal,
  getSuperficie,
  getHojaVerde,
  getGeoLayerAtributos,
  getNdviZona,
  getClimaZona,
  getPrecios,
  getPreciosGondola,
  getRemInflacion,
  getSalidaMolino,
  getExportacionesAnualReal,
  getExportacionesIndec,
  getImportacionesIndec,
} from "@/lib/api";
import {
  agregarProduccionAnualNacional,
  agregarRendimientoAnual,
  agregarExportacionesAnualNacional,
  agregarComexIndecPorPais,
  agregarSalidaMolinoAnual,
  calcularVarPct,
} from "@/lib/agregaciones";
import { calcularConcentracion } from "@/lib/metricas-competencia";
import { ZONAS, etiquetaZona } from "@/lib/zonas";

const CHAPTERS: InsightTocItem[] = [
  { id: "panorama", numero: "01", label: "Panorama" },
  { id: "geografia", numero: "02", label: "Geografía del cultivo" },
  { id: "clima", numero: "03", label: "Clima y vegetación" },
  { id: "desregulacion", numero: "04", label: "La desregulación" },
  { id: "consumo", numero: "05", label: "Un bien de necesidad" },
  { id: "comercio-exterior", numero: "06", label: "Comercio exterior" },
  { id: "modelos-ml", numero: "07", label: "Los 3 modelos predictivos" },
  { id: "integridad-datos", numero: "08", label: "Integridad de los datos" },
  { id: "sintesis", numero: "09", label: "Síntesis" },
];

export default async function InsightsPage() {
  const [
    produccionAnualCompleta,
    superficieCompletas,
    hojaVerdeCompleta,
    superficieZonaAtributos,
    ndviCompleto,
    climaCompleto,
    preciosCompletos,
    gondola,
    remInflacion,
    salidaMolinoCompleta,
    exportAnualCompleta,
    exportIndecCompleta,
    importIndecCompleta,
  ] = await Promise.all([
    getProduccionAnualReal(),
    getSuperficie(),
    getHojaVerde(),
    getGeoLayerAtributos<{ zona: string; sup_ym: number }>("view_superficie_por_zonas"),
    getNdviZona(),
    getClimaZona(),
    getPrecios(),
    getPreciosGondola(),
    getRemInflacion(),
    getSalidaMolino(),
    getExportacionesAnualReal(),
    getExportacionesIndec(),
    getImportacionesIndec(),
  ]);

  // ---- Cap. 1: Panorama ----------------------------------------------------
  const produccionAnual = agregarProduccionAnualNacional(produccionAnualCompleta);
  const ultimoAnio = Math.max(...produccionAnual.map((f) => f.anio));
  const anualUltimo = produccionAnual.find((f) => f.anio === ultimoAnio);
  const totalSupZonas = superficieZonaAtributos.reduce((acc, z) => acc + z.sup_ym, 0);

  // ---- Cap. 2: Geografía del cultivo ---------------------------------------
  const zonasPorSuperficie = [...superficieZonaAtributos].sort((a, b) => b.sup_ym - a.sup_ym);
  const concentracionGeografica =
    totalSupZonas > 0 ? calcularConcentracion(superficieZonaAtributos.map((z) => (z.sup_ym / totalSupZonas) * 100)) : null;
  const rendimientoAnual = agregarRendimientoAnual(produccionAnualCompleta, superficieCompletas);
  const rendimientoUltimo = rendimientoAnual[rendimientoAnual.length - 1];

  // ---- Cap. 3: Clima y vegetación -------------------------------------------
  function anomaliaMensualPorZona(puntos: { zona: string; anio: number; mes: number; valor: number }[]) {
    return ZONAS.map((zona) => {
      const deLaZona = puntos.filter((p) => p.zona === zona).sort((a, b) => a.anio * 100 + a.mes - (b.anio * 100 + b.mes));
      const ultimo = deLaZona[deLaZona.length - 1];
      if (!ultimo) return null;
      const mismoMes = deLaZona.filter((p) => p.mes === ultimo.mes);
      const promedio = mismoMes.reduce((acc, p) => acc + p.valor, 0) / mismoMes.length;
      return promedio !== 0 ? (ultimo.valor / promedio - 1) * 100 : null;
    }).filter((v): v is number => v !== null);
  }
  const anomaliasNdvi = anomaliaMensualPorZona(
    ndviCompleto.map((f) => ({ zona: f.zona, anio: f.anio, mes: f.mes, valor: f.ndvi_promedio }))
  );
  const anomaliasPrecip = anomaliaMensualPorZona(
    climaCompleto.map((f) => ({ zona: f.zona, anio: f.anio, mes: f.mes, valor: f.precipitacion_mm_dia }))
  );
  const ultimoMesNdvi = ndviCompleto.length ? Math.max(...ndviCompleto.map((f) => f.anio * 100 + f.mes)) : null;
  const ultimoMesPrecip = climaCompleto.length ? Math.max(...climaCompleto.map((f) => f.anio * 100 + f.mes)) : null;

  // ---- Cap. 4: La desregulación ---------------------------------------------
  const preciosOrdenados = [...preciosCompletos].sort((a, b) => a.anio - b.anio || a.mes - b.mes);
  const conIpcNacional = preciosOrdenados.filter((f) => f.ipc_nacional != null && f.precio_hoja_verde_ars != null);
  const ipcNacionalUltimo = conIpcNacional[conIpcNacional.length - 1]?.ipc_nacional ?? null;
  const FECHA_DNU_70_23 = { anio: 2023, mes: 12 };
  const esAntesDeDesregulacion = (anio: number, mes: number) =>
    anio < FECHA_DNU_70_23.anio || (anio === FECHA_DNU_70_23.anio && mes < FECHA_DNU_70_23.mes);
  const serieRealConMes = conIpcNacional.map((f) => ({
    anio: f.anio,
    mes: f.mes,
    valor: (f.precio_hoja_verde_ars as number) * ((ipcNacionalUltimo as number) / (f.ipc_nacional as number)),
  }));
  function variacionesMensuales(serie: typeof serieRealConMes): number[] {
    const out: number[] = [];
    for (let i = 1; i < serie.length; i++) {
      const anterior = serie[i - 1];
      const actual = serie[i];
      const mesEsperado = anterior.mes === 12 ? 1 : anterior.mes + 1;
      const anioEsperado = anterior.mes === 12 ? anterior.anio + 1 : anterior.anio;
      if (actual.mes !== mesEsperado || actual.anio !== anioEsperado) continue;
      const v = calcularVarPct(actual.valor, anterior.valor);
      if (v !== null) out.push(v);
    }
    return out;
  }
  function desviacionEstandar(valores: number[]): number | null {
    if (valores.length === 0) return null;
    const media = valores.reduce((a, b) => a + b, 0) / valores.length;
    const varianza = valores.reduce((acc, v) => acc + (v - media) ** 2, 0) / valores.length;
    return Math.sqrt(varianza);
  }
  const volatilidadPre = desviacionEstandar(variacionesMensuales(serieRealConMes.filter((f) => esAntesDeDesregulacion(f.anio, f.mes))));
  const volatilidadPost = desviacionEstandar(variacionesMensuales(serieRealConMes.filter((f) => !esAntesDeDesregulacion(f.anio, f.mes))));

  const corrientesOctubre2025 = hojaVerdeCompleta.find((f) => f.zona === "CORRIENTES" && f.anio === 2025 && f.mes === 10);
  const corrientesOctubreHistorico = hojaVerdeCompleta.filter(
    (f) => f.zona === "CORRIENTES" && (f.mes === 10 || f.mes === 11) && f.anio !== 2025
  );
  const corrientesOctubreMaxHistorico = corrientesOctubreHistorico.length
    ? Math.max(...corrientesOctubreHistorico.map((f) => f.hoja_verde_kg))
    : null;

  const ipcYerbaPorPeriodo = new Map<string, number>();
  for (const f of preciosOrdenados) {
    if (f.ipc_yerba_mate != null) ipcYerbaPorPeriodo.set(`${f.anio}-${f.mes}`, f.ipc_yerba_mate);
  }
  const sorpresas: number[] = [];
  for (const r of remInflacion) {
    const claveAnterior = r.mes === 1 ? `${r.anio - 1}-12` : `${r.anio}-${r.mes - 1}`;
    const actual = ipcYerbaPorPeriodo.get(`${r.anio}-${r.mes}`);
    const anterior = ipcYerbaPorPeriodo.get(claveAnterior);
    const varYerbaReal = calcularVarPct(actual, anterior);
    if (varYerbaReal !== null) sorpresas.push(varYerbaReal - r.rem_ipc_general_pct);
  }
  const promedioSorpresa = sorpresas.length ? sorpresas.reduce((a, b) => a + b, 0) / sorpresas.length : null;
  const pctMesesPorDebajo = sorpresas.length ? (sorpresas.filter((s) => s < 0).length / sorpresas.length) * 100 : null;

  // ---- Cap. 5: Consumo: un bien de necesidad --------------------------------
  const molinoAnual = agregarSalidaMolinoAnual(salidaMolinoCompleta);
  const emaePorAnio = new Map<number, number[]>();
  for (const f of salidaMolinoCompleta) {
    if (f.emae == null) continue;
    const arr = emaePorAnio.get(f.anio) ?? [];
    arr.push(f.emae);
    emaePorAnio.set(f.anio, arr);
  }
  const anosElasticidad = molinoAnual
    .filter((f) => esAnioCompleto(f.anio) && emaePorAnio.has(f.anio))
    .map((f) => ({
      anio: f.anio,
      interno_kg: f.interno_kg,
      emae: emaePorAnio.get(f.anio)!.reduce((a, b) => a + b, 0) / emaePorAnio.get(f.anio)!.length,
    }))
    .sort((a, b) => a.anio - b.anio);
  const yoyEmae: number[] = [];
  const yoyInterno: number[] = [];
  for (let i = 1; i < anosElasticidad.length; i++) {
    const vEmae = calcularVarPct(anosElasticidad[i].emae, anosElasticidad[i - 1].emae);
    const vInterno = calcularVarPct(anosElasticidad[i].interno_kg, anosElasticidad[i - 1].interno_kg);
    if (vEmae !== null && vInterno !== null) {
      yoyEmae.push(vEmae);
      yoyInterno.push(vInterno);
    }
  }
  function correlacionPearson(x: number[], y: number[]): number | null {
    const n = x.length;
    if (n < 2) return null;
    const mediaX = x.reduce((a, b) => a + b, 0) / n;
    const mediaY = y.reduce((a, b) => a + b, 0) / n;
    const cov = x.reduce((acc, v, i) => acc + (v - mediaX) * (y[i] - mediaY), 0);
    const desvX = Math.sqrt(x.reduce((acc, v) => acc + (v - mediaX) ** 2, 0));
    const desvY = Math.sqrt(y.reduce((acc, v) => acc + (v - mediaY) ** 2, 0));
    return desvX && desvY ? cov / (desvX * desvY) : null;
  }
  const correlacionEmaeConsumo = correlacionPearson(yoyEmae, yoyInterno);

  const conRipte = preciosOrdenados.filter((f) => f.ripte != null);
  const ripteUltimo = conRipte[conRipte.length - 1];
  const totalObservaciones = gondola.reduce((acc, f) => acc + f.n_observaciones, 0);
  const precioGondolaPromedio =
    totalObservaciones > 0
      ? gondola.reduce((acc, f) => acc + f.precio_ars_kg_promedio * f.n_observaciones, 0) / totalObservaciones
      : null;
  const kgComprablesHoy = ripteUltimo && precioGondolaPromedio ? ripteUltimo.ripte! / precioGondolaPromedio : null;

  // ---- Cap. 6: Comercio exterior --------------------------------------------
  const exportAnual = agregarExportacionesAnualNacional(exportAnualCompleta);
  const exportUltimo = exportAnual.find((f) => f.anio === ultimoAnio);
  const destinoCosechaColocado = (anualUltimo?.exportaciones_kg ?? 0) + (anualUltimo?.consumo_interno_kg ?? 0);
  const pctExportadoDeLoColocado =
    destinoCosechaColocado > 0 ? ((anualUltimo?.exportaciones_kg ?? 0) / destinoCosechaColocado) * 100 : null;

  // Año de referencia = ultimoAnio (año calendario completo, anclado al
  // comunicado INYM) -- NO el máximo año propio de ym.exportaciones_indec,
  // que puede incluir un 2026 parcial con muy pocos países reportados
  // todavía (HHI artificialmente inflado, verificado con SQL directo antes
  // de corregir esto: 2026 parcial daba HHI≈5228, 2025 completo da 6508,
  // ambos altos pero el parcial es un artefacto de cobertura, no realidad).
  const destinosDelAnio = agregarComexIndecPorPais(exportIndecCompleta, ultimoAnio);
  const concentracionExport = calcularConcentracion(destinosDelAnio.map((d) => d.porcentaje));
  const precioFobPorDestino = destinosDelAnio
    .filter((d) => d.volumen_kg > 0)
    .map((d) => ({ ...d, precio_fob_usd_kg: d.valor_fob_usd / d.volumen_kg }))
    .sort((a, b) => b.precio_fob_usd_kg - a.precio_fob_usd_kg);
  const destinoMasCaro = precioFobPorDestino[0];
  const siriaDestino = destinosDelAnio.find((d) => d.pais_nombre.toLowerCase().includes("siria"));

  const origenesDelAnio = agregarComexIndecPorPais(importIndecCompleta, ultimoAnio);
  const concentracionImport = calcularConcentracion(origenesDelAnio.map((d) => d.porcentaje));

  return (
    <main className="p-6 md:p-8">
      <PageHeader
        title="Hallazgos"
        description="Síntesis narrativa de los hallazgos reales del proyecto — regulación, consumo, geografía, comercio exterior, los 3 modelos predictivos y la integridad de los datos que los sostiene."
      />

      <div className="flex gap-8">
        <InsightsToc items={CHAPTERS} />

        <div className="flex-1 min-w-0">
          <InsightChapter id="panorama" numero="01" titulo="Panorama">
            <p>
              La plataforma sigue la cadena completa de la yerba mate argentina: cultivo, cosecha, industria, precios,
              comercio exterior y consumo. El último año con cierre real completo es <strong>{ultimoAnio}</strong>, con
              cifras confirmadas contra el comunicado oficial del INYM (no estimadas ni interpoladas — ver capítulo 8).
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <KpiCard
                label={`Producción ${ultimoAnio}`}
                value={anualUltimo?.produccion_kg != null ? formatMasaCompacta(anualUltimo.produccion_kg, "kg") : "s/d"}
                icon={Sprout}
                destacado
              />
              <KpiCard
                label={`Exportado ${ultimoAnio}`}
                value={exportUltimo?.volumen_kg != null ? formatMasaCompacta(exportUltimo.volumen_kg, "kg") : "s/d"}
                icon={Ship}
              />
              <KpiCard
                label={`Consumo interno ${ultimoAnio}`}
                value={anualUltimo?.consumo_interno_kg != null ? formatMasaCompacta(anualUltimo.consumo_interno_kg, "kg") : "s/d"}
                icon={Coffee}
              />
            </div>
            <p>
              Todo esto se cultiva sobre <strong>{formatNumero(totalSupZonas, 0)} hectáreas</strong> reales (INYM
              GeoServer) repartidas en 6 zonas productoras entre Misiones y Corrientes.
            </p>
          </InsightChapter>

          <InsightChapter id="geografia" numero="02" titulo="Geografía del cultivo">
            <p>
              La superficie cultivada no se reparte parejo entre las 6 zonas: el índice de concentración (HHI) da{" "}
              <strong>{concentracionGeografica ? Math.round(concentracionGeografica.hhi) : "s/d"}</strong>
              {" "}— moderadamente concentrado —, con{" "}
              <strong>{zonasPorSuperficie[0] ? etiquetaZona(zonasPorSuperficie[0].zona) : "s/d"}</strong> sola
              representando el{" "}
              {totalSupZonas > 0 && zonasPorSuperficie[0] ? formatPct((zonasPorSuperficie[0].sup_ym / totalSupZonas) * 100) : "s/d"}
              {" "}de la superficie real.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <KpiCard label="HHI geográfico (superficie)" value={concentracionGeografica ? String(Math.round(concentracionGeografica.hhi)) : "s/d"} icon={Gauge} />
              <KpiCard
                label={`Rendimiento nacional ${rendimientoUltimo?.anio ?? ""}`}
                value={rendimientoUltimo ? `${formatNumero(rendimientoUltimo.rendimiento_kg_ha, 0)} kg/ha` : "s/d"}
                icon={Sprout}
              />
            </div>
            <p>
              El rendimiento por hectárea es real (producción real / superficie real), no un promedio de manual —
              varía bastante año a año según la zona, ver el detalle por zona en Producción.
            </p>
            <Link href="/produccion" className="text-sm font-medium text-primary hover:underline">
              Ver el detalle completo en Producción →
            </Link>
          </InsightChapter>

          <InsightChapter id="clima" numero="03" titulo="Clima y vegetación">
            <p>
              La plataforma incorpora clima real (NASA POWER) y vegetación satelital (NDVI, MODIS) por zona —
              descriptivo, no predictivo: ya se probó como variable de pronóstico en el Modelo 1 de producción y{" "}
              <strong>no ayudó</strong> a predecir la cosecha (ver capítulo 7). Aun así, es contexto real sobre la
              condición actual del cultivo.
            </p>
            {anomaliasNdvi.length > 0 && (
              <p>
                En el último mes con dato disponible{ultimoMesNdvi ? ` (${String(ultimoMesNdvi).slice(0, 4)}-${String(ultimoMesNdvi).slice(4)})` : ""},
                las 6 zonas muestran vegetación{" "}
                <strong>{anomaliasNdvi.every((v) => v >= 0) ? "por encima" : "mixta respecto"}</strong> de su propio
                promedio histórico para ese mes calendario (entre {formatNumero(Math.min(...anomaliasNdvi), 1)}% y{" "}
                {formatNumero(Math.max(...anomaliasNdvi), 1)}%).
              </p>
            )}
            {anomaliasPrecip.length > 0 && (
              <p>
                La precipitación del último mes con dato
                {ultimoMesPrecip ? ` (${String(ultimoMesPrecip).slice(0, 4)}-${String(ultimoMesPrecip).slice(4)})` : ""}
                {" "}también corrió {anomaliasPrecip.every((v) => v >= 0) ? "por encima" : "de forma mixta respecto"} del
                promedio histórico del mismo mes, entre {formatNumero(Math.min(...anomaliasPrecip), 1)}% y{" "}
                {formatNumero(Math.max(...anomaliasPrecip), 1)}% según la zona.
              </p>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <KpiCard label="Anomalía NDVI (rango entre zonas)" value={anomaliasNdvi.length ? `${formatNumero(Math.min(...anomaliasNdvi), 1)}% a ${formatNumero(Math.max(...anomaliasNdvi), 1)}%` : "s/d"} icon={Sparkles} />
              <KpiCard label="Anomalía de lluvia (rango entre zonas)" value={anomaliasPrecip.length ? `${formatNumero(Math.min(...anomaliasPrecip), 1)}% a ${formatNumero(Math.max(...anomaliasPrecip), 1)}%` : "s/d"} icon={CloudRain} />
            </div>
            <Link href="/produccion" className="text-sm font-medium text-primary hover:underline">
              Ver el mapa de calor de clima y NDVI en Producción →
            </Link>
          </InsightChapter>

          <InsightChapter id="desregulacion" numero="04" titulo="La desregulación (2023-2026)">
            <p>
              Entre diciembre de 2023 y enero de 2026, el Estado se retiró progresivamente de la fijación de precios y
              regulación de la yerba mate: el <strong>DNU 70/23</strong> (dic-2023) le sacó al INYM la potestad de
              fijar precios; el <strong>Decreto 812/2025</strong> (nov-2025) le prohibió intervenir en el mercado; la{" "}
              <strong>Resolución 2/2026</strong> del INYM (ene-2026) eliminó la veda histórica de cosecha
              octubre-noviembre.
            </p>
            {corrientesOctubre2025 && corrientesOctubreMaxHistorico != null && (
              <p>
                Efecto real y verificable: en octubre de 2025 (antes incluso de que la veda se eliminara formalmente),
                Corrientes ingresó <strong>{formatMasa(corrientesOctubre2025.hoja_verde_kg, "kg")}</strong> de hoja
                verde — sin precedente en 14 años de octubre/noviembre, cuando el máximo histórico previo para esos
                meses en esa zona fue {formatMasa(corrientesOctubreMaxHistorico, "kg")}. Sugestivo, no concluyente
                (es un solo dato, la zona volvió a valores normales en noviembre).
              </p>
            )}
            <p>
              La volatilidad del precio real de la hoja verde subió tras el DNU 70/23:{" "}
              <strong>{volatilidadPre != null ? `±${formatNumero(volatilidadPre, 1)} p.p./mes` : "s/d"}</strong> antes
              vs. <strong>{volatilidadPost != null ? `±${formatNumero(volatilidadPost, 1)} p.p./mes` : "s/d"}</strong>{" "}
              después.
            </p>
            {promedioSorpresa != null && pctMesesPorDebajo != null && (
              <p>
                Y pese a la desregulación, la inflación real de la yerba corrió <strong>por debajo</strong> de lo que
                el mercado esperaba para la inflación general: en el {formatPct(pctMesesPorDebajo)} de los últimos
                meses comparables (sorpresa promedio {formatNumero(promedioSorpresa, 1)} p.p.), según la expectativa
                REM del BCRA.
              </p>
            )}
            <Link href="/precios" className="text-sm font-medium text-primary hover:underline">
              Ver precios, volatilidad y sorpresa inflacionaria completos →
            </Link>
          </InsightChapter>

          <InsightChapter id="consumo" numero="05" titulo="Consumo: un bien de necesidad">
            <p>
              El consumo interno de yerba mate se mueve poco con los ciclos económicos — comportamiento típico de un
              bien de necesidad cotidiana, no de un bien discrecional.
            </p>
            {correlacionEmaeConsumo != null && (
              <p>
                La correlación entre la variación año a año del consumo interno real (salida de molino) y del EMAE
                (nivel de actividad económica, INDEC) es <strong>r = {formatNumero(correlacionEmaeConsumo, 2)}</strong>{" "}
                — débil. En abril de 2020, con el EMAE en su piso del año por la cuarentena, el consumo interno de
                yerba fue el más alto del año.
              </p>
            )}
            <p>
              El Modelo 2 de Fase 5 (SARIMA, pronóstico de consumo interno) confirma el patrón: un modelo puramente
              estacional, sin salario real ni precio relativo como variables, ya predice con{" "}
              <ReliabilityBadge tipo="backtest" texto="MAPE 6,3% (backtest walk-forward, 60 meses)" /> — agregar esas
              variables macro no mejora el pronóstico.
            </p>
            {kgComprablesHoy != null && (
              <p>
                Poder de compra hoy: con 1 RIPTE (remuneración imponible promedio) se pueden comprar{" "}
                <strong>{formatNumero(kgComprablesHoy, 0)} kg</strong> de yerba al precio de góndola relevado.
              </p>
            )}
            <Link href="/cadena-productiva" className="text-sm font-medium text-primary hover:underline">
              Ver la correlación completa en Cadena Productiva →
            </Link>
          </InsightChapter>

          <InsightChapter id="comercio-exterior" numero="06" titulo="Comercio exterior">
            {pctExportadoDeLoColocado != null && (
              <p>
                Del volumen real efectivamente colocado en {ultimoAnio} (exportado + consumo interno), el{" "}
                <strong>{formatPct(pctExportadoDeLoColocado)}</strong> se exportó.
              </p>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <KpiCard label={`HHI destinos de exportación ${ultimoAnio}`} value={String(Math.round(concentracionExport.hhi))} icon={Globe2} />
              <KpiCard label={`HHI orígenes de importación ${ultimoAnio}`} value={String(Math.round(concentracionImport.hhi))} icon={Globe2} />
            </div>
            {destinoMasCaro && siriaDestino && (
              <p>
                No todos los mercados pagan lo mismo: en {ultimoAnio}, {destinoMasCaro.pais_nombre} pagó{" "}
                <strong>US$ {formatNumero(destinoMasCaro.precio_fob_usd_kg, 2)}/kg</strong>, muy por encima de Siria
                (US$ {formatNumero(siriaDestino.valor_fob_usd / siriaDestino.volumen_kg, 2)}/kg) — el mayor comprador
                histórico, pero no el que mejor paga.
              </p>
            )}
            <p>
              El Modelo 3 de Fase 5 (regresión gravitacional, 20 países) explica por qué: PBI del país destino y
              distancia a Buenos Aires son significativos con el signo esperado, pero el hallazgo más fuerte es un{" "}
              <strong>efecto diáspora</strong> — Siria y Líbano importan{" "}
              <ReliabilityBadge tipo="backtest" texto="≈120x más volumen del que predice la gravedad económica (R²=0,42)" />, por
              migración histórica, no por poder adquisitivo ni cercanía.
            </p>
            <Link href="/exportaciones" className="text-sm font-medium text-primary hover:underline">
              Ver exportaciones e importaciones completas →
            </Link>
          </InsightChapter>

          <InsightChapter id="modelos-ml" numero="07" titulo="Los 3 modelos predictivos — síntesis">
            <p>
              Fase 5 construyó 3 modelos de pronóstico (producción por zona, consumo interno, exportaciones por
              país) — todos v1, todos con un mismo patrón repetido: las variables macro &quot;obvias&quot; casi nunca
              ayudan.
            </p>
            <ul className="list-disc pl-5 space-y-2">
              <li>
                <strong>Modelo 1 (producción por zona)</strong>: baseline SARIMA estacional,{" "}
                <ReliabilityBadge tipo="backtest" texto="MAE 20-30% del promedio histórico por zona" /> — clima y NDVI
                probados dos veces como exógenas, empeoran el pronóstico en las 6 zonas.
              </li>
              <li>
                <strong>Modelo 2 (consumo interno)</strong>: <ReliabilityBadge tipo="backtest" texto="MAPE 6,3%" /> —
                el más preciso de los 3 — salario real y precio relativo tampoco ayudan.
              </li>
              <li>
                <strong>Modelo 3 (exportaciones)</strong>: regresión gravitacional, explica bien la estructura del
                comercio (R²=0,42) pero pronostica mal el volumen exacto por país (
                <ReliabilityBadge tipo="backtest" texto="MAPE 145%" />) — tipo de cambio tampoco resultó significativo.
              </li>
            </ul>
            <p>
              Conclusión práctica: para estas series, un modelo estacional simple compite de igual a igual (o gana)
              contra modelos con más variables macro — la complejidad no se traduce en mejor pronóstico.
            </p>
            <Link href="/predicciones" className="text-sm font-medium text-primary hover:underline">
              Ver los 3 modelos con sus pronósticos completos →
            </Link>
          </InsightChapter>

          <InsightChapter id="integridad-datos" numero="08" titulo="Integridad de los datos">
            <p>
              En julio se descubrió que buena parte del dataset original (siete CSV sin fuente primaria documentada)
              tenía datos fabricados: el desglose <strong>mensual</strong> de producción/consumo/exportaciones era
              100% sintético (correlación de estacionalidad de 1,000 exacto entre todos los pares de años posibles),
              el año <strong>2025 completo estaba clonado byte a byte de 2024</strong>, y varios tramos de superficie
              cultivada eran interpolación lineal perfecta.
            </p>
            <p>
              Los totales anuales, en cambio, sí eran reales — se verificaron contra el scraper propio de reportes
              del INYM y contra comunicados oficiales. Se saneó reemplazando cada dato fabricado por <code>NULL</code>{" "}
              (nunca un relleno inventado, ver reglas de datos del repo) y cargando fuentes reales alternativas donde
              se encontraron (INDEC Comercio Exterior para exportaciones/importaciones mensuales, scraper de PDFs del
              INYM para hoja verde y salida de molino).
            </p>
            <p>
              Resultado: antes de la auditoría, el campo de producción {ultimoAnio} mostraba un valor clonado de{" "}
              {ultimoAnio - 1}; hoy muestra{" "}
              <strong>{anualUltimo?.produccion_kg != null ? formatMasa(anualUltimo.produccion_kg, "kg") : "s/d"}</strong>{" "}
              real, confirmado contra el comunicado oficial del INYM.
            </p>
          </InsightChapter>

          <InsightChapter id="sintesis" numero="09" titulo="Síntesis">
            <p>Lo más importante de todo lo anterior, en una sola lista:</p>
            <ul className="list-disc pl-5 space-y-2">
              <li>La yerba mate es un bien de necesidad: su consumo casi no se mueve con los ciclos económicos.</li>
              <li>
                La desregulación 2023-2026 subió la volatilidad del precio real, pero la yerba corre por debajo de la
                inflación general esperada por el mercado.
              </li>
              <li>Siria importa ~120x más de lo que predice su PBI y distancia — puro efecto diáspora, no economía.</li>
              <li>
                En los 3 modelos de Fase 5, las variables macro &quot;obvias&quot; (clima, NDVI, salario, tipo de
                cambio) no mejoran el pronóstico — un baseline estacional simple compite de igual a igual.
              </li>
              <li>
                Buena parte del dataset original estaba fabricado (mensual sintético, 2025 clonado) — ya saneado y
                reemplazado por fuentes reales, documentado en detalle.
              </li>
            </ul>
            <div className="flex flex-wrap gap-3 pt-2">
              <Link href="/produccion" className="text-sm font-medium text-primary hover:underline">Producción →</Link>
              <Link href="/precios" className="text-sm font-medium text-primary hover:underline">Precios →</Link>
              <Link href="/exportaciones" className="text-sm font-medium text-primary hover:underline">Exportaciones →</Link>
              <Link href="/cadena-productiva" className="text-sm font-medium text-primary hover:underline">Cadena Productiva →</Link>
              <Link href="/predicciones" className="text-sm font-medium text-primary hover:underline">Predicciones →</Link>
            </div>
          </InsightChapter>

          <FooterFuentes
            tablas={[
              "ym.dataset_principal_anual",
              "ym.exportaciones_anual",
              "ym.exportaciones_indec",
              "ym.importaciones_indec",
              "ym.inym_hoja_verde_zona",
              "ym.inym_salida_molino",
              "ym.superficie_productores",
              "ym.precios",
              "ym.precios_gondola",
              "ym.indec_series",
              "ym.bcra_rem",
              "ym.ndvi_mensual",
              "ym.clima_zona_mensual",
              "ym.ml_predicciones",
            ]}
          />
        </div>
      </div>
    </main>
  );
}
