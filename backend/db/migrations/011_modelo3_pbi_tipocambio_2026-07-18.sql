-- ============================================================================
-- MIGRACIÓN 011 — ym.pbi_pais_anual + ym.tipo_cambio_anual (2026-07-18)
-- Ver backend/db/schema.sql tablas 18-19. Modelo 3 de Fase 5 (gravitacional
-- de exportaciones).
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS ym.pbi_pais_anual (
    pais_iso2   TEXT NOT NULL,
    anio        SMALLINT NOT NULL,
    pbi_usd     NUMERIC(20,2),
    PRIMARY KEY (pais_iso2, anio)
);

CREATE TABLE IF NOT EXISTS ym.tipo_cambio_anual (
    anio            SMALLINT NOT NULL PRIMARY KEY,
    ars_usd_oficial NUMERIC(12,4) NOT NULL,
    dias_con_dato   INTEGER NOT NULL
);

INSERT INTO ym.fuentes (codigo, nombre, organismo, url, cobertura, metodo_obtencion, notas) VALUES
('world_bank_gdp', 'PBI corriente por país (NY.GDP.MKTP.CD)', 'Banco Mundial',
 'api.worldbank.org/v2/country/{iso2}/indicator/NY.GDP.MKTP.CD', 'Anual, variable por país',
 'API pública del Banco Mundial, sin auth', 'Algunos países/años sin dato (ej. Siria 2023-2025, guerra civil) -- NULL, no se imputa'),
('argentinadatos_dolar', 'Cotización dólar oficial ARS/USD, diaria', 'ArgentinaDatos (agregador)',
 'api.argentinadatos.com/v1/cotizaciones/dolares', '2011-presente, diaria',
 'API pública, sin auth -- agregado a promedio anual para el Modelo 3 (Fase 5)', NULL)
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO ym.tabla_fuente (tabla_nombre, fuente_id, notas)
SELECT 'ym.pbi_pais_anual', id, 'Modelo 3, Fase 5 -- solo los ~20 países destino con volumen real y consistente'
FROM ym.fuentes WHERE codigo = 'world_bank_gdp'
ON CONFLICT (tabla_nombre) DO NOTHING;

INSERT INTO ym.tabla_fuente (tabla_nombre, fuente_id, notas)
SELECT 'ym.tipo_cambio_anual', id, 'Modelo 3, Fase 5 -- dólar oficial, promedio de cotizaciones diarias'
FROM ym.fuentes WHERE codigo = 'argentinadatos_dolar'
ON CONFLICT (tabla_nombre) DO NOTHING;

COMMIT;
