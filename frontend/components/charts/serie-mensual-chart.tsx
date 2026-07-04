"use client";

import { useId, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ReferenceDot,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { BarChart3, LineChart as LineChartIcon } from "lucide-react";

const GRID_COLOR = "#e2e8e4";
const TICK_COLOR = "#64748b";

interface SerieMensualChartProps {
  data: { etiqueta: string; valor: number }[];
  color?: string;
  prefix?: string;
  suffix?: string;
  numberFormat?: Intl.NumberFormatOptions;
}

function ChartTooltip({
  active,
  payload,
  label,
  color,
  formatear,
}: {
  active?: boolean;
  payload?: { value?: number }[];
  label?: string;
  color: string;
  formatear: (v: number) => string;
}) {
  if (!active || !payload?.length) return null;
  const valor = payload[0]?.value;
  if (valor === undefined) return null;
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 shadow-lg">
      <div className="text-xs text-muted-foreground mb-0.5">{label}</div>
      <div className="flex items-center gap-1.5">
        <span className="inline-block w-3 h-0.5 rounded-full" style={{ backgroundColor: color }} />
        <span className="text-sm font-semibold tabular-nums text-card-foreground">{formatear(valor)}</span>
      </div>
    </div>
  );
}

export function SerieMensualChart({ data, color = "#15803d", prefix = "", suffix = "", numberFormat }: SerieMensualChartProps) {
  const [tipo, setTipo] = useState<"linea" | "barra">("linea");
  const gradientId = useId();
  const formatear = (v: number) => `${prefix}${new Intl.NumberFormat("es-AR", numberFormat).format(v)}${suffix}`;
  const ultimo = data[data.length - 1];

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-1 self-end rounded-lg border border-border bg-muted p-1">
        <button
          type="button"
          aria-label="Ver como línea"
          onClick={() => setTipo("linea")}
          className={`flex items-center justify-center size-6 rounded-md transition-colors ${
            tipo === "linea" ? "bg-card text-primary shadow-sm" : "text-muted-foreground hover:text-card-foreground"
          }`}
        >
          <LineChartIcon size={14} aria-hidden="true" />
        </button>
        <button
          type="button"
          aria-label="Ver como barras"
          onClick={() => setTipo("barra")}
          className={`flex items-center justify-center size-6 rounded-md transition-colors ${
            tipo === "barra" ? "bg-card text-primary shadow-sm" : "text-muted-foreground hover:text-card-foreground"
          }`}
        >
          <BarChart3 size={14} aria-hidden="true" />
        </button>
      </div>

      <ResponsiveContainer width="100%" height={280}>
        {tipo === "linea" ? (
          <AreaChart data={data} margin={{ top: 16, right: 16, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.18} />
                <stop offset="100%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke={GRID_COLOR} vertical={false} />
            <XAxis
              dataKey="etiqueta"
              tick={{ fontSize: 12, fill: TICK_COLOR }}
              tickLine={false}
              axisLine={{ stroke: GRID_COLOR }}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fontSize: 12, fill: TICK_COLOR }}
              tickLine={false}
              axisLine={false}
              width={56}
              tickFormatter={(v) => formatear(v)}
            />
            <Tooltip content={<ChartTooltip color={color} formatear={formatear} />} cursor={{ stroke: GRID_COLOR, strokeWidth: 1 }} />
            <Area
              type="monotone"
              dataKey="valor"
              stroke={color}
              strokeWidth={2}
              fill={`url(#${gradientId})`}
              dot={false}
              activeDot={{ r: 5, fill: color, stroke: "#ffffff", strokeWidth: 2 }}
              isAnimationActive={false}
            />
            {ultimo && (
              <ReferenceDot
                x={ultimo.etiqueta}
                y={ultimo.valor}
                r={4}
                fill={color}
                stroke="#ffffff"
                strokeWidth={2}
                label={{ value: formatear(ultimo.valor), position: "top", fill: "#14532d", fontSize: 12, fontWeight: 600 }}
              />
            )}
          </AreaChart>
        ) : (
          <BarChart data={data} margin={{ top: 16, right: 16, bottom: 0, left: 0 }}>
            <CartesianGrid stroke={GRID_COLOR} vertical={false} />
            <XAxis
              dataKey="etiqueta"
              tick={{ fontSize: 12, fill: TICK_COLOR }}
              tickLine={false}
              axisLine={{ stroke: GRID_COLOR }}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fontSize: 12, fill: TICK_COLOR }}
              tickLine={false}
              axisLine={false}
              width={56}
              tickFormatter={(v) => formatear(v)}
            />
            <Tooltip content={<ChartTooltip color={color} formatear={formatear} />} cursor={{ fill: color, fillOpacity: 0.06 }} />
            <Bar dataKey="valor" fill={color} radius={[4, 4, 0, 0]} maxBarSize={24} isAnimationActive={false} />
          </BarChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}
