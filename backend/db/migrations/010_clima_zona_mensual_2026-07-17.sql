-- ============================================================================
-- MIGRACIÓN 010 — ym.clima_zona_mensual (2026-07-17)
-- Ver backend/db/schema.sql tabla 17. Clima por zona INYM (no por ciudad) --
-- Modelo 1 de Fase 5 necesita el clima a la misma granularidad que el target
-- real de producción (ym.inym_hoja_verde_zona).
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS ym.clima_zona_mensual (
    zona                    TEXT NOT NULL,
    latitud                 DOUBLE PRECISION NOT NULL,
    longitud                DOUBLE PRECISION NOT NULL,
    anio                    SMALLINT NOT NULL,
    mes                     SMALLINT NOT NULL CHECK (mes BETWEEN 1 AND 12),
    precipitacion_mm_dia    NUMERIC(6,2),
    temperatura_media_c     NUMERIC(5,2),
    PRIMARY KEY (zona, anio, mes)
);
CREATE INDEX IF NOT EXISTS idx_clima_zona_mensual_anio ON ym.clima_zona_mensual (anio, mes);

INSERT INTO ym.tabla_fuente (tabla_nombre, fuente_id, notas)
SELECT 'ym.clima_zona_mensual', fuente_id, 'Misma fuente (NASA POWER) que clima_mensual, reconsultada en el centroide ponderado por superficie cultivada de cada zona INYM (Modelo 1, Fase 5)'
FROM ym.tabla_fuente WHERE tabla_nombre = 'ym.clima_mensual'
ON CONFLICT (tabla_nombre) DO NOTHING;

COMMIT;
