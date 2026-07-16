// Tokens visuales compartidos por todos los charts de Recharts de la app
// (ver Fase 9, A4) -- antes GRID_COLOR/TICK_COLOR estaban duplicados
// literal en 5 archivos, cada uno podía desviarse sin que se notara.

// var() en vez de hex fijo -- Recharts resuelve custom properties CSS en sus
// props de color (soporte nativo del navegador), así que estos tokens se
// adaptan solos al modo oscuro sin lógica de tema en cada chart.
export const GRID_COLOR = "var(--chart-grid)";
export const TICK_COLOR = "var(--color-muted-foreground)";

/** Series sin token semántico propio (IPC, rankings) -- ver globals.css para
 * los valores claro/oscuro de cada uno. */
export const CHART_BLUE = "var(--chart-blue)";
export const CHART_PURPLE = "var(--chart-purple)";
export const CHART_ORANGE = "var(--chart-orange)";

/** Tamaño de fuente de eje (A4: "Ejes: 11px"). */
export const AXIS_TICK_SIZE = 11;

export const AXIS_TICK_STYLE = { fontSize: AXIS_TICK_SIZE, fill: TICK_COLOR };

/** Curva lineal para series con pocos puntos (menos de ~24) -- un
 * "monotone"/"basis" interpola una forma suave que no existe en los datos
 * reales cuando hay pocos puntos (ver Fase 9, C5: el promedio mensual de
 * hoja verde con 12 puntos no debería verse como una curva suave). Series
 * densas (24+ puntos, ej. mensual multi-año) sí se benefician de monotone
 * para legibilidad. */
export function tipoCurva(n: number): "linear" | "monotone" {
  return n < 24 ? "linear" : "monotone";
}
