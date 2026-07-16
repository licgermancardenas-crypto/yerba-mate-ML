-- ============================================================================
-- MIGRACIÓN 008 — superficie_productores.superficie_ha, 2021-2024 anulado
-- (2026-07-16). Ver docs/auditoria_datos.md §7.11 para el detalle completo.
--
-- El total nacional 2020-2024 (177.533 ha, congelado en las 7 ciudades) se
-- había dado por validado en julio contra "un benchmark externo". Al
-- conseguir la serie histórica real del INYM ("Superficie Cultivada por
-- Departamento", 2016-2025) se confirmó que 177.533 ha coincide casi exacto
-- con el total real de **2020 solamente** (174.820,1 ha) -- el real sigue
-- creciendo cada año después (2021: 191.391,7 · 2022: 209.276,9 · 2023:
-- 222.168,6 · 2025: 231.352,4). Congelar ese valor 2021-2024 fue fabricación,
-- no dato real. Se conserva 2020 como último año real (ya estaba ahí) y se
-- anula 2021-2024 en las 7 ciudades -- mismo tratamiento que el resto de los
-- congelamientos de esta tabla (migración 003).
--
-- La columna `ciudad` en sí (Apóstoles, Colonia Liebig, Gobernador Virasoro,
-- Montecarlo, Oberá, Otros, Santo Pipó) no corresponde a ningún `departamento`
-- real del INYM (comparado 1 a 1 contra los 8 informes reales: factores de
-- 0,44x a 5,2x, sin patrón consistente) -- queda documentada como no
-- verificable por partida, no se toca en esta migración (no hay con qué
-- reemplazarla sin perder el histórico 2010-2019).
-- ============================================================================

BEGIN;

UPDATE ym.superficie_productores SET superficie_ha = NULL
WHERE anio BETWEEN 2021 AND 2024;

COMMIT;
