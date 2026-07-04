"""ETL — Clima mensual (NASA POWER) para las ciudades productoras de yerba mate.

Descarga precipitación (PRECTOTCORR) y temperatura media (T2M) mensuales de la
API NASA POWER para las 6 ciudades productoras reales de `dataset_principal.csv`
(se excluye 'Otros', que es una categoría agregada sin ubicación puntual).

API gratuita, sin autenticación, resolución espacial ~0.5°x0.5° (MERRA-2),
cobertura histórica desde 1981. Estos datos cambian poco entre corridas
(salvo el mes más reciente), por lo que este ETL se puede correr con
frecuencia mensual.

OJO unidades: PRECTOTCORR viene en mm/día (promedio diario del mes), NO en
mm totales del mes. NASA POWER reporta faltantes como -999.0 (fill_value) —
se convierten a NULL. La respuesta mensual incluye una clave 'YYYY13' con el
promedio/total anual — se descarta, solo se cargan meses 01-12.

Uso:
    python -m backend.etl.etl_nasa_power --dry-run
    python -m backend.etl.etl_nasa_power --start-year 2010 --end-year 2025
"""

from __future__ import annotations

import argparse
import os
from datetime import date

import requests
from dotenv import load_dotenv

API_URL = "https://power.larc.nasa.gov/api/temporal/monthly/point"
PARAMETERS = "T2M,PRECTOTCORR"
COMMUNITY = "AG"  # Agroclimatology
FILL_VALUE = -999.0

# Coordenadas aproximadas de las ciudades productoras reales (misma
# granularidad que dataset_principal.csv). Suficiente precisión dado que la
# grilla nativa de NASA POWER es de ~0.5°x0.5° (~50 km).
UBICACIONES = [
    {"ubicacion": "Colonia Liebig", "provincia": "Corrientes", "lat": -27.53, "lon": -55.72},
    {"ubicacion": "Gobernador Virasoro", "provincia": "Corrientes", "lat": -28.07, "lon": -56.03},
    {"ubicacion": "Apóstoles", "provincia": "Misiones", "lat": -27.90, "lon": -55.75},
    {"ubicacion": "Montecarlo", "provincia": "Misiones", "lat": -26.57, "lon": -54.77},
    {"ubicacion": "Oberá", "provincia": "Misiones", "lat": -27.49, "lon": -55.12},
    {"ubicacion": "Santo Pipó", "provincia": "Misiones", "lat": -27.20, "lon": -55.05},
]


def fetch_monthly(lat: float, lon: float, start_year: int, end_year: int, timeout: int = 60) -> dict:
    params = {
        "parameters": PARAMETERS,
        "community": COMMUNITY,
        "longitude": lon,
        "latitude": lat,
        "start": start_year,
        "end": end_year,
        "format": "JSON",
    }
    resp = requests.get(API_URL, params=params, timeout=timeout)
    resp.raise_for_status()
    return resp.json()


def _limpiar(valor: float | None) -> float | None:
    if valor is None or valor == FILL_VALUE:
        return None
    return valor


def transformar(data: dict, ubicacion: str, provincia: str, lat: float, lon: float) -> list[tuple]:
    parametros = data["properties"]["parameter"]
    precip_por_mes = parametros.get("PRECTOTCORR", {})
    temp_por_mes = parametros.get("T2M", {})

    filas = []
    for clave in sorted(precip_por_mes):
        anio_str, mes_str = clave[:4], clave[4:6]
        mes = int(mes_str)
        if mes == 13:  # promedio/total anual, no es un mes real
            continue
        filas.append(
            (
                ubicacion,
                provincia,
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
        INSERT INTO ym.clima_mensual
            (ubicacion, provincia, latitud, longitud, anio, mes,
             precipitacion_mm_dia, temperatura_media_c)
        VALUES %s
        ON CONFLICT (ubicacion, anio, mes) DO UPDATE SET
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
    parser.add_argument("--dry-run", action="store_true", help="Solo descarga e imprime, no escribe en la DB")
    args = parser.parse_args()

    conn = None
    if not args.dry_run:
        import psycopg2

        conn = psycopg2.connect(os.environ["DATABASE_URL"])

    try:
        for u in UBICACIONES:
            print(f"Descargando clima: {u['ubicacion']} ({u['lat']}, {u['lon']})")
            data = fetch_monthly(u["lat"], u["lon"], args.start_year, args.end_year)
            filas = transformar(data, u["ubicacion"], u["provincia"], u["lat"], u["lon"])
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
