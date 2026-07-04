-- ============================================================================
-- ESQUEMA POSTGIS — PLATAFORMA DE INTELIGENCIA YERBATERA
-- Capas geoespaciales del INYM (gis.inym.org.ar/geoserver_disabled/wfs)
-- ============================================================================
-- Diseño: cada capa WFS se carga "tal cual" en una tabla cruda (raw) con
-- geometría + JSONB para los atributos (porque todavía no confirmamos el
-- esquema exacto de columnas de varias capas de polígonos — el geometry
-- es tan grande que corta la respuesta en herramientas de inspección).
-- Sobre esas tablas raw se construyen vistas/tablas normalizadas una vez
-- que confirmemos los nombres de columna reales en el primer corrido del ETL.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS postgis;

CREATE SCHEMA IF NOT EXISTS inym_gis;

-- ----------------------------------------------------------------------------
-- 1) Tabla RAW genérica: una fila por feature, por capa, por snapshot
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS inym_gis.raw_features (
    id                  BIGSERIAL PRIMARY KEY,
    layer_name          TEXT NOT NULL,              -- ej. 'view_superficie_por_departamentos'
    feature_gid         TEXT,                       -- id del feature según GeoServer (ej. 'view_superficie_por_departamentos.1')
    snapshot_date       DATE NOT NULL DEFAULT CURRENT_DATE,
    geom                geometry,                    -- se carga en SRID nativo (3857) y se reproyecta en vistas
    properties          JSONB NOT NULL DEFAULT '{}', -- todas las propiedades originales, sin asumir esquema
    inserted_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (layer_name, feature_gid, snapshot_date)
);

CREATE INDEX IF NOT EXISTS idx_raw_features_geom ON inym_gis.raw_features USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_raw_features_layer ON inym_gis.raw_features (layer_name, snapshot_date);
CREATE INDEX IF NOT EXISTS idx_raw_features_props ON inym_gis.raw_features USING GIN (properties);

-- ----------------------------------------------------------------------------
-- 2) Vista con geometría reproyectada a WGS84 (4326) — la que consume el front
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW inym_gis.v_features_4326 AS
SELECT
    id,
    layer_name,
    feature_gid,
    snapshot_date,
    ST_Transform(geom, 4326) AS geom_4326,
    properties,
    inserted_at
FROM inym_gis.raw_features;

-- ----------------------------------------------------------------------------
-- 3) Catálogo de capas — metadata de cada una de las 20 (18 funcionales) capas
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS inym_gis.catalogo_capas (
    layer_name      TEXT PRIMARY KEY,
    categoria       TEXT NOT NULL,   -- 'limites' | 'edad' | 'densidad' | 'consociado' | 'secaderos'
    nivel_espacial  TEXT NOT NULL,   -- 'municipio' | 'departamento' | 'provincia' | 'zona' | 'punto'
    geom_type       TEXT NOT NULL,   -- 'MultiPolygon' | 'Point'
    activa          BOOLEAN NOT NULL DEFAULT TRUE,
    descripcion     TEXT
);

INSERT INTO inym_gis.catalogo_capas (layer_name, categoria, nivel_espacial, geom_type, descripcion) VALUES
 ('view_superficie_por_municipios',            'limites',     'municipio',     'MultiPolygon', 'Superficie total cultivada por municipio'),
 ('view_superficie_por_departamentos',         'limites',     'departamento',  'MultiPolygon', 'Superficie total cultivada por departamento'),
 ('view_superficie_por_provincias',            'limites',     'provincia',     'MultiPolygon', 'Superficie total cultivada por provincia'),
 ('view_superficie_por_zonas',                 'limites',     'zona',          'MultiPolygon', 'Superficie total cultivada por zona productora'),
 ('view_superficie_edad_por_municipios',       'edad',        'municipio',     'MultiPolygon', 'Superficie por rango de edad de plantación, por municipio'),
 ('view_superficie_edad_por_departamentos',    'edad',        'departamento',  'MultiPolygon', 'Idem, por departamento'),
 ('view_superficie_edad_por_provincias',       'edad',        'provincia',     'MultiPolygon', 'Idem, por provincia'),
 ('view_superficie_edad_por_zonas',            'edad',        'zona',          'MultiPolygon', 'Idem, por zona'),
 ('view_superficie_densidad_por_municipios',   'densidad',    'municipio',     'MultiPolygon', 'Superficie por densidad de plantación, por municipio'),
 ('view_superficie_densidad_por_departamentos','densidad',    'departamento',  'MultiPolygon', 'Idem, por departamento'),
 ('view_superficie_densidad_por_provincias',   'densidad',    'provincia',     'MultiPolygon', 'Idem, por provincia'),
 ('view_superficie_densidad_por_zonas',        'densidad',    'zona',          'MultiPolygon', 'Idem, por zona'),
 ('view_superficie_consociado_por_municipios', 'consociado',  'municipio',     'MultiPolygon', 'Superficie de cultivo asociado/intercalado, por municipio'),
 ('view_superficie_consociado_por_departamentos','consociado','departamento',  'MultiPolygon', 'Idem, por departamento'),
 ('view_superficie_consociado_por_provincias', 'consociado',  'provincia',     'MultiPolygon', 'Idem, por provincia'),
 ('view_superficie_consociado_por_zonas',      'consociado',  'zona',          'MultiPolygon', 'Idem, por zona'),
 ('view_mat_gis_marketing_puntos_secaderos',   'secaderos',   'punto',         'Point',        'Ubicación puntual de cada secadero/planta (idplanta, dir_catastral, lat/lon)'),
 ('view_gis_marketing_secaderos_por_municipios','secaderos',  'municipio',     'MultiPolygon', 'Cantidad/agregado de secaderos por municipio'),
 ('view_gis_marketing_secaderos_por_departamentos','secaderos','departamento', 'MultiPolygon', 'Idem, por departamento'),
 ('view_gis_marketing_secaderos_por_provincias','secaderos',  'provincia',     'MultiPolygon', 'Idem, por provincia'),
 ('view_gis_marketing_secaderos_por_zonas',    'secaderos',   'zona',          'MultiPolygon', 'Idem, por zona')
ON CONFLICT (layer_name) DO NOTHING;

-- ----------------------------------------------------------------------------
-- 4) Tabla especializada para secaderos (puntos) — esquema YA confirmado
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS inym_gis.secaderos (
    id              INTEGER PRIMARY KEY,        -- 'id' del feature original
    idplanta        INTEGER NOT NULL,
    dir_catastral   TEXT,
    latitud         DOUBLE PRECISION NOT NULL,
    longitud        DOUBLE PRECISION NOT NULL,
    geom            geometry(Point, 4326) GENERATED ALWAYS AS (
                        ST_SetSRID(ST_MakePoint(longitud, latitud), 4326)
                    ) STORED,
    snapshot_date   DATE NOT NULL DEFAULT CURRENT_DATE,
    municipio_id    INTEGER,        -- a completar con spatial join contra dim_municipios
    departamento_id INTEGER,
    provincia_id    INTEGER
);

CREATE INDEX IF NOT EXISTS idx_secaderos_geom ON inym_gis.secaderos USING GIST (geom);

-- ----------------------------------------------------------------------------
-- 5) Tablas dimensión de límites administrativos (se completan en el primer ETL)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS inym_gis.dim_municipios (
    id          SERIAL PRIMARY KEY,
    nombre      TEXT,
    geom        geometry(MultiPolygon, 4326),
    properties  JSONB
);
CREATE TABLE IF NOT EXISTS inym_gis.dim_departamentos (
    id          SERIAL PRIMARY KEY,
    nombre      TEXT,
    geom        geometry(MultiPolygon, 4326),
    properties  JSONB
);
CREATE TABLE IF NOT EXISTS inym_gis.dim_provincias (
    id          SERIAL PRIMARY KEY,
    nombre      TEXT,
    geom        geometry(MultiPolygon, 4326),
    properties  JSONB
);
CREATE TABLE IF NOT EXISTS inym_gis.dim_zonas (
    id          SERIAL PRIMARY KEY,
    nombre      TEXT,
    geom        geometry(MultiPolygon, 4326),
    properties  JSONB
);

CREATE INDEX IF NOT EXISTS idx_dim_municipios_geom ON inym_gis.dim_municipios USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_dim_departamentos_geom ON inym_gis.dim_departamentos USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_dim_provincias_geom ON inym_gis.dim_provincias USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_dim_zonas_geom ON inym_gis.dim_zonas USING GIST (geom);


-- ============================================================================
-- ESQUEMA YM — SERIES TEMPORALES YERBATERAS (7 CSVs históricos INYM)
-- ============================================================================
-- Nota de calidad de datos: varios CSV fuente repiten el mismo valor en los
-- 12 meses de un año (consumo per cápita, precios, importaciones). Se
-- confirmó que SÍ varían de año a año (ej. precio USD/kg: 1,80 en 2011 →
-- 2,50 en 2023; importaciones: 83.333 kg/mes solo en 2011, después cambia).
-- Conclusión: son datos anuales publicados con cadencia mensual (mismo
-- valor los 12 meses de cada año), no placeholders. Ver TODO.md.
-- ============================================================================

CREATE SCHEMA IF NOT EXISTS ym;

-- ----------------------------------------------------------------------------
-- 1) dataset_principal — producción/consumo/exportaciones/precio por
--    provincia y ciudad productora, mensual (2011–presente)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ym.dataset_principal (
    anio                SMALLINT NOT NULL,
    mes                 SMALLINT NOT NULL CHECK (mes BETWEEN 1 AND 12),
    mes_nombre          TEXT NOT NULL,
    provincia           TEXT NOT NULL,
    ciudad              TEXT NOT NULL,
    produccion_kg       NUMERIC(14,2) NOT NULL,
    consumo_interno_kg  NUMERIC(14,2) NOT NULL,
    exportaciones_kg    NUMERIC(14,2) NOT NULL,
    precio_usd_kg       NUMERIC(8,2) NOT NULL,
    valor_fob_usd       NUMERIC(14,2) NOT NULL,
    PRIMARY KEY (anio, mes, provincia, ciudad)
);
CREATE INDEX IF NOT EXISTS idx_dataset_principal_anio ON ym.dataset_principal (anio);

-- ----------------------------------------------------------------------------
-- 2) consumo_interno — consumo per cápita nacional y mix de envases, mensual
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ym.consumo_interno (
    anio                        SMALLINT NOT NULL,
    mes                         SMALLINT NOT NULL CHECK (mes BETWEEN 1 AND 12),
    mes_nombre                  TEXT NOT NULL,
    consumo_per_capita_kg       NUMERIC(6,2) NOT NULL,
    envase_05kg_pct             NUMERIC(5,2) NOT NULL,
    envase_1kg_pct              NUMERIC(5,2) NOT NULL,
    envase_2kg_pct              NUMERIC(5,2) NOT NULL,
    envase_025kg_pct            NUMERIC(5,2) NOT NULL,
    otros_envases_pct           NUMERIC(5,2) NOT NULL,
    sin_estampillas_pct         NUMERIC(5,2) NOT NULL,
    PRIMARY KEY (anio, mes)
);
CREATE INDEX IF NOT EXISTS idx_consumo_interno_anio ON ym.consumo_interno (anio);

-- ----------------------------------------------------------------------------
-- 3) exportaciones — volumen y valor FOB por país destino, mensual
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ym.exportaciones (
    anio                SMALLINT NOT NULL,
    mes                 SMALLINT NOT NULL CHECK (mes BETWEEN 1 AND 12),
    mes_nombre          TEXT NOT NULL,
    destino             TEXT NOT NULL,     -- incluye 'Others' como categoría agregada
    volumen_kg          NUMERIC(14,2) NOT NULL,
    valor_fob_usd       NUMERIC(14,2) NOT NULL,
    precio_fob_usd_kg   NUMERIC(8,2) NOT NULL,
    PRIMARY KEY (anio, mes, destino)
);
CREATE INDEX IF NOT EXISTS idx_exportaciones_anio ON ym.exportaciones (anio);
CREATE INDEX IF NOT EXISTS idx_exportaciones_destino ON ym.exportaciones (destino);

-- ----------------------------------------------------------------------------
-- 4) importaciones — volumen mensual, sin desagregar por origen
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ym.importaciones (
    anio                SMALLINT NOT NULL,
    mes                 SMALLINT NOT NULL CHECK (mes BETWEEN 1 AND 12),
    mes_nombre          TEXT NOT NULL,
    volumen_kg          NUMERIC(14,2) NOT NULL,
    PRIMARY KEY (anio, mes)
);
CREATE INDEX IF NOT EXISTS idx_importaciones_anio ON ym.importaciones (anio);

-- ----------------------------------------------------------------------------
-- 5) precios — precio de hoja verde y canchada (ARS/kg), mensual (2017–)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ym.precios (
    anio                    SMALLINT NOT NULL,
    mes                     SMALLINT NOT NULL CHECK (mes BETWEEN 1 AND 12),
    mes_nombre              TEXT NOT NULL,
    precio_hoja_verde_ars   NUMERIC(10,2),      -- NULL: mes sin precio publicado por el INYM (ej. 2020-10)
    precio_canchada_ars     NUMERIC(10,2),
    PRIMARY KEY (anio, mes)
);
CREATE INDEX IF NOT EXISTS idx_precios_anio ON ym.precios (anio);

-- ----------------------------------------------------------------------------
-- 6) competencia — cuota de mercado y volumen anual por empresa
-- ----------------------------------------------------------------------------
-- AUDITORÍA 2026-07-04 (Fase 8): el CSV original 2011-2024 era relleno
-- sintético (2011-2021 plano + 2022-2024 interpolación lineal) sin fuente
-- real — ver docs/fuentes_competencia.md. NULL = sin dato real publicado
-- para ese año/empresa, NUNCA 0 ni un valor inventado. "Others" es la
-- categoría agregada que ya publica la fuente para el resto del ranking
-- (cobertura_ranking documenta cuántas empresas entran en el desglose).
CREATE TABLE IF NOT EXISTS ym.competencia (
    anio                SMALLINT NOT NULL,
    empresa             TEXT NOT NULL,      -- nombre TAL COMO lo publica la fuente, sin reasignar
    cuota_mercado_pct   NUMERIC(5,2),       -- NULL: sin fuente real para este año/empresa
    volumen_kg          NUMERIC(14,2),      -- NULL: idem
    cobertura_ranking   TEXT,               -- 'top10' | 'top20' | 'top65', cuántas empresas cubre el ranking fuente de este año
    fuente_url          TEXT,
    fuente_medio        TEXT,
    fuente_fecha        DATE,               -- fecha de publicación de la fuente (no del año que reporta)
    PRIMARY KEY (anio, empresa)
);
CREATE INDEX IF NOT EXISTS idx_competencia_anio ON ym.competencia (anio);

-- ----------------------------------------------------------------------------
-- 6b) Modelo relacional empresa/marca (Fase 8 auditoría 2026-07-04)
-- ----------------------------------------------------------------------------
-- Separa la entidad comercial (empresa) de las marcas que vende, porque una
-- marca puede cambiar de titular/elaborador sin salir de góndola (caso
-- Molinos Río de la Plata / Yerbatera Misiones SRL — ver
-- docs/fuentes_competencia.md; el año de transición NO está confirmado
-- todavía, marca_empresa no debe cargarse con vigencias inventadas).
-- ym.competencia.empresa arriba sigue siendo el nombre fiel a la fuente,
-- sin reasignar — esta capa es un enriquecimiento de identidad aparte.
CREATE TABLE IF NOT EXISTS ym.empresas (
    id              SERIAL PRIMARY KEY,
    razon_social    TEXT NOT NULL UNIQUE,
    tipo            TEXT,       -- 'cooperativa' | 'SA' | 'SRL' | ...
    provincia       TEXT
);

CREATE TABLE IF NOT EXISTS ym.marcas (
    id              SERIAL PRIMARY KEY,
    nombre          TEXT NOT NULL UNIQUE
);

-- rol: 'propietario' (dueño de la marca) | 'elaborador' (fabrica a fazón/maquila,
-- no necesariamente el dueño) — permite modelar el caso planta alquilada sin
-- asumir que el elaborador reemplaza al propietario en el ranking.
CREATE TABLE IF NOT EXISTS ym.marca_empresa (
    id              SERIAL PRIMARY KEY,
    marca_id        INTEGER NOT NULL REFERENCES ym.marcas(id),
    empresa_id      INTEGER NOT NULL REFERENCES ym.empresas(id),
    rol             TEXT NOT NULL CHECK (rol IN ('propietario', 'elaborador')),
    vigente_desde   DATE,
    vigente_hasta   DATE,       -- NULL = vigente a la fecha de la última fuente cargada
    notas           TEXT,
    UNIQUE (marca_id, empresa_id, rol, vigente_desde)
);

-- Observaciones crudas por empresa, tal como las publica cada fuente — puede
-- haber más de una por empresa/año (ej. un corte mensual y otro anual). No
-- son la tabla que lee la API: ym.competencia arriba se cura a partir de
-- estas (misma lógica raw-vs-normalizado que inym_gis.raw_features).
CREATE TABLE IF NOT EXISTS ym.despachos_empresa (
    id              SERIAL PRIMARY KEY,
    empresa_id      INTEGER NOT NULL REFERENCES ym.empresas(id),
    anio            SMALLINT NOT NULL,
    kg              NUMERIC(14,2),
    share_pct       NUMERIC(5,2),
    ranking_pos     SMALLINT,
    cobertura_ranking TEXT,
    fuente_url      TEXT NOT NULL,
    fuente_medio    TEXT,
    fuente_fecha    DATE,
    UNIQUE (empresa_id, anio, fuente_url)
);
CREATE INDEX IF NOT EXISTS idx_despachos_empresa_anio ON ym.despachos_empresa (anio);

-- ----------------------------------------------------------------------------
-- 7) superficie_productores — cantidad de productores y hectáreas cultivadas,
--    por provincia y ciudad, mensual (2010–presente)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ym.superficie_productores (
    anio                SMALLINT NOT NULL,
    mes                 SMALLINT NOT NULL CHECK (mes BETWEEN 1 AND 12),
    mes_nombre          TEXT NOT NULL,
    provincia           TEXT NOT NULL,
    ciudad              TEXT NOT NULL,
    productores         INTEGER NOT NULL,
    superficie_ha       NUMERIC(12,2) NOT NULL,
    PRIMARY KEY (anio, mes, provincia, ciudad)
);
CREATE INDEX IF NOT EXISTS idx_superficie_productores_anio ON ym.superficie_productores (anio);

-- ----------------------------------------------------------------------------
-- 8) clima_mensual — precipitación y temperatura por ciudad productora
--    (fuente: NASA POWER, community=AG, mensual)
-- ----------------------------------------------------------------------------
-- OJO unidades: precipitacion_mm_dia es el promedio DIARIO de precipitación
-- del mes (parámetro PRECTOTCORR de NASA POWER viene en mm/day, no mm/mes).
-- Para un total mensual aproximado: precipitacion_mm_dia * días del mes.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ym.clima_mensual (
    ubicacion               TEXT NOT NULL,      -- misma granularidad que dataset_principal.ciudad
    provincia               TEXT NOT NULL,
    latitud                 DOUBLE PRECISION NOT NULL,
    longitud                DOUBLE PRECISION NOT NULL,
    anio                    SMALLINT NOT NULL,
    mes                     SMALLINT NOT NULL CHECK (mes BETWEEN 1 AND 12),
    precipitacion_mm_dia    NUMERIC(6,2),       -- NULL si NASA POWER reporta fill_value (-999.0)
    temperatura_media_c     NUMERIC(5,2),
    PRIMARY KEY (ubicacion, anio, mes)
);
CREATE INDEX IF NOT EXISTS idx_clima_mensual_anio ON ym.clima_mensual (anio);

-- Variables rezagadas (lag 6/12/18/24 meses): la cosecha que se consume/exporta
-- hoy se cosechó 6-24 meses atrás, por eso el clima relevante para producción
-- no es el del mes corriente. Se calculan en una vista (no se materializan)
-- para no duplicar datos ni tener que re-cargar si cambia el horizonte de lag.
CREATE OR REPLACE VIEW ym.v_clima_con_lags AS
SELECT
    ubicacion,
    provincia,
    anio,
    mes,
    precipitacion_mm_dia,
    temperatura_media_c,
    LAG(precipitacion_mm_dia, 6)  OVER w AS precip_lag_6m,
    LAG(precipitacion_mm_dia, 12) OVER w AS precip_lag_12m,
    LAG(precipitacion_mm_dia, 18) OVER w AS precip_lag_18m,
    LAG(precipitacion_mm_dia, 24) OVER w AS precip_lag_24m,
    LAG(temperatura_media_c, 6)   OVER w AS temp_lag_6m,
    LAG(temperatura_media_c, 12)  OVER w AS temp_lag_12m,
    LAG(temperatura_media_c, 18)  OVER w AS temp_lag_18m,
    LAG(temperatura_media_c, 24)  OVER w AS temp_lag_24m
FROM ym.clima_mensual
WINDOW w AS (PARTITION BY ubicacion ORDER BY anio, mes);

-- ----------------------------------------------------------------------------
-- 9) indec_series — series macro de INDEC (IPC, EMAE, etc.), formato genérico
-- ----------------------------------------------------------------------------
-- Tabla genérica (serie_id + serie_nombre + valor) en vez de una columna por
-- indicador: cada serie de la API de series de tiempo tiene su propia base,
-- unidad y cobertura temporal, y se espera sumar más series con el tiempo
-- (ver docs/indec_series.md) sin tener que migrar el schema cada vez.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ym.indec_series (
    serie_id        TEXT NOT NULL,      -- id oficial en apis.datos.gob.ar (ej. '148.3_INIVELNAL_DICI_M_26')
    serie_nombre    TEXT NOT NULL,      -- nombre corto interno (ej. 'ipc_nacional_nivel_general')
    anio            SMALLINT NOT NULL,
    mes             SMALLINT NOT NULL CHECK (mes BETWEEN 1 AND 12),
    valor           NUMERIC(14,4) NOT NULL,
    unidad          TEXT,               -- 'índice', 'variación %', etc.
    PRIMARY KEY (serie_id, anio, mes)
);
CREATE INDEX IF NOT EXISTS idx_indec_series_nombre ON ym.indec_series (serie_nombre, anio, mes);

-- ----------------------------------------------------------------------------
-- 10) bcra_rem — Relevamiento de Expectativas de Mercado (BCRA), por informe
-- ----------------------------------------------------------------------------
-- Fuente: API JSON de ArgentinaDatos (mirror del REM del BCRA), NO el Excel
-- crudo del BCRA. Estructura calcada de la fuente porque cada fila ya es una
-- observación bien definida (indicador x horizonte x informe), no hace falta
-- normalizar más. Ver docs/bcra_rem.md — la ventana de datos disponible en
-- esta API es corta (solo ~14 meses a la fecha), no el histórico completo.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ym.bcra_rem (
    informe             TEXT NOT NULL,      -- período del informe publicado, 'YYYY-MM'
    fecha               DATE NOT NULL,
    muestra             TEXT NOT NULL,      -- ej. 'todos'
    indicador           TEXT NOT NULL,      -- ej. 'Precios minoristas (IPC nivel general-Nacional; INDEC)'
    periodo             TEXT NOT NULL,      -- etiqueta del horizonte pronosticado, ej. 'Trim. I-26', '2026'
    periodo_tipo        TEXT NOT NULL,      -- 'mensual' | 'trimestral' | 'anual'
    periodo_desde       DATE,
    periodo_hasta       DATE,
    referencia          TEXT,
    referencia_fecha    DATE,
    unidad              TEXT,
    mediana             NUMERIC(14,4),
    promedio            NUMERIC(14,4),
    desvio              NUMERIC(14,4),
    maximo              NUMERIC(14,4),
    minimo              NUMERIC(14,4),
    percentil90         NUMERIC(14,4),
    percentil75         NUMERIC(14,4),
    percentil25         NUMERIC(14,4),
    percentil10         NUMERIC(14,4),
    participantes       INTEGER,
    publicacion_url     TEXT,
    xlsx_url            TEXT,               -- Excel original del BCRA, por si hace falta ir a la fuente primaria
    PRIMARY KEY (informe, indicador, muestra, periodo, periodo_tipo)
);
CREATE INDEX IF NOT EXISTS idx_bcra_rem_indicador ON ym.bcra_rem (indicador, periodo_desde);

-- ----------------------------------------------------------------------------
-- 11) inym_hoja_verde_zona — ingreso de hoja verde a secadero, por zona (INYM PDF)
-- ----------------------------------------------------------------------------
-- Fuente: PDFs mensuales/anuales de inym.org.ar (Cuadro "Ingreso de Hoja
-- Verde por Zona"), extraídos con tablas estructuradas (PyMuPDF find_tables),
-- NO regex sobre texto plano. Ver docs/inym_scraper.md.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ym.inym_hoja_verde_zona (
    anio            SMALLINT NOT NULL,
    mes             SMALLINT NOT NULL CHECK (mes BETWEEN 1 AND 12),
    zona            TEXT NOT NULL,      -- 'ZONA CENTRO' | 'ZONA NOROESTE' | 'ZONA NORESTE' | 'ZONA OESTE' | 'ZONA SUR' | 'CORRIENTES' | 'TOTAL'
    hoja_verde_kg   NUMERIC(16,2) NOT NULL,
    PRIMARY KEY (anio, mes, zona)
);
CREATE INDEX IF NOT EXISTS idx_inym_hoja_verde_anio ON ym.inym_hoja_verde_zona (anio, mes);

-- ----------------------------------------------------------------------------
-- 12) inym_salida_molino — salida de yerba mate elaborada a molino, por destino
-- ----------------------------------------------------------------------------
-- OJO: distinto de ym.dataset_principal (consumo_interno_kg/exportaciones_kg
-- del CSV histórico) — son mediciones en puntos distintos de la cadena
-- (declaraciones juradas a salida de molino vs producción/consumo estimados).
-- Confirmado con datos reales que NO coinciden (enero 2025: 22,04M kg salida
-- de molino interno vs 20,13M kg consumo_interno del CSV) — no son duplicados.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ym.inym_salida_molino (
    anio            SMALLINT NOT NULL,
    mes             SMALLINT NOT NULL CHECK (mes BETWEEN 1 AND 12),
    destino         TEXT NOT NULL CHECK (destino IN ('interno', 'externo')),
    volumen_kg      NUMERIC(16,2) NOT NULL,
    PRIMARY KEY (anio, mes, destino)
);
CREATE INDEX IF NOT EXISTS idx_inym_salida_molino_anio ON ym.inym_salida_molino (anio, mes);

-- ----------------------------------------------------------------------------
-- 13) precios_gondola — precio de góndola por marca, agregado desde SEPA
-- ----------------------------------------------------------------------------
-- Fuente: dump diario público de SEPA (datos.produccion.gob.ar/dataset/sepa-precios,
-- Res. 678/2020). El portal solo mantiene 7 archivos rotativos (uno por día de
-- semana, se pisan cada semana) — NO hay backfill histórico posible, cada carga
-- es una FOTO del momento (fecha_snapshot). Para tener serie temporal hay que
-- correr el ETL de nuevo en sesiones futuras y acumular snapshots.
-- El dump viene por sucursal (mismo producto repetido por cada sucursal de la
-- cadena) y sin columna de categoría — se filtra por texto "yerba" en la
-- descripción libre y se agrega por marca/presentación antes de cargar, para
-- no meter cientos de miles de filas crudas a la base.
-- `empresa_ym` mapea la marca de góndola (nombre comercial) a la empresa de
-- `ym.competencia` SOLO cuando la atribución está citada en
-- docs/fuentes_competencia.md — si no hay fuente, queda NULL (no se inventa).
CREATE TABLE IF NOT EXISTS ym.precios_gondola (
    fecha_snapshot          DATE NOT NULL,
    marca_gondola           TEXT NOT NULL,      -- marca tal como aparece en la descripción SEPA (ej. 'ROSAMONTE')
    empresa_ym              TEXT,               -- referencia informal a ym.competencia.empresa, NULL si no está confirmada
    presentacion_kg         NUMERIC(6,3) NOT NULL,
    precio_ars_kg_promedio  NUMERIC(10,2) NOT NULL,
    precio_ars_kg_min       NUMERIC(10,2) NOT NULL,
    precio_ars_kg_max       NUMERIC(10,2) NOT NULL,
    n_observaciones         INTEGER NOT NULL,   -- cantidad de filas sucursal-producto agregadas
    n_comercios             INTEGER NOT NULL,   -- cantidad de cadenas distintas con ese producto
    PRIMARY KEY (fecha_snapshot, marca_gondola, presentacion_kg)
);
CREATE INDEX IF NOT EXISTS idx_precios_gondola_fecha ON ym.precios_gondola (fecha_snapshot);
