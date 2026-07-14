import type { ReactNode } from "react";

interface ChartCardProps {
  title: string;
  description?: ReactNode;
  children: ReactNode;
  className?: string;
}

// Contenedor estándar para gráficos/tablas — reemplaza el
// `<div className="rounded-xl border...">` que se repetía a mano en cada
// página. Un solo lugar para el tratamiento visual (radio, sombra, hover).
export function ChartCard({ title, description, children, className = "" }: ChartCardProps) {
  return (
    <div className={`rounded-2xl border border-border bg-card p-5 shadow-sm hover:shadow-md transition-shadow duration-200 ${className}`}>
      {/* Tokens A4: título 600/15px, subtítulo 400/12px gris -- únicos valores de la app, no repetir a mano por card. */}
      <h2 className="text-[15px] font-semibold text-card-foreground mb-1">{title}</h2>
      {description && <p className="text-xs font-normal text-muted-foreground mb-3">{description}</p>}
      {children}
    </div>
  );
}
