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
