"use client";

import dynamic from "next/dynamic";
import type { ComponentProps } from "react";
import type { ProduccionMapaClient } from "@/components/produccion-mapa-client";

// El mapa usa MapLibre GL (WebGL + acceso a window/document en tiempo de
// import) y hace todo su fetch de datos en el cliente -- no aporta nada
// renderizarlo en el servidor y sí puede causar mismatches de hidratación
// con el canvas. `next/dynamic` con `ssr:false` solo puede invocarse desde
// un Client Component, de ahí este wrapper separado de la página (Server
// Component) que lo usa.
const ProduccionMapaClientDinamico = dynamic(
  () => import("@/components/produccion-mapa-client").then((m) => m.ProduccionMapaClient),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[640px] w-full items-center justify-center rounded-2xl border border-border bg-card">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <span className="text-sm">Cargando mapa…</span>
        </div>
      </div>
    ),
  }
);

export function ProduccionMapaLoader(props: ComponentProps<typeof ProduccionMapaClient>) {
  return <ProduccionMapaClientDinamico {...props} />;
}
