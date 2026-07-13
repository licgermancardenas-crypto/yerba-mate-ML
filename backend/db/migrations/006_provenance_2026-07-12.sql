-- ============================================================================
-- MIGRACIÓN 006 — Provenance: catálogo de fuentes (Etapa 4, regla 1)
-- Ver docs/auditoria_datos.md. Nivel TABLA (una fuente principal por tabla
-- física), no fila -- decisión explícita del usuario 2026-07-12: el mismo
-- valor práctico que fuente_id por fila, sin migrar/backfillear ~18 tablas
-- ya cargadas. Las 2 tablas que ya tenían provenance real por fila
-- (dataset_principal_anual, exportaciones_anual, columna `fuente` en texto)
-- se formalizan acá con fuente_id FK real.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS ym.fuentes (
    id                  SERIAL PRIMARY KEY,
    codigo              TEXT NOT NULL UNIQUE,   -- slug estable, referenciado desde ym.tabla_fuente
    nombre              TEXT NOT NULL,
    organismo           TEXT,                   -- NULL si es un cálculo derivado, no una fuente externa
    url                 TEXT,
    cobertura           TEXT,                   -- rango temporal / alcance geográfico en texto libre
    metodo_obtencion    TEXT NOT NULL,           -- cómo se consigue el dato (scraper PDF, API REST, cálculo, etc.)
    notas               TEXT
);

CREATE TABLE IF NOT EXISTS ym.tabla_fuente (
    tabla_nombre        TEXT PRIMARY KEY,        -- 'ym.inym_hoja_verde_zona', etc.
    fuente_id           INTEGER NOT NULL REFERENCES ym.fuentes(id),
    notas               TEXT                     -- matices: "solo columnas X/Y", "tabla legacy, no usar", etc.
);

INSERT INTO ym.fuentes (codigo, nombre, organismo, url, cobertura, metodo_obtencion, notas) VALUES
('inym_pdf_hoja_verde', 'Ingreso de hoja verde a secadero, por zona', 'INYM',
 'inym.org.ar/descargar/publicaciones/estadisticas/', '2012-presente, mensual',
 'Scraper de PDFs mensuales/anuales (PyMuPDF find_tables sobre tablas reales, no OCR/regex)',
 'backend/etl/etl_inym_pdf.py. Ver docs/inym_scraper.md.'),

('inym_pdf_salida_molino', 'Salida de molino, mercado interno/externo', 'INYM',
 'inym.org.ar/descargar/publicaciones/estadisticas/', '2008-presente, mensual',
 'Scraper de PDFs mensuales/anuales (PyMuPDF find_tables)',
 'backend/etl/etl_inym_pdf.py. NO coincide con consumo_interno_kg/exportaciones_kg de dataset_principal -- miden puntos distintos de la cadena. Ver docs/inym_scraper.md.'),

('inym_sagyp_precio_materia_prima', 'Valores de la Materia Prima (hoja verde y canchada)', 'INYM / SAGyP',
 'inym.org.ar/tramites/normativa/ ; inym.org.ar/noticias/precio/', '2008-presente, semestral con escalonamiento mensual',
 'Resoluciones publicadas -- carga manual/histórica, sin ETL automatizado todavía',
 'Ley 25.564, Decreto 1240/02. Mecanismo discontinuado por el INYM el 31/03/2026 (Decreto 812). Validado: 3 meses (ene-mar 2024) coinciden exacto contra Resolución 406/2023 SAGyP. Ver docs/fuentes_precios_materia_prima.md.'),

('inym_comunicado_oficial', 'Comunicados de prensa institucional del INYM', 'INYM',
 'inym.org.ar/noticias/', 'Puntual, según publicación',
 'Lectura manual de comunicados oficiales (research web), sin ETL',
 'Usado para cargar 2025 nacional (producción/consumo/exportaciones) tras el hallazgo de la auditoría de que dataset_principal/ym.exportaciones tenían 2025 clonado de 2024. Ver docs/auditoria_datos.md §6.'),

('indec_comex', 'Comercio Exterior de Bienes (exportaciones/importaciones por país)', 'INDEC',
 'comexbe.indec.gob.ar/public-api/search/', '2002-presente, mensual',
 'API REST pública sin autenticación (backend descubierto detrás de la UI web)',
 'NCM 09030010/09030090 (yerba mate, posición propia). backend/etl/lib_indec_comex.py + etl_indec_comex_exportaciones.py/etl_indec_comex_importaciones.py. Ver docs/fuentes_exportaciones_indec.md.'),

('indec_series_tiempo', 'API de series de tiempo (IPC, EMAE)', 'INDEC',
 'apis.datos.gob.ar/series/api/series', 'Variable por serie, ver docs/indec_series.md',
 'API REST pública',
 'backend/etl/etl_indec_series.py. Ver docs/indec_series.md.'),

('indec_geonode', 'Cartografía censal (Marco Geoestadístico Nacional)', 'INDEC',
 'geonode.indec.gob.ar', 'Snapshot, Misiones+Corrientes',
 'WFS (GeoNode)',
 'backend/etl/etl_indec_censal.py. Origen IGN, republicado por INDEC (geonode.indec.gob.ar era accesible, ign.gob.ar no). Capas indec_* en inym_gis.raw_features.'),

('nasa_power', 'Precipitación y temperatura mensual', 'NASA (POWER)',
 'power.larc.nasa.gov/api/temporal/monthly/point', '1981-presente, mensual',
 'API REST pública sin autenticación',
 'backend/etl/etl_nasa_power.py. 6 ciudades productoras.'),

('argentinadatos_bcra_rem', 'Relevamiento de Expectativas de Mercado (REM)', 'BCRA (mirror ArgentinaDatos)',
 'api.argentinadatos.com/v1/rems/', '~14 meses móviles (no histórico completo)',
 'API REST pública (mirror comunitario, no el Excel crudo del BCRA)',
 'backend/etl/etl_bcra_rem.py. Ver docs/bcra_rem.md.'),

('sepa_precios', 'Precios de góndola (dump diario)', 'Secretaría de Comercio (SEPA, Res. 678/2020)',
 'datos.produccion.gob.ar/dataset/sepa-precios', 'Snapshot único (sin backfill posible)',
 'Descarga de dump público diario',
 'backend/etl/etl_sepa_gondola.py. El portal solo mantiene 7 archivos rotativos.'),

('inym_geoserver', 'Superficie cultivada y secaderos (capas geoespaciales)', 'INYM',
 'gis.inym.org.ar/geoserver_disabled/wfs', 'Snapshot, 20 capas', 'WFS (GeoServer)',
 'backend/etl/etl_inym_gis.py. Ver docs/inym_geoserver_layers.md.'),

('prensa_competencia', 'Rankings de participación de mercado citados por fila', 'Prensa especializada (Agrofy, Plan B Misiones, Infobae, LA NACIÓN, vía INYM)',
 NULL, '2021, 2024, 2025 (parcial)', 'Research manual, fuente citada en cada fila (fuente_url/fuente_medio/fuente_fecha)',
 'ym.competencia ya tiene provenance por fila desde Fase 8 -- esta entrada es solo la referencia general del catálogo. Ver docs/fuentes_competencia.md.'),

('bcr_informativo', 'Composición exportación granel vs. fraccionado', 'Bolsa de Comercio de Rosario',
 NULL, 'Puntual, ene-sep 2025 (Informativo Semanal N.° 2222, 28/11/2025)',
 'Lectura manual de informe',
 'No es tabla/serie -- anotación estática en el frontend de Exportaciones (GaugeCard), no hay ETL.'),

('csv_semilla_validado', 'CSV semilla del scaffolding inicial (origen exacto desconocido)', NULL,
 NULL, '2011-2024 (totales anuales)',
 'Desconocido -- cargado en el commit de scaffolding inicial (223741e, 2026-06-30) sin cita',
 'El desglose mensual/por-ciudad resultó 100% sintético (auditoría 2026-07-11) y fue anulado. Los TOTALES ANUALES 2011-2024 fueron validados por cruce independiente contra inym_pdf_hoja_verde/inym_pdf_salida_molino/comunicados INYM (coinciden a <0,5%) -- categoría C, no A: el origen exacto del CSV sigue sin identificarse, solo se confirmó que sus totales son reales. Ver docs/auditoria_datos.md.'),

('derivado_precio_fob', 'Precio FOB unitario (USD/kg)', NULL, NULL, 'Toda la serie',
 'Cálculo: valor_fob_usd / exportaciones_kg',
 'Verificado a nivel anual por ciudad: coincide a la 5ª-6ª cifra decimal. Categoría C. Ver docs/auditoria_datos.md.'),

('derivado_consumo_percapita', 'Consumo per cápita (kg/persona)', NULL, NULL, 'Toda la serie',
 'Cálculo: consumo_interno_kg (nacional) / población (fuente exacta de población no identificada, probablemente INDEC)',
 'Verificado: la población implícita (consumo_total/per_cápita) por año forma una curva demográfica plausible (40,6M en 2011 a 47,7M en 2025). Categoría C. Ver docs/auditoria_datos.md.')

ON CONFLICT (codigo) DO NOTHING;

-- ----------------------------------------------------------------------------
-- Formalizar provenance por fila en las 2 tablas que ya la tenían en texto
-- plano (dataset_principal_anual, exportaciones_anual)
-- ----------------------------------------------------------------------------
ALTER TABLE ym.dataset_principal_anual ADD COLUMN IF NOT EXISTS fuente_id INTEGER REFERENCES ym.fuentes(id);
UPDATE ym.dataset_principal_anual SET fuente_id = (SELECT id FROM ym.fuentes WHERE codigo = 'csv_semilla_validado') WHERE fuente = 'dataset_principal_original';
UPDATE ym.dataset_principal_anual SET fuente_id = (SELECT id FROM ym.fuentes WHERE codigo = 'inym_comunicado_oficial') WHERE fuente = 'inym_comunicado_oficial';

ALTER TABLE ym.exportaciones_anual ADD COLUMN IF NOT EXISTS fuente_id INTEGER REFERENCES ym.fuentes(id);
UPDATE ym.exportaciones_anual SET fuente_id = (SELECT id FROM ym.fuentes WHERE codigo = 'csv_semilla_validado') WHERE fuente = 'ym_exportaciones_original';
UPDATE ym.exportaciones_anual SET fuente_id = (SELECT id FROM ym.fuentes WHERE codigo = 'inym_comunicado_oficial') WHERE fuente = 'inym_comunicado_oficial';

-- ----------------------------------------------------------------------------
-- Mapeo tabla -> fuente principal (provenance a nivel tabla para el resto)
-- ----------------------------------------------------------------------------
INSERT INTO ym.tabla_fuente (tabla_nombre, fuente_id, notas) VALUES
('ym.dataset_principal', (SELECT id FROM ym.fuentes WHERE codigo='csv_semilla_validado'),
 'Desglose mensual/por-ciudad anulado (sintético, auditoría 2026-07-11). Solo precio_usd_kg tiene dato -- ver derivado_precio_fob. Usar ym.dataset_principal_anual para totales.'),
-- ym.dataset_principal_anual: provenance por FILA (columna fuente_id propia), no entra acá.
('ym.consumo_interno', (SELECT id FROM ym.fuentes WHERE codigo='csv_semilla_validado'),
 'consumo_per_capita_kg -- ver derivado_consumo_percapita. mix de envases anulado 2011-2024 (fabricado), solo 2025 real.'),
('ym.exportaciones', (SELECT id FROM ym.fuentes WHERE codigo='csv_semilla_validado'),
 'TABLA LEGACY -- desglose mensual anulado (sintético). Reemplazada por ym.exportaciones_indec, no usar para nada nuevo.'),
-- ym.exportaciones_anual: provenance por FILA (columna fuente_id propia), no entra acá.
('ym.exportaciones_indec', (SELECT id FROM ym.fuentes WHERE codigo='indec_comex'), NULL),
('ym.importaciones', (SELECT id FROM ym.fuentes WHERE codigo='csv_semilla_validado'),
 'TABLA LEGACY -- reemplazada por ym.importaciones_indec, no usar para nada nuevo.'),
('ym.importaciones_indec', (SELECT id FROM ym.fuentes WHERE codigo='indec_comex'), NULL),
('ym.precios', (SELECT id FROM ym.fuentes WHERE codigo='inym_sagyp_precio_materia_prima'), NULL),
('ym.superficie_productores', (SELECT id FROM ym.fuentes WHERE codigo='csv_semilla_validado'),
 'productores: 8 tramos interpolados anulados (fabricado). superficie_ha 2020-2024 validada (177.533 ha, coincide con benchmark externo).'),
('ym.competencia', (SELECT id FROM ym.fuentes WHERE codigo='prensa_competencia'), 'Provenance real por fila desde Fase 8 (fuente_url/fuente_medio/fuente_fecha propios).'),
('ym.inym_hoja_verde_zona', (SELECT id FROM ym.fuentes WHERE codigo='inym_pdf_hoja_verde'), NULL),
('ym.inym_salida_molino', (SELECT id FROM ym.fuentes WHERE codigo='inym_pdf_salida_molino'), NULL),
('ym.clima_mensual', (SELECT id FROM ym.fuentes WHERE codigo='nasa_power'), NULL),
('ym.indec_series', (SELECT id FROM ym.fuentes WHERE codigo='indec_series_tiempo'), NULL),
('ym.bcra_rem', (SELECT id FROM ym.fuentes WHERE codigo='argentinadatos_bcra_rem'), NULL),
('ym.precios_gondola', (SELECT id FROM ym.fuentes WHERE codigo='sepa_precios'), NULL),
('inym_gis.raw_features', (SELECT id FROM ym.fuentes WHERE codigo='inym_geoserver'),
 'Capas indec_* vienen de indec_geonode, no de este fuente_id -- tabla mixta, ver docs/inym_geoserver_layers.md y Fase 3e en TODO.md.'),
('inym_gis.secaderos', (SELECT id FROM ym.fuentes WHERE codigo='inym_geoserver'), NULL)
ON CONFLICT (tabla_nombre) DO NOTHING;

COMMIT;
