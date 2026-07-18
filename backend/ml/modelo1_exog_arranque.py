"""Modelo 1 (Fase 5) — prueba puntual: ¿ayuda un indicador de "atraso de
temporada" a pronosticar marzo/abril?

Hallazgo de la investigación del baseline (2026-07-17): el error del
baseline puramente estacional se concentra en la transición feb-mar-abr
(cuándo arranca la cosecha), no repartido parejo en los 12 meses -- Centro
2025/2026 tuvieron arranque tardío real (marzo muy por debajo del histórico)
que el calendario fijo no anticipó.

Indicador: anomalía de NDVI/lluvia acumulada de enero-febrero de cada año
vs. el promedio histórico de esos 2 meses para esa zona -- información
disponible ANTES de marzo/abril (no es data leakage), a diferencia de la
anomalía mensual genérica que ya se probó y no sirvió. Solo se activa como
exógena en marzo/abril (el resto del año queda en 0) -- prueba dirigida al
problema real encontrado, no una exógena genérica de 12 meses.

Uso:
    python -m backend.ml.modelo1_exog_arranque
"""

from __future__ import annotations

import warnings

import numpy as np
import pandas as pd

from backend.ml.build_panel_modelo1 import armar_panel
from backend.ml.modelo1_baseline import MESES_TEST, elegir_orden, metricas, serie_mensual_completa


def construir_exog_arranque(panel: pd.DataFrame, zona: str) -> pd.Series:
    """Anomalía de NDVI de enero+febrero de cada año vs. el promedio
    histórico (todo el panel) de esos 2 meses para esa zona -- activa solo
    en marzo/abril, 0 el resto del año."""
    g = panel[panel["zona"] == zona]
    enefeb = g[g["mes"].isin([1, 2])].groupby("anio")["ndvi_promedio"].mean()
    baseline_historico = enefeb.mean()
    anomalia_por_anio = enefeb - baseline_historico

    rango = pd.date_range(panel["fecha"].min(), panel["fecha"].max(), freq="MS")
    exog = pd.Series(0.0, index=rango)
    for fecha in rango:
        if fecha.month in (3, 4) and fecha.year in anomalia_por_anio.index:
            valor = anomalia_por_anio.loc[fecha.year]
            exog.loc[fecha] = valor if pd.notna(valor) else 0.0
    return exog


def walk_forward_con_exog(y_log: pd.Series, exog: pd.Series, orden: tuple, meses_test: int) -> pd.DataFrame:
    from statsmodels.tsa.statespace.sarimax import SARIMAX

    orden_ar, orden_estacional = orden
    n = len(y_log)
    filas = []
    for i in range(n - meses_test, n):
        train_y = y_log.iloc[:i]
        train_x = exog.iloc[:i]
        real_log = y_log.iloc[i]
        if pd.isna(real_log):
            continue
        try:
            with warnings.catch_warnings():
                warnings.simplefilter("ignore")
                res = SARIMAX(
                    train_y, exog=train_x, order=orden_ar, seasonal_order=orden_estacional,
                    enforce_stationarity=False, enforce_invertibility=False,
                ).fit(disp=False)
                pred_log = res.forecast(1, exog=exog.iloc[[i]]).iloc[0]
        except Exception as e:
            print(f"    fallo en {y_log.index[i].date()}: {e}")
            continue
        filas.append({"fecha": y_log.index[i], "real": np.exp(real_log), "pred": np.exp(pred_log)})
    return pd.DataFrame(filas)


def main() -> None:
    panel = armar_panel()
    comparacion = []
    for zona in sorted(panel["zona"].unique()):
        y = serie_mensual_completa(panel, zona)
        y_log = np.log(y)
        exog = construir_exog_arranque(panel, zona)
        orden = elegir_orden(y_log.iloc[: -MESES_TEST].dropna())

        resultado = walk_forward_con_exog(y_log, exog, orden, MESES_TEST)
        resultado["zona"] = zona
        marzo_abril = resultado[resultado["fecha"].dt.month.isin([3, 4])]
        m = metricas(marzo_abril) if len(marzo_abril) else {"n": 0}
        print(f"{zona}: marzo/abril con exógena de arranque -> {m}")
        comparacion.append({"zona": zona, **m})

    print("\nComparar contra el baseline sin exógena (backend/ml/outputs/modelo1_baseline_walkforward.csv), "
          "filtrando también marzo/abril, para ver si mejoró de verdad.")

    import os

    out_dir = os.path.join(os.path.dirname(__file__), "outputs")
    pd.DataFrame(comparacion).to_csv(os.path.join(out_dir, "modelo1_exog_arranque_marzo_abril.csv"), index=False)


if __name__ == "__main__":
    main()
