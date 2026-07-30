import Link from "next/link";
import styles from "../landing.module.css";

// Ícono placeholder del isotype -- la marca todavía no tiene logo definitivo
// (se está iterando aparte). Una hoja simple, fácil de reemplazar por el
// isotype real sin tocar el resto del nav.
function LeafPlaceholder() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="#F4EFE4" strokeWidth={1.4}>
      <path d="M12 2C9 6 6 9 6 13a6 6 0 0012 0c0-4-3-7-6-11z" />
    </svg>
  );
}

function ChevronDown() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

export function LandingNav() {
  return (
    <nav className={styles.nav}>
      <div className={styles.navBrand}>
        <LeafPlaceholder />
        <span>Yerba Mate Intelligence</span>
      </div>
      <div className={styles.navMenu}>
        <Link href="#modulos">
          Producción <ChevronDown />
        </Link>
        <Link href="#modulos">
          Comercio exterior <ChevronDown />
        </Link>
        <Link href="#datos">Datos y fuentes</Link>
        <Link href="#modulos">Mapa GIS</Link>
      </div>
      <div className={styles.navRight}>
        <Link href="#datos" className={styles.navSignin}>
          Fuentes
        </Link>
        <Link href="/dashboard" className={styles.navCta}>
          Ingresar a la plataforma
        </Link>
      </div>
    </nav>
  );
}
