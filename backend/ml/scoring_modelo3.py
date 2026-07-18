"""Scoring — Modelo 3 (Exportaciones gravitacional): entrena la regresión
final sobre TODO el panel (sin split) y genera 2 tipos de fila en
ym.ml_predicciones:

1. **Ajustado-vs-real histórico** (es_pronostico=False): para cada
   observación real del panel (país-año con volumen/PBI/tipo de cambio
   conocidos), el valor predicho por el modelo + intervalo de predicción,
   junto al valor real -- pieza explicativa, no un forecast.
2. **Proyección año próximo** (es_pronostico=True): un país por fila, año
   = último año del panel + 1. No hay PBI ni tipo de cambio futuros
   reales -- se usa el ÚLTIMO valor real conocido de CADA país por
   separado para el PBI (Siria puede quedar fijo en un año anterior a
   2025 si la guerra civil le cortó la publicación) y el último tipo de
   cambio nacional conocido. El supuesto queda explícito en `supuestos`,
   con el año exacto usado por país -- esto NO es un pronóstico real, es
   una proyección con supuestos declarados (ver docs/modelo3_exportaciones_gravitacional.md).

Usa el intervalo de PREDICCIÓN individual (obs_ci, no mean_ci) en ambos
casos -- es el intervalo correcto para comparar contra una observación
real puntual (un país-año), no el intervalo (más angosto) de la media
condicional de la regresión.

No pasa por backend/etl/audit_datos.py -- es salida de modelo, no dato
crudo (ver nota en la migración 012).

Uso:
    python -m backend.ml.scoring_modelo3 --dry-run
    python -m backend.ml.scoring_modelo3
"""

from __future__ import annotations

import argparse
import os

import numpy as np
import pandas as pd
import statsmodels.api as sm
from dotenv import load_dotenv

from backend.ml.build_panel_modelo3 import COORDS_PAISES, DUMMY_DIASPORA, armar_panel, haversine_km, ORIGEN_BUENOS_AIRES
from backend.ml.modelo3_gravitacional import ajustar, preparar_variables
from backend.ml.scoring_common import upsert_predicciones

MODELO = "modelo3_exportaciones"
COLUMNAS_X = ["log_pbi", "log_distancia", "dummy_diaspora", "log_tipo_cambio"]


def fitted_vs_actual(modelo, df: pd.DataFrame) -> list[tuple]:
    X = sm.add_constant(df[COLUMNAS_X], has_constant="add")
    pred = modelo.get_prediction(X).summary_frame(alpha=0.05)
    metodo = f"OLS log-log, R²={modelo.rsquared:.3f}, n={len(df)}"

    filas = []
    for (idx, fila_df), (_, fila_pred) in zip(df.iterrows(), pred.iterrows()):
        filas.append(
            (
                MODELO,
                fila_df["pais_iso2"],
                int(fila_df["anio"]),
                None,
                False,
                round(float(np.exp(fila_df["log_volumen"])), 4),
                round(float(np.exp(fila_pred["mean"])), 4),
                round(float(np.exp(fila_pred["obs_ci_lower"])), 4),
                round(float(np.exp(fila_pred["obs_ci_upper"])), 4),
                0.95,
                "kg",
                metodo,
                None,
            )
        )
    return filas


def proyeccion_siguiente_anio(modelo, panel: pd.DataFrame, n_entrenamiento: int) -> list[tuple]:
    anio_proyeccion = int(panel["anio"].max()) + 1
    metodo = f"OLS log-log, R²={modelo.rsquared:.3f}, n={n_entrenamiento}"
    ultimo_tc_row = panel.dropna(subset=["ars_usd_oficial"]).sort_values("anio").iloc[-1]
    ultimo_tc, anio_tc = float(ultimo_tc_row["ars_usd_oficial"]), int(ultimo_tc_row["anio"])

    filas = []
    for pais in sorted(COORDS_PAISES):
        pbi_pais = panel[(panel["pais_iso2"] == pais) & panel["pbi_usd"].notna()].sort_values("anio")
        if pbi_pais.empty:
            continue  # nunca publicó PBI en el rango del panel -- no se puede proyectar
        ultimo_pbi_row = pbi_pais.iloc[-1]
        ultimo_pbi, anio_pbi = float(ultimo_pbi_row["pbi_usd"]), int(ultimo_pbi_row["anio"])

        distancia = haversine_km(ORIGEN_BUENOS_AIRES, COORDS_PAISES[pais])
        X = pd.DataFrame(
            {
                "const": [1.0],
                "log_pbi": [np.log(ultimo_pbi)],
                "log_distancia": [np.log(distancia)],
                "dummy_diaspora": [1 if pais in DUMMY_DIASPORA else 0],
                "log_tipo_cambio": [np.log(ultimo_tc)],
            }
        )
        pred = modelo.get_prediction(X).summary_frame(alpha=0.05).iloc[0]

        supuestos = f"PBI congelado en el último real conocido ({anio_pbi}); tipo de cambio oficial de {anio_tc}"
        if anio_pbi < anio_proyeccion - 1:
            supuestos += f" -- sin PBI publicado desde {anio_pbi} (ver docs/modelo3_exportaciones_gravitacional.md)"

        filas.append(
            (
                MODELO,
                pais,
                anio_proyeccion,
                None,
                True,
                None,
                round(float(np.exp(pred["mean"])), 4),
                round(float(np.exp(pred["obs_ci_lower"])), 4),
                round(float(np.exp(pred["obs_ci_upper"])), 4),
                0.95,
                "kg",
                metodo,
                supuestos,
            )
        )
    return filas


def main() -> None:
    load_dotenv()
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    panel = armar_panel()
    df = preparar_variables(panel)
    modelo = ajustar(df)
    print(f"R²={modelo.rsquared:.3f}, n={len(df)}")

    filas_ajuste = fitted_vs_actual(modelo, df)
    filas_proyeccion = proyeccion_siguiente_anio(modelo, panel, n_entrenamiento=len(df))
    filas = filas_ajuste + filas_proyeccion
    print(f"{len(filas_ajuste)} filas ajustado-vs-real + {len(filas_proyeccion)} filas de proyección")

    if args.dry_run:
        print("\nProyección (primeras 5):")
        for f in filas_proyeccion[:5]:
            print(" ", f)
        return

    import psycopg2

    conn = psycopg2.connect(os.environ["DATABASE_URL"])
    try:
        upsert_predicciones(conn, filas)
        conn.commit()
        print("Commit OK")
    finally:
        conn.close()


if __name__ == "__main__":
    main()
