"""
ETL — Población, hogares y viviendas por radio censal (INDEC, Censo 2010)
===========================================================================

Fuente: paquetes "Codgeo_<Provincia>_con_datos" de INDEC (Unidades
Geoestadísticas del Sistema Estadístico Nacional, código geográfico +
cartografía shapefile). IMPORTANTE: es cartografía y datos del Censo
Nacional de Población, Hogares y Viviendas **2010** (CNPHyV 2010), no del
censo 2022 — la nota aclaratoria de INDEC (incluida en
data/raw/censo2010_radios/nota_aclaratoria_indec.pdf) lo dice
explícitamente ("elaborada... para el CNPHyV 2010"). Se etiqueta así en
todo el proyecto para no insinuar un dato más reciente del que es.

Trae 5 variables reales por radio censal: población por sexo, total de
hogares, total de viviendas particulares y viviendas particulares
habitadas. Se agregan 3 indicadores derivados (calculados, no inventados):
    - densidad_hab_km2: población / superficie del radio (área calculada
      en la proyección original POSGAR 98 faja 3, EPSG:22183, en metros --
      ANTES de reproyectar a 4326, porque en grados el área no tiene
      sentido físico)
    - personas_por_hogar: totalpobl / hogares
    - ocupacion_viviendas_pct: % de viviendas particulares que están
      habitadas (viv_part_h / viviendasp) -- proxy de vivienda vacía/
      estacional, relevante en zonas rurales yerbateras

Misma tabla genérica que el resto de las capas GIS del proyecto
(inym_gis.raw_features + inym_gis.catalogo_capas) -- sin cambios de
schema ni de backend/frontend, la capa aparece sola en el selector de
Mapa GIS en cuanto se registra en el catálogo.

Uso:
    python -m backend.etl.etl_censo2010_radios --dry-run
    python -m backend.etl.etl_censo2010_radios
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
log = logging.getLogger("etl_censo2010_radios")

DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "data", "raw", "censo2010_radios")
SOURCE_SRID = 22183  # POSGAR 98 / Argentina 3 (faja Gauss-Krüger 3), en metros

FUENTES = [
    {"provincia": "Corrientes", "shp": os.path.join(DATA_DIR, "corrientes", "Corrientes_con_datos.shp")},
    {"provincia": "Misiones", "shp": os.path.join(DATA_DIR, "misiones", "Misiones_con_datos.shp")},
]

LAYER_NAME = "censo2010_radios"
CATEGORIA = "censo_poblacion"
NIVEL = "radio"
DESCRIPCION = (
    "Población, hogares y viviendas por radio censal — INDEC, Censo Nacional de Población, "
    "Hogares y Viviendas 2010 (CNPHyV 2010). Cartografía y códigos geográficos del Sistema "
    "Estadístico Nacional, INDEC 2015. Misiones y Corrientes."
)


def cargar_fuente(provincia: str, shp_path: str) -> gpd.GeoDataFrame:
    log.info(f"Leyendo {provincia}: {shp_path}")
    gdf = gpd.read_file(shp_path)
    if gdf.crs is None or gdf.crs.to_epsg() != SOURCE_SRID:
        log.warning(f"  CRS inesperado en {shp_path}: {gdf.crs} (se esperaba EPSG:{SOURCE_SRID})")

    # Área real en m2 -- se calcula en la proyección original (metros),
    # antes de reproyectar a 4326 (grados, donde .area no representa
    # superficie física).
    area_km2 = gdf.geometry.area / 1_000_000

    gdf["provincia"] = provincia
    gdf["area_km2"] = area_km2.round(4)
    gdf["densidad_hab_km2"] = (gdf["totalpobl"] / area_km2.replace(0, None)).round(2)
    gdf["personas_por_hogar"] = (gdf["totalpobl"] / gdf["hogares"].replace(0, None)).round(2)
    gdf["ocupacion_viviendas_pct"] = (gdf["viv_part_h"] / gdf["viviendasp"].replace(0, None) * 100).round(1)

    # Radios sin hogares/viviendas (reservas, cursos de agua) dan división por
    # cero -> NaN, que `json.dumps` serializa como el token `NaN` (inválido
    # para Postgres). Se convierte a None (null real) para esos casos, en vez
    # de inventar un 0 que confundiría "sin población" con "no aplica".
    for col in ("densidad_hab_km2", "personas_por_hogar", "ocupacion_viviendas_pct"):
        gdf[col] = gdf[col].astype(object).where(gdf[col].notna(), None)

    gdf = gdf.to_crs(epsg=4326)
    log.info(f"  -> {len(gdf)} radios, población total {int(gdf['totalpobl'].sum()):,}".replace(",", "."))
    return gdf


def print_schema(gdf: gpd.GeoDataFrame) -> None:
    cols = [c for c in gdf.columns if c != "geometry"]
    print(f"\n=== Esquema de columnas: {LAYER_NAME} ({len(gdf)} features) ===")
    print(cols)
    if len(gdf) > 0:
        print("--- Ejemplo de fila (sin geometría) ---")
        print(gdf.iloc[0][cols].to_dict())
    print()


def load_to_postgis(gdf: gpd.GeoDataFrame, engine) -> None:
    snapshot_date = date.today().isoformat()
    cols = [c for c in gdf.columns if c != "geometry"]

    rows = []
    for _, row in gdf.iterrows():
        if row.geometry is None:
            continue
        properties = {c: (row[c] if not hasattr(row[c], "item") else row[c].item()) for c in cols}
        rows.append(
            {
                "layer_name": LAYER_NAME,
                "feature_gid": str(row["link"]),
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
    log.info(f"  -> {len(rows)} filas cargadas/actualizadas en inym_gis.raw_features (layer_name={LAYER_NAME})")


def upsert_catalogo(geom_type: str, engine) -> None:
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
            {"layer_name": LAYER_NAME, "categoria": CATEGORIA, "nivel": NIVEL, "geom_type": geom_type, "descripcion": DESCRIPCION},
        )


def main():
    load_dotenv()
    parser = argparse.ArgumentParser(description="ETL de población/hogares/viviendas por radio censal (INDEC 2010)")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    engine = None
    if not args.dry_run:
        db_url = os.environ.get("DATABASE_URL")
        if not db_url:
            log.error("Falta la variable de entorno DATABASE_URL.")
            sys.exit(1)
        engine = create_engine(db_url)

    partes = []
    for fuente in FUENTES:
        if not os.path.exists(fuente["shp"]):
            log.error(f"No se encuentra el shapefile: {fuente['shp']}")
            sys.exit(1)
        partes.append(cargar_fuente(fuente["provincia"], fuente["shp"]))

    gdf = gpd.GeoDataFrame(gpd.pd.concat(partes, ignore_index=True), crs=partes[0].crs)
    geom_type = gdf.geometry.geom_type.mode()[0] if len(gdf) else "Unknown"

    if args.dry_run:
        print_schema(gdf)
        print(f"geom_type dominante: {geom_type}")
        print(f"Población total combinada: {int(gdf['totalpobl'].sum()):,}".replace(",", "."))
        return

    load_to_postgis(gdf, engine)
    upsert_catalogo(geom_type, engine)
    log.info("ETL finalizado.")


if __name__ == "__main__":
    main()
