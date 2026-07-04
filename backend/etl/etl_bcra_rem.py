"""ETL — Relevamiento de Expectativas de Mercado (REM) del BCRA.

Usa la API JSON de ArgentinaDatos (mirror comunitario del REM, fuente
original BCRA) en vez de parsear el Excel multi-hoja que publica el BCRA
directamente — la API ya devuelve cada fila normalizada (indicador x
horizonte pronosticado x informe), sin trabajo de parsing.

Endpoint: https://api.argentinadatos.com/v1/rems/{año}/{mes}
Gratuito, sin auth. Cada informe mensual trae ~130 filas: varios indicadores
(inflación IPC nivel general y núcleo, PBI, tipo de cambio, tasa TAMAR,
desocupación, exportaciones/importaciones, resultado fiscal) x varios
horizontes (mensual/trimestral/anual).

LIMITACIÓN IMPORTANTE (confirmada 2026-07-01): esta API solo tiene datos
desde 2025-04 hasta el mes más reciente publicado — NO el histórico completo
del REM (que en el BCRA arranca ~2004). Meses fuera de esa ventana devuelven
404. Si se necesita el histórico completo para walk-forward validation en
Fase 5, hay que parsear el Excel del BCRA directamente (ver
docs/bcra_rem.md) — no implementado.

Uso:
    python -m backend.etl.etl_bcra_rem --dry-run
    python -m backend.etl.etl_bcra_rem --start 2025-04 --end 2026-05
"""

from __future__ import annotations

import argparse
import os
from datetime import date

import requests
from dotenv import load_dotenv

API_URL = "https://api.argentinadatos.com/v1/rems/{anio}/{mes:02d}"

CAMPOS = [
    "informe", "fecha", "muestra", "indicador", "periodo", "periodoTipo",
    "periodoDesde", "periodoHasta", "referencia", "referenciaFecha", "unidad",
    "mediana", "promedio", "desvio", "maximo", "minimo",
    "percentil90", "percentil75", "percentil25", "percentil10",
    "participantes", "publicacionUrl", "xlsxUrl",
]


def _meses_en_rango(desde: str, hasta: str) -> list[tuple[int, int]]:
    anio_ini, mes_ini = (int(x) for x in desde.split("-"))
    anio_fin, mes_fin = (int(x) for x in hasta.split("-"))
    meses = []
    anio, mes = anio_ini, mes_ini
    while (anio, mes) <= (anio_fin, mes_fin):
        meses.append((anio, mes))
        mes += 1
        if mes > 12:
            mes = 1
            anio += 1
    return meses


def fetch_informe(anio: int, mes: int, timeout: int = 60) -> list[dict] | None:
    """Devuelve las filas del informe, o None si ese mes no está disponible (404)."""
    resp = requests.get(API_URL.format(anio=anio, mes=mes), timeout=timeout)
    if resp.status_code == 404:
        return None
    resp.raise_for_status()
    return resp.json()


def transformar(filas_raw: list[dict]) -> list[tuple]:
    return [tuple(fila.get(campo) for campo in CAMPOS) for fila in filas_raw]


def upsert(conn, filas: list[tuple]) -> None:
    from psycopg2.extras import execute_values

    cols_destino = [
        "informe", "fecha", "muestra", "indicador", "periodo", "periodo_tipo",
        "periodo_desde", "periodo_hasta", "referencia", "referencia_fecha", "unidad",
        "mediana", "promedio", "desvio", "maximo", "minimo",
        "percentil90", "percentil75", "percentil25", "percentil10",
        "participantes", "publicacion_url", "xlsx_url",
    ]
    pk = ["informe", "indicador", "muestra", "periodo", "periodo_tipo"]
    update_cols = [c for c in cols_destino if c not in pk]
    query = (
        f"INSERT INTO ym.bcra_rem ({', '.join(cols_destino)}) VALUES %s "
        f"ON CONFLICT ({', '.join(pk)}) DO UPDATE SET "
        + ", ".join(f"{c} = EXCLUDED.{c}" for c in update_cols)
    )
    with conn.cursor() as cur:
        execute_values(cur, query, filas)


def main() -> None:
    load_dotenv()
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--start", default="2025-01", help="YYYY-MM, se prueba mes a mes (los no disponibles se saltan)")
    parser.add_argument("--end", default=date.today().strftime("%Y-%m"))
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    conn = None
    if not args.dry_run:
        import psycopg2

        conn = psycopg2.connect(os.environ["DATABASE_URL"])

    try:
        total = 0
        for anio, mes in _meses_en_rango(args.start, args.end):
            filas_raw = fetch_informe(anio, mes)
            if filas_raw is None:
                print(f"{anio}-{mes:02d}: no disponible (404), se salta")
                continue
            filas = transformar(filas_raw)
            total += len(filas)
            print(f"{anio}-{mes:02d}: {len(filas)} filas")
            if args.dry_run:
                indicadores = sorted({f[3] for f in filas})
                print(f"  indicadores: {indicadores}")
            else:
                upsert(conn, filas)
        print(f"Total filas procesadas: {total}")
        if conn is not None:
            conn.commit()
            print("Commit OK")
    finally:
        if conn is not None:
            conn.close()


if __name__ == "__main__":
    main()
