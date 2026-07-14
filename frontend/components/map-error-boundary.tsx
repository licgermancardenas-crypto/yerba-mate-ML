"use client";

import { Component, type ReactNode } from "react";
import { MapPinOff } from "lucide-react";

interface Props {
  children: ReactNode;
  className?: string;
}

interface State {
  crashed: boolean;
}

// Los 3 mapas de la app (Producción, Exportaciones, Mapa GIS) usan MapLibre
// GL (WebGL) -- si WebGL no está disponible en el navegador (deshabilitado,
// hardware viejo, sesión remota sin GPU) o el mapa falla por cualquier otra
// razón en tiempo de render, sin este boundary el error se propaga y
// React desmonta TODA la página (filtros, KPIs, todo), no solo el mapa.
// Class component a propósito: React todavía no tiene un equivalente con
// hooks para getDerivedStateFromError/componentDidCatch.
export class MapErrorBoundary extends Component<Props, State> {
  state: State = { crashed: false };

  static getDerivedStateFromError() {
    return { crashed: true };
  }

  componentDidCatch(error: unknown) {
    console.error("No se pudo renderizar el mapa:", error);
  }

  render() {
    if (this.state.crashed) {
      return (
        <div
          className={`flex h-full w-full flex-col items-center justify-center gap-2 p-6 text-center text-sm text-muted-foreground ${this.props.className ?? ""}`}
        >
          <MapPinOff size={28} className="text-muted-foreground/50" aria-hidden="true" />
          <p>No se pudo cargar el mapa en este navegador.</p>
          <p className="text-xs text-muted-foreground/70">
            Puede deberse a que WebGL está deshabilitado o no soportado — probá con otro navegador o dispositivo.
          </p>
        </div>
      );
    }
    return this.props.children;
  }
}
