"""ETL — Series macro de INDEC vía la API de series de tiempo de datos.gob.ar.

Descarga IPC Nacional, EMAE y el IPC específico de yerba mate (GBA) y los
carga en la tabla genérica `ym.indec_series`.

API: https://apis.datos.gob.ar/series/api/series/ — gratuita, sin auth.
Nota: el catálogo original es de la ex Subsecretaría de Programación
Macroeconómica ('sspm', datos desde 2017), pero las series de INDEC se
siguen actualizando ahí (IPC verificado con datos hasta 2026-05, EMAE hasta
2026-04 al momento de escribir esto) — no está discontinuada.

IDs de series confirmados manualmente contra la API real (2026-07-01):
- IPC Nacional, nivel general, base dic-2016=100, mensual: 148.3_INIVELNAL_DICI_M_26
- EMAE, nivel general, índice original, base 2004, mensual: 143.3_NO_PR_2004_A_21
- IPC-GBA, precio de yerba mate específicamente, base dic-2016, mensual: 105.1_I2YM_2016_M_19
  (más específico que 'infusiones' en general — sirve directo para Modelo 2)

Buscadas pero NO usadas (ver docs/indec_series.md):
- Comercio exterior NCM 'café, té, yerba mate y especias': viene mezclado con
  otros productos, no es yerba mate pura — los datos de exportaciones del
  INYM (ym.exportaciones) ya son mejores (yerba mate sola, por destino).
- Proyecciones de población por provincia: no hay una serie nacional limpia
  con Censo 2022 en esta API (solo proyecciones viejas post-Censo 2010).

Uso:
    python -m backend.etl.etl_indec_series --dry-run
    python -m backend.etl.etl_indec_series
"""

from __future__ import annotations

import argparse
import os

import requests
from dotenv import load_dotenv

API_URL = "https://apis.datos.gob.ar/series/api/series/"

SERIES = [
    {
        "id": "148.3_INIVELNAL_DICI_M_26",
        "nombre": "ipc_nacional_nivel_general",
        "unidad": "índice (dic-2016=100)",
    },
    {
        "id": "143.3_NO_PR_2004_A_21",
        "nombre": "emae_nivel_general",
        "unidad": "índice (base 2004)",
    },
    {
        "id": "105.1_I2YM_2016_M_19",
        "nombre": "ipc_gba_yerba_mate",
        "unidad": "índice (dic-2016=100)",
    },
]


def fetch_serie(serie_id: str, timeout: int = 60) -> list[tuple[str, float]]:
    """Descarga la serie completa (fecha ISO, valor). La API pagina con
    `limit` (máx 1000); ninguna de nuestras series supera eso, pero se
    revisa `count` igual para no truncar en silencio si el histórico crece."""
    resp = requests.get(API_URL, params={"ids": serie_id, "limit": 1000, "format": "json"}, timeout=timeout)
    resp.raise_for_status()
    data = resp.json()
    if data["count"] > len(data["data"]):
        raise RuntimeError(
            f"Serie {serie_id}: {data['count']} valores disponibles pero solo se pidieron "
            f"{len(data['data'])} — subir el límite del request."
        )
    return [(fecha, valor) for fecha, valor in data["data"]]


def transformar(serie_id: str, nombre: str, unidad: str, puntos: list[tuple[str, float]]) -> list[tuple]:
    filas = []
    for fecha, valor in puntos:
        anio, mes = int(fecha[:4]), int(fecha[5:7])
        filas.append((serie_id, nombre, anio, mes, valor, unidad))
    return filas


def upsert(conn, filas: list[tuple]) -> None:
    from psycopg2.extras import execute_values

    query = """
        INSERT INTO ym.indec_series (serie_id, serie_nombre, anio, mes, valor, unidad)
        VALUES %s
        ON CONFLICT (serie_id, anio, mes) DO UPDATE SET
            valor = EXCLUDED.valor,
            unidad = EXCLUDED.unidad
    """
    with conn.cursor() as cur:
        execute_values(cur, query, filas)


def main() -> None:
    load_dotenv()
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dry-run", action="store_true", help="Solo descarga e imprime, no escribe en la DB")
    args = parser.parse_args()

    conn = None
    if not args.dry_run:
        import psycopg2

        conn = psycopg2.connect(os.environ["DATABASE_URL"])

    try:
        for serie in SERIES:
            print(f"Descargando serie: {serie['nombre']} ({serie['id']})")
            puntos = fetch_serie(serie["id"])
            filas = transformar(serie["id"], serie["nombre"], serie["unidad"], puntos)
            print(f"  -> {len(filas)} valores mensuales")
            if args.dry_run:
                print(f"  primer valor: {filas[0]}")
                print(f"  último valor: {filas[-1]}")
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
