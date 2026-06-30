"""
ETL — Capas geoespaciales del INYM (gis.inym.org.ar)
=====================================================

Descarga las capas WFS confirmadas del GeoServer del INYM, las normaliza
y las carga a PostGIS. Diseñado para correr como job programado (cron de
GitHub Actions / Railway) una vez por semana o por mes — estos datos
(superficie cultivada, secaderos) cambian poco y de forma lenta.

Requisitos:
    pip install requests geopandas sqlalchemy geoalchemy2 psycopg2-binary shapely

Variables de entorno esperadas:
    DATABASE_URL  -> postgresql://user:pass@host:port/dbname  (Supabase/Render/etc.)

Uso:
    python etl_inym_gis.py                 # corre todas las capas activas
    python etl_inym_gis.py --layer view_mat_gis_marketing_puntos_secaderos
    python etl_inym_gis.py --dry-run        # descarga e imprime el esquema, no escribe en la DB
"""

import argparse
import json
import logging
import os
import sys
from datetime import date

import geopandas as gpd
import requests
from sqlalchemy import create_engine, text

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger("etl_inym_gis")

BASE_WFS_URL = "https://gis.inym.org.ar/geoserver_disabled/wfs"
WORKSPACE = "shapes_inym"
SOURCE_SRID = 3857  # el GeoServer del INYM devuelve todo en Web Mercator

# Inventario de capas confirmadas manualmente inspeccionando el visor (ver chat).
# 'Superficies por Cob. de Árboles' y 'Mapas de Calor de Cultivos' figuran en el
# menú pero no están implementadas del lado del INYM (no disparan ninguna request).
LAYERS = [
    # --- Límites / superficie total ---
    {"name": "view_superficie_por_municipios", "categoria": "limites", "nivel": "municipio"},
    {"name": "view_superficie_por_departamentos", "categoria": "limites", "nivel": "departamento"},
    {"name": "view_superficie_por_provincias", "categoria": "limites", "nivel": "provincia"},
    {"name": "view_superficie_por_zonas", "categoria": "limites", "nivel": "zona"},
    # --- Edad de plantación ---
    {"name": "view_superficie_edad_por_municipios", "categoria": "edad", "nivel": "municipio"},
    {"name": "view_superficie_edad_por_departamentos", "categoria": "edad", "nivel": "departamento"},
    {"name": "view_superficie_edad_por_provincias", "categoria": "edad", "nivel": "provincia"},
    {"name": "view_superficie_edad_por_zonas", "categoria": "edad", "nivel": "zona"},
    # --- Densidad de plantación ---
    {"name": "view_superficie_densidad_por_municipios", "categoria": "densidad", "nivel": "municipio"},
    {"name": "view_superficie_densidad_por_departamentos", "categoria": "densidad", "nivel": "departamento"},
    {"name": "view_superficie_densidad_por_provincias", "categoria": "densidad", "nivel": "provincia"},
    {"name": "view_superficie_densidad_por_zonas", "categoria": "densidad", "nivel": "zona"},
    # --- Cultivo consociado (asociado con otras especies) ---
    {"name": "view_superficie_consociado_por_municipios", "categoria": "consociado", "nivel": "municipio"},
    {"name": "view_superficie_consociado_por_departamentos", "categoria": "consociado", "nivel": "departamento"},
    {"name": "view_superficie_consociado_por_provincias", "categoria": "consociado", "nivel": "provincia"},
    {"name": "view_superficie_consociado_por_zonas", "categoria": "consociado", "nivel": "zona"},
    # --- Secaderos ---
    {"name": "view_mat_gis_marketing_puntos_secaderos", "categoria": "secaderos", "nivel": "punto"},
    {"name": "view_gis_marketing_secaderos_por_municipios", "categoria": "secaderos", "nivel": "municipio"},
    {"name": "view_gis_marketing_secaderos_por_departamentos", "categoria": "secaderos", "nivel": "departamento"},
    {"name": "view_gis_marketing_secaderos_por_provincias", "categoria": "secaderos", "nivel": "provincia"},
    {"name": "view_gis_marketing_secaderos_por_zonas", "categoria": "secaderos", "nivel": "zona"},
]


def fetch_layer(layer_name: str, srid: int = SOURCE_SRID, timeout: int = 60) -> dict:
    """Descarga una capa WFS completa como GeoJSON (dict)."""
    params = {
        "service": "WFS",
        "version": "1.0.0",
        "request": "GetFeature",
        "typename": f"{WORKSPACE}:{layer_name}",
        "outputFormat": "application/json",
        "srsname": f"EPSG:{srid}",
    }
    log.info(f"Descargando capa: {layer_name}")
    resp = requests.get(BASE_WFS_URL, params=params, timeout=timeout)
    resp.raise_for_status()
    data = resp.json()
    n = data.get("totalFeatures", len(data.get("features", [])))
    log.info(f"  -> {n} features recibidas")
    return data


def geojson_to_gdf(geojson: dict, srid: int = SOURCE_SRID) -> gpd.GeoDataFrame:
    """Convierte el GeoJSON crudo a GeoDataFrame, reproyectado a WGS84 (4326)."""
    gdf = gpd.GeoDataFrame.from_features(geojson["features"], crs=f"EPSG:{srid}")
    gdf = gdf.to_crs(epsg=4326)
    return gdf


def print_schema(layer_name: str, gdf: gpd.GeoDataFrame) -> None:
    """Imprime las columnas y un ejemplo de fila — clave la primera vez que se
    corre cada capa nueva, para confirmar los nombres reales de atributos
    (edad, densidad, superficie en hectáreas, etc.) que en la inspección manual
    quedaron truncados por el tamaño de la geometría."""
    cols = [c for c in gdf.columns if c != "geometry"]
    print(f"\n=== Esquema de columnas: {layer_name} ===")
    print(cols)
    if len(gdf) > 0:
        print("--- Ejemplo de fila (sin geometría) ---")
        print(gdf.iloc[0][cols].to_dict())
    print()


def load_to_postgis(gdf: gpd.GeoDataFrame, layer_name: str, categoria: str, nivel: str, engine) -> None:
    """Carga el GeoDataFrame a la tabla raw genérica (inym_gis.raw_features),
    serializando todas las propiedades a JSONB para no depender de un esquema
    fijo por capa."""
    snapshot_date = date.today().isoformat()
    cols = [c for c in gdf.columns if c != "geometry"]

    rows = []
    for idx, row in gdf.iterrows():
        feature_gid = row.get("id") if "id" in cols else f"{layer_name}.{idx}"
        properties = {c: (row[c] if not hasattr(row[c], "item") else row[c].item()) for c in cols}
        rows.append(
            {
                "layer_name": layer_name,
                "feature_gid": str(feature_gid),
                "snapshot_date": snapshot_date,
                "geom_wkt": row.geometry.wkt if row.geometry is not None else None,
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
    log.info(f"  -> {len(rows)} filas cargadas/actualizadas en inym_gis.raw_features")


def load_secaderos_puntos(gdf: gpd.GeoDataFrame, engine) -> None:
    """Carga especializada para la capa de puntos de secaderos, que ya tiene
    esquema confirmado: id, idplanta, dir_catastral, latitud, longitud."""
    snapshot_date = date.today().isoformat()
    rows = gdf[["id", "idplanta", "dir_catastral", "latitud", "longitud"]].copy()
    rows["snapshot_date"] = snapshot_date

    insert_sql = text(
        """
        INSERT INTO inym_gis.secaderos (id, idplanta, dir_catastral, latitud, longitud, snapshot_date)
        VALUES (:id, :idplanta, :dir_catastral, :latitud, :longitud, :snapshot_date)
        ON CONFLICT (id) DO UPDATE SET
            idplanta = EXCLUDED.idplanta,
            dir_catastral = EXCLUDED.dir_catastral,
            latitud = EXCLUDED.latitud,
            longitud = EXCLUDED.longitud,
            snapshot_date = EXCLUDED.snapshot_date
        """
    )
    with engine.begin() as conn:
        conn.execute(insert_sql, rows.to_dict(orient="records"))
    log.info(f"  -> {len(rows)} secaderos cargados/actualizados en inym_gis.secaderos")


def main():
    parser = argparse.ArgumentParser(description="ETL de capas geoespaciales del INYM")
    parser.add_argument("--layer", help="Nombre de una sola capa a correr (por defecto: todas)")
    parser.add_argument("--dry-run", action="store_true", help="Solo descarga e imprime el esquema, no escribe en la DB")
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
            geojson = fetch_layer(layer["name"])
            gdf = geojson_to_gdf(geojson)

            if args.dry_run:
                print_schema(layer["name"], gdf)
                continue

            if layer["name"] == "view_mat_gis_marketing_puntos_secaderos":
                load_secaderos_puntos(gdf, engine)
            else:
                load_to_postgis(gdf, layer["name"], layer["categoria"], layer["nivel"], engine)

        except requests.HTTPError as e:
            log.error(f"Error HTTP en {layer['name']}: {e}")
        except Exception as e:
            log.exception(f"Error inesperado procesando {layer['name']}: {e}")

    log.info("ETL finalizado.")


if __name__ == "__main__":
    main()
