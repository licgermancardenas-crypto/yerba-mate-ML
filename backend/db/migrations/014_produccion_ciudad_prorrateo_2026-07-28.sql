-- ============================================================================
-- MIGRACIÓN 014 — ym.dataset_principal_anual.produccion_kg por ciudad era un
-- prorrateo fijo, no dato real medido por ciudad
-- ============================================================================
-- Hallazgo real 2026-07-28 (investigando un pedido de gráfico de "rendimiento
-- por ciudad"): el % que cada ciudad representa del total nacional de
-- produccion_kg es EXACTAMENTE IDÉNTICO los 14 años reales (2011-2024, sin
-- variar ni 0,01pp) -- Apóstoles siempre 52,20%, Colonia Liebig siempre
-- 6,89%, etc. Esto es matemáticamente imposible si fuera una medición
-- independiente por ciudad -- es el total nacional (real, verificado en la
-- auditoría de julio) repartido con un % fijo heredado del batch de
-- scaffolding original (mismo origen sin fuente documentada que los demás
-- hallazgos de la auditoría de julio, ver docs/auditoria_datos.md). La
-- auditoría de julio validó el TOTAL NACIONAL contra fuentes reales pero no
-- verificó independientemente el desglose POR CIUDAD -- este hallazgo es
-- nuevo, no una repetición de lo ya cerrado.
--
-- Se anula (NULL, nunca se inventa) produccion_kg en las filas por ciudad
-- (ciudad != '(nacional)'). La fila '(nacional)' NO se toca -- ese total sí
-- es real. consumo_interno_kg/exportaciones_kg/valor_fob_usd por ciudad NO
-- se tocan en esta migración -- no se verificaron todavía, quedan
-- pendientes de la misma revisión en el futuro si hace falta.
-- ============================================================================

BEGIN;

UPDATE ym.dataset_principal_anual
SET produccion_kg = NULL
WHERE ciudad != '(nacional)';

-- Esta tabla usa fuente_id POR FILA (no ym.tabla_fuente) desde julio -- el
-- lugar correcto para actualizar la nota de provenance es el COMMENT.
COMMENT ON TABLE ym.dataset_principal_anual IS
    'Totales anuales reales (categoría C de docs/auditoria_datos.md). El total NACIONAL de cada año está validado contra fuente independiente (hoja_verde_zona/salida_molino/comunicados INYM). CONFIRMADO 2026-07-28 (no solo "sin validar" como decía este comentario desde julio): el desglose de produccion_kg por ciudad 2011-2024 era un prorrateo con % FIJO idéntico los 14 años (Apóstoles siempre 52,20%, etc.) -- imposible como medición real, anulado (NULL) en la fila por ciudad, se preserva solo el total nacional. Ver migración 014, docs/auditoria_datos.md.';

COMMIT;
