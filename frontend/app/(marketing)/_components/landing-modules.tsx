import Link from "next/link";
import styles from "../landing.module.css";

interface Modulo {
  numero: string;
  titulo: string;
  descripcion: string;
  href: string;
  tag?: string;
}

const MODULOS: Modulo[] = [
  {
    numero: "01 — Origen",
    titulo: "Producción",
    descripcion: "Ingreso de hoja verde por zona, rendimiento por hectárea y distribución geográfica sobre el mapa productivo.",
    href: "/produccion",
  },
  {
    numero: "02 — Mercado interno",
    titulo: "Consumo",
    descripcion: "Consumo per cápita, mezcla de envases y evolución del mercado doméstico desde 2011.",
    href: "/consumo",
  },
  {
    numero: "03 — Actores",
    titulo: "Competencia",
    descripcion: "Cuotas de mercado por empresa, concentración del sector e histórico de marcas y grupos yerbateros.",
    href: "/competencia",
  },
  {
    numero: "04 — Comercio exterior",
    titulo: "Exportaciones",
    descripcion: "Volumen y valor FOB por país de destino, flujos comerciales y balanza con Brasil y Paraguay.",
    href: "/exportaciones",
  },
  {
    numero: "05 — Territorio",
    titulo: "Mapa GIS",
    descripcion: "Capas oficiales del INYM: superficie cultivada, edad de plantación, densidad y ubicación de secaderos.",
    href: "/mapa-gis",
  },
  {
    numero: "06 — Proyección",
    titulo: "ML / Predicciones",
    descripcion: "Modelos de corto plazo para producción, consumo y exportación, con variables climáticas y económicas.",
    href: "/predicciones",
    tag: "Próximamente",
  },
];

export function LandingModules() {
  return (
    <div className={styles.modules}>
      {MODULOS.map((m) => (
        <Link
          key={m.href}
          href={m.href}
          className={`${styles.module} ${m.tag ? styles.moduleComingSoon : ""}`}
        >
          {m.tag && <span className={styles.moduleTag}>{m.tag}</span>}
          <span className={styles.moduleNum}>{m.numero}</span>
          <h3>{m.titulo}</h3>
          <p>{m.descripcion}</p>
        </Link>
      ))}
    </div>
  );
}
