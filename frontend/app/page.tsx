import Link from "next/link";
import {
  Sprout,
  Coffee,
  Ship,
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
import { formatKg, formatNumero } from "@/lib/format";
import { getProduccion, getConsumo } from "@/lib/api";
import { agregarProduccionPorCiudad } from "@/lib/agregaciones";

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
  { href: "/precios", label: "Precios", descripcion: "Hoja verde y canchada", icon: DollarSign, disponible: true },
  { href: "/competencia", label: "Competencia", descripcion: "Cuotas de mercado por empresa", icon: Users, disponible: true },
  { href: "/cadena-productiva", label: "Cadena Productiva", descripcion: "Hoja verde por zona y salida de molino", icon: Factory, disponible: true },
  { href: "/predicciones", label: "ML / Predicciones", descripcion: "Modelos y horizonte de pronóstico", icon: Brain, disponible: false },
  { href: "/mapa-gis", label: "Mapa GIS", descripcion: "Capas geoespaciales del INYM", icon: Map, disponible: true },
];

export default async function ResumenPage() {
  const [produccion, consumo] = await Promise.all([getProduccion(), getConsumo()]);

  const ultimoAnio = Math.max(...produccion.map((f) => f.anio));
  const produccionUltimoAnio = produccion.filter((f) => f.anio === ultimoAnio);
  const totalProduccionUltimoAnio = produccionUltimoAnio.reduce((acc, f) => acc + f.produccion_kg, 0);
  const totalExportadoUltimoAnio = produccionUltimoAnio.reduce((acc, f) => acc + f.exportaciones_kg, 0);
  const precioPromedioUltimoAnio =
    produccionUltimoAnio.reduce((acc, f) => acc + f.precio_usd_kg, 0) / produccionUltimoAnio.length;
  const ciudadLider = agregarProduccionPorCiudad(produccion, ultimoAnio)[0];
  const consumoPerCapitaUltimoAnio = consumo.find((f) => f.anio === ultimoAnio)?.consumo_per_capita_kg;

  return (
    <main className="p-6 md:p-8">
      <PageHeader
        title="Resumen"
        description="Plataforma de inteligencia de datos sobre la industria yerbatera argentina."
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <KpiCard label={`Producción ${ultimoAnio}`} value={formatKg(totalProduccionUltimoAnio)} icon={Sprout} />
        <KpiCard
          label={`Consumo per cápita ${ultimoAnio}`}
          value={consumoPerCapitaUltimoAnio != null ? `${formatNumero(consumoPerCapitaUltimoAnio, 2)} kg` : "Sin dato"}
          icon={Coffee}
        />
        <KpiCard label={`Exportado ${ultimoAnio}`} value={formatKg(totalExportadoUltimoAnio)} icon={Ship} />
        <KpiCard label="Precio promedio USD/kg" value={formatNumero(precioPromedioUltimoAnio, 2)} icon={DollarSign} />
      </div>

      <p className="text-sm text-muted-foreground mb-3">
        Principal zona productora: <span className="font-medium text-foreground">{ciudadLider.ciudad}</span> ({ciudadLider.provincia})
      </p>

      <h2 className="text-sm font-semibold text-foreground mt-8 mb-3">Secciones</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {SECCIONES.map(({ href, label, descripcion, icon: Icon, disponible }) => (
          <Link
            key={href}
            href={href}
            className="group rounded-xl border border-border bg-card p-4 flex items-start gap-3 transition-colors duration-150 hover:border-primary"
          >
            <span className="flex items-center justify-center size-9 rounded-lg bg-primary/10 text-primary shrink-0">
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
              className="text-muted-foreground shrink-0 mt-1 transition-transform duration-150 group-hover:translate-x-0.5 group-hover:text-primary"
              aria-hidden="true"
            />
          </Link>
        ))}
      </div>
    </main>
  );
}
