-- ============================================================================
-- MIGRACIÓN 007 — Provenance: capas de transporte del IGN (Etapa 4, regla 1)
-- Ver backend/etl/etl_ign_transporte.py. Nueva fuente en el catálogo +
-- nota actualizada en inym_gis.raw_features (tabla mixta: INYM geoserver +
-- INDEC geonode + IGN transporte, todas conviven en la misma tabla física).
-- ============================================================================

BEGIN;

INSERT INTO ym.fuentes (codigo, nombre, organismo, url, cobertura, metodo_obtencion, notas) VALUES
('ign_capas_sig250', 'Infraestructura de transporte (vial nacional/provincial, ferrocarril)', 'IGN',
 'ign.gob.ar (paquete Capas SIG 250)', 'Snapshot, recortado a Misiones+Corrientes (+3km buffer)',
 'Descarga manual (endpoints directos del IGN inalcanzables desde este entorno, igual que en indec_geonode) + recorte geográfico con geopandas',
 'backend/etl/etl_ign_transporte.py. Archivos fuente ya recortados en data/raw/gis_transporte/ (originales nacionales de hasta 88MB no se commitean, solo el recorte de ~2.5MB). Capas ign_* en inym_gis.raw_features. Corrupción de encoding preexistente en el campo fdc de los GeoJSON originales del IGN (no introducida por este ETL, no afecta ningún campo mostrado en el frontend).')
ON CONFLICT (codigo) DO NOTHING;

UPDATE ym.tabla_fuente
SET notas = 'Capas indec_* vienen de indec_geonode, capas ign_* vienen de ign_capas_sig250 -- ninguna de las dos usa este fuente_id. Tabla mixta de 3 fuentes, ver docs/inym_geoserver_layers.md y Fase 3e en TODO.md.'
WHERE tabla_nombre = 'inym_gis.raw_features';

COMMIT;
