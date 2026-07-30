import Link from "next/link";
import styles from "../landing.module.css";

export function LandingFinalCta() {
  return (
    <section className={styles.finalCta}>
      <span className={styles.eyebrow}>Acceso libre</span>
      <h2 style={{ marginTop: 18 }}>Explorá la industria yerbatera argentina, dato por dato.</h2>
      <Link href="/dashboard" className={styles.btnPrimary}>
        Ingresar a la plataforma →
      </Link>
    </section>
  );
}
