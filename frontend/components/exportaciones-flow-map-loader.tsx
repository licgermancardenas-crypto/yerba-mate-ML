"use client";

import dynamic from "next/dynamic";
import type { ComponentProps } from "react";
import type { ExportacionesFlowMap } from "@/components/exportaciones-flow-map";

// Mismo motivo que produccion-mapa-loader.tsx: MapLibre GL (WebGL) no debe
// intentar hidratarse en el servidor, y `next/dynamic` con `ssr:false` solo
// puede invocarse desde un Client Component -- de ahí este wrapper.
const ExportacionesFlowMapDinamico = dynamic(
  () => import("@/components/exportaciones-flow-map").then((m) => m.ExportacionesFlowMap),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full w-full items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <span className="text-sm">Cargando mapa de flujos…</span>
        </div>
      </div>
    ),
  }
);

export function ExportacionesFlowMapLoader(props: ComponentProps<typeof ExportacionesFlowMap>) {
  return <ExportacionesFlowMapDinamico {...props} />;
}
