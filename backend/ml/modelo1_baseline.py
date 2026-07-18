"""Modelo 1 (Fase 5) — baseline estacional puro, por zona.

SARIMA sobre log(hoja_verde_kg), sin exógenas todavía -- la estacionalidad
(pico abril-septiembre, caída octubre-noviembre) es la señal dominante y
consistente en los datos reales; clima/NDVI mensual mostraron correlación
casi nula una vez removido el ciclo anual (ver investigación 2026-07-17,
confirmada con el usuario: arrancar por este baseline antes de sumar
exógenas). El transform log es seguro -- la serie es siempre positiva
(mínimo real 6.500 kg, sin ceros).

Walk-forward, no split fijo train/test: para cada uno de los últimos 24
meses de cada zona, se reentrena con todo lo anterior y se pronostica un
paso adelante (más correcto que un solo split, y es lo que pide el TODO:
"validación walk-forward, ventana mínima 12 meses de test").

Uso:
    python -m backend.ml.modelo1_baseline
"""

from __future__ import annotations

import warnings

import numpy as np
import pandas as pd

from backend.ml.build_panel_modelo1 import armar_panel

MESES_TEST = 24
ORDENES_CANDIDATOS = [
    ((1, 1, 1), (1, 1, 0, 12)),
    ((1, 1, 1), (0, 1, 1, 12)),
    ((0, 1, 1), (0, 1, 1, 12)),
    ((1, 1, 0), (1, 1, 0, 12)),
]


def serie_mensual_completa(panel: pd.DataFrame, zona: str) -> pd.Series:
    g = panel[panel["zona"] == zona].set_index("fecha")["hoja_verde_kg"]
    rango = pd.date_range(panel["fecha"].min(), panel["fecha"].max(), freq="MS")
    return g.reindex(rango)


def elegir_orden(y_log_train: pd.Series) -> tuple:
    """AIC sobre 4 órdenes SARIMA candidatos, conservador a propósito (ver
    TODO.md: "modelos interpretables preferibles a black-box", no se hace
    una búsqueda tipo auto-ARIMA exhaustiva)."""
    from statsmodels.tsa.statespace.sarimax import SARIMAX

    mejor_aic, mejor_orden = np.inf, ORDENES_CANDIDATOS[0]
    for orden, orden_estacional in ORDENES_CANDIDATOS:
        try:
            with warnings.catch_warnings():
                warnings.simplefilter("ignore")
                res = SARIMAX(
                    y_log_train, order=orden, seasonal_order=orden_estacional,
                    enforce_stationarity=False, enforce_invertibility=False,
                ).fit(disp=False)
            if res.aic < mejor_aic:
                mejor_aic, mejor_orden = res.aic, (orden, orden_estacional)
        except Exception:
            continue
    return mejor_orden


def walk_forward(y_log: pd.Series, orden: tuple, meses_test: int) -> pd.DataFrame:
    from statsmodels.tsa.statespace.sarimax import SARIMAX

    orden_ar, orden_estacional = orden
    n = len(y_log)
    filas = []
    for i in range(n - meses_test, n):
        train = y_log.iloc[:i]
        real_log = y_log.iloc[i]
        if pd.isna(real_log):
            continue
        try:
            with warnings.catch_warnings():
                warnings.simplefilter("ignore")
                res = SARIMAX(
                    train, order=orden_ar, seasonal_order=orden_estacional,
                    enforce_stationarity=False, enforce_invertibility=False,
                ).fit(disp=False)
                pred_log = res.forecast(1).iloc[0]
        except Exception as e:
            print(f"    fallo en {y_log.index[i].date()}: {e}")
            continue
        filas.append({"fecha": y_log.index[i], "real": np.exp(real_log), "pred": np.exp(pred_log)})
    return pd.DataFrame(filas)


def metricas(resultado: pd.DataFrame) -> dict:
    err = resultado["pred"] - resultado["real"]
    mape = (err.abs() / resultado["real"]).mean() * 100
    mae = err.abs().mean()
    sesgo_pct = (err.sum() / resultado["real"].sum()) * 100
    return {"n": len(resultado), "MAE_kg": round(mae), "MAPE_%": round(mape, 1), "sesgo_%": round(sesgo_pct, 1)}


def main() -> None:
    panel = armar_panel()
    resultados_todas = []
    for zona in sorted(panel["zona"].unique()):
        y = serie_mensual_completa(panel, zona)
        y_log = np.log(y)
        orden = elegir_orden(y_log.iloc[: -MESES_TEST].dropna())
        print(f"{zona}: orden elegido {orden} (AIC sobre entrenamiento pre-test)")
        resultado = walk_forward(y_log, orden, MESES_TEST)
        resultado["zona"] = zona
        resultados_todas.append(resultado)
        print(f"  {zona}: {metricas(resultado)}")

    todo = pd.concat(resultados_todas, ignore_index=True)
    print("\nMétricas globales (todas las zonas, pooled):")
    print(metricas(todo))

    import os

    out_dir = os.path.join(os.path.dirname(__file__), "outputs")
    os.makedirs(out_dir, exist_ok=True)
    todo.to_csv(os.path.join(out_dir, "modelo1_baseline_walkforward.csv"), index=False)
    print(f"\nGuardado: {out_dir}/modelo1_baseline_walkforward.csv")


if __name__ == "__main__":
    main()
