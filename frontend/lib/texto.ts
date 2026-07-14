// El INYM y el INDEC no siempre escriben igual un mismo nombre geográfico
// ("OBERA" sin tilde vs. "Oberá") — se normaliza (sin acentos, mayúsculas)
// para poder cruzar ambas fuentes sin depender de la grafía exacta.
const DIACRITICOS = new RegExp("[\\u0300-\\u036f]", "g");

export function normalizar(s: string): string {
  return s.normalize("NFD").replace(DIACRITICOS, "").toUpperCase().trim();
}

export function tituloCase(s: string): string {
  return s.toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase());
}

// Abreviaturas curadas para nombres de departamentos/ciudades largos en
// ejes de gráfico angostos (ver Fase 9, C2) -- "Libertador General San
// Martín" nunca entra en un tick de 150px, pero "Lib. Gral. San Martín" sí.
// Se aplican ANTES de truncar con elipsis, así el recorte final es sobre
// texto ya corto en vez de cortar a la mitad una palabra clave.
const ABREVIATURAS_GEO: [RegExp, string][] = [
  [/\bLibertador\b/gi, "Lib."],
  [/\bGeneral\b/gi, "Gral."],
  [/\bGobernador\b/gi, "Gob."],
  [/\bComandante\b/gi, "Cte."],
  [/\bCoronel\b/gi, "Cnel."],
  [/\bPresidente\b/gi, "Pte."],
];

export function abreviarNombreGeografico(s: string): string {
  return ABREVIATURAS_GEO.reduce((acc, [patron, reemplazo]) => acc.replace(patron, reemplazo), s);
}
