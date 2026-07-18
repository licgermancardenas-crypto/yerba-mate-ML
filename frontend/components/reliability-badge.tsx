import { Info, TriangleAlert } from "lucide-react";

interface ReliabilityBadgeProps {
  /** Ej. "MAPE 6,3% (backtest walk-forward, 60 meses)" o "PBI congelado en 2022 (último real conocido)". */
  texto: string;
  /** "backtest": nota neutra de precisión medida. "supuesto": aclara que el valor asume algo que no es un dato real (ej. PBI futuro). */
  tipo: "backtest" | "supuesto";
  className?: string;
}

// Único badge de confiabilidad/supuesto de /predicciones -- mismo criterio
// de pill que <DeltaBadge> (Fase 9, A2), pero esto no es una variación, es
// una nota de método -- no debe poder confundirse con un delta verde/rojo.
// "supuesto" usa --color-warning (agregado 2026-07-18, contraste WCAG
// verificado >=6:1 en ambos temas) -- distinto de --color-destructive
// (implica error) y de los pills neutros de "backtest".
export function ReliabilityBadge({ texto, tipo, className = "" }: ReliabilityBadgeProps) {
  const pillClase = tipo === "supuesto" ? "bg-warning/10 text-warning" : "bg-muted text-muted-foreground";
  const Icono = tipo === "supuesto" ? TriangleAlert : Info;

  return (
    <div className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${pillClase} ${className}`}>
      <Icono size={13} aria-hidden="true" className="shrink-0" />
      <span>{texto}</span>
    </div>
  );
}
