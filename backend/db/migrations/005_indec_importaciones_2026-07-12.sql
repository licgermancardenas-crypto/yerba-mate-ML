-- ============================================================================
-- MIGRACIÓN 005 — Importaciones reales por país de origen (INDEC)
-- Cierra el hueco de ym.importaciones (2011-2018 anulado, 2019+ sin fuente
-- documentada -- ver docs/auditoria_datos.md, docs/fuentes_exportaciones_indec.md).
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS ym.importaciones_indec (
    anio            SMALLINT NOT NULL,
    mes             SMALLINT NOT NULL CHECK (mes BETWEEN 1 AND 12),
    ncm             TEXT NOT NULL,          -- '09030010' | '09030090'
    pais_iso2       TEXT NOT NULL,
    pais_nombre     TEXT NOT NULL,
    peso_kg         NUMERIC(14,2),          -- NULL si es_confidencial
    monto_fob_usd   NUMERIC(14,2),          -- NULL si es_confidencial
    es_confidencial BOOLEAN NOT NULL DEFAULT FALSE,
    PRIMARY KEY (anio, mes, ncm, pais_iso2)
);
CREATE INDEX IF NOT EXISTS idx_importaciones_indec_anio ON ym.importaciones_indec (anio, mes);

COMMENT ON TABLE ym.importaciones_indec IS
    'Importaciones reales de yerba mate por país de origen, mensual (INDEC comexbe.indec.gob.ar, NCM 09030010/09030090, 2002-presente). Validado contra ym.importaciones (categoría B, sin cita de fuente): 2020 da 31.399.188,94 kg vs 31.400.004 ya cargado, Δ 0,003%. Ver docs/fuentes_exportaciones_indec.md.';

COMMIT;
