"""ETL — PBI anual por país destino (Banco Mundial), para el Modelo 3
(gravitacional de exportaciones, Fase 5).

Solo los ~20 países destino con volumen real y consistente en
ym.exportaciones_indec 2011-2025 (top 20 por volumen, todos con datos en
>=7 de los 15 años -- el resto son embarques sueltos, ajustar el modelo a
esos países sería ajustar ruido estadístico, no señal real de gravedad
comercial. Ver docs/modelo3_exportaciones_gravitacional.md).

API: https://api.worldbank.org/v2/ -- gratuita, sin auth. Indicador
NY.GDP.MKTP.CD (PBI, USD corrientes).

Uso:
    python -m backend.etl.etl_pbi_paises --dry-run
"""

from __future__ import annotations

import argparse
import os

import requests
from dotenv import load_dotenv

API_URL = "https://api.worldbank.org/v2/country/{paises}/indicator/NY.GDP.MKTP.CD"

# Top 20 destinos reales por volumen 2011-2025 (ver investigación 2026-07-18).
PAISES = [
    "SY", "CL", "ES", "LB", "US", "BR", "DE", "FR", "UY", "KR",
    "TR", "AE", "CA", "MX", "IL", "CN", "AU", "PL", "IT", "BO",
]


def fetch_pbi(paises: list[str], anio_desde: int, anio_hasta: int, timeout: int = 60) -> list[dict]:
    url = API_URL.format(paises=";".join(paises))
    resp = requests.get(
        url,
        params={"format": "json", "date": f"{anio_desde}:{anio_hasta}", "per_page": 1000},
        timeout=timeout,
    )
    resp.raise_for_status()
    data = resp.json()
    if isinstance(data, dict):
        raise RuntimeError(f"Error de la API del Banco Mundial: {data}")
    return data[1] or []


def transformar(filas_raw: list[dict]) -> list[tuple]:
    return [(f["country"]["id"], int(f["date"]), f["value"]) for f in filas_raw]


def upsert(conn, filas: list[tuple]) -> None:
    from psycopg2.extras import execute_values

    query = """
        INSERT INTO ym.pbi_pais_anual (pais_iso2, anio, pbi_usd)
        VALUES %s
        ON CONFLICT (pais_iso2, anio) DO UPDATE SET pbi_usd = EXCLUDED.pbi_usd
    """
    with conn.cursor() as cur:
        execute_values(cur, query, filas)


def main() -> None:
    load_dotenv()
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--anio-desde", type=int, default=2011)
    parser.add_argument("--anio-hasta", type=int, default=2025)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    print(f"Descargando PBI de {len(PAISES)} países ({args.anio_desde}-{args.anio_hasta})...")
    filas_raw = fetch_pbi(PAISES, args.anio_desde, args.anio_hasta)
    filas = transformar(filas_raw)
    con_dato = sum(1 for f in filas if f[2] is not None)
    print(f"-> {len(filas)} filas país-año, {con_dato} con dato real, {len(filas) - con_dato} NULL (país sin publicar ese año)")

    if args.dry_run:
        print("Primeras 5:", filas[:5])
        print("Sin dato:", [f for f in filas if f[2] is None][:10])
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
