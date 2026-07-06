import { ArrowDownRight, ArrowUpRight, type LucideIcon } from "lucide-react";

interface KpiCardProps {
  label: string;
  value: string;
  icon: LucideIcon;
  deltaPct?: number;
  deltaLabel?: string;
  /** Tarjeta "hero" con fondo verde sólido — usar en 1 KPI por página como máximo, para jerarquía visual. */
  destacado?: boolean;
}

export function KpiCard({ label, value, icon: Icon, deltaPct, deltaLabel, destacado = false }: KpiCardProps) {
  const positivo = (deltaPct ?? 0) >= 0;

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
        <div className="relative text-3xl font-bold tabular-nums text-white">{value}</div>
        {deltaPct !== undefined && (
          <div className="relative inline-flex items-center gap-1 self-start rounded-full bg-white/15 px-2 py-0.5 text-xs font-semibold text-white">
            {positivo ? <ArrowUpRight size={13} aria-hidden="true" /> : <ArrowDownRight size={13} aria-hidden="true" />}
            <span>
              {positivo ? "+" : ""}
              {deltaPct.toFixed(1)}% {deltaLabel}
            </span>
          </div>
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
      <div className="text-3xl font-bold tabular-nums text-card-foreground">{value}</div>
      {deltaPct !== undefined && (
        <div
          className={`inline-flex items-center gap-1 self-start rounded-full px-2 py-0.5 text-xs font-semibold ${
            positivo ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive"
          }`}
        >
          {positivo ? (
            <ArrowUpRight size={13} aria-hidden="true" />
          ) : (
            <ArrowDownRight size={13} aria-hidden="true" />
          )}
          <span>
            {positivo ? "+" : ""}
            {deltaPct.toFixed(1)}% {deltaLabel}
          </span>
        </div>
      )}
    </div>
  );
}
