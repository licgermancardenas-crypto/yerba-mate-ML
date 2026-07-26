"use client";

import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { GRID_COLOR, AXIS_TICK_STYLE, CHART_ORANGE, tipoCurva } from "@/components/charts/chart-theme";
import { formatNumero } from "@/lib/format";

export interface PuntoRemTipoCambio {
  etiqueta: string;
  valor: number;
}

interface RemTipoCambioTooltipProps {
  active?: boolean;
  payload?: { payload?: PuntoRemTipoCambio }[];
}

function RemTipoCambioTooltip({ active, payload }: RemTipoCambioTooltipProps) {
  if (!active || !payload?.length) return null;
  const punto = payload[0]?.payload;
  if (!punto) return null;
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 shadow-lg">
      <div className="text-xs text-muted-foreground mb-0.5">Encuesta {punto.etiqueta}</div>
      <div className="text-sm font-semibold tabular-nums text-card-foreground">${formatNumero(punto.valor, 0)}</div>
    </div>
  );
}

export function RemTipoCambioChart({
  data,
  tcCongeladoModelo,
  tcRealParcial,
  anioProyeccion,
}: {
  data: PuntoRemTipoCambio[];
  tcCongeladoModelo: number;
  tcRealParcial: number | null;
  anioProyeccion: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
        <CartesianGrid stroke={GRID_COLOR} vertical={false} />
        <XAxis dataKey="etiqueta" tick={AXIS_TICK_STYLE} tickLine={false} axisLine={{ stroke: GRID_COLOR }} />
        <YAxis tick={AXIS_TICK_STYLE} tickLine={false} axisLine={false} width={56} tickFormatter={(v) => `$${formatNumero(v, 0)}`} />
        <ReferenceLine
          y={tcCongeladoModelo}
          stroke="var(--color-warning)"
          strokeDasharray="4 4"
          label={{ value: `Supuesto del modelo ($${formatNumero(tcCongeladoModelo, 0)})`, position: "insideTopLeft", fontSize: 11, fill: "var(--color-warning)" }}
        />
        {tcRealParcial != null && (
          <ReferenceLine
            y={tcRealParcial}
            stroke="var(--color-primary)"
            strokeDasharray="4 4"
            label={{ value: `Real ${anioProyeccion} parcial ($${formatNumero(tcRealParcial, 0)})`, position: "insideBottomLeft", fontSize: 11, fill: "var(--color-primary)" }}
          />
        )}
        <Tooltip content={<RemTipoCambioTooltip />} cursor={{ stroke: "var(--color-muted-foreground)", strokeDasharray: "3 3" }} />
        <Line
          type={tipoCurva(data.length)}
          dataKey="valor"
          stroke={CHART_ORANGE}
          strokeWidth={2}
          dot={{ r: 3, fill: CHART_ORANGE }}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
