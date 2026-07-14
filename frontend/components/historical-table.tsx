"use client";

import { useState } from "react";
import { DataTable, type ColumnaTabla } from "@/components/data-table";

export function HistoricalTable<TAnual extends object, TMensual extends object>({
  columnasAnual,
  filasAnual,
  columnasMensual,
  filasMensual,
  notaMensual,
}: {
  columnasAnual: ColumnaTabla<TAnual>[];
  filasAnual: TAnual[];
  columnasMensual?: ColumnaTabla<TMensual>[];
  filasMensual?: TMensual[];
  notaMensual?: string;
}) {
  const [vista, setVista] = useState<"anual" | "mensual">("anual");
  const tieneMensual = !!(columnasMensual && filasMensual);

  return (
    <div className="flex flex-col gap-3">
      {tieneMensual && (
        <div className="flex items-center gap-1 self-start rounded-lg border border-border bg-muted p-1">
          <button
            type="button"
            onClick={() => setVista("anual")}
            aria-pressed={vista === "anual"}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
              vista === "anual" ? "bg-card text-card-foreground shadow-sm" : "text-muted-foreground hover:text-card-foreground"
            }`}
          >
            Anual
          </button>
          <button
            type="button"
            onClick={() => setVista("mensual")}
            aria-pressed={vista === "mensual"}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
              vista === "mensual" ? "bg-card text-card-foreground shadow-sm" : "text-muted-foreground hover:text-card-foreground"
            }`}
          >
            Mensual
          </button>
        </div>
      )}

      {vista === "anual" || !tieneMensual ? (
        <DataTable columnas={columnasAnual} filas={filasAnual} />
      ) : (
        <>
          {notaMensual && <p className="text-xs text-muted-foreground">{notaMensual}</p>}
          <DataTable columnas={columnasMensual!} filas={filasMensual!} maxHeightPx={480} />
        </>
      )}
    </div>
  );
}
