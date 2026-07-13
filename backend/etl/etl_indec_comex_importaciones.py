"""ETL — Importaciones reales de yerba mate por país de origen (INDEC Comercio Exterior).

Reemplaza ym.importaciones.volumen_kg, que tenía 2011-2018 anulado (congelado
en el mismo valor exacto, sin fuente documentada -- ver docs/auditoria_datos.md)
y 2019 en adelante sin cita de fuente (categoría B).

Misma fuente y mismas posiciones NCM que las exportaciones -- ver
docs/fuentes_exportaciones_indec.md, esto es el espejo con
`commerceType=import`. Cobertura real 2002-presente, SIN ninguna fila
confidencial en todo el rango (a diferencia de exportaciones) -- volúmenes de
importación mucho menores, aparentemente no disparan el umbral de secreto
estadístico del INDEC.

Validación 2026-07-12: 2020 da 31.399.188,94 kg reales vs. 31.400.004 kg que
ya estaba cargado en ym.importaciones (Δ 0,003%) -- confirma que el dato
original del CSV semilla venía de esta misma fuente (o una equivalente), solo
que 2011-2018 habían quedado congelados/fabricados en el CSV.

Uso:
    python -m backend.etl.etl_indec_comex_importaciones --dry-run
    python -m backend.etl.etl_indec_comex_importaciones --start-year 2002 --end-year 2026
"""

from __future__ import annotations

import argparse
import os
from datetime import date

from dotenv import load_dotenv

from backend.etl.lib_indec_comex import fetch_anio, transformar, upsert

TABLA = "ym.importaciones_indec"
COMMERCE_TYPE = "import"


def main() -> None:
    load_dotenv()
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--start-year", type=int, default=2002)
    parser.add_argument("--end-year", type=int, default=date.today().year)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    conn = None
    if not args.dry_run:
        import psycopg2

        conn = psycopg2.connect(os.environ["DATABASE_URL"])

    try:
        total = 0
        total_confidencial = 0
        for anio in range(args.start_year, args.end_year + 1):
            filas_raw = fetch_anio(anio, COMMERCE_TYPE)
            if not filas_raw:
                print(f"{anio}: sin datos, se salta")
                continue
            filas = transformar(anio, filas_raw)
            n_conf = sum(1 for f in filas if f[7])
            total += len(filas)
            total_confidencial += n_conf
            peso_real = sum(f[5] for f in filas if f[5] is not None)
            print(f"{anio}: {len(filas)} filas ({n_conf} confidenciales) -- {peso_real:,.0f} kg reales".replace(",", "."))
            if not args.dry_run:
                upsert(conn, filas, TABLA)
        print(f"\nTotal: {total} filas, {total_confidencial} confidenciales ({100*total_confidencial/total:.1f}%)" if total else "Sin filas")
        if conn is not None:
            conn.commit()
            print("Commit OK")
    finally:
        if conn is not None:
            conn.close()


if __name__ == "__main__":
    main()
