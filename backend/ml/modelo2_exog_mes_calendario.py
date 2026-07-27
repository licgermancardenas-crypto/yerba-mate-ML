"""Modelo 2 -- prueba de exógenas de estacionalidad fina: 11 dummies de mes
calendario (Ene..Nov, Dic como referencia), a pedido del usuario ("probá
con exógenas de estacionalidad más fina, por mes calendario"). Reusa el
mismo motor SARIMAX walk-forward de `modelo2_baseline.py` para que el
MAPE sea directamente comparable al ya documentado en
docs/modelo2_consumo_interno.md (baseline 6,3%).

Nota metodológica a priori: `seasonal_order` ya usa diferenciación
estacional (D=1, período 12) -- un efecto fijo por mes calendario
perfectamente estable año a año queda casi anulado por esa
diferenciación, así que la expectativa es que estos dummies aporten poco
sobre lo que el propio SARIMA ya captura. Se prueba igual en vez de
asumirlo (mismo criterio que las 3 rondas anteriores de exógenas en
Fase 5 -- NDVI/clima Modelo 1, precio relativo/salario real Modelo 2,
tipo de cambio Modelo 3 -- las 3 negativas).

A diferencia de precio relativo/salario real (NaN antes de 2016), los
dummies de mes no tienen NaN nunca -- se prueban sobre el rango completo
de 60 meses de test, sin recortar.

Uso:
    python -m backend.ml.modelo2_exog_mes_calendario
"""

from __future__ import annotations

import numpy as np
import pandas as pd

from backend.ml.build_panel_modelo2 import armar_panel
from backend.ml.modelo1_baseline import elegir_orden, metricas
from backend.ml.modelo2_baseline import MESES_TEST, serie_mensual_completa, walk_forward

MESES_DUMMY = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov"]  # dic = referencia


def dummies_mes_calendario(indice: pd.DatetimeIndex) -> pd.DataFrame:
    df = pd.DataFrame(index=indice)
    for m, nombre in enumerate(MESES_DUMMY, start=1):
        df[nombre] = (indice.month == m).astype(float)
    return df


def main() -> None:
    panel = armar_panel()
    y = serie_mensual_completa(panel)
    y_log = np.log(y)

    orden = elegir_orden(y_log.iloc[:-MESES_TEST].dropna())
    print(f"Orden elegido: {orden}")

    r_base = walk_forward(y_log, orden, MESES_TEST)
    print(f"\nBaseline (sin exógena): {metricas(r_base)}")

    exog = dummies_mes_calendario(y_log.index)
    r_dummies = walk_forward(y_log, orden, MESES_TEST, exog=exog)
    print(f"Con exógena (11 dummies de mes calendario): {metricas(r_dummies)}")

    import os

    out_dir = os.path.join(os.path.dirname(__file__), "outputs")
    os.makedirs(out_dir, exist_ok=True)
    r_dummies.to_csv(os.path.join(out_dir, "modelo2_exog_mes_calendario_walkforward.csv"), index=False)


if __name__ == "__main__":
    main()
