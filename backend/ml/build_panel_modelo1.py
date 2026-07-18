"""Modelo 1 (Fase 5) — arma el panel zona x mes para producción de yerba mate.

Junta las 3 fuentes reales ya cargadas, todas a la misma granularidad (zona
INYM, 6 unidades -- ver TODO.md, corregido 2026-07-17: no existe producción
real por departamento):

- target: ym.inym_hoja_verde_zona.hoja_verde_kg (real, mensual, 2012-presente)
- ym.clima_zona_mensual (NASA POWER en el centroide ponderado por superficie
  cultivada de cada zona)
- ym.ndvi_mensual (MODIS, por departamento) agregado a zona -- promedio
  ponderado por pixeles_validos, usando el mapeo departamento->zona real
  (cada departamento cae 100% dentro de una sola zona, verificado con
  ST_Contains, no hace falta prorratear)

No imputa ni interpola nada -- donde falta una fuente en un (zona, mes)
queda NaN, igual que en la DB.

Uso:
    python -m backend.ml.build_panel_modelo1
"""

from __future__ import annotations

import os

import pandas as pd
from dotenv import load_dotenv

# 'ZONA CENTRO' -> 'CENTRO', etc. -- ym.inym_hoja_verde_zona usa el prefijo
# "ZONA " salvo en Corrientes (no es una zona de Misiones).
ZONA_TARGET_A_LIMPIA = {
    "ZONA CENTRO": "CENTRO",
    "ZONA NORESTE": "NORESTE",
    "ZONA NOROESTE": "NOROESTE",
    "ZONA OESTE": "OESTE",
    "ZONA SUR": "SUR",
    "CORRIENTES": "CORRIENTES",
}


def _conn():
    import psycopg2

    load_dotenv()
    return psycopg2.connect(os.environ["DATABASE_URL"])


def cargar_target(conn) -> pd.DataFrame:
    df = pd.read_sql(
        """
        SELECT zona, anio, mes, hoja_verde_kg
        FROM ym.inym_hoja_verde_zona
        WHERE zona != 'TOTAL'
        ORDER BY zona, anio, mes
        """,
        conn,
    )
    df["zona"] = df["zona"].map(ZONA_TARGET_A_LIMPIA)
    return df


def cargar_clima_zona(conn) -> pd.DataFrame:
    return pd.read_sql(
        "SELECT zona, anio, mes, precipitacion_mm_dia, temperatura_media_c FROM ym.clima_zona_mensual ORDER BY zona, anio, mes",
        conn,
    )


def cargar_ndvi_por_zona(conn) -> pd.DataFrame:
    """Agrega ym.ndvi_mensual (por departamento) a zona -- promedio ponderado
    por pixeles_validos, vía el mapeo real departamento->zona (ST_Contains
    sobre las geometrías reales de inym_gis, cada departamento cae 100%
    dentro de una sola zona)."""
    mapeo = pd.read_sql(
        """
        SELECT d.properties->>'depto' AS depto, z.properties->>'zona' AS zona
        FROM inym_gis.v_features_4326 d
        JOIN inym_gis.v_features_4326 z ON z.layer_name = 'view_superficie_por_zonas'
          AND ST_Contains(z.geom_4326, ST_Centroid(d.geom_4326))
        WHERE d.layer_name = 'view_superficie_por_departamentos'
        """,
        conn,
    )
    ndvi = pd.read_sql("SELECT depto, anio, mes, ndvi_promedio, pixeles_validos FROM ym.ndvi_mensual", conn)
    ndvi = ndvi.merge(mapeo, on="depto", how="left")

    def promedio_ponderado(g: pd.DataFrame) -> float | None:
        g = g.dropna(subset=["ndvi_promedio"])
        if g.empty or g["pixeles_validos"].sum() == 0:
            return None
        return (g["ndvi_promedio"] * g["pixeles_validos"]).sum() / g["pixeles_validos"].sum()

    return (
        ndvi.groupby(["zona", "anio", "mes"])
        .apply(promedio_ponderado, include_groups=False)
        .rename("ndvi_promedio")
        .reset_index()
    )


def armar_panel() -> pd.DataFrame:
    conn = _conn()
    try:
        target = cargar_target(conn)
        clima = cargar_clima_zona(conn)
        ndvi = cargar_ndvi_por_zona(conn)
    finally:
        conn.close()

    panel = target.merge(clima, on=["zona", "anio", "mes"], how="left")
    panel = panel.merge(ndvi, on=["zona", "anio", "mes"], how="left")
    panel["fecha"] = pd.to_datetime(panel["anio"].astype(str) + "-" + panel["mes"].astype(str) + "-01")
    return panel.sort_values(["zona", "fecha"]).reset_index(drop=True)


def diagnostico(panel: pd.DataFrame) -> None:
    print(f"Panel: {len(panel)} filas, {panel['zona'].nunique()} zonas")
    print(f"Rango: {panel['fecha'].min().date()} a {panel['fecha'].max().date()}")
    print()
    print("Por zona -- filas, rango de fechas, % NaN por columna:")
    cols = ["hoja_verde_kg", "precipitacion_mm_dia", "temperatura_media_c", "ndvi_promedio"]
    for zona, g in panel.groupby("zona"):
        faltantes = g[cols].isna().mean() * 100
        resumen = ", ".join(f"{c}={v:.0f}%" for c, v in faltantes.items())
        print(f"  {zona:12} n={len(g):3}  {g['fecha'].min().date()} a {g['fecha'].max().date()}  NaN: {resumen}")
    print()
    print("Correlación contemporánea (sin lag) con hoja_verde_kg, por zona:")
    for zona, g in panel.groupby("zona"):
        corr = g[cols].corr()["hoja_verde_kg"].drop("hoja_verde_kg")
        print(f"  {zona:12}", corr.round(2).to_dict())
    print()
    print("Promedio mensual (estacionalidad) de hoja_verde_kg, todas las zonas sumadas:")
    print(panel.groupby("mes")["hoja_verde_kg"].mean().round(0))


if __name__ == "__main__":
    panel = armar_panel()
    diagnostico(panel)
    out_dir = os.path.join(os.path.dirname(__file__), "outputs")
    os.makedirs(out_dir, exist_ok=True)
    out_path = os.path.join(out_dir, "panel_modelo1.csv")
    panel.to_csv(out_path, index=False)
    print(f"\nGuardado: {out_path}")
