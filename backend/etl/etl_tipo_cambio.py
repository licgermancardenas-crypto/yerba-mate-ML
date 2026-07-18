"""ETL — Dólar oficial ARS/USD, promedio anual (ArgentinaDatos), para el
Modelo 3 (gravitacional de exportaciones, Fase 5). Competitividad
exportadora argentina -- una sola serie nacional, no por país destino.

API: https://api.argentinadatos.com/v1/cotizaciones/dolares -- gratuita,
sin auth. Devuelve cotizaciones diarias de varias "casas" (oficial, blue,
mayorista, etc.) desde 2011. Se usa 'oficial' -- es la referencia estándar
para comercio exterior, a diferencia del BCRA REM (ym.bcra_rem) que solo
tiene 14 meses de histórico.

Uso:
    python -m backend.etl.etl_tipo_cambio --dry-run
"""

from __future__ import annotations

import argparse
import os
from collections import defaultdict

import requests
from dotenv import load_dotenv

API_URL = "https://api.argentinadatos.com/v1/cotizaciones/dolares"


def fetch_cotizaciones(timeout: int = 60) -> list[dict]:
    resp = requests.get(API_URL, timeout=timeout)
    resp.raise_for_status()
    return resp.json()


def transformar(cotizaciones: list[dict]) -> list[tuple]:
    """Promedio anual de (compra+venta)/2 de la casa 'oficial'."""
    por_anio: dict[int, list[float]] = defaultdict(list)
    for c in cotizaciones:
        if c.get("casa") != "oficial":
            continue
        compra, venta = c.get("compra"), c.get("venta")
        if compra is None or venta is None:
            continue
        anio = int(c["fecha"][:4])
        por_anio[anio].append((compra + venta) / 2)

    filas = []
    for anio, valores in sorted(por_anio.items()):
        promedio = sum(valores) / len(valores)
        filas.append((anio, round(promedio, 4), len(valores)))
    return filas


def upsert(conn, filas: list[tuple]) -> None:
    from psycopg2.extras import execute_values

    query = """
        INSERT INTO ym.tipo_cambio_anual (anio, ars_usd_oficial, dias_con_dato)
        VALUES %s
        ON CONFLICT (anio) DO UPDATE SET
            ars_usd_oficial = EXCLUDED.ars_usd_oficial,
            dias_con_dato = EXCLUDED.dias_con_dato
    """
    with conn.cursor() as cur:
        execute_values(cur, query, filas)


def main() -> None:
    load_dotenv()
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    print("Descargando cotizaciones diarias...")
    cotizaciones = fetch_cotizaciones()
    print(f"-> {len(cotizaciones)} cotizaciones totales (todas las casas)")
    filas = transformar(cotizaciones)
    print(f"-> {len(filas)} años con promedio 'oficial'")

    if args.dry_run:
        for f in filas:
            print(" ", f)
        return

    import psycopg2

    conn = psycopg2.connect(os.environ["DATABASE_URL"])
    try:
        upsert(conn, filas)
        conn.commit()
        print("Commit OK")
    finally:
        conn.close()


if __name__ == "__main__":
    main()
