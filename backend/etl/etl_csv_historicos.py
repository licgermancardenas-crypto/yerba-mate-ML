"""ETL de los 7 CSVs históricos del INYM hacia el esquema `ym.*` en Postgres.

Uso:
    python -m backend.etl.etl_csv_historicos --csv-dir data/raw
    python -m backend.etl.etl_csv_historicos --dry-run   # solo valida y cuenta filas, no escribe

Los CSV usan formato numérico argentino ('.' miles, ',' decimal, a veces con
prefijo '$') y separador de columnas ';'. Ver notas de calidad de datos en
backend/db/schema.sql (sección ESQUEMA YM): varios valores se repiten los 12
meses del año porque son datos anuales publicados con cadencia mensual, no
placeholders.
"""

from __future__ import annotations

import argparse
import os
import re
from pathlib import Path

import pandas as pd
from dotenv import load_dotenv

MESES = {
    "Enero": 1,
    "Febrero": 2,
    "Marzo": 3,
    "Abril": 4,
    "Mayo": 5,
    "Junio": 6,
    "Julio": 7,
    "Agosto": 8,
    "Septiembre": 9,
    "Setiembre": 9,
    "Octubre": 10,
    "Noviembre": 11,
    "Diciembre": 12,
}

_THOUSANDS_GROUP = re.compile(r"^\d{1,3}(\.\d{3})+$")


def parse_numero_ar(valor) -> float | None:
    """Convierte un número en formato argentino ('$ 1.234,56', '83333', '7,8') a float."""
    if valor is None or (isinstance(valor, float) and pd.isna(valor)):
        return None
    s = str(valor).strip().replace("$", "").replace(" ", "")
    if s == "":
        return None
    has_comma = "," in s
    has_dot = "." in s
    if has_comma and has_dot:
        s = s.replace(".", "").replace(",", ".")
    elif has_comma:
        s = s.replace(",", ".")
    elif has_dot and _THOUSANDS_GROUP.match(s):
        s = s.replace(".", "")
    return float(s)


def leer_csv(path: Path) -> pd.DataFrame:
    return pd.read_csv(path, sep=";", encoding="utf-8-sig", dtype=str)


def _mes_numero(row_mes_nombre: str) -> int:
    return MESES[row_mes_nombre.strip()]


# ----------------------------------------------------------------------------
# Transformaciones por archivo -> filas listas para upsert
# ----------------------------------------------------------------------------

def transformar_dataset_principal(df: pd.DataFrame) -> list[tuple]:
    filas = []
    for _, r in df.iterrows():
        filas.append(
            (
                int(r["Año"]),
                int(r["Numero de Mes"]),
                r["Mes"].strip(),
                r["Provincia"].strip(),
                r["Ciudad"].strip(),
                parse_numero_ar(r["Producción (kg)"]),
                parse_numero_ar(r["Consumo interno (kg)"]),
                parse_numero_ar(r["Exportaciones (kg)"]),
                parse_numero_ar(r["Precio USD por kg"]),
                parse_numero_ar(r["Valor FOB (USD)"]),
            )
        )
    return filas


def transformar_consumo_interno(df: pd.DataFrame) -> list[tuple]:
    filas = []
    for _, r in df.iterrows():
        filas.append(
            (
                int(r["Año"]),
                int(r["Numero de Mes"]),
                r["Mes"].strip(),
                parse_numero_ar(r["Consumo per cápita (kg/persona)"]),
                parse_numero_ar(r["Envase 0,5 kg (%)"]),
                parse_numero_ar(r["Envase 1 kg (%)"]),
                parse_numero_ar(r["Envase 2 kg (%)"]),
                parse_numero_ar(r["Envase 0,25 kg (%)"]),
                parse_numero_ar(r["Otros envases (%)"]),
                parse_numero_ar(r["Sin estampillas (%)"]),
            )
        )
    return filas


def transformar_exportaciones(df: pd.DataFrame) -> list[tuple]:
    filas = []
    for _, r in df.iterrows():
        filas.append(
            (
                int(r["Año"]),
                int(r["Numero de Mes"]),
                r["Mes"].strip(),
                r["Destino"].strip(),
                parse_numero_ar(r["Volumen Exportado (kg)"]),
                parse_numero_ar(r["Valor FOB (USD)"]),
                parse_numero_ar(r["Precio FOB por kg (USD)"]),
            )
        )
    return filas


def transformar_importaciones(df: pd.DataFrame) -> list[tuple]:
    filas = []
    for _, r in df.iterrows():
        mes_nombre = r["Mes"].strip()
        filas.append(
            (
                int(r["Año"]),
                _mes_numero(mes_nombre),
                mes_nombre,
                parse_numero_ar(r["Importaciones (kg)"]),
            )
        )
    return filas


def transformar_precios(df: pd.DataFrame) -> list[tuple]:
    filas = []
    for _, r in df.iterrows():
        mes_nombre = r["Mes"].strip()
        filas.append(
            (
                int(r["Año"]),
                _mes_numero(mes_nombre),
                mes_nombre,
                parse_numero_ar(r["Precio hoja verde (ARS/kg)"]),
                parse_numero_ar(r["Precio canchada (ARS/kg)"]),
            )
        )
    return filas


def transformar_competencia(df: pd.DataFrame) -> list[tuple]:
    filas = []
    for _, r in df.iterrows():
        filas.append(
            (
                int(r["Año"]),
                r["Empresa"].strip(),
                parse_numero_ar(r["Cuota de mercado (%)"]),
                parse_numero_ar(r["Volumen (kg)"]),
            )
        )
    return filas


def transformar_superficie_productores(df: pd.DataFrame) -> list[tuple]:
    filas = []
    for _, r in df.iterrows():
        filas.append(
            (
                int(r["Año"]),
                int(r["Numero de Mes"]),
                r["Mes"].strip(),
                r["Provincia"].strip(),
                r["Ciudad"].strip(),
                int(parse_numero_ar(r["Productores"])),
                parse_numero_ar(r["Superficie (ha)"]),
            )
        )
    return filas


# ----------------------------------------------------------------------------
# Registro: archivo -> (tabla destino, columnas, función de transformación, PK)
# ----------------------------------------------------------------------------

TABLAS = {
    "dataset_principal.csv": (
        "ym.dataset_principal",
        [
            "anio", "mes", "mes_nombre", "provincia", "ciudad",
            "produccion_kg", "consumo_interno_kg", "exportaciones_kg",
            "precio_usd_kg", "valor_fob_usd",
        ],
        transformar_dataset_principal,
        ["anio", "mes", "provincia", "ciudad"],
    ),
    "consumo_interno.csv": (
        "ym.consumo_interno",
        [
            "anio", "mes", "mes_nombre", "consumo_per_capita_kg",
            "envase_05kg_pct", "envase_1kg_pct", "envase_2kg_pct",
            "envase_025kg_pct", "otros_envases_pct", "sin_estampillas_pct",
        ],
        transformar_consumo_interno,
        ["anio", "mes"],
    ),
    "exportaciones.csv": (
        "ym.exportaciones",
        [
            "anio", "mes", "mes_nombre", "destino",
            "volumen_kg", "valor_fob_usd", "precio_fob_usd_kg",
        ],
        transformar_exportaciones,
        ["anio", "mes", "destino"],
    ),
    "importaciones.csv": (
        "ym.importaciones",
        ["anio", "mes", "mes_nombre", "volumen_kg"],
        transformar_importaciones,
        ["anio", "mes"],
    ),
    "precios_historicos.csv": (
        "ym.precios",
        ["anio", "mes", "mes_nombre", "precio_hoja_verde_ars", "precio_canchada_ars"],
        transformar_precios,
        ["anio", "mes"],
    ),
    "competencia.csv": (
        "ym.competencia",
        ["anio", "empresa", "cuota_mercado_pct", "volumen_kg"],
        transformar_competencia,
        ["anio", "empresa"],
    ),
    "superficie_productores.csv": (
        "ym.superficie_productores",
        ["anio", "mes", "mes_nombre", "provincia", "ciudad", "productores", "superficie_ha"],
        transformar_superficie_productores,
        ["anio", "mes", "provincia", "ciudad"],
    ),
}


def upsert(conn, tabla: str, columnas: list[str], filas: list[tuple], pk: list[str]) -> None:
    from psycopg2.extras import execute_values

    cols_sql = ", ".join(columnas)
    update_cols = [c for c in columnas if c not in pk]
    set_sql = ", ".join(f"{c} = EXCLUDED.{c}" for c in update_cols)
    query = (
        f"INSERT INTO {tabla} ({cols_sql}) VALUES %s "
        f"ON CONFLICT ({', '.join(pk)}) DO UPDATE SET {set_sql}"
    )
    with conn.cursor() as cur:
        execute_values(cur, query, filas)


def main() -> None:
    load_dotenv()
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--csv-dir", default="data/raw", help="Carpeta con los 7 CSV fuente")
    parser.add_argument("--dry-run", action="store_true", help="Solo parsea y cuenta filas, no escribe en la DB")
    args = parser.parse_args()

    csv_dir = Path(args.csv_dir)
    conn = None
    if not args.dry_run:
        import psycopg2

        conn = psycopg2.connect(os.environ["DATABASE_URL"])

    try:
        for archivo, (tabla, columnas, transformar, pk) in TABLAS.items():
            path = csv_dir / archivo
            df = leer_csv(path)
            filas = transformar(df)
            print(f"{archivo}: {len(filas)} filas -> {tabla}")
            if not args.dry_run:
                upsert(conn, tabla, columnas, filas, pk)
        if conn is not None:
            conn.commit()
            print("Commit OK")
    finally:
        if conn is not None:
            conn.close()


if __name__ == "__main__":
    main()
