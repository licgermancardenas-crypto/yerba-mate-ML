"""Tipología productiva por municipio (Fase 5 informal / GIS derivado) --
K-means sobre % superficie cultivada, % superficie en alta densidad de
plantación, % superficie con cultivo consociado. A pedido explícito del
usuario ("mapa o gráfico de clusters/cohortes en algún concepto").

Fuentes: view_superficie_por_municipios / _densidad_ / _consociado_por_municipios
(INYM, ya cargadas en inym_gis.raw_features). "Edad de plantación" se evaluó
y se descartó como feature -- ver docs/clusters_municipios.md, solo ~24% de
la superficie promedio tiene año de plantación registrado.

Persiste el resultado como una capa GIS nueva (`clusters_municipios`,
reusa la geometría real de view_superficie_por_municipios) en
inym_gis.raw_features, seleccionable en Mapa GIS como cualquier otra capa
(ver migración 013 para el catálogo/provenance).

Uso:
    python -m backend.ml.clusters_municipios [--dry-run]
"""

from __future__ import annotations

import argparse
import os
import re

import numpy as np
import pandas as pd
from dotenv import load_dotenv
from sklearn.cluster import KMeans
from sklearn.preprocessing import StandardScaler

K = 4
RANDOM_STATE = 42
LAYER_ORIGEN = "view_superficie_por_municipios"
LAYER_DESTINO = "clusters_municipios"


def _parse_num(s: str) -> float:
    return float(s.replace(".", "").replace(",", "."))


def _parse_edad_cobertura(anio_str: str) -> float:
    """% de superficie con año de plantación registrado (excluye 'S/D') --
    NO se usa como feature de clustering, solo para documentar la
    cobertura real de esa dimensión (ver docstring del módulo)."""
    total = 0.0
    con_dato = 0.0
    for parte in anio_str.split(";"):
        clave, valor = parte.split(":")
        ha = _parse_num(valor.strip())
        total += ha
        if clave.strip() != "S/D":
            con_dato += ha
    return con_dato / total * 100 if total else 0.0


def _parse_pct_alta_densidad(densidad_str: str) -> float | None:
    totales: dict[str, float] = {}
    for bloque in densidad_str.split("//"):
        m = re.match(r"(BAJA|MEDIA|ALTA) Densidad: ([\d.,]+)@", bloque.strip())
        if m:
            totales[m.group(1)] = _parse_num(m.group(2))
    total = sum(totales.values())
    return (totales.get("ALTA", 0.0) / total * 100) if total else None


def _armar_features(conn) -> pd.DataFrame:
    def fetch(layer: str) -> list[dict]:
        rows = pd.read_sql(
            """
            SELECT DISTINCT ON (feature_gid) properties
            FROM inym_gis.v_features_4326
            WHERE layer_name = %(layer)s
            ORDER BY feature_gid, snapshot_date DESC
            """,
            conn,
            params={"layer": layer},
        )
        return list(rows["properties"])

    superficie = {f["municipio"]: f for f in fetch(LAYER_ORIGEN)}
    edad = {f["municipio"]: f for f in fetch("view_superficie_edad_por_municipios")}
    densidad = {f["municipio"]: f for f in fetch("view_superficie_densidad_por_municipios")}
    consociado = {f["municipio"]: f for f in fetch("view_superficie_consociado_por_municipios")}

    filas = []
    for municipio, f in superficie.items():
        pct_cultivado = f["sup_ym"] / f["superficie"] * 100 if f["superficie"] else None
        pct_alta_densidad = _parse_pct_alta_densidad(densidad[municipio]["densidad"]) if municipio in densidad else None
        pct_consociado = None
        if municipio in consociado:
            c = consociado[municipio]
            pct_consociado = c["sup_cons"] / c["superficie"] * 100 if c["superficie"] else None
        pct_edad_cobertura = _parse_edad_cobertura(edad[municipio]["anio"]) if municipio in edad else 0.0
        filas.append(
            {
                "municipio": municipio,
                "depto": f["depto"],
                "pcia": f["pcia"],
                "pct_cultivado": pct_cultivado,
                "pct_alta_densidad": pct_alta_densidad,
                "pct_consociado": pct_consociado,
                "pct_edad_cobertura": pct_edad_cobertura,  # informativo, no se clusteriza
            }
        )
    return pd.DataFrame(filas)


def _etiquetar_clusters(df: pd.DataFrame) -> dict[int, str]:
    """Asigna labels legibles por características reales del centroide (no
    por índice arbitrario de K-means, para que sea estable entre corridas
    aunque cambie el orden interno de las etiquetas numéricas)."""
    medias = df.groupby("cluster")[["pct_cultivado", "pct_alta_densidad", "pct_consociado"]].mean()
    etiquetas: dict[int, str] = {}
    restantes = set(medias.index)

    c_densidad = medias.loc[list(restantes), "pct_alta_densidad"].idxmax()
    if medias.loc[c_densidad, "pct_alta_densidad"] > medias["pct_alta_densidad"].median() * 2:
        etiquetas[c_densidad] = "Alta densidad de plantación"
        restantes.discard(c_densidad)

    if restantes:
        c_consociado = medias.loc[list(restantes), "pct_consociado"].idxmax()
        if medias.loc[c_consociado, "pct_consociado"] > medias["pct_consociado"].median() * 2:
            etiquetas[c_consociado] = "Cultivo consociado intensivo"
            restantes.discard(c_consociado)

    if restantes:
        ordenados = sorted(restantes, key=lambda c: medias.loc[c, "pct_cultivado"], reverse=True)
        if ordenados:
            etiquetas[ordenados[0]] = "Núcleo yerbatero"
        for c in ordenados[1:]:
            etiquetas[c] = "Baja intensidad"

    return etiquetas


def main() -> None:
    load_dotenv()
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    import psycopg2

    conn = psycopg2.connect(os.environ["DATABASE_URL"])
    df = _armar_features(conn)
    print(f"Municipios totales: {len(df)}")

    features = ["pct_cultivado", "pct_alta_densidad", "pct_consociado"]
    df_clu = df.dropna(subset=features).copy()
    print(f"Municipios usables para clustering (features completas): {len(df_clu)} de {len(df)}")
    sin_clasificar = df[~df["municipio"].isin(df_clu["municipio"])]
    if len(sin_clasificar):
        print(f"Sin clasificar (falta pct_consociado u otra feature): {sin_clasificar['municipio'].tolist()}")

    X = StandardScaler().fit_transform(df_clu[features])
    km = KMeans(n_clusters=K, random_state=RANDOM_STATE, n_init=10).fit(X)
    df_clu["cluster"] = km.labels_

    etiquetas = _etiquetar_clusters(df_clu)
    df_clu["cluster_label"] = df_clu["cluster"].map(etiquetas)

    print("\nComposición final:")
    for c, label in sorted(etiquetas.items(), key=lambda kv: kv[0]):
        sub = df_clu[df_clu["cluster"] == c]
        print(
            f"  {label} (n={len(sub)}): pct_cultivado={sub['pct_cultivado'].mean():.1f}, "
            f"pct_alta_densidad={sub['pct_alta_densidad'].mean():.1f}, pct_consociado={sub['pct_consociado'].mean():.1f}"
        )

    if args.dry_run:
        print("\n--dry-run: no se escribió nada en la base.")
        return

    cur = conn.cursor()
    filas_escritas = 0
    for _, row in df.iterrows():
        clasificado = row["municipio"] in set(df_clu["municipio"])
        if clasificado:
            fila_clu = df_clu[df_clu["municipio"] == row["municipio"]].iloc[0]
            cluster_id = int(fila_clu["cluster"])
            cluster_label = fila_clu["cluster_label"]
        else:
            cluster_id = None
            cluster_label = "Sin clasificar (dato incompleto)"

        properties = {
            "pcia": row["pcia"],
            "depto": row["depto"],
            "municipio": row["municipio"],
            "cluster_id": cluster_id,
            "cluster_label": cluster_label,
            "pct_cultivado": None if pd.isna(row["pct_cultivado"]) else round(float(row["pct_cultivado"]), 2),
            "pct_alta_densidad": None if pd.isna(row["pct_alta_densidad"]) else round(float(row["pct_alta_densidad"]), 2),
            "pct_consociado": None if pd.isna(row["pct_consociado"]) else round(float(row["pct_consociado"]), 2),
        }
        import json

        cur.execute(
            """
            INSERT INTO inym_gis.raw_features (layer_name, feature_gid, snapshot_date, geom, properties)
            SELECT %(layer_destino)s, %(feature_gid)s, CURRENT_DATE, geom, %(properties)s::jsonb
            FROM inym_gis.raw_features
            WHERE layer_name = %(layer_origen)s AND properties->>'municipio' = %(municipio)s
            ORDER BY id LIMIT 1
            ON CONFLICT (layer_name, feature_gid, snapshot_date)
            DO UPDATE SET geom = EXCLUDED.geom, properties = EXCLUDED.properties
            """,
            {
                "layer_destino": LAYER_DESTINO,
                "feature_gid": f"{LAYER_DESTINO}.{row['municipio']}",
                "properties": json.dumps(properties),
                "layer_origen": LAYER_ORIGEN,
                "municipio": row["municipio"],
            },
        )
        filas_escritas += cur.rowcount

    conn.commit()
    print(f"\nFilas escritas/actualizadas en inym_gis.raw_features (layer_name='{LAYER_DESTINO}'): {filas_escritas}")


if __name__ == "__main__":
    main()
