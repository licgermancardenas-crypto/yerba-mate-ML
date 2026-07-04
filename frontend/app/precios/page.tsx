import { DollarSign, Leaf, Factory } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { KpiCard } from "@/components/kpi-card";
import { FilterBar } from "@/components/filter-bar";
import { SerieMensualChart } from "@/components/charts/serie-mensual-chart";
import { HistoricalTable } from "@/components/historical-table";
import type { ColumnaTabla } from "@/components/data-table";
import { formatNumero } from "@/lib/format";
import { getPrecios } from "@/lib/api";
import { agregarPreciosAnual, type PrecioAnualRow } from "@/lib/agregaciones";
import type { PrecioRow } from "@/lib/types";

const COLUMNAS_ANUAL: ColumnaTabla<PrecioAnualRow>[] = [
  { key: "anio", label: "Año", align: "left" },
  { key: "precio_hoja_verde_ars_promedio", label: "Hoja verde prom. (ARS/kg)", align: "right", format: "ars" },
  { key: "precio_canchada_ars_promedio", label: "Canchada prom. (ARS/kg)", align: "right", format: "ars" },
];

const COLUMNAS_MENSUAL: ColumnaTabla<PrecioRow>[] = [
  { key: "anio", label: "Año", align: "left" },
  { key: "mes_nombre", label: "Mes", align: "left" },
  { key: "precio_hoja_verde_ars", label: "Hoja verde (ARS/kg)", align: "right", format: "ars" },
  { key: "precio_canchada_ars", label: "Canchada (ARS/kg)", align: "right", format: "ars" },
];

const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

function formatArsKg(valor: number): string {
  return `$${formatNumero(valor, 2)}/kg`;
}

export default async function PreciosPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const sp = await searchParams;
  const anioDesde = Number(sp.anio_desde) || undefined;
  const anioHasta = Number(sp.anio_hasta) || undefined;

  const filasCompletas = await getPrecios();
  const todosLosAnios = Array.from(new Set(filasCompletas.map((f) => f.anio))).sort((a, b) => a - b);

  const filas = filasCompletas.filter(
    (f) => (!anioDesde || f.anio >= anioDesde) && (!anioHasta || f.anio <= anioHasta)
  );
  const ordenadas = [...filas].sort((a, b) => a.anio - b.anio || a.mes - b.mes);

  if (ordenadas.length === 0) {
    return (
      <main className="p-6 md:p-8">
        <PageHeader title="Precios" description="Serie histórica de precio de hoja verde y canchada (ARS/kg)." />
        <FilterBar anios={todosLosAnios} />
        <p className="text-sm text-muted-foreground">Sin datos para los filtros seleccionados.</p>
      </main>
    );
  }

  const ultima = ordenadas[ordenadas.length - 1];
  const haceUnAnio = ordenadas.find((f) => f.anio === ultima.anio - 1 && f.mes === ultima.mes);

  const deltaHojaVerde =
    ultima.precio_hoja_verde_ars != null && haceUnAnio?.precio_hoja_verde_ars
      ? ((ultima.precio_hoja_verde_ars - haceUnAnio.precio_hoja_verde_ars) / haceUnAnio.precio_hoja_verde_ars) * 100
      : undefined;
  const deltaCanchada =
    ultima.precio_canchada_ars != null && haceUnAnio?.precio_canchada_ars
      ? ((ultima.precio_canchada_ars - haceUnAnio.precio_canchada_ars) / haceUnAnio.precio_canchada_ars) * 100
      : undefined;

  const relacion =
    ultima.precio_canchada_ars && ultima.precio_hoja_verde_ars
      ? ultima.precio_canchada_ars / ultima.precio_hoja_verde_ars
      : null;

  const etiqueta = (f: (typeof ordenadas)[number]) => `${MESES[f.mes - 1].slice(0, 3)} ${String(f.anio).slice(2)}`;

  const serieHojaVerde = ordenadas
    .filter((f) => f.precio_hoja_verde_ars != null)
    .map((f) => ({ etiqueta: etiqueta(f), valor: f.precio_hoja_verde_ars as number }));
  const serieCanchada = ordenadas
    .filter((f) => f.precio_canchada_ars != null)
    .map((f) => ({ etiqueta: etiqueta(f), valor: f.precio_canchada_ars as number }));

  const anualHistorico = agregarPreciosAnual(filas);
  const mensualHistorico = [...ordenadas].reverse();

  return (
    <main className="p-6 md:p-8">
      <PageHeader
        title="Precios"
        description="Serie histórica de precio de hoja verde y canchada (ARS/kg)."
      />

      <FilterBar anios={todosLosAnios} />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <KpiCard
          label={`Hoja verde ${MESES[ultima.mes - 1]} ${ultima.anio}`}
          value={ultima.precio_hoja_verde_ars != null ? formatArsKg(ultima.precio_hoja_verde_ars) : "Sin dato"}
          icon={Leaf}
          deltaPct={deltaHojaVerde}
          deltaLabel="vs. año anterior"
        />
        <KpiCard
          label={`Canchada ${MESES[ultima.mes - 1]} ${ultima.anio}`}
          value={ultima.precio_canchada_ars != null ? formatArsKg(ultima.precio_canchada_ars) : "Sin dato"}
          icon={Factory}
          deltaPct={deltaCanchada}
          deltaLabel="vs. año anterior"
        />
        <KpiCard
          label="Relación canchada / hoja verde"
          value={relacion != null ? `${formatNumero(relacion, 2)}x` : "Sin dato"}
          icon={DollarSign}
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className="rounded-xl border border-border bg-card p-4">
          <h2 className="text-sm font-semibold text-card-foreground mb-1">Precio hoja verde</h2>
          <p className="text-xs text-muted-foreground mb-3">ARS/kg, serie completa</p>
          <SerieMensualChart data={serieHojaVerde} color="#15803d" prefix="$" suffix="/kg" numberFormat={{ minimumFractionDigits: 2, maximumFractionDigits: 2 }} />
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <h2 className="text-sm font-semibold text-card-foreground mb-1">Precio canchada</h2>
          <p className="text-xs text-muted-foreground mb-3">ARS/kg, serie completa</p>
          <SerieMensualChart data={serieCanchada} color="#a16207" prefix="$" suffix="/kg" numberFormat={{ minimumFractionDigits: 2, maximumFractionDigits: 2 }} />
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-border bg-card p-4">
        <h2 className="text-sm font-semibold text-card-foreground mb-1">Histórico completo</h2>
        <p className="text-xs text-muted-foreground mb-3">
          Desde {anualHistorico[anualHistorico.length - 1]?.anio} hasta {ultima.anio}. El promedio anual ignora meses sin precio publicado por el INYM.
        </p>
        <HistoricalTable
          columnasAnual={COLUMNAS_ANUAL}
          filasAnual={anualHistorico}
          columnasMensual={COLUMNAS_MENSUAL}
          filasMensual={mensualHistorico}
        />
      </div>
    </main>
  );
}
