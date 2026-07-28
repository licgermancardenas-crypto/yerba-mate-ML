-- ============================================================================
-- MIGRACIÓN 015 — Arreglar regresión de la migración 014 + anular
-- consumo_interno_kg/exportaciones_kg/valor_fob_usd por ciudad (mismo
-- prorrateo fabricado que produccion_kg, ver docs/auditoria_datos.md §7.13)
-- ============================================================================
-- BUG REAL introducido por la migración 014: anuló produccion_kg en las
-- filas por ciudad, pero el frontend (agregarProduccionAnualNacional) SOLO
-- tiene fila explícita '(nacional)' para 2025 -- para 2011-2024 sumaba las
-- 7 filas por ciudad para armar el total nacional. Al anular esas 7 filas,
-- SUM() da NULL para 2011-2024 -- el KPI/tabla/chart de "Producción"
-- quedó roto en producción (sitio en vivo) desde el deploy de la 014.
--
-- Este archivo:
-- 1) Inserta filas '(nacional)' explícitas para 2011-2024 con los totales
--    reales YA VALIDADOS (el comentario de la tabla dice "el total nacional
--    de cada año está validado contra fuente independiente" desde julio):
--    - produccion_kg: 2012-2024 se recupera de ym.inym_hoja_verde_zona
--      zona='TOTAL' (fuente real independiente, ratio ~1,002 contra el
--      valor que sumaban las 7 ciudades antes de anularse en la 014, ver
--      docs/auditoria_datos.md). **2011 queda NULL a propósito** -- no
--      existe esa fuente para 2011 (el PDF anual de ese año dio 0 filas
--      usables en el scraping de Fase 3c, gap real y ya documentado) y el
--      valor original de produccion_kg ya se perdió en la migración 014 --
--      nunca se inventa un número para taparlo.
--    - consumo_interno_kg/exportaciones_kg/valor_fob_usd: se capturan de
--      la SUMA de las 7 filas por ciudad ANTES de anularlas más abajo en
--      este mismo archivo -- es exactamente el total nacional ya validado,
--      no un cálculo nuevo.
-- 2) Anula (NULL) consumo_interno_kg/exportaciones_kg/valor_fob_usd en las
--    filas por ciudad (mismo hallazgo que produccion_kg en la 014: % fijo
--    idéntico los 14 años, prorrateo, no medición real).
-- ============================================================================

BEGIN;

-- Paso 1: capturar y guardar los totales nacionales reales ANTES de anular
-- nada (evita repetir el error de la 014, que anuló primero y perdió el
-- dato sin guardar el total agregado).
CREATE TEMP TABLE totales_nacionales_reales AS
SELECT
    anio,
    SUM(consumo_interno_kg) AS consumo_interno_kg,
    SUM(exportaciones_kg) AS exportaciones_kg,
    SUM(valor_fob_usd) AS valor_fob_usd
FROM ym.dataset_principal_anual
WHERE ciudad != '(nacional)'
GROUP BY anio;

CREATE TEMP TABLE produccion_hoja_verde_real AS
SELECT anio, SUM(hoja_verde_kg) AS produccion_kg
FROM ym.inym_hoja_verde_zona
WHERE zona = 'TOTAL'
GROUP BY anio;

-- Paso 2: insertar/actualizar las filas '(nacional)' 2011-2024 con estos
-- totales reales -- ON CONFLICT porque la fila puede no existir todavía
-- para ningún año salvo 2025.
INSERT INTO ym.dataset_principal_anual
    (anio, provincia, ciudad, produccion_kg, consumo_interno_kg, exportaciones_kg, valor_fob_usd, fuente)
SELECT
    t.anio,
    '(nacional)',
    '(nacional)',
    p.produccion_kg,
    t.consumo_interno_kg,
    t.exportaciones_kg,
    t.valor_fob_usd,
    'dataset_principal_original'
FROM totales_nacionales_reales t
LEFT JOIN produccion_hoja_verde_real p ON p.anio = t.anio
WHERE t.anio BETWEEN 2011 AND 2024
ON CONFLICT (anio, provincia, ciudad) DO UPDATE
SET produccion_kg = EXCLUDED.produccion_kg,
    consumo_interno_kg = EXCLUDED.consumo_interno_kg,
    exportaciones_kg = EXCLUDED.exportaciones_kg,
    valor_fob_usd = EXCLUDED.valor_fob_usd;

-- Paso 3: precio_usd_kg_promedio no lo tocan las migraciones 014/015 (no es
-- el mismo prorrateo -- las 7 ciudades ya tenían el MISMO valor cada una,
-- consistente con ser un precio nacional único, no una variación por
-- ciudad inventada) pero las filas '(nacional)' nuevas del paso 2 no lo
-- traían -- se completa acá con el promedio real de las filas por ciudad
-- (equivalente matemáticamente, todas valen lo mismo).
UPDATE ym.dataset_principal_anual d
SET precio_usd_kg_promedio = sub.promedio
FROM (
    SELECT anio, AVG(precio_usd_kg_promedio) AS promedio
    FROM ym.dataset_principal_anual
    WHERE ciudad != '(nacional)' AND precio_usd_kg_promedio IS NOT NULL
    GROUP BY anio
) sub
WHERE d.ciudad = '(nacional)' AND d.anio = sub.anio AND d.precio_usd_kg_promedio IS NULL;

-- Paso 4: ahora sí, anular el prorrateo fabricado por ciudad (mismo
-- hallazgo que produccion_kg, ver docs/auditoria_datos.md §7.13).
UPDATE ym.dataset_principal_anual
SET consumo_interno_kg = NULL,
    exportaciones_kg = NULL,
    valor_fob_usd = NULL
WHERE ciudad != '(nacional)';

COMMENT ON TABLE ym.dataset_principal_anual IS
    'Totales anuales reales (categoría C de docs/auditoria_datos.md). El total NACIONAL de cada año (fila ciudad=provincia=''(nacional)'', TODOS los años 2011-2025 desde la migración 015) está validado contra fuente independiente -- produccion_kg 2012-2024 viene de ym.inym_hoja_verde_zona zona=''TOTAL'' (2011 sin fuente real disponible, queda NULL a propósito), consumo_interno_kg/exportaciones_kg/valor_fob_usd 2011-2024 recuperados de la suma real ya validada antes de anular el desglose por ciudad. El desglose POR CIUDAD de produccion_kg/consumo_interno_kg/exportaciones_kg/valor_fob_usd está anulado (NULL) desde las migraciones 014/015: era un prorrateo con % FIJO idéntico los 14 años (imposible como medición real), no una medición independiente por ciudad. Ver docs/auditoria_datos.md §7.12/§7.13.';

COMMIT;
