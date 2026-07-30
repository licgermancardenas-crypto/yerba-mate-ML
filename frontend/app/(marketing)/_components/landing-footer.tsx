import styles from "../landing.module.css";

// El selector ".landing footer" del módulo CSS ya alcanza este <footer>
// porque page.tsx envuelve toda la landing en un <div className={styles.landing}>
// -- no hace falta (ni corresponde) aplicar la clase acá de nuevo.
export function LandingFooter() {
  return (
    <footer>
      <div className={styles.footBrand}>Yerba Mate Intelligence</div>
      <div className={styles.footLinks}>
        <span>Fuentes: INYM · INDEC · BCRA</span>
        <span>Datos 2011 — 2026</span>
        <span>Plataforma independiente de análisis de datos</span>
      </div>
    </footer>
  );
}
