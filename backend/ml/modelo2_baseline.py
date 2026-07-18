"""Modelo 2 (Fase 5) — baseline + prueba de exógenas, consumo interno
(salida de molino al mercado interno, real y mensual).

A diferencia del Modelo 1 (producción, estacionalidad muy fuerte: de casi
cero a picos de decenas de millones de kg), acá la estacionalidad es débil
-- el mínimo mensual (dic/ene, ~19-20M kg) y el máximo (jul/ago, ~23M kg)
difieren solo ~20%, consistente con un bien de consumo cotidiano, no
agrícola. Reusa el motor genérico de SARIMAX walk-forward de
`modelo1_baseline.py` (no es específico de zona, sirve igual acá).

Uso:
    python -m backend.ml.modelo2_baseline
"""

from __future__ import annotations

import warnings

import numpy as np
import pandas as pd

from backend.ml.build_panel_modelo2 import armar_panel
from backend.ml.modelo1_baseline import ORDENES_CANDIDATOS, elegir_orden, metricas

MESES_TEST = 60  # 5 años -- panel completo es más largo (2008-2026) que el de Modelo 1


def serie_mensual_completa(panel: pd.DataFrame) -> pd.Series:
    g = panel.set_index("fecha")["salida_molino_interno_kg"]
    rango = pd.date_range(panel["fecha"].min(), panel["fecha"].max(), freq="MS")
    return g.reindex(rango)


def walk_forward(y_log: pd.Series, orden: tuple, meses_test: int, exog: pd.DataFrame | pd.Series | None = None) -> pd.DataFrame:
    from statsmodels.tsa.statespace.sarimax import SARIMAX

    orden_ar, orden_estacional = orden
    n = len(y_log)
    filas = []
    for i in range(n - meses_test, n):
        train_y = y_log.iloc[:i]
        real_log = y_log.iloc[i]
        if pd.isna(real_log):
            continue
        try:
            with warnings.catch_warnings():
                warnings.simplefilter("ignore")
                kwargs = dict(order=orden_ar, seasonal_order=orden_estacional, enforce_stationarity=False, enforce_invertibility=False)
                if exog is not None:
                    res = SARIMAX(train_y, exog=exog.iloc[:i], **kwargs).fit(disp=False)
                    pred_log = res.forecast(1, exog=exog.iloc[[i]]).iloc[0]
                else:
                    res = SARIMAX(train_y, **kwargs).fit(disp=False)
                    pred_log = res.forecast(1).iloc[0]
        except Exception as e:
            print(f"    fallo en {y_log.index[i].date()}: {e}")
            continue
        filas.append({"fecha": y_log.index[i], "real": np.exp(real_log), "pred": np.exp(pred_log)})
    return pd.DataFrame(filas)


def main() -> None:
    panel = armar_panel()
    y = serie_mensual_completa(panel)
    y_log = np.log(y)

    orden = elegir_orden(y_log.iloc[: -MESES_TEST].dropna())
    print(f"Orden elegido: {orden}")

    r_base = walk_forward(y_log, orden, MESES_TEST)
    print(f"\nBaseline (sin exógena): {metricas(r_base)}")

    # Exógenas: precio relativo + salario real, alineadas al mismo índice
    # mensual completo que la serie (quedan NaN antes de 2016, real, no se
    # rellena -- SARIMAX no acepta NaN en exog, así que se recorta el walk-
    # forward a partir de donde las 2 exógenas están completas).
    exog_completo = panel.set_index("fecha")[["precio_relativo_yerba", "salario_real"]].reindex(y_log.index)
    primer_dato_valido = exog_completo.dropna().index.min()
    y_log_exog = y_log[y_log.index >= primer_dato_valido]
    exog_valido = exog_completo.loc[y_log_exog.index]
    meses_test_exog = min(MESES_TEST, len(y_log_exog) - 24)

    orden_exog = elegir_orden(y_log_exog.iloc[: -meses_test_exog].dropna())
    r_exog = walk_forward(y_log_exog, orden_exog, meses_test_exog, exog=exog_valido)
    print(f"Con exógena (precio relativo + salario real), mismo rango de test: {metricas(r_exog)}")

    # Comparar baseline SOLO en ese mismo rango recortado, para que sea justo
    r_base_mismo_rango = walk_forward(y_log_exog, orden_exog, meses_test_exog)
    print(f"Baseline sin exógena, mismo rango recortado (comparación justa): {metricas(r_base_mismo_rango)}")

    import os

    out_dir = os.path.join(os.path.dirname(__file__), "outputs")
    os.makedirs(out_dir, exist_ok=True)
    r_base.to_csv(os.path.join(out_dir, "modelo2_baseline_walkforward.csv"), index=False)
    r_exog.to_csv(os.path.join(out_dir, "modelo2_exog_walkforward.csv"), index=False)


if __name__ == "__main__":
    main()
