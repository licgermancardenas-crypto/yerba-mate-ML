"""Modelo 1 (Fase 5) — comparación más robusta de exógenas de "arranque de
temporada" para marzo/abril.

La prueba anterior (`modelo1_exog_arranque.py`) solo evaluó en los últimos
2 años (n=4 por zona) -- muestra demasiado chica para concluir nada. Acá se
evalúa contra TODOS los años disponibles con suficiente historia previa
(leave-one-year-out: entrena con todo lo anterior a enero de ese año, corre
un forecast de 4 pasos -- ene, feb, mar, abr -- y solo puntúa marzo/abril),
y se prueban 3 variantes de exógena en vez de una sola:

- NDVI: anomalía de NDVI de enero+febrero (la que ya se probó, mal diseño
  de evaluación la vez pasada)
- lluvia: anomalía de precipitación acumulada (mm/día promedio) de
  enero+febrero
- ambas: las dos juntas

El baseline histórico de cada anomalía se recalcula excluyendo el año que
se está evaluando (evita el leakage leve que tenía la prueba anterior, que
promediaba incluyendo los años de test).

Uso:
    python -m backend.ml.modelo1_exog_comparacion
"""

from __future__ import annotations

import warnings

import numpy as np
import pandas as pd

from backend.ml.build_panel_modelo1 import armar_panel
from backend.ml.modelo1_baseline import elegir_orden, serie_mensual_completa

ANIO_DESDE_TEST = 2018  # deja >=6 años de historia antes del primer año evaluado


def anomalias_enefeb(panel: pd.DataFrame, zona: str, columna: str) -> pd.Series:
    """Serie anio -> valor real de enero+febrero (promedio) de esa columna, para esa zona."""
    g = panel[panel["zona"] == zona]
    return g[g["mes"].isin([1, 2])].groupby("anio")[columna].mean()


def construir_exog(rango: pd.DatetimeIndex, valores_enefeb: pd.Series, anio_excluir: int) -> pd.Series:
    """Anomalía activa solo en marzo/abril -- el promedio histórico de
    referencia excluye el año evaluado (sin leakage)."""
    referencia = valores_enefeb.drop(index=anio_excluir, errors="ignore").mean()
    exog = pd.Series(0.0, index=rango)
    for fecha in rango:
        if fecha.month in (3, 4) and fecha.year in valores_enefeb.index:
            valor = valores_enefeb.loc[fecha.year]
            exog.loc[fecha] = (valor - referencia) if pd.notna(valor) else 0.0
    return exog


def evaluar_variante(y_log: pd.Series, exog: pd.Series | None, orden: tuple, anios_test: list[int]) -> pd.DataFrame:
    from statsmodels.tsa.statespace.sarimax import SARIMAX

    orden_ar, orden_estacional = orden
    filas = []
    for anio in anios_test:
        corte = y_log.index.get_loc(pd.Timestamp(f"{anio}-01-01"))
        train_y = y_log.iloc[:corte]
        if train_y.dropna().shape[0] < 24:
            continue
        try:
            with warnings.catch_warnings():
                warnings.simplefilter("ignore")
                kwargs = dict(order=orden_ar, seasonal_order=orden_estacional, enforce_stationarity=False, enforce_invertibility=False)
                if exog is not None:
                    res = SARIMAX(train_y, exog=exog.iloc[:corte], **kwargs).fit(disp=False)
                    pred = res.forecast(4, exog=exog.iloc[corte : corte + 4])
                else:
                    res = SARIMAX(train_y, **kwargs).fit(disp=False)
                    pred = res.forecast(4)
        except Exception as e:
            print(f"    fallo {anio}: {e}")
            continue
        for offset, mes in enumerate([1, 2, 3, 4]):
            if mes not in (3, 4):
                continue
            idx = corte + offset
            if idx >= len(y_log) or pd.isna(y_log.iloc[idx]):
                continue
            filas.append({"anio": anio, "mes": mes, "real": np.exp(y_log.iloc[idx]), "pred": np.exp(pred.iloc[offset])})
    return pd.DataFrame(filas)


def metricas(df: pd.DataFrame) -> dict:
    if df.empty:
        return {"n": 0}
    err = df["pred"] - df["real"]
    return {"n": len(df), "MAE_kg": round(err.abs().mean()), "MAPE_%": round((err.abs() / df["real"]).mean() * 100, 1)}


def main() -> None:
    panel = armar_panel()
    resumen = []
    for zona in sorted(panel["zona"].unique()):
        y = serie_mensual_completa(panel, zona)
        y_log = np.log(y)
        rango = y_log.index
        anios_test = [a for a in range(ANIO_DESDE_TEST, rango.year.max() + 1) if pd.Timestamp(f"{a}-01-01") in rango]

        ndvi_enefeb = anomalias_enefeb(panel, zona, "ndvi_promedio")
        lluvia_enefeb = anomalias_enefeb(panel, zona, "precipitacion_mm_dia")

        orden = elegir_orden(y_log.iloc[: y_log.index.get_loc(pd.Timestamp(f"{ANIO_DESDE_TEST}-01-01"))].dropna())
        print(f"\n{zona} (orden {orden}, {len(anios_test)} años evaluados: {anios_test}):")

        # baseline sin exógena
        r_base = evaluar_variante(y_log, None, orden, anios_test)
        m_base = metricas(r_base)
        print(f"  sin exógena:      {m_base}")

        # NDVI: como el promedio de referencia debe excluir el año evaluado,
        # se arma un exog POR año de test y se concatenan los resultados.
        for nombre, serie_enefeb, serie_enefeb2 in [
            ("ndvi", ndvi_enefeb, None),
            ("lluvia", lluvia_enefeb, None),
            ("ndvi+lluvia", ndvi_enefeb, lluvia_enefeb),
        ]:
            filas_totales = []
            for anio in anios_test:
                exog = construir_exog(rango, serie_enefeb, anio)
                if serie_enefeb2 is not None:
                    exog2 = construir_exog(rango, serie_enefeb2, anio)
                    exog_df = pd.concat([exog.rename("a"), exog2.rename("b")], axis=1)
                else:
                    exog_df = exog
                r = evaluar_variante(y_log, exog_df, orden, [anio])
                filas_totales.append(r)
            r_variante = pd.concat(filas_totales, ignore_index=True) if filas_totales else pd.DataFrame()
            m = metricas(r_variante)
            print(f"  {nombre:16}: {m}")
            resumen.append({"zona": zona, "variante": nombre, **m})
        resumen.append({"zona": zona, "variante": "sin_exogena", **m_base})

    resumen_df = pd.DataFrame(resumen)
    print("\n\n=== RESUMEN ===")
    print(resumen_df.pivot(index="zona", columns="variante", values="MAPE_%"))

    import os

    out_dir = os.path.join(os.path.dirname(__file__), "outputs")
    resumen_df.to_csv(os.path.join(out_dir, "modelo1_exog_comparacion.csv"), index=False)


if __name__ == "__main__":
    main()
