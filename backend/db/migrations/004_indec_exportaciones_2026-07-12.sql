-- ============================================================================
-- MIGRACIÓN 004 — Exportaciones reales por país (INDEC Comercio Exterior)
-- Reemplaza el desglose mensual/por destino de ym.exportaciones, anulado en
-- la migración 002 por ser sintético (ver docs/auditoria_datos.md).
--
-- Fuente: INDEC, Sistema de Consulta de Comercio Exterior de Bienes
-- (comexbe.indec.gob.ar), posiciones NCM 09030010 (yerba mate simplemente
-- canchada) y 09030090 (yerba mate excluida simplemente canchada), mensual
-- por país, 2002-presente. Validado contra el total oficial INYM 2025
-- (57.980.911 kg): 96% de cobertura, el resto queda enmascarado por secreto
-- estadístico (celdas con pocos operadores) -- se carga como NULL, no como 0.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS ym.exportaciones_indec (
    anio            SMALLINT NOT NULL,
    mes             SMALLINT NOT NULL CHECK (mes BETWEEN 1 AND 12),
    ncm             TEXT NOT NULL,          -- '09030010' | '09030090'
    pais_iso2       TEXT NOT NULL,
    pais_nombre     TEXT NOT NULL,
    peso_kg         NUMERIC(14,2),          -- NULL si es_confidencial (secreto estadístico)
    monto_fob_usd   NUMERIC(14,2),          -- NULL si es_confidencial
    es_confidencial BOOLEAN NOT NULL DEFAULT FALSE,
    PRIMARY KEY (anio, mes, ncm, pais_iso2)
);
CREATE INDEX IF NOT EXISTS idx_exportaciones_indec_anio ON ym.exportaciones_indec (anio, mes);
CREATE INDEX IF NOT EXISTS idx_exportaciones_indec_pais ON ym.exportaciones_indec (pais_iso2);

COMMENT ON TABLE ym.exportaciones_indec IS
    'Exportaciones reales de yerba mate por país, mensual (INDEC comexbe.indec.gob.ar, NCM 09030010/09030090, 2002-presente). es_confidencial=true -> peso_kg/monto_fob_usd son NULL (secreto estadístico), nunca 0. Ver docs/fuentes_exportaciones_indec.md.';

COMMIT;
