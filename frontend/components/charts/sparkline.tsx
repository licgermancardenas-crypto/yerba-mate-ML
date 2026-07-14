// Mini-gráfico de tendencia sin ejes/tooltip -- para series anuales cortas
// donde un chart completo (o peor, una matriz de 12 columnas mensuales
// idénticas, ver Fase 9 C4) desperdicia espacio sin aportar más lectura
// que "sube/baja". SVG plano en vez de Recharts: no necesita interacción,
// más liviano para un elemento tan chico.
export function Sparkline({
  valores,
  color = "var(--color-primary)",
  width = 120,
  height = 32,
}: {
  valores: number[];
  color?: string;
  width?: number;
  height?: number;
}) {
  if (valores.length < 2) return null;

  const min = Math.min(...valores);
  const max = Math.max(...valores);
  const rango = max - min || 1;
  const paso = width / (valores.length - 1);
  const y = (v: number) => height - ((v - min) / rango) * height;

  const puntos = valores.map((v, i) => `${i * paso},${y(v)}`).join(" ");
  const ultimo = valores[valores.length - 1];

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="overflow-visible shrink-0" aria-hidden="true">
      <polyline points={puntos} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={width} cy={y(ultimo)} r={3} fill={color} />
    </svg>
  );
}
