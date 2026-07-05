"""
ETL — Cartografía censal del INDEC (geonode.indec.gob.ar)
==========================================================

El IGN (ign.gob.ar, wms.ign.gob.ar, incluidos sus links de descarga
directa `ign.gob.ar/descargas/...`) es INALCANZABLE desde este entorno
(timeout total confirmado con curl directo, no solo fetch — reintentado
2026-07-05, mismo resultado). El WFS de GeoNode del INDEC sí responde y
sirve capas equivalentes (una de ellas, jurisdicciones, declara "sag":
"IGN" como fuente — o sea, cartografía originada en el IGN, republicada
por el INDEC).

Descarga 5 capas del Marco Geoestadístico Nacional, filtradas a Misiones
y Corrientes (única zona relevante para este proyecto), y las carga en
la MISMA tabla genérica `inym_gis.raw_features` que ya usa el ETL del
INYM (`etl_inym_gis.py`) — incluida a pesar del nombre del schema, que
ya no es exclusivamente INYM: el diseño raw_features + properties JSONB
es agnóstico a la fuente, y así estas capas quedan visibles de una en el
selector de Mapa GIS sin tocar el backend ni el frontend.

Capas cargadas:
    - jurisdicciones        (provincias)
    - departamentos
    - fracciones_censales
    - radios_censales2      (la más granular — miles de polígonos)
    - localidades_censales  (puntos)

Requisitos: los mismos de etl_inym_gis.py (requests, geopandas, sqlalchemy).

Uso:
    python -m backend.etl.etl_indec_censal --dry-run
    python -m backend.etl.etl_indec_censal
"""

import argparse
import json
import logging
import os
import sys
from datetime import date

import geopandas as gpd
import requests
from dotenv import load_dotenv
from sqlalchemy import create_engine, text

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger("etl_indec_censal")

BASE_WFS_URL = "https://geonode.indec.gob.ar/geoserver/ows"
WORKSPACE = "geonode"
SOURCE_SRID = 3857
PROVINCIAS = ["Misiones", "Corrientes"]

LAYERS = [
    {"name": "jurisdicciones", "categoria": "indec_jurisdicciones", "nivel": "provincia", "filtro_campo": "nam"},
    {"name": "departamentos", "categoria": "indec_departamentos", "nivel": "departamento", "filtro_campo": "jur"},
    {"name": "fracciones_censales", "categoria": "indec_fracciones", "nivel": "fraccion", "filtro_campo": "jur"},
    {"name": "radios_censales2", "categoria": "indec_radios_censales", "nivel": "radio", "filtro_campo": "jur"},
    {"name": "localidades_censales", "categoria": "indec_localidades", "nivel": "localidad", "filtro_campo": "jur"},
]

# Layer_name con el que quedan catalogadas (distinto del nombre WFS, para no
# pisar futuras capas del INYM con el mismo nombre corto).
LAYER_NAME_PREFIX = "indec_"


def fetch_layer(layer_name: str, filtro_campo: str, timeout: int = 180) -> dict:
    """Descarga una capa WFS filtrada a Misiones/Corrientes vía CQL_FILTER."""
    valores = ",".join(f"'{p}'" for p in PROVINCIAS)
    cql = f"{filtro_campo} IN ({valores})"
    params = {
        "service": "WFS",
        "version": "1.0.0",
        "request": "GetFeature",
        "typeName": f"{WORKSPACE}:{layer_name}",
        "outputFormat": "application/json",
        "CQL_FILTER": cql,
    }
    log.info(f"Descargando capa: {layer_name} (filtro: {cql})")
    resp = requests.get(BASE_WFS_URL, params=params, timeout=timeout)
    resp.raise_for_status()
    data = resp.json()
    n = len(data.get("features", []))
    log.info(f"  -> {n} features recibidas")
    return data


def geojson_to_gdf(geojson: dict, srid: int = SOURCE_SRID) -> gpd.GeoDataFrame:
    gdf = gpd.GeoDataFrame.from_features(geojson["features"], crs=f"EPSG:{srid}")
    gdf = gdf.to_crs(epsg=4326)
    return gdf


def print_schema(layer_name: str, gdf: gpd.GeoDataFrame) -> None:
    cols = [c for c in gdf.columns if c != "geometry"]
    print(f"\n=== Esquema de columnas: {layer_name} ({len(gdf)} features) ===")
    print(cols)
    if len(gdf) > 0:
        print("--- Ejemplo de fila (sin geometría) ---")
        print(gdf.iloc[0][cols].to_dict())
    print()


def load_to_postgis(gdf: gpd.GeoDataFrame, layer_name: str, engine) -> None:
    snapshot_date = date.today().isoformat()
    cols = [c for c in gdf.columns if c != "geometry"]

    rows = []
    for idx, row in gdf.iterrows():
        feature_gid = row.get("cod_indec") or row.get("id") or f"{layer_name}.{idx}"
        properties = {c: (row[c] if not hasattr(row[c], "item") else row[c].item()) for c in cols}
        if row.geometry is None:
            continue
        rows.append(
            {
                "layer_name": layer_name,
                "feature_gid": str(feature_gid),
                "snapshot_date": snapshot_date,
                "geom_wkt": row.geometry.wkt,
                "properties": json.dumps(properties, default=str),
            }
        )

    insert_sql = text(
        """
        INSERT INTO inym_gis.raw_features (layer_name, feature_gid, snapshot_date, geom, properties)
        VALUES (:layer_name, :feature_gid, :snapshot_date,
                ST_SetSRID(ST_GeomFromText(:geom_wkt), 4326), :properties)
        ON CONFLICT (layer_name, feature_gid, snapshot_date)
        DO UPDATE SET geom = EXCLUDED.geom, properties = EXCLUDED.properties
        """
    )
    with engine.begin() as conn:
        conn.execute(insert_sql, rows)
    log.info(f"  -> {len(rows)} filas cargadas/actualizadas en inym_gis.raw_features (layer_name={layer_name})")


def upsert_catalogo(layer_name: str, categoria: str, nivel: str, geom_type: str, descripcion: str, engine) -> None:
    stmt = text(
        """
        INSERT INTO inym_gis.catalogo_capas (layer_name, categoria, nivel_espacial, geom_type, activa, descripcion)
        VALUES (:layer_name, :categoria, :nivel, :geom_type, TRUE, :descripcion)
        ON CONFLICT (layer_name) DO UPDATE SET
            categoria = EXCLUDED.categoria, nivel_espacial = EXCLUDED.nivel_espacial,
            geom_type = EXCLUDED.geom_type, descripcion = EXCLUDED.descripcion
        """
    )
    with engine.begin() as conn:
        conn.execute(
            stmt,
            {"layer_name": layer_name, "categoria": categoria, "nivel": nivel, "geom_type": geom_type, "descripcion": descripcion},
        )


def main():
    load_dotenv()
    parser = argparse.ArgumentParser(description="ETL de cartografía censal del INDEC (Misiones/Corrientes)")
    parser.add_argument("--layer", help="Nombre de una sola capa a correr (por defecto: todas)")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    layers_to_run = [l for l in LAYERS if args.layer is None or l["name"] == args.layer]
    if not layers_to_run:
        log.error(f"Capa '{args.layer}' no encontrada en el inventario.")
        sys.exit(1)

    engine = None
    if not args.dry_run:
        db_url = os.environ.get("DATABASE_URL")
        if not db_url:
            log.error("Falta la variable de entorno DATABASE_URL.")
            sys.exit(1)
        engine = create_engine(db_url)

    for layer in layers_to_run:
        try:
            geojson = fetch_layer(layer["name"], layer["filtro_campo"])
            gdf = geojson_to_gdf(geojson)
            geom_type = gdf.geometry.geom_type.mode()[0] if len(gdf) else "Unknown"
            layer_name = f"{LAYER_NAME_PREFIX}{layer['name']}"

            if args.dry_run:
                print_schema(layer_name, gdf)
                print(f"  geom_type dominante: {geom_type}")
                continue

            load_to_postgis(gdf, layer_name, engine)
            upsert_catalogo(
                layer_name,
                layer["categoria"],
                layer["nivel"],
                geom_type,
                f"{layer['name']} del Marco Geoestadístico Nacional (INDEC/GeoNode), Misiones y Corrientes",
                engine,
            )

        except requests.HTTPError as e:
            log.error(f"Error HTTP en {layer['name']}: {e}")
        except Exception as e:
            log.exception(f"Error inesperado procesando {layer['name']}: {e}")

    log.info("ETL finalizado.")


if __name__ == "__main__":
    main()
