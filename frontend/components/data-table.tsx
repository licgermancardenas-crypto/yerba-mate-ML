"use client";

import { NoData } from "@/components/no-data";

export type ColumnFormat = "entero" | "decimal1" | "decimal2" | "porcentaje" | "usd" | "ars" | "texto";

export interface ColumnaTabla<T> {
  key: keyof T;
  label: string;
  format?: ColumnFormat;
  align?: "left" | "right";
}

const SIN_DATO = "s/d";

function formatearCelda(valor: unknown, format?: ColumnFormat): string {
  if (valor === null || valor === undefined) return SIN_DATO;
  if (format === "texto" || format === undefined) return String(valor);
  const n = typeof valor === "number" ? valor : Number(valor);
  if (Number.isNaN(n)) return String(valor);
  switch (format) {
    case "entero":
      return new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 }).format(n);
    case "decimal1":
      return new Intl.NumberFormat("es-AR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(n);
    case "decimal2":
      return new Intl.NumberFormat("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
    case "porcentaje":
      return `${new Intl.NumberFormat("es-AR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(n)}%`;
    case "usd":
      return new Intl.NumberFormat("es-AR", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
    case "ars":
      return `$${new Intl.NumberFormat("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)}`;
  }
}

export function DataTable<T extends object>({
  columnas,
  filas,
  maxHeightPx = 420,
}: {
  columnas: ColumnaTabla<T>[];
  filas: T[];
  maxHeightPx?: number;
}) {
  return (
    <div className="rounded-lg border border-border overflow-auto" style={{ maxHeight: maxHeightPx }}>
      <table className="w-full text-sm border-collapse">
        <thead className="sticky top-0 z-10">
          <tr>
            {columnas.map((c) => (
              <th
                key={String(c.key)}
                className={`px-3 py-2 text-xs font-semibold text-muted-foreground bg-muted border-b border-border whitespace-nowrap ${
                  c.align === "right" ? "text-right" : "text-left"
                }`}
              >
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filas.map((fila, i) => (
            <tr
              key={i}
              className={`border-b border-border/60 last:border-0 hover:bg-primary/5 transition-colors ${i % 2 === 1 ? "bg-black/[0.015]" : ""}`}
            >
              {columnas.map((c) => {
                const valor = fila[c.key];
                const esSinDato = valor === null || valor === undefined;
                return (
                  <td
                    key={String(c.key)}
                    title={esSinDato ? "Sin dato publicado por la fuente para este período" : undefined}
                    className={`px-3 py-1.5 tabular-nums whitespace-nowrap ${
                      c.align === "right" ? "text-right font-medium text-card-foreground" : "text-card-foreground"
                    } ${esSinDato ? "text-muted-foreground italic cursor-help" : ""}`}
                  >
                    {formatearCelda(valor, c.format)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      {filas.length === 0 && <NoData variant="chart" />}
    </div>
  );
}
