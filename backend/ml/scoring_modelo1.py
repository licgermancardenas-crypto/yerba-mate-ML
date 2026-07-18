"""Scoring — Modelo 1 (Producción por zona): entrena SARIMA final sobre
TODA la serie disponible (sin hold-out, a diferencia de modelo1_baseline.py
que reserva los últimos 24 meses para walk-forward) y genera un pronóstico
real de 12 meses con intervalo de confianza nativo, por zona. Escribe en
ym.ml_predicciones (ver backend/db/schema.sql tabla 20).

No pasa por backend/etl/audit_datos.py -- es salida de modelo, no dato
crudo (ver nota en la migración 012).

Uso:
    python -m backend.ml.scoring_modelo1 --dry-run
    python -m backend.ml.scoring_modelo1
"""

from __future__ import annotations

import argparse
import os
import warnings

import numpy as np
import pandas as pd
from dotenv import load_dotenv

from backend.ml.build_panel_modelo1 import armar_panel
from backend.ml.modelo1_baseline import elegir_orden, serie_mensual_completa
from backend.ml.scoring_common import upsert_predicciones

MODELO = "modelo1_produccion_zona"
PASOS_FORECAST = 12


def pronosticar_serie(y_log: pd.Series, orden: tuple, pasos: int = PASOS_FORECAST) -> pd.DataFrame:
    """Ajusta SARIMAX sobre TODA la serie (con sus NaN internos tal cual --
    statsmodels los maneja nativamente vía Kalman filter, no hace falta
    dropear ni interpolar) y devuelve el forecast con IC 95% nativo."""
    from statsmodels.tsa.statespace.sarimax import SARIMAX

    orden_ar, orden_estacional = orden
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        res = SARIMAX(
            y_log, order=orden_ar, seasonal_order=orden_estacional,
            enforce_stationarity=False, enforce_invertibility=False,
        ).fit(disp=False)
    fc = res.get_forecast(steps=pasos)
    ic = fc.conf_int(alpha=0.05)
    fechas = pd.date_range(y_log.index.max() + pd.DateOffset(months=1), periods=pasos, freq="MS")

    # A 10-12 meses de horizonte, en zonas/meses de valle (oct-nov, producción
    # casi cero) el error estándar en escala log puede ensanchar tanto que
    # exp() desborda a inf -- pasa en algunos meses de valle de zonas chicas.
    # No se fabrica un techo arbitrario: si el límite no da un número finito,
    # queda NaN (-> NULL en la DB) en vez de un valor inventado. El pronóstico
    # puntual (valor_predicho) sigue siendo válido, es solo el intervalo el
    # que no se puede calcular de forma confiable ahí.
    with np.errstate(over="ignore"):
        ic_inferior = np.exp(ic.iloc[:, 0].values)
        ic_superior = np.exp(ic.iloc[:, 1].values)
    ic_inferior = np.where(np.isfinite(ic_inferior), ic_inferior, np.nan)
    ic_superior = np.where(np.isfinite(ic_superior), ic_superior, np.nan)

    return pd.DataFrame(
        {
            "fecha": fechas,
            "valor_predicho": np.exp(fc.predicted_mean.values),
            "ic_inferior": ic_inferior,
            "ic_superior": ic_superior,
        }
    )


def _redondear_o_none(valor: float, decimales: int = 4) -> float | None:
    return None if pd.isna(valor) else round(float(valor), decimales)


def generar_filas(panel: pd.DataFrame) -> list[tuple]:
    filas = []
    for zona in sorted(panel["zona"].unique()):
        y = serie_mensual_completa(panel, zona)
        y_log = np.log(y)
        orden = elegir_orden(y_log.dropna())
        print(f"{zona}: orden {orden}")
        forecast = pronosticar_serie(y_log, orden)
        metodo = f"SARIMA{orden[0]}{orden[1]}, entrenado sobre {y_log.dropna().shape[0]} meses reales"
        for _, fila in forecast.iterrows():
            filas.append(
                (
                    MODELO,
                    zona,
                    fila["fecha"].year,
                    fila["fecha"].month,
                    True,
                    None,
                    round(float(fila["valor_predicho"]), 4),
                    _redondear_o_none(fila["ic_inferior"]),
                    _redondear_o_none(fila["ic_superior"]),
                    0.95,
                    "kg",
                    metodo,
                    None,
                )
            )
    return filas


def main() -> None:
    load_dotenv()
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    panel = armar_panel()
    filas = generar_filas(panel)
    print(f"\n{len(filas)} filas de pronóstico generadas ({panel['zona'].nunique()} zonas x {PASOS_FORECAST} meses)")

    if args.dry_run:
        for f in filas[:3]:
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
