// 'ZONA CENTRO' -> 'CENTRO', etc. -- ym.inym_hoja_verde_zona (fuente real)
// usa el prefijo "ZONA " salvo en Corrientes; ym.ml_predicciones (salida del
// Modelo 1) ya guarda el nombre limpio -- ver backend/ml/build_panel_modelo1.py.
// Extraído de app/predicciones/page.tsx (2do consumidor real: la tabla de
// calor por zona de Cadena Productiva) para no duplicar el mapeo.
export const ZONA_RAW_A_LIMPIA: Record<string, string> = {
  "ZONA CENTRO": "CENTRO",
  "ZONA NORESTE": "NORESTE",
  "ZONA NOROESTE": "NOROESTE",
  "ZONA OESTE": "OESTE",
  "ZONA SUR": "SUR",
  CORRIENTES: "CORRIENTES",
};

export const ZONAS = ["CENTRO", "CORRIENTES", "NORESTE", "NOROESTE", "OESTE", "SUR"] as const;

/** "CENTRO" -> "Centro" para mostrar en UI (selectores, títulos de chart). */
export function etiquetaZona(zona: string): string {
  return zona.charAt(0) + zona.slice(1).toLowerCase();
}
