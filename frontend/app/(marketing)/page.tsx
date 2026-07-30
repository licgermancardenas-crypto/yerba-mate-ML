import styles from "./landing.module.css";
import { LandingNav } from "./_components/landing-nav";
import { LandingHero, type HeroStat } from "./_components/landing-hero";
import { getProduccionAnualReal, getGeoLayerAtributos } from "@/lib/api";

const ANIO_STATS = 2025;

// Fallback si el backend no responde -- mismos valores que ya estaban
// verificados a mano en la spec aprobada (comunicado oficial INYM 02/02/2026,
// ver docs/auditoria_datos.md), NO se usan a menos que el fetch real falle.
const STATS_FALLBACK: HeroStat[] = [
  { value: "889,3 M kg", label: `Producción nacional ${ANIO_STATS}, hoja verde a secadero` },
  { value: "57,98 M kg", label: `Exportado en ${ANIO_STATS} — récord histórico` },
  { value: "203 plantas", label: "Secaderos geolocalizados sobre capas del INYM" },
];

function formatMillonesKg(kg: number): string {
  const millones = kg / 1_000_000;
  return `${millones.toLocaleString("es-AR", { maximumFractionDigits: 2 })} M kg`;
}

async function getHeroStats(): Promise<{ stats: HeroStat[]; esFallback: boolean }> {
  try {
    const [anualReal, secaderos] = await Promise.all([
      getProduccionAnualReal({ anioDesde: ANIO_STATS, anioHasta: ANIO_STATS }),
      getGeoLayerAtributos<Record<string, unknown>>("view_mat_gis_marketing_puntos_secaderos"),
    ]);
    const nacional = anualReal.find((f) => f.ciudad === "(nacional)" && f.anio === ANIO_STATS);
    if (!nacional || nacional.produccion_kg == null || nacional.exportaciones_kg == null || !secaderos.length) {
      console.warn("[landing] Faltan datos reales para las stats del hero -- usando fallback. Ver docs/auditoria_datos.md.");
      return { stats: STATS_FALLBACK, esFallback: true };
    }
    return {
      stats: [
        { value: formatMillonesKg(nacional.produccion_kg), label: `Producción nacional ${ANIO_STATS}, hoja verde a secadero` },
        { value: formatMillonesKg(nacional.exportaciones_kg), label: `Exportado en ${ANIO_STATS} — récord histórico` },
        { value: `${secaderos.length} plantas`, label: "Secaderos geolocalizados sobre capas del INYM" },
      ],
      esFallback: false,
    };
  } catch (err) {
    console.error("[landing] Error trayendo stats del hero desde el backend -- usando fallback.", err);
    return { stats: STATS_FALLBACK, esFallback: true };
  }
}

export default async function LandingPage() {
  const { stats, esFallback } = await getHeroStats();

  return (
    <div className={styles.landing}>
      <LandingNav />
      <LandingHero stats={stats} statsSonFallback={esFallback} />
    </div>
  );
}
