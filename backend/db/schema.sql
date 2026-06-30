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
