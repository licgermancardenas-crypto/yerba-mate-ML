interface PageSkeletonProps {
  /** Cantidad de KpiCard a aproximar (0 = sin fila de KPIs, ej. Mapa GIS). */
  kpis?: number;
  /** Cantidad de ChartCard/tabla a aproximar. */
  charts?: number;
}

function Bloque({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-2xl bg-muted ${className}`} />;
}

// Placeholder de layout para el cold-start de Render free tier (~30-50s)
// -- antes las 9 páginas de datos quedaban en blanco ese tiempo (solo los
// mapas tenían loading state), parecía roto. Aproxima la forma real de
// cada página (PageHeader + FilterBar + KPIs + charts) para no generar
// salto de layout cuando llega el dato real, sin replicar el contenido
// exacto de cada página (eso sería una duplicación frágil de mantener).
export function PageSkeleton({ kpis = 4, charts = 2 }: PageSkeletonProps) {
  return (
    <main className="p-6 md:p-8" aria-busy="true" aria-label="Cargando datos">
      <div className="mb-6">
        <div className="animate-pulse rounded-md bg-muted h-6 w-56 mb-2" />
        <div className="animate-pulse rounded-md bg-muted h-4 w-96 max-w-full" />
      </div>
      <div className="animate-pulse rounded-full bg-muted h-9 w-full max-w-md mb-6" />
      {kpis > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {Array.from({ length: kpis }).map((_, i) => (
            <Bloque key={i} className="h-32" />
          ))}
        </div>
      )}
      {charts > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {Array.from({ length: charts }).map((_, i) => (
            <Bloque key={i} className="h-80" />
          ))}
        </div>
      )}
    </main>
  );
}
