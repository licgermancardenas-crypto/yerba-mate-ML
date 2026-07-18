"""Scoring — Modelo 2 (Consumo interno): entrena SARIMA final sobre TODA la
serie disponible (2008-presente, sin hold-out) y genera un pronóstico real
de 12 meses con intervalo de confianza nativo. Escribe en ym.ml_predicciones.

Usa el baseline SIN exógenas (histórico completo, MAPE 6,3% ya validado en
modelo2_baseline.py) -- NO la variante con precio relativo/salario real:
esa arranca recién en 2016 (los IPC del INDEC no tienen serie limpia
antes) y en la comparación directa sobre el mismo rango no superó al
baseline (docs/modelo2_consumo_interno.md §4). Usar la variante con
exógenas acá perdería 8 años de historia real sin una ganancia demostrada.

No pasa por backend/etl/audit_datos.py -- es salida de modelo, no dato
crudo (ver nota en la migración 012).

Uso:
    python -m backend.ml.scoring_modelo2 --dry-run
    python -m backend.ml.scoring_modelo2
"""

from __future__ import annotations

import argparse
import os

import numpy as np
from dotenv import load_dotenv

from backend.ml.build_panel_modelo2 import armar_panel
from backend.ml.modelo1_baseline import elegir_orden
from backend.ml.modelo2_baseline import serie_mensual_completa
from backend.ml.scoring_common import upsert_predicciones
from backend.ml.scoring_modelo1 import _redondear_o_none, pronosticar_serie

MODELO = "modelo2_consumo_interno"
DIMENSION = "(nacional)"
PASOS_FORECAST = 12


def main() -> None:
    load_dotenv()
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    panel = armar_panel()
    y = serie_mensual_completa(panel)
    y_log = np.log(y)
    orden = elegir_orden(y_log.dropna())
    print(f"Orden elegido: {orden}")

    forecast = pronosticar_serie(y_log, orden, PASOS_FORECAST)
    metodo = f"SARIMA{orden[0]}{orden[1]}, entrenado sobre {y_log.dropna().shape[0]} meses reales, sin exógenas"

    filas = []
    for _, fila in forecast.iterrows():
        filas.append(
            (
                MODELO,
                DIMENSION,
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
    print(f"\n{len(filas)} filas de pronóstico generadas")

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
