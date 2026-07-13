"""
ETL — Infraestructura de transporte (IGN, Capas SIG 250)
==========================================================

Fuente: Instituto Geográfico Nacional, paquete "Capas SIG 250" (descarga
directa vía ign.gob.ar). Igual que en `etl_indec_censal.py`, los endpoints
directos del IGN son inalcanzables desde este entorno (timeout confirmado) —
los GeoJSON originales se descargaron manualmente fuera de sesión y se
recortaron una sola vez a Misiones+Corrientes (+3km de buffer, para no
cortar cruces/puentes justo en el límite provincial) antes de commitear:
ver `data/raw/gis_transporte/`. Los originales eran de alcance nacional
(vial_nacional 7MB, vial_provincial 30MB) — el recorte los redujo a ~2.5MB
combinados sin perder ningún tramo relevante para la zona yerbatera.

Se cargaron 3 de las 8 capas descargadas por el usuario; se descartaron por
bajo valor analítico para este proyecto (no es que falten, están en
`Downloads/transporte capa gis/` si en el futuro hiciera falta revisarlas):
    - vial_terciaria.geojson (88MB nacional): caminos rurales de detalle,
      demasiado pesada para el fetch cache de Next.js sin agregar contexto
      relevante sobre el nacional+provincial.
    - infraestructura_de_transporte_030801/AQ170 (peajes, estaciones de
      servicio): puntual, no vinculado a la cadena logística yerbatera.
    - lineas_de_cruces_y_enlaces (puentes): posible capa futura si se
      analiza logística de exportación por pasos fronterizos, no pedida.

Misma tabla genérica que el resto de las capas GIS del proyecto
(inym_gis.raw_features + inym_gis.catalogo_capas) — sin cambios de schema
ni de backend, las 3 capas quedan disponibles solas en el selector de
Mapa GIS en cuanto se registran en el catálogo.

Uso:
    python -m backend.etl.etl_ign_transporte --dry-run
    python -m backend.etl.etl_ign_transporte
"""

import argparse
import json
import logging
import os
import sys
from datetime import date

import geopandas as gpd
from dotenv import load_dotenv
from sqlalchemy import create_engine, text

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger("etl_ign_transporte")

DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "data", "raw", "gis_transporte")

LAYERS = [
    {
        "archivo": "vial_nacional.geojson",
        "layer_name": "ign_vial_nacional",
        "nivel": "vial_nacional",
        "descripcion": "Red vial de jurisdicción nacional (rutas nacionales) — IGN, Capas SIG 250. Misiones y Corrientes.",
    },
    {
        "archivo": "vial_provincial.geojson",
        "layer_name": "ign_vial_provincial",
        "nivel": "vial_provincial",
        "descripcion": "Red vial de jurisdicción provincial — IGN, Capas SIG 250. Misiones y Corrientes.",
    },
    {
        "archivo": "ferrocarril.geojson",
        "layer_name": "ign_ferrocarril",
        "nivel": "ferroviario",
        "descripcion": "Líneas de ferrocarril (ramales) — IGN, Capas SIG 250. Misiones y Corrientes.",
    },
]

CATEGORIA = "transporte"


def cargar_capa(path: str) -> gpd.GeoDataFrame:
    gdf = gpd.read_file(path)
    if gdf.crs is None:
        gdf = gdf.set_crs(epsg=4326)
    elif gdf.crs.to_epsg() != 4326:
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
    for idx, row in gdf.reset_index(drop=True).iterrows():
        if row.geometry is None or row.geometry.is_empty:
            continue
        gid = row.get("gid") if "gid" in cols else idx
        feature_gid = f"{layer_name}.{gid}.{idx}"
        properties = {c: (row[c] if not hasattr(row[c], "item") else row[c].item()) for c in cols}
        rows.append(
            {
                "layer_name": layer_name,
                "feature_gid": feature_gid,
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


def upsert_catalogo(layer_name: str, nivel: str, geom_type: str, descripcion: str, engine) -> None:
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
            {"layer_name": layer_name, "categoria": CATEGORIA, "nivel": nivel, "geom_type": geom_type, "descripcion": descripcion},
        )


def main():
    load_dotenv()
    parser = argparse.ArgumentParser(description="ETL de infraestructura de transporte (IGN, Misiones/Corrientes)")
    parser.add_argument("--layer", help="layer_name de una sola capa a correr (por defecto: todas)")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    layers_to_run = [l for l in LAYERS if args.layer is None or l["layer_name"] == args.layer]
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
        path = os.path.join(DATA_DIR, layer["archivo"])
        if not os.path.exists(path):
            log.error(f"No se encuentra el archivo: {path}")
            sys.exit(1)

        log.info(f"Procesando {layer['layer_name']} <- {path}")
        gdf = cargar_capa(path)
        # Las 3 capas mezclan LineString/MultiLineString por feature (según si
        # la ruta tiene un solo tramo o varios) -- se catalogan todas como
        # "MultiLineString" (MapLibre renderiza ambos tipos igual con un
        # layer "line", no hace falta distinguir en el frontend).
        geom_type = "MultiLineString"

        if args.dry_run:
            print_schema(layer["layer_name"], gdf)
            print(f"  geom_type real (mezcla): {set(gdf.geometry.geom_type)}")
            continue

        load_to_postgis(gdf, layer["layer_name"], engine)
        upsert_catalogo(layer["layer_name"], layer["nivel"], geom_type, layer["descripcion"], engine)

    log.info("ETL finalizado.")


if __name__ == "__main__":
    main()
