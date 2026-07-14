import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { DeltaBadge } from "@/components/delta-badge";

interface KpiCardProps {
  label: string;
  /** String formateado, o `<NoData variant="kpi" />` cuando no hay dato (ver Fase 9, A6). */
  value: ReactNode;
  icon: LucideIcon;
  deltaPct?: number;
  deltaLabel?: string;
  /** Tarjeta "hero" con fondo verde sólido — usar en 1 KPI por página como máximo, para jerarquía visual. */
  destacado?: boolean;
  /** Valor sin notación compacta, para el tooltip nativo cuando `value` viene compactado (ej. "889,3 M kg" -> "889.253.083 kg"). */
  valorExacto?: string;
  /** Dato secundario chico debajo del valor principal (ej. un índice cuando el héroe es su variación, ver Fase 9 D1) -- no reemplaza a `deltaPct`. */
  secundario?: ReactNode;
}

export function KpiCard({ label, value, icon: Icon, deltaPct, deltaLabel, destacado = false, valorExacto, secundario }: KpiCardProps) {
  if (destacado) {
    return (
      <div className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary to-[#0d3d1f] p-5 flex flex-col gap-3 shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200">
        <div
          className="pointer-events-none absolute -right-6 -top-6 size-28 rounded-full bg-white/10"
          aria-hidden="true"
        />
        <div className="relative flex items-center justify-between">
          <span className="text-sm font-medium text-white/80">{label}</span>
          <span className="flex items-center justify-center size-11 rounded-full bg-white/15 text-white shrink-0">
            <Icon size={18} aria-hidden="true" />
          </span>
        </div>
        <div className="relative text-3xl font-bold tabular-nums text-white" title={valorExacto}>
          {value}
        </div>
        {secundario && <div className="relative text-xs text-white/70">{secundario}</div>}
        {deltaPct !== undefined && (
          <DeltaBadge valor={deltaPct} base={deltaLabel ?? ""} sobreFondoOscuro className="relative self-start" />
        )}
      </div>
    );
  }

  return (
    <div className="group rounded-2xl border border-border bg-card p-5 flex flex-col gap-3 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-muted-foreground">{label}</span>
        <span className="flex items-center justify-center size-11 rounded-full bg-primary/10 text-primary ring-4 ring-primary/5 transition-colors duration-200 group-hover:bg-primary group-hover:text-on-primary">
          <Icon size={18} aria-hidden="true" />
        </span>
      </div>
      <div className="text-3xl font-bold tabular-nums text-card-foreground" title={valorExacto}>
        {value}
      </div>
      {secundario && <div className="text-xs text-muted-foreground">{secundario}</div>}
      {deltaPct !== undefined && <DeltaBadge valor={deltaPct} base={deltaLabel ?? ""} className="self-start" />}
    </div>
  );
}
