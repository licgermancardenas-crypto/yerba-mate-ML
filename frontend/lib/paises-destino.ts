// Coordenadas de los destinos reales de exportación (ym.exportaciones.destino
// solo trae estos 5 países + un bucket "Others" no geocodificable). Se usa
// la capital de cada país como marcador -- es una aproximación ilustrativa
// del país destino, no la ubicación real del puerto/comprador.
export const ORIGEN_ARGENTINA: [number, number] = [-58.3816, -34.6037]; // Puerto de Buenos Aires

export const PAISES_DESTINO: Record<string, { coords: [number, number]; label: string }> = {
  Chile: { coords: [-70.6693, -33.4489], label: "Chile" },
  Lebanon: { coords: [35.5018, 33.8938], label: "Líbano" },
  Spain: { coords: [-3.7038, 40.4168], label: "España" },
  Syria: { coords: [36.2765, 33.5138], label: "Siria" },
  USA: { coords: [-77.0369, 38.9072], label: "Estados Unidos" },
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
