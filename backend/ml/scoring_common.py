"""Utilidad compartida por los 3 scripts de scoring (backend/ml/scoring_modelo{1,2,3}.py)
-- upsert genérico a ym.ml_predicciones. Ver backend/db/schema.sql tabla 20.
"""

from __future__ import annotations


def upsert_predicciones(conn, filas: list[tuple]) -> None:
    """filas: (modelo, dimension, anio, mes, es_pronostico, valor_real,
    valor_predicho, ic_inferior, ic_superior, nivel_confianza, unidad,
    metodo, supuestos)."""
    from psycopg2.extras import execute_values

    query = """
        INSERT INTO ym.ml_predicciones
            (modelo, dimension, anio, mes, es_pronostico, valor_real, valor_predicho,
             ic_inferior, ic_superior, nivel_confianza, unidad, metodo, supuestos)
        VALUES %s
        ON CONFLICT (modelo, dimension, anio, mes, es_pronostico) DO UPDATE SET
            valor_real = EXCLUDED.valor_real,
            valor_predicho = EXCLUDED.valor_predicho,
            ic_inferior = EXCLUDED.ic_inferior,
            ic_superior = EXCLUDED.ic_superior,
            nivel_confianza = EXCLUDED.nivel_confianza,
            unidad = EXCLUDED.unidad,
            metodo = EXCLUDED.metodo,
            supuestos = EXCLUDED.supuestos,
            generado_en = now()
    """
    with conn.cursor() as cur:
        execute_values(cur, query, filas)
