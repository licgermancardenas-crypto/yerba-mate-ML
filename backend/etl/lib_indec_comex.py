"""Lógica compartida por los ETLs contra comexbe.indec.gob.ar (INDEC Comercio
Exterior) -- exportaciones e importaciones de yerba mate comparten la misma
API, el mismo formato de respuesta y el mismo gotcha de países duplicados.

Ver docs/fuentes_exportaciones_indec.md para el detalle completo de la fuente
(posiciones NCM, secreto estadístico, validación contra INYM).
"""

from __future__ import annotations

import json

import requests

API_URL = "https://comexbe.indec.gob.ar/public-api/search/"
NCM_YERBA_MATE = ["09030010", "09030090"]


def fetch_anio(anio: int, commerce_type: str, timeout: int = 60) -> list[dict]:
    """Trae las filas mes x país x NCM de un año. commerce_type: 'export' | 'import'."""
    params = {
        "commerceType": commerce_type,
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
            if f["weight"] >= (acc.get("_peso_max") or 0):
                acc["pais_nombre"] = f["country"]["name"]
                acc["_peso_max"] = f["weight"]

    filas = []
    for (mes, ncm, iso2), acc in agregado.items():
        filas.append((anio, mes, ncm, iso2, acc["pais_nombre"], acc["peso_kg"], acc["monto_fob_usd"], acc["es_confidencial"]))
    return filas


def upsert(conn, filas: list[tuple], tabla: str) -> None:
    from psycopg2.extras import execute_values

    cols = ["anio", "mes", "ncm", "pais_iso2", "pais_nombre", "peso_kg", "monto_fob_usd", "es_confidencial"]
    pk = ["anio", "mes", "ncm", "pais_iso2"]
    update_cols = [c for c in cols if c not in pk]
    query = (
        f"INSERT INTO {tabla} ({', '.join(cols)}) VALUES %s "
        f"ON CONFLICT ({', '.join(pk)}) DO UPDATE SET "
        + ", ".join(f"{c} = EXCLUDED.{c}" for c in update_cols)
    )
    with conn.cursor() as cur:
        execute_values(cur, query, filas)
