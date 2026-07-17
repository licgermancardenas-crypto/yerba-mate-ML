"""ETL — Clima mensual (NASA POWER) por zona INYM, para el Modelo 1 de Fase 5.

`ym.clima_mensual` (Fase 3d) usa 6 "ciudades productoras" que solo caen
dentro de 4 de las 6 zonas del INYM (Centro, Corrientes, Noroeste, Sur) --
Noreste y Oeste quedan sin clima. El target real de producción del Modelo 1
(`ym.inym_hoja_verde_zona`) es por zona, así que el clima tiene que consultarse
en la misma granularidad -- reusa `fetch_monthly`/`_limpiar` de
`etl_nasa_power.py`, cambia solo los puntos de consulta y la tabla destino.

Punto de cada zona: centroide ponderado por superficie cultivada real
(sup_ym) de sus departamentos, no el centroide geométrico de todo el
polígono de la zona (que incluye mucha superficie no yerbatera).

Uso:
    python -m backend.etl.etl_nasa_power_zona --dry-run
    python -m backend.etl.etl_nasa_power_zona --start-year 2011
"""

from __future__ import annotations

import argparse
import os
from datetime import date

from dotenv import load_dotenv

from backend.etl.etl_nasa_power import _limpiar, fetch_monthly

# Centroides ponderados por sup_ym (ver investigación 2026-07-17, query
# ad-hoc sobre inym_gis.v_features_4326) -- no se recalculan en cada corrida
# porque no cambian salvo que el INYM republique la cartografía de zonas.
ZONAS = [
    {"zona": "CENTRO", "lat": -27.3840, "lon": -54.9709},
    {"zona": "CORRIENTES", "lat": -28.1173, "lon": -56.4294},
    {"zona": "NORESTE", "lat": -26.5299, "lon": -54.0648},
    {"zona": "NOROESTE", "lat": -26.2838, "lon": -54.4722},
    {"zona": "OESTE", "lat": -27.0678, "lon": -55.1742},
    {"zona": "SUR", "lat": -27.8388, "lon": -55.6479},
]


def transformar(data: dict, zona: str, lat: float, lon: float) -> list[tuple]:
    parametros = data["properties"]["parameter"]
    precip_por_mes = parametros.get("PRECTOTCORR", {})
    temp_por_mes = parametros.get("T2M", {})

    filas = []
    for clave in sorted(precip_por_mes):
        anio_str, mes_str = clave[:4], clave[4:6]
        mes = int(mes_str)
        if mes == 13:
            continue
        filas.append(
            (
                zona,
                lat,
                lon,
                int(anio_str),
                mes,
                _limpiar(precip_por_mes.get(clave)),
                _limpiar(temp_por_mes.get(clave)),
            )
        )
    return filas


def upsert(conn, filas: list[tuple]) -> None:
    from psycopg2.extras import execute_values

    query = """
        INSERT INTO ym.clima_zona_mensual
            (zona, latitud, longitud, anio, mes, precipitacion_mm_dia, temperatura_media_c)
        VALUES %s
        ON CONFLICT (zona, anio, mes) DO UPDATE SET
            precipitacion_mm_dia = EXCLUDED.precipitacion_mm_dia,
            temperatura_media_c = EXCLUDED.temperatura_media_c
    """
    with conn.cursor() as cur:
        execute_values(cur, query, filas)


def main() -> None:
    load_dotenv()
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--start-year", type=int, default=2010)
    parser.add_argument("--end-year", type=int, default=date.today().year)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    conn = None
    if not args.dry_run:
        import psycopg2

        conn = psycopg2.connect(os.environ["DATABASE_URL"])

    try:
        for z in ZONAS:
            print(f"Descargando clima: zona {z['zona']} ({z['lat']}, {z['lon']})")
            data = fetch_monthly(z["lat"], z["lon"], args.start_year, args.end_year)
            filas = transformar(data, z["zona"], z["lat"], z["lon"])
            print(f"  -> {len(filas)} filas mensuales")
            if args.dry_run:
                print(f"  primera fila: {filas[0]}")
                print(f"  última fila:  {filas[-1]}")
            else:
                upsert(conn, filas)
        if conn is not None:
            conn.commit()
            print("Commit OK")
    finally:
        if conn is not None:
            conn.close()


if __name__ == "__main__":
    main()
