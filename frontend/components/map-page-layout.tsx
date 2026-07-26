"use client";

import { useState, type ReactNode } from "react";
import { SlidersHorizontal, X, PanelLeftClose, PanelLeftOpen } from "lucide-react";

interface MapPageLayoutProps {
  /** Controles de la barra flotante (selects, pills de capa/año, toggles de
   * transporte, BasemapToggle) -- se pasan tal cual (mismos GrupoControl/
   * pillClass de mapa-controles.tsx), este layout solo da el contenedor
   * flotante + el colapso a drawer en mobile. */
  filtros: ReactNode;
  /** Nota/leyenda chica debajo de los filtros (ej. leyendaTexto/descripción
   * de la capa activa). Opcional. */
  nota?: ReactNode;
  /** Panel de info flotante (el stack de <PanelCard> que arma
   * ProduccionPanel/GisPanel) -- opcional; si no se pasa, no se renderiza
   * panel ni botón de colapso. */
  panel?: ReactNode;
  /** El mapa en sí: MapErrorBoundary + Mapa + overlay de "Cargando…" +
   * leyendas de color -- se monta a pantalla completa. */
  children: ReactNode;
}

// Layout compartido para vistas de mapa a pantalla completa (Producción →
// Mapa, Mapa GIS) -- reemplaza la grilla de 2 columnas (panel fijo + mapa
// h-[720px]) donde el mapa terminaba con menos del 60% del ancho real.
// Patrón GIS profesional (Mapbox Studio/Carto): mapa ocupa todo el
// contenedor, filtros y panel flotan encima.
export function MapPageLayout({ filtros, nota, panel, children }: MapPageLayoutProps) {
  const [panelAbierto, setPanelAbierto] = useState(true);
  const [filtrosMobileAbiertos, setFiltrosMobileAbiertos] = useState(false);

  return (
    <div className="relative w-full h-full rounded-2xl border border-border bg-card overflow-hidden shadow-sm">
      <div className="absolute inset-0">{children}</div>

      {/* Overlay flotante -- desktop: barra de filtros + panel apilados en
          flujo vertical real (el panel arranca justo debajo de la barra sin
          adivinar un offset en píxeles fijo -- si la barra crece a 2
          líneas, el panel se acomoda solo). `pointer-events-none` en el
          wrapper deja pasar los clicks al mapa en el espacio vacío;
          `pointer-events-auto` en cada pieza visible reactiva la
          interacción ahí. */}
      <div className="hidden md:flex absolute inset-3 z-30 flex-col items-start gap-3 pointer-events-none">
        <div className="pointer-events-auto w-full flex flex-col gap-3 rounded-2xl border border-border bg-card/90 backdrop-blur px-4 py-3 shadow-lg shrink-0">
          <div className="flex flex-wrap items-start gap-x-6 gap-y-3">{filtros}</div>
          {nota && <div className="flex items-start gap-2 rounded-xl border border-border bg-muted px-3 py-2">{nota}</div>}
        </div>

        {panel && (
          <div className="hidden lg:flex flex-1 min-h-0 pointer-events-none">
            <div className="pointer-events-auto max-h-full">
              {panelAbierto ? (
                <div className="w-[300px] max-h-full overflow-y-auto rounded-2xl border border-border bg-card/95 backdrop-blur shadow-lg">
                  <div className="flex justify-end px-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setPanelAbierto(false)}
                      aria-label="Colapsar panel"
                      aria-expanded={true}
                      className="rounded-full p-1 text-foreground/60 hover:text-foreground hover:bg-muted transition-colors"
                    >
                      <PanelLeftClose size={16} aria-hidden="true" />
                    </button>
                  </div>
                  <div className="px-3 pb-3 flex flex-col gap-4">{panel}</div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setPanelAbierto(true)}
                  aria-label="Expandir panel de info"
                  aria-expanded={false}
                  className="rounded-full border border-border bg-card/95 backdrop-blur p-2 shadow-lg text-foreground/70 hover:text-foreground transition-colors"
                >
                  <PanelLeftOpen size={16} aria-hidden="true" />
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Filtros -- mobile: botón que abre un overlay a pantalla completa
          (mismo patrón hand-rolled que ya usa el drawer de <Sidebar>, sin
          agregar ninguna librería de Sheet/Dialog nueva). */}
      <div className="md:hidden absolute top-3 left-3 z-30">
        <button
          type="button"
          onClick={() => setFiltrosMobileAbiertos(true)}
          aria-label="Abrir filtros"
          aria-expanded={filtrosMobileAbiertos}
          className="flex items-center gap-1.5 rounded-full border border-border bg-card/95 backdrop-blur px-3.5 py-2 text-sm font-medium text-foreground shadow-lg"
        >
          <SlidersHorizontal size={14} aria-hidden="true" />
          Filtros
        </button>
      </div>

      {filtrosMobileAbiertos && (
        <div className="md:hidden fixed inset-0 z-40 bg-background/95 backdrop-blur flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <span className="text-sm font-semibold text-foreground">Filtros</span>
            <button
              type="button"
              onClick={() => setFiltrosMobileAbiertos(false)}
              aria-label="Cerrar filtros"
              className="rounded-full p-1.5 text-foreground/70 hover:text-foreground hover:bg-muted transition-colors"
            >
              <X size={18} aria-hidden="true" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
            {filtros}
            {nota && <div className="flex items-start gap-2 rounded-xl border border-border bg-muted px-3 py-2">{nota}</div>}
          </div>
        </div>
      )}
    </div>
  );
}
