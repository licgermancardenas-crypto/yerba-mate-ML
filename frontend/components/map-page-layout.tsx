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

      {/* Barra de filtros flotante -- desktop */}
      <div className="hidden md:flex md:flex-col md:gap-3 absolute top-3 left-3 right-3 z-30 rounded-2xl border border-border bg-card/90 backdrop-blur px-4 py-3 shadow-lg">
        <div className="flex flex-wrap items-start gap-x-6 gap-y-3">{filtros}</div>
        {nota && <div className="flex items-start gap-2 rounded-xl border border-border bg-muted px-3 py-2">{nota}</div>}
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

      {/* Panel de info flotante y colapsable -- nunca una columna que
          reserva espacio fijo, se encoge a su contenido real (los
          PanelCard internos ya son flex-col sin altura fija). */}
      {panel && (
        <div className="hidden lg:block absolute top-[88px] left-3 z-20 max-h-[calc(100%-104px)]">
          {panelAbierto ? (
            <div className="w-[300px] max-h-[calc(100vh-200px)] overflow-y-auto rounded-2xl border border-border bg-card/95 backdrop-blur shadow-lg">
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
      )}
    </div>
  );
}
