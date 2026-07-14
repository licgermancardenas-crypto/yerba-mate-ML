"use client";

import { RadialBar, RadialBarChart, PolarAngleAxis, ResponsiveContainer } from "recharts";
import { formatNumero } from "@/lib/format";

interface GaugeRadialProps {
  /** 0-100. Se clampea a ese rango. */
  valorPct: number;
  /** Texto en el centro del gauge. Por defecto, valorPct redondeado + "%". */
  displayValue?: string;
  color: string;
}

// Pieza cliente mínima (solo props serializables: numbers/strings) — el
// ícono y el resto del layout de GaugeCard se renderizan en el server,
// porque un componente de ícono (función) no puede pasarse como prop a un
// Client Component a través del límite de RSC.
export function GaugeRadial({ valorPct, displayValue, color }: GaugeRadialProps) {
  const valor = Math.min(Math.max(valorPct, 0), 100);
  const data = [{ valor }];

  return (
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
        <span className="text-2xl font-bold tabular-nums text-card-foreground">{displayValue ?? `${formatNumero(valor, 0)}%`}</span>
      </div>
    </div>
  );
}
