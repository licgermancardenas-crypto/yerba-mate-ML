import type { LucideIcon } from "lucide-react";
import { GaugeRadial } from "@/components/gauge-radial";

interface GaugeCardProps {
  label: string;
  /** 0-100. Se clampea a ese rango. */
  valorPct: number;
  /** Texto en el centro del gauge. Por defecto, valorPct redondeado + "%". */
  displayValue?: string;
  icon?: LucideIcon;
  color?: string;
  descripcion?: string;
}

// Gauge circular (no dona completa: arranca a las 12 y da 3/4 de vuelta) para
// KPIs 0-100%, en vez de mostrar el número plano. Server Component: el ícono
// se renderiza acá (no puede pasarse como prop a GaugeRadial, que es cliente).
export function GaugeCard({ label, valorPct, displayValue, icon: Icon, color = "var(--color-primary)", descripcion }: GaugeCardProps) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm hover:shadow-md transition-shadow duration-200 flex flex-col items-center">
      <div className="flex items-center gap-1.5 self-start mb-1">
        {Icon && <Icon size={14} className="text-muted-foreground" aria-hidden="true" />}
        <span className="text-sm font-medium text-muted-foreground">{label}</span>
      </div>
      <GaugeRadial valorPct={valorPct} displayValue={displayValue} color={color} />
      {descripcion && <p className="text-xs text-muted-foreground text-center mt-1">{descripcion}</p>}
    </div>
  );
}
