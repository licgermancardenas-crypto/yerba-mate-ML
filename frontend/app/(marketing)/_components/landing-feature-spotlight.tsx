import Image from "next/image";
import Link from "next/link";
import styles from "../landing.module.css";

export function LandingFeatureSpotlight() {
  return (
    <div className={styles.featureSpotlight}>
      <div className={styles.fsTop}>
        <div className={styles.fsText}>
          <span className={styles.eyebrow}>Módulo geoespacial</span>
          <h3>Mapa GIS interactivo, capa por capa.</h3>
          <p>
            20+ capas oficiales del INYM — superficie cultivada, edad de plantación, densidad y ubicación de 203
            secaderos — sobre un mapa navegable en tiempo real.
          </p>
        </div>
        <Link href="/mapa-gis" className={styles.fsCta}>
          Explorar el mapa →
        </Link>
      </div>

      <div className={styles.fsMainImg}>
        <Image
          src="/images/mapa-gis-coropletico.jpg"
          alt="Vista del Mapa GIS de la plataforma, capa de superficie cultivada por departamento"
          width={1600}
          height={1000}
          quality={88}
        />
      </div>
      <div className={styles.fsThumbs}>
        <div className={styles.fsThumb}>
          <Image src="/images/thumb-competencia.jpg" alt="Panel de Competencia y cuotas de mercado" fill quality={80} />
        </div>
        <div className={styles.fsThumb}>
          <Image src="/images/thumb-mapa-secaderos.jpg" alt="Vista satelital de secaderos en el mapa" fill quality={80} />
        </div>
      </div>
      <div className={styles.fsSpacer} />
    </div>
  );
}
