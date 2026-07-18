-- ============================================================================
-- MIGRACIÓN 012 — ym.ml_predicciones (2026-07-18)
-- Ver backend/db/schema.sql tabla 20. Salida de los 3 modelos de Fase 5
-- (Producción por zona, Consumo interno, Exportaciones gravitacional).
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS ym.ml_predicciones (
    id              BIGSERIAL PRIMARY KEY,
    modelo          TEXT NOT NULL,
    dimension       TEXT NOT NULL DEFAULT '(nacional)',
    anio            SMALLINT NOT NULL,
    mes             SMALLINT,
    es_pronostico   BOOLEAN NOT NULL,
    valor_real      NUMERIC(20,4),
    valor_predicho  NUMERIC(20,4) NOT NULL,
    ic_inferior     NUMERIC(20,4),
    ic_superior     NUMERIC(20,4),
    nivel_confianza NUMERIC(4,3) NOT NULL DEFAULT 0.95,
    unidad          TEXT NOT NULL DEFAULT 'kg',
    metodo          TEXT NOT NULL,
    supuestos       TEXT,
    generado_en     TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- NULLS NOT DISTINCT: mes es NULL en todas las filas de modelo3 (panel
    -- anual) -- sin esto el ON CONFLICT del upsert nunca matchea esas filas.
    CONSTRAINT ml_predicciones_unico UNIQUE NULLS NOT DISTINCT (modelo, dimension, anio, mes, es_pronostico)
);
CREATE INDEX IF NOT EXISTS idx_ml_predicciones_modelo ON ym.ml_predicciones (modelo, dimension, anio, mes);

INSERT INTO ym.fuentes (codigo, nombre, organismo, url, cobertura, metodo_obtencion, notas) VALUES
('ml_fase5_interno', 'Modelos ML internos (SARIMA producción/consumo, OLS gravitacional exportaciones)',
 'Modelo interno (no es una fuente externa)', NULL, 'Fase 5, ver docs/modelo1_produccion_zona.md, docs/modelo2_consumo_interno.md, docs/modelo3_exportaciones_gravitacional.md',
 'Entrenado sobre las series reales ya cargadas en ym.* -- ver backend/ml/scoring_modelo{1,2,3}.py',
 'Salida de modelo, no dato crudo -- no pasa por audit_datos.py (ese script detecta fabricación de datos reales, no aplica a salida de modelo declarada como tal)')
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO ym.tabla_fuente (tabla_nombre, fuente_id, notas)
SELECT 'ym.ml_predicciones', id, 'Predicciones/proyecciones generadas por backend/ml/scoring_*.py, no dato observado'
FROM ym.fuentes WHERE codigo = 'ml_fase5_interno'
ON CONFLICT (tabla_nombre) DO NOTHING;

COMMIT;
