"""ETL — Exportaciones reales de yerba mate por país (INDEC Comercio Exterior).

Reemplaza el desglose mensual/por destino de ym.exportaciones, anulado en la
auditoría de datos de 2026-07-11 por ser sintético (ver docs/auditoria_datos.md).

Fuente: comexbe.indec.gob.ar (Sistema de Consulta de Comercio Exterior de
Bienes del INDEC), backend REST público sin autenticación descubierto detrás
de la UI web. Posiciones NCM de 8 dígitos propias de yerba mate (no mezclada
con café/té/especias como la serie agregada de apis.datos.gob.ar, ya evaluada
y descartada en Fase 3a):
    09030010  Yerba mate simplemente canchada
    09030090  Yerba mate excluida simplemente canchada (la gran mayoría del volumen)

Cobertura: mensual, por país (ISO2), 2002-presente. Validado 2026-07-11 contra
el total oficial INYM 2025 (57.980.911 kg): suma de filas no confidenciales =
55.633.560 kg, 96% de cobertura -- ver docs/fuentes_exportaciones_indec.md.

Secreto estadístico: cuando hay pocos operadores para una combinación
NCM×país×mes, esa celda viene con `isConfidential: true` y weight/amount en 0
(dummy, no un cero real). Se carga como NULL, nunca como 0 -- ver
docs/auditoria_datos.md, regla "NULL es un valor válido".

Uso:
    python -m backend.etl.etl_indec_comex_exportaciones --dry-run
    python -m backend.etl.etl_indec_comex_exportaciones --start-year 2002 --end-year 2026
"""

from __future__ import annotations

import argparse
import json
import os
from datetime import date

import requests
from dotenv import load_dotenv

API_URL = "https://comexbe.indec.gob.ar/public-api/search/"
NCM_YERBA_MATE = ["09030010", "09030090"]


def fetch_anio(anio: int, timeout: int = 60) -> list[dict]:
    """Trae las 12 filas/mes x país x NCM de un año. Lista vacía si no hay datos."""
    params = {
        "commerceType": "export",
        "year": anio,
        "period": "month",
        "countryQuery": "allCountries",
        "products": json.dumps(NCM_YERBA_MATE),
        "countries": "[]",
    }
    resp = requests.get(API_URL, params=params, timeout=timeout)
    resp.raise_for_status()
    return resp.json()


def transformar(anio: int, filas_raw: list[dict]) -> list[tuple]:
    """Agrega por (mes, ncm, pais_iso2) -- la fuente reporta algunas zonas
    aduaneras especiales como país separado con el mismo ISO2 (ej. 'Chile' y
    'Punta Arenas (Chile)' comparten iso2='CL'), lo que rompería la PK si no
    se suman. `es_confidencial` queda True solo si TODAS las filas agregadas
    lo son (si al menos una tiene dato real, se usa el real)."""
    agregado: dict[tuple, dict] = {}
    for f in filas_raw:
        confidencial = bool(f.get("isConfidential", False))
        clave = (f["month"], f["product"]["id"], f["country"]["iso2"])
        acc = agregado.setdefault(
            clave,
            {"pais_nombre": f["country"]["name"], "peso_kg": None, "monto_fob_usd": None, "es_confidencial": True},
        )
        if not confidencial:
            acc["peso_kg"] = (acc["peso_kg"] or 0) + f["weight"]
            acc["monto_fob_usd"] = (acc["monto_fob_usd"] or 0) + f["amount"]
            acc["es_confidencial"] = False
            # país "principal" (el de mayor peso) manda el nombre mostrado
            if f["weight"] >= (acc.get("_peso_max") or 0):
                acc["pais_nombre"] = f["country"]["name"]
                acc["_peso_max"] = f["weight"]

    filas = []
    for (mes, ncm, iso2), acc in agregado.items():
        filas.append((anio, mes, ncm, iso2, acc["pais_nombre"], acc["peso_kg"], acc["monto_fob_usd"], acc["es_confidencial"]))
    return filas


def upsert(conn, filas: list[tuple]) -> None:
    from psycopg2.extras import execute_values

    cols = ["anio", "mes", "ncm", "pais_iso2", "pais_nombre", "peso_kg", "monto_fob_usd", "es_confidencial"]
    pk = ["anio", "mes", "ncm", "pais_iso2"]
    update_cols = [c for c in cols if c not in pk]
    query = (
        f"INSERT INTO ym.exportaciones_indec ({', '.join(cols)}) VALUES %s "
        f"ON CONFLICT ({', '.join(pk)}) DO UPDATE SET "
        + ", ".join(f"{c} = EXCLUDED.{c}" for c in update_cols)
    )
    with conn.cursor() as cur:
        execute_values(cur, query, filas)


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
            filas_raw = fetch_anio(anio)
            if not filas_raw:
                print(f"{anio}: sin datos, se salta")
                continue
            filas = transformar(anio, filas_raw)
            n_conf = sum(1 for f in filas if f[7])
            total += len(filas)
            total_confidencial += n_conf
            peso_real = sum(f[5] for f in filas if f[5] is not None)
            print(f"{anio}: {len(filas)} filas ({n_conf} confidenciales) — {peso_real:,.0f} kg reales".replace(",", "."))
            if not args.dry_run:
                upsert(conn, filas)
        print(f"\nTotal: {total} filas, {total_confidencial} confidenciales ({100*total_confidencial/total:.1f}%)" if total else "Sin filas")
        if conn is not None:
            conn.commit()
            print("Commit OK")
    finally:
        if conn is not None:
            conn.close()


if __name__ == "__main__":
    main()
