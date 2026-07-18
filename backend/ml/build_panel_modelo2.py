"""Modelo 2 (Fase 5) — arma el panel mensual para consumo interno.

`ym.consumo_interno.consumo_per_capita_kg` es un dato ANUAL publicado con
cadencia mensual (mismo valor los 12 meses, cambia solo año a año, ya
documentado en TODO.md) -- no sirve como target de un SARIMAX mensual. El
target real es `ym.inym_salida_molino` (destino='interno'): salida de
molino hacia el mercado interno, real y mensual desde 2008 (scraper PDF
INYM, Fase 3c). Mide un punto distinto de la cadena que "consumo" (más
cerca de fábrica que de consumidor final) pero es la única serie mensual
real disponible de ese lado.

Predictores:
- precio relativo: ipc_gba_yerba_mate / ipc_nacional_nivel_general
- salario real: ripte / ipc_nacional_nivel_general (RIPTE es nominal)
- dummy Día del Mate (30/11) -- mes == 11

Los IPC/RIPTE del INDEC solo tienen serie limpia desde 2016 -- el panel
completo va 2008-2026 (todo el rango real del target), los predictores
quedan NaN antes de 2016 (no se rellena).

Uso:
    python -m backend.ml.build_panel_modelo2
"""

from __future__ import annotations

import os

import pandas as pd
from dotenv import load_dotenv


def _conn():
    import psycopg2

    load_dotenv()
    return psycopg2.connect(os.environ["DATABASE_URL"])


def armar_panel() -> pd.DataFrame:
    conn = _conn()
    try:
        target = pd.read_sql(
            "SELECT anio, mes, volumen_kg AS salida_molino_interno_kg FROM ym.inym_salida_molino WHERE destino='interno' ORDER BY anio, mes",
            conn,
        )
        series = pd.read_sql("SELECT serie_nombre, anio, mes, valor FROM ym.indec_series", conn)
    finally:
        conn.close()

    pivot = series.pivot_table(index=["anio", "mes"], columns="serie_nombre", values="valor").reset_index()
    panel = target.merge(pivot, on=["anio", "mes"], how="left")

    panel["precio_relativo_yerba"] = panel["ipc_gba_yerba_mate"] / panel["ipc_nacional_nivel_general"]
    panel["salario_real"] = panel["ripte"] / panel["ipc_nacional_nivel_general"]
    panel["dummy_dia_del_mate"] = (panel["mes"] == 11).astype(int)

    panel["fecha"] = pd.to_datetime(panel["anio"].astype(str) + "-" + panel["mes"].astype(str) + "-01")
    return panel.sort_values("fecha").reset_index(drop=True)


def diagnostico(panel: pd.DataFrame) -> None:
    print(f"Panel: {len(panel)} filas, {panel['fecha'].min().date()} a {panel['fecha'].max().date()}")
    cols = ["salida_molino_interno_kg", "precio_relativo_yerba", "salario_real"]
    print("\n% NaN por columna:")
    print((panel[cols].isna().mean() * 100).round(1))
    print("\nCorrelación contemporánea (sin lag) con el target:")
    print(panel[cols].corr()["salida_molino_interno_kg"].round(2))
    print("\nPromedio mensual (estacionalidad):")
    print(panel.groupby("mes")["salida_molino_interno_kg"].mean().round(0))


if __name__ == "__main__":
    panel = armar_panel()
    diagnostico(panel)
    out_dir = os.path.join(os.path.dirname(__file__), "outputs")
    os.makedirs(out_dir, exist_ok=True)
    panel.to_csv(os.path.join(out_dir, "panel_modelo2.csv"), index=False)
    print(f"\nGuardado: {out_dir}/panel_modelo2.csv")
