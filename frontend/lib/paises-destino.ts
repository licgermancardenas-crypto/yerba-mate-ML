// Coordenadas (capital de cada país, aproximación ilustrativa del destino,
// no la ubicación real del puerto/comprador) para los ~30 destinos con
// volumen real relevante en ym.exportaciones_indec (INDEC, 2002-presente).
// Cualquier país fuera de esta lista simplemente no dibuja arco en el mapa
// de flujos (mismo criterio que ya usaba el bucket "Others" viejo) --
// "ZZ" (Confidencial, secreto estadístico) queda afuera a propósito, no es
// un país real. Claves = ISO2 (ym.exportaciones_indec.pais_iso2).
export const ORIGEN_ARGENTINA: [number, number] = [-58.3816, -34.6037]; // Puerto de Buenos Aires

export const PAISES_DESTINO: Record<string, { coords: [number, number]; label: string }> = {
  SY: { coords: [36.2765, 33.5138], label: "Siria" },
  CL: { coords: [-70.6693, -33.4489], label: "Chile" },
  BR: { coords: [-47.8825, -15.7942], label: "Brasil" },
  UY: { coords: [-56.1645, -34.9011], label: "Uruguay" },
  ES: { coords: [-3.7038, 40.4168], label: "España" },
  LB: { coords: [35.5018, 33.8938], label: "Líbano" },
  US: { coords: [-77.0369, 38.9072], label: "Estados Unidos" },
  FR: { coords: [2.3522, 48.8566], label: "Francia" },
  DE: { coords: [13.405, 52.52], label: "Alemania" },
  BO: { coords: [-68.1193, -16.4897], label: "Bolivia" },
  IL: { coords: [35.2137, 31.7683], label: "Israel" },
  CA: { coords: [-75.6972, 45.4215], label: "Canadá" },
  IT: { coords: [12.4964, 41.9028], label: "Italia" },
  PY: { coords: [-57.5759, -25.2637], label: "Paraguay" },
  AE: { coords: [54.3773, 24.4539], label: "Emiratos Árabes Unidos" },
  KR: { coords: [126.978, 37.5665], label: "Corea del Sur" },
  MX: { coords: [-99.1332, 19.4326], label: "México" },
  AU: { coords: [149.13, -35.2809], label: "Australia" },
  CN: { coords: [116.4074, 39.9042], label: "China" },
  TR: { coords: [32.8597, 39.9334], label: "Turquía" },
  PL: { coords: [21.0122, 52.2297], label: "Polonia" },
  RU: { coords: [37.6173, 55.7558], label: "Rusia" },
  VE: { coords: [-66.9036, 10.4806], label: "Venezuela" },
  NL: { coords: [4.8952, 52.3702], label: "Países Bajos" },
  CZ: { coords: [14.4378, 50.0755], label: "República Checa" },
  JP: { coords: [139.6917, 35.6895], label: "Japón" },
  SE: { coords: [18.0686, 59.3293], label: "Suecia" },
  SA: { coords: [46.6753, 24.7136], label: "Arabia Saudita" },
  BE: { coords: [4.3517, 50.8503], label: "Bélgica" },
  GB: { coords: [-0.1278, 51.5074], label: "Reino Unido" },
  CH: { coords: [7.4474, 46.9481], label: "Suiza" },
  NZ: { coords: [174.7762, -41.2865], label: "Nueva Zelandia" },
};

// Punto intermedio sobre el círculo máximo (great circle) entre dos
// coordenadas -- es el camino geodésico real más corto entre dos puntos
// sobre una esfera, no una curva decorativa arbitraria.
function puntoIntermedio(desde: [number, number], hasta: [number, number], fraccion: number): [number, number] {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const toDeg = (r: number) => (r * 180) / Math.PI;

  const lat1 = toRad(desde[1]);
  const lon1 = toRad(desde[0]);
  const lat2 = toRad(hasta[1]);
  const lon2 = toRad(hasta[0]);

  const d =
    2 *
    Math.asin(
      Math.sqrt(
        Math.sin((lat2 - lat1) / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin((lon2 - lon1) / 2) ** 2
      )
    );
  if (d === 0) return desde;

  const a = Math.sin((1 - fraccion) * d) / Math.sin(d);
  const b = Math.sin(fraccion * d) / Math.sin(d);
  const x = a * Math.cos(lat1) * Math.cos(lon1) + b * Math.cos(lat2) * Math.cos(lon2);
  const y = a * Math.cos(lat1) * Math.sin(lon1) + b * Math.cos(lat2) * Math.sin(lon2);
  const z = a * Math.sin(lat1) + b * Math.sin(lat2);

  const lat = Math.atan2(z, Math.sqrt(x * x + y * y));
  const lon = Math.atan2(y, x);
  return [toDeg(lon), toDeg(lat)];
}

export function arcoGeodesico(desde: [number, number], hasta: [number, number], pasos = 48): [number, number][] {
  const puntos: [number, number][] = [];
  for (let i = 0; i <= pasos; i++) {
    puntos.push(puntoIntermedio(desde, hasta, i / pasos));
  }
  return puntos;
}
