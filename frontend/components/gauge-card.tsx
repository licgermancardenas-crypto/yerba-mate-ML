"use client";

import { RadialBar, RadialBarChart, PolarAngleAxis, ResponsiveContainer } from "recharts";
import type { LucideIcon } from "lucide-react";

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
// KPIs 0-100%, en vez de mostrar el número plano — ver referencias de diseño
// (dashboards con gauges radiales) pedidas 2026-07-05.
export function GaugeCard({ label, valorPct, displayValue, icon: Icon, color = "var(--color-primary)", descripcion }: GaugeCardProps) {
  const valor = Math.min(Math.max(valorPct, 0), 100);
  const data = [{ valor }];

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm hover:shadow-md transition-shadow duration-200 flex flex-col items-center">
      <div className="flex items-center gap-1.5 self-start mb-1">
        {Icon && <Icon size={14} className="text-muted-foreground" aria-hidden="true" />}
        <span className="text-sm font-medium text-muted-foreground">{label}</span>
      </div>
      <div className="relative w-full h-[128px]">
        <ResponsiveContainer width="100%" height="100%">
          <RadialBarChart data={data} innerRadius="72%" outerRadius="100%" startAngle={90} endAngle={-270} barSize={11}>
            <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
            <RadialBar
              dataKey="valor"
              cornerRadius={10}
              fill={color}
              background={{ fill: "var(--color-muted)" }}
              isAnimationActive={false}
            />
          </RadialBarChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-2xl font-bold tabular-nums text-card-foreground">{displayValue ?? `${valor.toFixed(0)}%`}</span>
        </div>
      </div>
      {descripcion && <p className="text-xs text-muted-foreground text-center mt-1">{descripcion}</p>}
    </div>
  );
}
