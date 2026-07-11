-- ============================================================================
-- MIGRACIÓN 003 — Saneamiento post-auditoría de datos (2026-07-11), parte 2
-- Ver docs/auditoria_datos.md. Continúa la migración 002 (dataset_principal
-- / ym.exportaciones) con el resto de la lista priorizada (§7):
--   - mix de envases (consumo_interno): anular 2011-2024, congelado/fabricado
--   - productores (superficie_productores): anular los 8 tramos de
--     interpolación lineal perfecta, conservando los años ancla
--   - superficie_productores 2025: anular (clon de 2024 + solo 8/12 meses)
--   - importaciones 2011-2018: anular (congelado, sin fuente documentada)
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- Mix de envases — congelado idéntico 2011-2021, otro valor fijo 2022-2024,
-- T4=100% siempre exacto. Se anula todo 2011-2024, se conserva 2025 (único
-- valor no repetido, aunque tampoco tiene fuente documentada todavía).
-- ----------------------------------------------------------------------------
UPDATE ym.consumo_interno
SET envase_05kg_pct = NULL, envase_1kg_pct = NULL, envase_2kg_pct = NULL,
    envase_025kg_pct = NULL, otros_envases_pct = NULL, sin_estampillas_pct = NULL
WHERE anio BETWEEN 2011 AND 2024;

-- ----------------------------------------------------------------------------
-- Productores — 8 tramos de interpolación lineal perfecta (T3). Se anulan
-- los años interiores, se conservan los años ancla (extremos de cada tramo).
-- ----------------------------------------------------------------------------
UPDATE ym.superficie_productores SET productores = NULL
WHERE provincia = 'Misiones' AND ciudad = 'Apóstoles' AND anio BETWEEN 2011 AND 2018;

UPDATE ym.superficie_productores SET productores = NULL
WHERE provincia = 'Misiones' AND ciudad = 'Montecarlo' AND anio BETWEEN 2011 AND 2012;

UPDATE ym.superficie_productores SET productores = NULL
WHERE provincia = 'Misiones' AND ciudad = 'Montecarlo' AND anio BETWEEN 2015 AND 2017;

UPDATE ym.superficie_productores SET productores = NULL
WHERE provincia = 'Misiones' AND ciudad = 'Oberá' AND anio BETWEEN 2017 AND 2018;

UPDATE ym.superficie_productores SET productores = NULL
WHERE provincia = 'Misiones' AND ciudad = 'Otros' AND anio BETWEEN 2011 AND 2014;

UPDATE ym.superficie_productores SET productores = NULL
WHERE provincia = 'Misiones' AND ciudad = 'Otros' AND anio BETWEEN 2017 AND 2020;

UPDATE ym.superficie_productores SET productores = NULL
WHERE provincia = 'Misiones' AND ciudad = 'Santo Pipó' AND anio BETWEEN 2012 AND 2016;

UPDATE ym.superficie_productores SET productores = NULL
WHERE provincia = 'Misiones' AND ciudad = 'Santo Pipó' AND anio BETWEEN 2019 AND 2020;

-- ----------------------------------------------------------------------------
-- superficie_productores 2025 — clon exacto de 2024 (T1) y solo 8/12 meses
-- cargados. Se anula superficie_ha y productores completos para 2025.
-- ----------------------------------------------------------------------------
UPDATE ym.superficie_productores
SET superficie_ha = NULL, productores = NULL
WHERE anio = 2025;

-- ----------------------------------------------------------------------------
-- Importaciones 2011-2018 — congelado en el mismo total anual exacto
-- (999.996 kg, 7 años seguidos), sin fuente documentada. La documentación
-- previa ("cambia de año a año") solo es cierta desde 2019, que se conserva.
-- ----------------------------------------------------------------------------
UPDATE ym.importaciones SET volumen_kg = NULL
WHERE anio BETWEEN 2011 AND 2018;

COMMIT;
