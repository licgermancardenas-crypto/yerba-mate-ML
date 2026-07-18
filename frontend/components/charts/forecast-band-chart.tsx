"use client";

import { Area, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { GRID_COLOR, AXIS_TICK_STYLE } from "@/components/charts/chart-theme";

export interface PuntoForecast {
  etiqueta: string;
  /** Histórico real (línea sólida) o, en el ajustado-vs-real de Modelo 3, el dato real de ese país-año. */
  real?: number | null;
  /** Pronóstico/proyección futura, o el valor ajustado por el modelo (línea punteada). */
  predicho?: number | null;
  icInferior?: number | null;
  icSuperior?: number | null;
}

interface ForecastBandChartProps {
  data: PuntoForecast[];
  color?: string;
  suffix?: string;
  numberFormat?: Intl.NumberFormatOptions;
}

interface DatoInterno extends PuntoForecast {
  banda?: number;
}

function ForecastTooltip({
  active,
  payload,
  label,
  color,
  formatear,
}: {
  active?: boolean;
  payload?: { payload?: DatoInterno }[];
  label?: string;
  color: string;
  formatear: (v: number) => string;
}) {
  if (!active || !payload?.length) return null;
  const punto = payload[0]?.payload;
  if (!punto) return null;
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 shadow-lg min-w-[170px]">
      <div className="text-xs text-muted-foreground mb-1">{label}</div>
      <div className="flex flex-col gap-1 text-xs">
        {punto.real != null && (
          <div className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-1.5 text-card-foreground">
              <span className="inline-block w-3 h-0.5 rounded-full" style={{ backgroundColor: color }} />
              Real
            </span>
            <span className="font-semibold tabular-nums text-card-foreground">{formatear(punto.real)}</span>
          </div>
        )}
        {punto.predicho != null && (
          <div className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-1.5 text-card-foreground">
              <span
                className="inline-block w-3 h-0.5 rounded-full"
                style={{ backgroundColor: color, backgroundImage: `repeating-linear-gradient(90deg, ${color} 0 3px, transparent 3px 5px)` }}
              />
              Predicho
            </span>
            <span className="font-semibold tabular-nums text-card-foreground">{formatear(punto.predicho)}</span>
          </div>
        )}
        {punto.icInferior != null && punto.icSuperior != null && (
          <div className="text-muted-foreground pt-1 border-t border-border mt-0.5">
            IC 95%: {formatear(punto.icInferior)} – {formatear(punto.icSuperior)}
          </div>
        )}
      </div>
    </div>
  );
}

/** Histórico (línea sólida) + pronóstico/ajustado (línea punteada) + banda de
 * confianza (Area apilada: una invisible hasta icInferior, una visible con
 * la delta icSuperior-icInferior encima -- el truco estándar de Recharts
 * para bandas de intervalo, ver Fase 5 /predicciones). Puntos sin IC quedan
 * con un hueco real en la banda (no se inventa un intervalo), mismo criterio
 * que el resto de los charts de esta app con `connectNulls={false}`. */
export function ForecastBandChart({ data, color = "var(--color-primary)", suffix = "", numberFormat }: ForecastBandChartProps) {
  const formatear = (v: number) => `${new Intl.NumberFormat("es-AR", numberFormat).format(v)}${suffix}`;
  const datos: DatoInterno[] = data.map((d) => ({
    ...d,
    banda: d.icInferior != null && d.icSuperior != null ? d.icSuperior - d.icInferior : undefined,
  }));

  return (
    <ResponsiveContainer width="100%" height={280}>
      <ComposedChart data={datos} margin={{ top: 16, right: 16, bottom: 0, left: 0 }}>
        <CartesianGrid stroke={GRID_COLOR} vertical={false} />
        <XAxis dataKey="etiqueta" tick={AXIS_TICK_STYLE} tickLine={false} axisLine={{ stroke: GRID_COLOR }} />
        <YAxis tick={AXIS_TICK_STYLE} tickLine={false} axisLine={false} width={84} tickFormatter={(v) => formatear(v)} />
        <Tooltip content={<ForecastTooltip color={color} formatear={formatear} />} />
        <Area dataKey="icInferior" stackId="ic" stroke="none" fill="transparent" isAnimationActive={false} connectNulls={false} />
        <Area
          dataKey="banda"
          stackId="ic"
          stroke="none"
          fill={color}
          fillOpacity={0.15}
          isAnimationActive={false}
          connectNulls={false}
        />
        <Line type="monotone" dataKey="real" stroke={color} strokeWidth={2} dot={false} isAnimationActive={false} connectNulls={false} />
        <Line
          type="monotone"
          dataKey="predicho"
          stroke={color}
          strokeWidth={2}
          strokeDasharray="5 4"
          dot={false}
          isAnimationActive={false}
          connectNulls={false}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
