import { FileQuestion } from "lucide-react";

interface NoDataProps {
  /** "kpi": "—" chico con tooltip del motivo, para el `value` de un KpiCard
   * (nunca el texto "Sin dato" en tipografía héroe). "chart": ícono + mensaje
   * centrado, para gráficos/tablas 100% vacíos con los filtros actuales. */
  variant?: "kpi" | "chart";
  /** Motivo del dato faltante -- tooltip en "kpi", cuerpo del mensaje en "chart". */
  motivo?: string;
  className?: string;
}

const MOTIVO_DEFAULT_KPI = "Sin dato disponible para este período.";
const MOTIVO_DEFAULT_CHART = "Sin datos publicados para este período.";

// Único componente de "sin dato" de toda la app (ver Fase 9, A6) -- antes
// cada página tenía su propio ternario `valor != null ? formato(valor) :
// "Sin dato"`, que en un KpiCard renderiza "Sin dato" en texto de 3xl/bold
// (misma tipografía que un valor real), como si la plataforma estuviera
// rota. Acá el vacío se comunica a una escala visual mucho más chica.
export function NoData({ variant = "kpi", motivo, className = "" }: NoDataProps) {
  if (variant === "kpi") {
    // Opacidad completa a propósito (Fase 9, D3): /70 daba 3,59:1 contra
    // --color-card, por debajo del mínimo AA -- el guion es la única lectura
    // de esa celda (reemplaza un valor real), no puede ser menos legible
    // que cualquier otro texto secundario de la app.
    return (
      <span title={motivo ?? MOTIVO_DEFAULT_KPI} className={`cursor-help text-muted-foreground ${className}`}>
        —
      </span>
    );
  }
  return (
    <div className={`flex flex-col items-center justify-center gap-2 py-10 text-center text-sm text-muted-foreground ${className}`}>
      <FileQuestion size={26} className="text-muted-foreground/50" aria-hidden="true" />
      <p>{motivo ?? MOTIVO_DEFAULT_CHART}</p>
    </div>
  );
}
