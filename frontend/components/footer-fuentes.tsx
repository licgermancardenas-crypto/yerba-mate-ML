import { getFuentesPorTabla } from "@/lib/api";

interface FooterFuentesProps {
  /** Nombres de tabla calificados con schema, ej: "ym.produccion", "ym.exportaciones_indec". */
  tablas: string[];
}

// Etapa 4 regla 5 (docs/auditoria_datos.md): toda vista con datos debe
// declarar de dónde vienen. Server component -- resuelve /fuentes/por-tabla
// una vez por render, cacheado igual que el resto de los fetches de la API.
export async function FooterFuentes({ tablas }: FooterFuentesProps) {
  const porTabla = await getFuentesPorTabla(tablas);
  const fuentes = new Map(
    Object.values(porTabla)
      .flat()
      .map((f) => [f.id, f])
  );

  if (fuentes.size === 0) return null;

  return (
    <footer className="mt-8 border-t border-border pt-4 text-xs text-muted-foreground">
      <p className="font-medium text-foreground/80 mb-1.5">Fuentes de esta vista</p>
      <ul className="space-y-1">
        {[...fuentes.values()].map((f) => (
          <li key={f.id}>
            <span className="text-foreground/70">{f.nombre}</span>
            {f.organismo && <span> — {f.organismo}</span>}
            {f.url && (
              <>
                {" "}
                (
                <a href={`https://${f.url.replace(/^https?:\/\//, "")}`} target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground">
                  {f.url}
                </a>
                )
              </>
            )}
          </li>
        ))}
      </ul>
    </footer>
  );
}
