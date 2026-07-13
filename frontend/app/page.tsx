import Link from "next/link";
import {
  Sprout,
  Coffee,
  Ship,
  Package,
  DollarSign,
  Users,
  Brain,
  Map,
  Factory,
  ArrowRight,
  type LucideIcon,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { KpiCard } from "@/components/kpi-card";
import { FilterBar } from "@/components/filter-bar";
import { FooterFuentes } from "@/components/footer-fuentes";
import { formatKg, formatNumero } from "@/lib/format";
import { getProduccionAnualReal, getConsumo } from "@/lib/api";
import { agregarProduccionAnualNacional, agregarProduccionPorCiudad } from "@/lib/agregaciones";

const SECCIONES: {
  href: string;
  label: string;
  descripcion: string;
  icon: LucideIcon;
  disponible: boolean;
}[] = [
  { href: "/produccion", label: "Producción", descripcion: "Serie mensual y por ciudad productora", icon: Sprout, disponible: true },
  { href: "/consumo", label: "Consumo", descripcion: "Per cápita y mix de envases", icon: Coffee, disponible: true },
  { href: "/exportaciones", label: "Exportaciones", descripcion: "Volumen y FOB por país destino", icon: Ship, disponible: true },
  { href: "/importaciones", label: "Importaciones", descripcion: "Volumen mensual importado y balanza comercial", icon: Package, disponible: true },
  { href: "/precios", label: "Precios", descripcion: "Hoja verde y canchada", icon: DollarSign, disponible: true },
  { href: "/competencia", label: "Competencia", descripcion: "Cuotas de mercado por empresa", icon: Users, disponible: true },
  { href: "/cadena-productiva", label: "Cadena Productiva", descripcion: "Hoja verde por zona y salida de molino", icon: Factory, disponible: true },
  { href: "/predicciones", label: "ML / Predicciones", descripcion: "Modelos y horizonte de pronóstico", icon: Brain, disponible: false },
  { href: "/mapa-gis", label: "Mapa GIS", descripcion: "Capas geoespaciales del INYM", icon: Map, disponible: true },
];

export default async function ResumenPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const sp = await searchParams;
  const [produccionAnualReal, consumo] = await Promise.all([getProduccionAnualReal(), getConsumo()]);

  const todosLosAnios = Array.from(new Set(produccionAnualReal.map((f) => f.anio))).sort((a, b) => a - b);
  const anioSeleccionado = Number(sp.anio_hasta) || Math.max(...todosLosAnios);

  const anualNacional = agregarProduccionAnualNacional(produccionAnualReal).find((f) => f.anio === anioSeleccionado);
  const totalProduccionUltimoAnio = anualNacional?.produccion_kg ?? null;
  const totalExportadoUltimoAnio = anualNacional?.exportaciones_kg ?? null;
  const precioPromedioUltimoAnio = anualNacional?.precio_usd_kg_promedio ?? null;
  const ciudadLider = agregarProduccionPorCiudad(produccionAnualReal, anioSeleccionado)[0];
  const consumoPerCapitaUltimoAnio = consumo.find((f) => f.anio === anioSeleccionado)?.consumo_per_capita_kg;

  return (
    <main className="p-6 md:p-8">
      <PageHeader
        title="Resumen"
        description="Plataforma de inteligencia de datos sobre la industria yerbatera argentina."
      />

      <FilterBar anios={todosLosAnios} anioUnico />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <KpiCard label={`Producción ${anioSeleccionado}`} value={totalProduccionUltimoAnio != null ? formatKg(totalProduccionUltimoAnio) : "Sin dato"} icon={Sprout} destacado />
        <KpiCard
          label={`Consumo per cápita ${anioSeleccionado}`}
          value={consumoPerCapitaUltimoAnio != null ? `${formatNumero(consumoPerCapitaUltimoAnio, 2)} kg` : "Sin dato"}
          icon={Coffee}
        />
        <KpiCard label={`Exportado ${anioSeleccionado}`} value={totalExportadoUltimoAnio != null ? formatKg(totalExportadoUltimoAnio) : "Sin dato"} icon={Ship} />
        <KpiCard label="Precio promedio USD/kg" value={precioPromedioUltimoAnio != null ? formatNumero(precioPromedioUltimoAnio, 2) : "Sin dato"} icon={DollarSign} />
      </div>

      {ciudadLider && (
        <p className="text-sm text-muted-foreground mb-3">
          Principal zona productora: <span className="font-medium text-foreground">{ciudadLider.ciudad}</span> ({ciudadLider.provincia})
        </p>
      )}

      <h2 className="text-sm font-semibold text-foreground mt-8 mb-3">Secciones</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {SECCIONES.map(({ href, label, descripcion, icon: Icon, disponible }) => (
          <Link
            key={href}
            href={href}
            className="group rounded-2xl border border-border bg-card p-4 flex items-start gap-3 shadow-sm transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 hover:border-primary/40"
          >
            <span className="flex items-center justify-center size-10 rounded-full bg-primary/10 text-primary shrink-0 ring-4 ring-primary/5 transition-colors duration-200 group-hover:bg-primary group-hover:text-on-primary">
              <Icon size={18} aria-hidden="true" />
            </span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium text-card-foreground">{label}</span>
                {!disponible && (
                  <span className="text-[10px] font-medium uppercase tracking-wide text-accent bg-accent/10 rounded px-1.5 py-0.5">
                    Próximamente
                  </span>
                )}
              </div>
              <p className="text-sm text-muted-foreground mt-0.5">{descripcion}</p>
            </div>
            <ArrowRight
              size={16}
              className="text-muted-foreground shrink-0 mt-1 transition-transform duration-200 group-hover:translate-x-1 group-hover:text-primary"
              aria-hidden="true"
            />
          </Link>
        ))}
      </div>

      <FooterFuentes tablas={["ym.dataset_principal_anual", "ym.consumo_interno"]} />
    </main>
  );
}
