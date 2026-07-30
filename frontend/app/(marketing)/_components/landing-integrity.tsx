import Image from "next/image";
import styles from "../landing.module.css";

function CheckCircleGold() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="#B99456" strokeWidth={1.3}>
      <circle cx="12" cy="12" r="9" />
      <path d="M8.5 12.2l2.4 2.4 4.6-5.2" />
    </svg>
  );
}

const FUENTES = ["INYM", "INDEC", "BCRA", "GeoServer INYM"];

export function LandingIntegrity() {
  return (
    <section id="datos" className={styles.datosSection}>
      <div className={styles.integrity}>
        <div className={styles.integrityMedia}>
          <Image src="/images/hand-yerba.jpg" alt="Yerba mate canchada recién elaborada" fill quality={85} />
        </div>
        <div className={styles.integrityText}>
          <span className={styles.eyebrow}>Integridad de datos</span>
          <h2>Si el dato no está verificado, no lo mostramos como si lo estuviera.</h2>
          <p>
            Cada cifra de esta plataforma es trazable a su fuente oficial. Los períodos sin información confirmada se
            muestran explícitamente como tales — nunca rellenados, nunca estimados sin marcarlo.
          </p>
          <div className={styles.seal}>
            <CheckCircleGold />
            <div className={styles.sealText}>
              <b>Auditoría permanente:</b> cada serie pasa controles de duplicados, interpolaciones y valores
              fabricados antes de publicarse.
            </div>
          </div>
          <div className={styles.sourceTags}>
            {FUENTES.map((f) => (
              <span key={f} className={styles.sourceTag}>
                {f}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
