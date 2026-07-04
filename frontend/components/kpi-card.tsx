import { ArrowDownRight, ArrowUpRight, type LucideIcon } from "lucide-react";

interface KpiCardProps {
  label: string;
  value: string;
  icon: LucideIcon;
  deltaPct?: number;
  deltaLabel?: string;
}

export function KpiCard({ label, value, icon: Icon, deltaPct, deltaLabel }: KpiCardProps) {
  const positivo = (deltaPct ?? 0) >= 0;
  return (
    <div className="rounded-xl border border-border bg-card p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-muted-foreground">{label}</span>
        <span className="flex items-center justify-center size-8 rounded-lg bg-primary/10 text-primary">
          <Icon size={16} aria-hidden="true" />
        </span>
      </div>
      <div className="text-2xl font-semibold tabular-nums text-card-foreground">{value}</div>
      {deltaPct !== undefined && (
        <div
          className={`flex items-center gap-1 text-xs font-medium ${
            positivo ? "text-primary" : "text-destructive"
          }`}
        >
          {positivo ? (
            <ArrowUpRight size={14} aria-hidden="true" />
          ) : (
            <ArrowDownRight size={14} aria-hidden="true" />
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
