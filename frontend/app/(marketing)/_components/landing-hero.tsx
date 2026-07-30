import Image from "next/image";
import Link from "next/link";
import styles from "../landing.module.css";

export interface HeroStat {
  value: string;
  label: string;
}

function CheckCircle() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="#3FA65C" strokeWidth={2}>
      <circle cx="12" cy="12" r="9" />
      <path d="M8.5 12.2l2.4 2.4 4.6-5.2" />
    </svg>
  );
}

function LeafIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth={1.6}>
      <path d="M12 2C9 6 6 9 6 13a6 6 0 0012 0c0-4-3-7-6-11z" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth={1.6}>
      <path d="M3 12h18M12 3v18" />
    </svg>
  );
}

export function LandingHero({ stats, statsSonFallback }: { stats: HeroStat[]; statsSonFallback: boolean }) {
  return (
    // statsSonFallback: ver nota en app/(marketing)/page.tsx -- si el fetch al
    // backend real falla, se muestran valores de respaldo pero queda marcado
    // acá (visible en el HTML fuente, no en la UI) para no romper fidelidad
    // visual del diseño aprobado con un badge de advertencia no contemplado.
    <header className={styles.hero} data-stats-fallback={statsSonFallback || undefined}>
      <Image
        src="/images/hero-yerbal.jpg"
        alt="Yerbal en Misiones-Corrientes, Argentina"
        fill
        priority
        quality={88}
        className={styles.heroImg}
      />
      <div className={styles.heroScrim} />
      <div className={styles.heroCredit}>Yerbal · Misiones–Corrientes, AR</div>
      <div className={styles.heroInner}>
        <div className={styles.heroCopy}>
          <h1>
            Datos que no se estiman.
            <br />
            Se verifican.
          </h1>
          <p className={styles.heroSub}>
            Producción, consumo, comercialización y exportaciones de yerba mate en Argentina, integradas en un solo
            sistema con mapas geoespaciales y modelos predictivos.
          </p>
          <div className={styles.heroActions}>
            <Link href="/dashboard" className={styles.btnPrimary}>
              Ingresar a la plataforma →
            </Link>
            <Link href="#datos" className={styles.btnGhost}>
              Cómo garantizamos los datos
            </Link>
          </div>
        </div>

        <div className={styles.heroStats}>
          {stats.map((s) => (
            <div key={s.label}>
              <div className={styles.hstatValue}>{s.value}</div>
              <div className={styles.hstatLabel}>{s.label}</div>
            </div>
          ))}
        </div>
        <div className={styles.heroBadge}>
          <CheckCircle />
          Cada cifra trazable a INYM, INDEC o BCRA
        </div>
      </div>

      <div className={styles.heroCornerIcons}>
        <div className={styles.cornerIcon}>
          <LeafIcon />
        </div>
        <div className={styles.cornerIcon}>
          <PlusIcon />
        </div>
      </div>
    </header>
  );
}
