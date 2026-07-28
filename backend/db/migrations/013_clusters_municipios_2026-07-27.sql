-- ============================================================================
-- MIGRACIÓN 013 — Tipología productiva por municipio (clustering K-means)
-- A pedido del usuario ("mapa o gráfico de clusters/cohortes"). Cálculo
-- propio (backend/ml/clusters_municipios.py) sobre datos ya cargados de
-- INYM (superficie/densidad/consociado por municipio) -- no es una fuente
-- externa nueva, es un cálculo derivado (organismo NULL a propósito).
-- Solo el catálogo/provenance -- los datos (geometría + cluster_id/label)
-- los inserta el script Python en inym_gis.raw_features.
-- ============================================================================

BEGIN;

INSERT INTO ym.fuentes (codigo, nombre, organismo, url, cobertura, metodo_obtencion, notas) VALUES
('calculo_clusters_municipios', 'Tipología productiva por municipio (clustering)', NULL, NULL,
 '79 de 82 municipios (Misiones+Corrientes) con las 3 features completas',
 'K-means (scikit-learn, k=4, random_state=42) sobre % superficie cultivada + % superficie en alta densidad de plantación + % superficie con cultivo consociado -- las 3 de view_superficie_por_municipios/_densidad_/_consociado (INYM, ya cargadas). "Edad de plantación" se evaluó y se descartó como feature: solo ~24% de la superficie promedio tiene año de plantación registrado (resto "S/D"), insuficiente cobertura para confiar en esa dimensión.',
 'backend/ml/clusters_municipios.py. Ver docs/clusters_municipios.md. Etiquetas de cluster asignadas programáticamente por características del centroide (no por índice arbitrario de K-means), reproducible re-corriendo el script.')
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO inym_gis.catalogo_capas (layer_name, categoria, nivel_espacial, geom_type, descripcion) VALUES
('clusters_municipios', 'clusters', 'municipio', 'MultiPolygon',
 'Tipología productiva por municipio (K-means, 4 grupos) sobre % cultivado, % alta densidad y % cultivo consociado -- cálculo propio, no dato crudo del INYM.')
ON CONFLICT (layer_name) DO NOTHING;

UPDATE ym.tabla_fuente
SET notas = 'Capas indec_* vienen de indec_geonode, capas ign_* vienen de ign_capas_sig250, capa clusters_municipios viene de calculo_clusters_municipios (cálculo propio, no fuente externa) -- ninguna de las 3 usa este fuente_id. Tabla mixta de 4 fuentes, ver docs/inym_geoserver_layers.md y Fase 3e en TODO.md.'
WHERE tabla_nombre = 'inym_gis.raw_features';

COMMIT;
