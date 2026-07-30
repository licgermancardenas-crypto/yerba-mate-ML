import Image from "next/image";
import styles from "../landing.module.css";

function SproutIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth={2}>
      <path d="M12 2C9 6 6 9 6 13a6 6 0 0012 0c0-4-3-7-6-11z" />
    </svg>
  );
}
function FactoryIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth={2}>
      <path d="M3 12h18M12 3v18" />
    </svg>
  );
}
function MapIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth={2}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 3v18M3 12h18" />
    </svg>
  );
}

const CARDS = [
  {
    titulo: "Producción",
    descripcion: "Superficie cultivada, edad de plantación e ingreso de hoja verde por zona.",
    img: "/images/hero-yerbal.jpg",
    alt: "Producción de yerba mate en Misiones",
    Icon: SproutIcon,
  },
  {
    titulo: "Cadena productiva",
    descripcion: "Del secadero al molino: elaboración, mezcla de envases y destino del producto.",
    img: "/images/hand-yerba.jpg",
    alt: "Yerba mate canchada recién elaborada",
    Icon: FactoryIcon,
  },
  {
    titulo: "Territorio",
    descripcion: "Capas oficiales del INYM: cultivo, densidad y secaderos, sobre mapa real.",
    img: "/images/territorio-mapa-satelital.jpg",
    alt: "Vista satelital del mapa de cultivos GIS",
    Icon: MapIcon,
  },
];

export function LandingPhotoCards() {
  return (
    <div className={styles.photoCards}>
      {CARDS.map(({ titulo, descripcion, img, alt, Icon }) => (
        <div key={titulo} className={styles.photoCard}>
          <Image src={img} alt={alt} fill quality={85} />
          <div className={styles.pcScrim} />
          <div className={styles.pcBadge}>
            <Icon />
          </div>
          <div className={styles.pcText}>
            <h4>{titulo}</h4>
            <p>{descripcion}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
