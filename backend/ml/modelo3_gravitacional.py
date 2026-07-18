"""Modelo 3 (Fase 5) — modelo gravitacional de exportaciones.

Regresión log-log estándar de la literatura de comercio internacional:

    log(volumen_kg) = b0 + b1*log(PBI_destino) + b2*log(distancia_km)
                       + b3*dummy_diaspora + b4*log(tipo_cambio) + e

OLS sobre observaciones con dato real (no se imputan los NaN -- ~21% de
las combinaciones país-año no tienen volumen real publicado, se excluyen
de la regresión, no se tratan como cero). Nota metodológica: esto es un
supuesto simplificador -- un modelo PPML (Poisson) sería más riguroso para
manejar ceros reales de comercio sin tener que descartarlos, no se
implementó en esta primera versión (ver docs/modelo3_exportaciones_gravitacional.md).

Validación: walk-forward por año (ya que es un panel, no una serie
univariada) -- entrena con años <= Y, predice todos los países en el año
Y+1, para los últimos 5 años.

Uso:
    python -m backend.ml.modelo3_gravitacional
"""

from __future__ import annotations

import numpy as np
import pandas as pd
import statsmodels.api as sm

from backend.ml.build_panel_modelo3 import armar_panel

ANIOS_TEST = 5


def preparar_variables(panel: pd.DataFrame) -> pd.DataFrame:
    df = panel.dropna(subset=["volumen_kg", "pbi_usd", "ars_usd_oficial"]).copy()
    df = df[df["volumen_kg"] > 0]  # log-log no admite cero -- ver nota metodológica
    df["log_volumen"] = np.log(df["volumen_kg"])
    df["log_pbi"] = np.log(df["pbi_usd"])
    df["log_distancia"] = np.log(df["distancia_km"])
    df["log_tipo_cambio"] = np.log(df["ars_usd_oficial"])
    return df


def ajustar(df_train: pd.DataFrame):
    X = df_train[["log_pbi", "log_distancia", "dummy_diaspora", "log_tipo_cambio"]]
    X = sm.add_constant(X)
    y = df_train["log_volumen"]
    return sm.OLS(y, X).fit()


def walk_forward_por_anio(df: pd.DataFrame, anios_test: list[int]) -> pd.DataFrame:
    filas = []
    for anio in anios_test:
        train = df[df["anio"] < anio]
        test = df[df["anio"] == anio]
        if train.empty or test.empty:
            continue
        modelo = ajustar(train)
        X_test = sm.add_constant(test[["log_pbi", "log_distancia", "dummy_diaspora", "log_tipo_cambio"]], has_constant="add")
        pred_log = modelo.predict(X_test)
        for (idx, real_log), pred in zip(test["log_volumen"].items(), pred_log):
            filas.append(
                {
                    "anio": anio,
                    "pais_iso2": test.loc[idx, "pais_iso2"],
                    "real": np.exp(real_log),
                    "pred": np.exp(pred),
                }
            )
    return pd.DataFrame(filas)


def metricas(df: pd.DataFrame) -> dict:
    if df.empty:
        return {"n": 0}
    err = df["pred"] - df["real"]
    return {"n": len(df), "MAE_kg": round(err.abs().mean()), "MAPE_%": round((err.abs() / df["real"]).mean() * 100, 1)}


def main() -> None:
    panel = armar_panel()
    df = preparar_variables(panel)
    print(f"Observaciones con dato real completo: {len(df)} de {len(panel)} posibles ({len(df) / len(panel) * 100:.0f}%)")

    print("\n=== Ajuste con todos los datos (para ver los coeficientes) ===")
    modelo_completo = ajustar(df)
    print(modelo_completo.summary())

    anios_disponibles = sorted(df["anio"].unique())
    anios_test = anios_disponibles[-ANIOS_TEST:]
    r = walk_forward_por_anio(df, anios_test)
    print(f"\n=== Walk-forward por año ({anios_test}) ===")
    print(metricas(r))
    print("\nPor país (para ver si el error se concentra en alguno):")
    for pais, g in r.groupby("pais_iso2"):
        print(f"  {pais}: {metricas(g)}")

    import os

    out_dir = os.path.join(os.path.dirname(__file__), "outputs")
    os.makedirs(out_dir, exist_ok=True)
    r.to_csv(os.path.join(out_dir, "modelo3_walkforward.csv"), index=False)
    print(f"\nGuardado: {out_dir}/modelo3_walkforward.csv")


if __name__ == "__main__":
    main()
