import { Mountain, Satellite, Signpost, type LucideIcon } from "lucide-react";
import type { Basemap } from "@/lib/basemap";

// Piezas de UI compartidas entre el mapa de Producción y el Mapa GIS -- mismo
// lenguaje visual (píldoras, selects de ancho fijo, leyenda flotante) para
// que ambos mapas se sientan parte del mismo sistema.

export const BASEMAPS: { id: Basemap; label: string; icon: LucideIcon }[] = [
  { id: "topo", label: "Topográfico", icon: Mountain },
  { id: "satelital", label: "Satelital", icon: Satellite },
  { id: "calles", label: "Calles", icon: Signpost },
];

// Ancho fijo (no "lo que ocupe el texto") para que la columna de un grupo de
// filtros tenga un tamaño predecible y no desalinee la cuadrícula de los
// otros grupos de controles según cuánto texto tenga cada <option> elegida.
export const SELECT_CLASS = "text-sm rounded-lg border border-border bg-background px-2.5 py-1.5 text-foreground w-[172px]";

// Ancla siempre abajo-a-la-izquierda, con z-index explícito y un ancho
// máximo -- el zoom (NavigationControl) vive arriba-a-la-derecha y la escala
// (ScaleControl) abajo-a-la-derecha, así que por diseño nunca se solapan.
export const LEYENDA_CLASS = "absolute bottom-3 left-3 z-10 max-w-[210px] rounded-lg border border-border bg-card/95 backdrop-blur px-3 py-2 text-xs shadow-lg";

// Píldoras independientes (no una caja con borde + botón relleno adentro) --
// mismo lenguaje visual que el toggle Datos/Mapa y el kg/t del FilterBar.
export function pillClass(activo: boolean): string {
  return `flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-full border transition-colors cursor-pointer ${
    activo
      ? "bg-primary border-primary text-on-primary shadow-sm"
      : "border-border bg-card text-foreground/70 hover:text-foreground hover:border-primary/40"
  }`;
}

export function GrupoControl({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{titulo}</span>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}

export function BasemapToggle({ basemap, onChange }: { basemap: Basemap; onChange: (b: Basemap) => void }) {
  return (
    <GrupoControl titulo="Mapa base">
      {BASEMAPS.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          type="button"
          onClick={() => onChange(id)}
          aria-label={label}
          aria-pressed={basemap === id}
          title={label}
          className={pillClass(basemap === id)}
        >
          <Icon size={14} aria-hidden="true" />
          <span className="hidden lg:inline">{label}</span>
        </button>
      ))}
    </GrupoControl>
  );
}
