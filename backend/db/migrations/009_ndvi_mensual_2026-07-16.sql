-- ============================================================================
-- MIGRACIÓN 009 — ym.ndvi_mensual (2026-07-16)
-- Ver backend/db/schema.sql tabla 16 para el detalle completo. NDVI satelital
-- por departamento, mensual (Google Earth Engine, MODIS/061/MOD13Q1) --
-- variable del Modelo 1 de Fase 5 (Producción por departamento).
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS ym.ndvi_mensual (
    depto           TEXT NOT NULL,
    pcia            TEXT NOT NULL,
    anio            SMALLINT NOT NULL,
    mes             SMALLINT NOT NULL CHECK (mes BETWEEN 1 AND 12),
    ndvi_promedio   NUMERIC(5,4),
    pixeles_validos INTEGER,
    PRIMARY KEY (depto, pcia, anio, mes)
);
CREATE INDEX IF NOT EXISTS idx_ndvi_mensual_anio ON ym.ndvi_mensual (anio, mes);

-- Provenance (Etapa 4 regla 1, docs/auditoria_datos.md) -- toda tabla nueva
-- necesita entrada en ym.tabla_fuente antes de mergear.
INSERT INTO ym.fuentes (codigo, nombre, organismo, url, cobertura, metodo_obtencion, notas) VALUES
('gee_modis_mod13q1', 'NDVI (índice de vegetación), MODIS/061/MOD13Q1', 'NASA / Google Earth Engine',
 'developers.google.com/earth-engine/datasets/catalog/MODIS_061_MOD13Q1', '2000-02-18-presente, compuesto de 16 días',
 'Google Earth Engine (API Python) -- compuesto mensual = promedio de los composites de 16 días que caen en el mes, enmascarados por SummaryQA<=1 (bueno/marginal); reduceRegions sobre las 19 geometrías reales de departamentos (inym_gis, capa view_superficie_por_departamentos), resolución nativa 250m',
 'Auth interactiva de Earth Engine (ee.Authenticate), no cuenta de servicio -- ver docs/fuentes_ndvi_gee.md')
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO ym.tabla_fuente (tabla_nombre, fuente_id, notas)
SELECT 'ym.ndvi_mensual', id, 'Variable del Modelo 1 de Fase 5 (Producción por departamento)'
FROM ym.fuentes WHERE codigo = 'gee_modis_mod13q1'
ON CONFLICT (tabla_nombre) DO NOTHING;

COMMIT;
