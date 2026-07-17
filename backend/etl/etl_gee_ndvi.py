"""ETL — NDVI mensual (Google Earth Engine, MODIS/061/MOD13Q1) por departamento.

Variable del Modelo 1 de Fase 5 (Producción por departamento, ver TODO.md).
Compuesto mensual = promedio de los composites de 16 días de MOD13Q1 que caen
en ese mes, enmascarados por SummaryQA<=1 (bueno/marginal, descarta nieve/
hielo y nublado) -- reduceRegions sobre las 19 geometrías reales de
departamentos ya cargadas en inym_gis (capa view_superficie_por_departamentos,
las mismas que usa Mapa GIS / "Superficie cultivada por departamento").

Auth: interactiva (ee.Authenticate(), no cuenta de servicio -- la política de
la organización de Google Cloud bloquea la descarga de claves, ver docs/
fuentes_ndvi_gee.md). El token queda guardado en ~/.config/earthengine/
credentials de esta máquina -- correr `python -c "import ee; ee.Authenticate()"`
una vez si hace falta autenticar en otra máquina.

Uso:
    python -m backend.etl.etl_gee_ndvi --dry-run
    python -m backend.etl.etl_gee_ndvi --start-year 2011
"""

from __future__ import annotations

import argparse
import json
import os
from datetime import date

from dotenv import load_dotenv

MODIS_COLLECTION = "MODIS/061/MOD13Q1"
LAYER_NAME = "view_superficie_por_departamentos"
SCALE_M = 250  # resolución nativa de MOD13Q1
NDVI_SCALE_FACTOR = 0.0001  # MOD13Q1.NDVI viene en enteros -2000..10000


def obtener_geometrias_departamentos(conn) -> list[dict]:
    """Lee las 19 geometrías reales de departamentos ya cargadas en inym_gis
    (simplificadas -- no hace falta precisión de vértice para un promedio de
    zona a 250m, y acelera reduceRegions)."""
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT properties->>'depto', properties->>'pcia',
                   ST_AsGeoJSON(ST_SimplifyPreserveTopology(geom_4326, 0.001))
            FROM inym_gis.v_features_4326
            WHERE layer_name = %s
            ORDER BY properties->>'depto'
            """,
            (LAYER_NAME,),
        )
        return [{"depto": depto, "pcia": pcia, "geojson": json.loads(geojson)} for depto, pcia, geojson in cur.fetchall()]


def construir_feature_collection(deptos: list[dict]):
    import ee

    features = [ee.Feature(ee.Geometry(d["geojson"]), {"depto": d["depto"], "pcia": d["pcia"]}) for d in deptos]
    return ee.FeatureCollection(features)


def _enmascarar_qa(img):
    qa = img.select("SummaryQA")
    return img.updateMask(qa.lte(1))


def compuesto_mensual(anio: int, mes: int):
    """Promedio de los composites de 16 días de MOD13Q1 que caen en el mes,
    enmascarados por calidad. `None` si no hay ningún composite real en ese
    mes (no debería pasar dentro del rango real de la colección, salvo en el
    borde superior -- se maneja en `ultimo_mes_disponible`)."""
    import ee

    desde = ee.Date.fromYMD(anio, mes, 1)
    hasta = desde.advance(1, "month")
    col = ee.ImageCollection(MODIS_COLLECTION).filterDate(desde, hasta).map(_enmascarar_qa)
    return col.select("NDVI").mean().multiply(NDVI_SCALE_FACTOR).rename("ndvi")


def ultimo_mes_disponible() -> tuple[int, int]:
    """Año/mes del composite más reciente en la colección real -- evita
    generar filas para meses futuros sin datos todavía."""
    import ee

    ultimo = ee.ImageCollection(MODIS_COLLECTION).sort("system:time_start", False).first()
    fecha = ee.Date(ultimo.get("system:time_start")).getInfo()
    # getInfo() de ee.Date sin formatear da milisegundos epoch en 'value'
    d = date.fromtimestamp(fecha["value"] / 1000)
    return d.year, d.month


def generar_meses(anio_desde: int, hasta: tuple[int, int]) -> list[tuple[int, int]]:
    anio_hasta, mes_hasta = hasta
    meses = []
    for anio in range(anio_desde, anio_hasta + 1):
        mes_final = mes_hasta if anio == anio_hasta else 12
        for mes in range(1, mes_final + 1):
            meses.append((anio, mes))
    return meses


def procesar_mes(fc, anio: int, mes: int) -> list[tuple]:
    import ee

    img = compuesto_mensual(anio, mes)
    resultado = img.reduceRegions(
        collection=fc,
        reducer=ee.Reducer.mean().combine(ee.Reducer.count(), sharedInputs=True),
        scale=SCALE_M,
    )
    filas = []
    for f in resultado.getInfo()["features"]:
        p = f["properties"]
        ndvi = p.get("mean")
        pixeles = p.get("count")
        filas.append((p["depto"], p["pcia"], anio, mes, round(ndvi, 4) if ndvi is not None else None, pixeles))
    return filas


def upsert(conn, filas: list[tuple]) -> None:
    from psycopg2.extras import execute_values

    query = """
        INSERT INTO ym.ndvi_mensual (depto, pcia, anio, mes, ndvi_promedio, pixeles_validos)
        VALUES %s
        ON CONFLICT (depto, pcia, anio, mes) DO UPDATE SET
            ndvi_promedio = EXCLUDED.ndvi_promedio,
            pixeles_validos = EXCLUDED.pixeles_validos
    """
    with conn.cursor() as cur:
        execute_values(cur, query, filas)


def main() -> None:
    load_dotenv()
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--start-year", type=int, default=2011)
    parser.add_argument("--dry-run", action="store_true", help="Solo descarga e imprime, no escribe en la DB")
    parser.add_argument("--meses-dry-run", type=int, default=3, help="Cuántos meses procesar en --dry-run (por defecto los primeros 3)")
    args = parser.parse_args()

    import ee
    import psycopg2

    ee.Initialize(project=os.environ["GEE_PROJECT_ID"])

    conn = psycopg2.connect(os.environ["DATABASE_URL"])
    try:
        deptos = obtener_geometrias_departamentos(conn)
        print(f"Departamentos: {len(deptos)}")
        fc = construir_feature_collection(deptos)

        anio_hasta, mes_hasta = ultimo_mes_disponible()
        print(f"Último composite real disponible: {anio_hasta}-{mes_hasta:02d}")
        meses = generar_meses(args.start_year, (anio_hasta, mes_hasta))
        if args.dry_run:
            meses = meses[: args.meses_dry_run]
        print(f"Meses a procesar: {len(meses)} ({meses[0]} a {meses[-1]})")

        for anio, mes in meses:
            filas = procesar_mes(fc, anio, mes)
            print(f"  {anio}-{mes:02d} -> {len(filas)} filas", filas[0] if args.dry_run else "")
            if not args.dry_run:
                upsert(conn, filas)
                conn.commit()

        if args.dry_run:
            print("Dry-run OK, no se escribió nada en la DB.")
    finally:
        conn.close()


if __name__ == "__main__":
    main()
