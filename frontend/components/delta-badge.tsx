import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { formatPct } from "@/lib/format";

interface DeltaBadgeProps {
  /** Variación en puntos porcentuales. `null`/`undefined` no renderiza nada (ver <NoData> para el caso "sin dato"). */
  valor: number | null | undefined;
  /** Base de comparación, siempre visible: "vs. 2024", "vs. dic-2024 (i.a.)". */
  base: string;
  /** Fondo oscuro (cards héroe con gradiente) -- mismo signo de color, ajustado para contraste. */
  sobreFondoOscuro?: boolean;
  className?: string;
}

// Único componente de badge de variación de toda la app (ver Fase 9, A2).
// Regla de neutralidad: se redondea a la misma precisión que se muestra
// (1 decimal, igual que formatPct) ANTES de decidir signo/flecha -- así un
// "+0,03%" que se ve como "+0,0%" en pantalla no muestra una flecha que
// contradice el número redondeado. Cero real (o que redondea a cero) es
// gris sin flecha, nunca verde con flecha ascendente.
export function DeltaBadge({ valor, base, sobreFondoOscuro = false, className = "" }: DeltaBadgeProps) {
  if (valor == null || !Number.isFinite(valor)) return null;

  const redondeado = Math.round(valor * 10) / 10;
  const esNeutro = redondeado === 0;
  const esPositivo = redondeado > 0;

  // bg-primary/10 y bg-destructive/10 daban 4,39:1 y 4,14:1 (verificado con
  // la fórmula WCAG real, no a ojo) -- por debajo del mínimo AA de 4,5:1
  // para texto normal. /6 y /3 respectivamente dan >=4,6:1 sin cambiar de
  // manera perceptible el look del pill (ver Fase 9, D3).
  const pillClase = sobreFondoOscuro
    ? "bg-white/15 text-white"
    : esNeutro
      ? "bg-muted text-muted-foreground"
      : esPositivo
        ? "bg-primary/6 text-primary"
        : "bg-destructive/3 text-destructive";

  const iconoClase = sobreFondoOscuro ? (esPositivo ? "text-emerald-300" : "text-red-300") : "";

  return (
    <div className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${pillClase} ${className}`}>
      {!esNeutro &&
        (esPositivo ? (
          <ArrowUpRight size={13} className={iconoClase} aria-hidden="true" />
        ) : (
          <ArrowDownRight size={13} className={iconoClase} aria-hidden="true" />
        ))}
      <span>
        {esPositivo ? "+" : ""}
        {formatPct(valor)} {base}
      </span>
    </div>
  );
}
