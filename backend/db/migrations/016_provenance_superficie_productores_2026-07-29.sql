-- ============================================================================
-- MIGRACIÓN 016 — Provenance real para ym.superficie_productores (2026-07-29)
-- Ver docs/auditoria_datos.md §7.11 (investigación cerrada 2026-07-16) y su
-- addendum de hoy.
--
-- Contexto: §7.11 encontró la fuente primaria real del INYM ("Superficie
-- Cultivada por Departamento", PDF anual) que confirma el total nacional
-- 177.533 ha ya cargado corresponde a 2020 (no está "congelado", el real
-- sigue creciendo después) -- pero ese PDF lleva una cláusula de
-- confidencialidad explícita, así que no se pudo citar como fuente pública.
--
-- Hallazgo nuevo de hoy: el mismo dato (declaraciones juradas ante el INYM)
-- está publicado SIN restricción de confidencialidad en 2 fuentes de prensa
-- que citan al INYM directamente:
--   - inym.org.ar/noticias/produccion-sustentable/79571-pequenos-productores-de-yerba-mate.html
--     (2021-05-11): productores 2010=7.360, 2021=9.334; superficie 2020=177.534,92 ha
--     (Corrientes 23.085,76 + Misiones 154.449,1) -- coincide EXACTO con la
--     suma de las 7 "ciudades" ya cargadas para esos 3 puntos.
--   - economis.com.ar/la-superficie-plantada-de-yerba-mate-crecio-18-en-dos-anos/
--     (2026-07-29): superficie 2022=209.277 ha (+18% vs. 2020), Misiones
--     181.890 ha, Corrientes 27.387 ha -- consistente con §7.11.
--
-- Esto NO resuelve los 2 problemas de fondo que cerró §7.11 (siguen igual,
-- no se tocan datos):
--   1) La columna `ciudad` no corresponde a ningún departamento real del
--      INYM -- no hay con qué reemplazar el desglose por ciudad.
--   2) No existe un informe histórico de `productores` por departamento/
--      ciudad, solo totales nacionales sueltos en prensa -- los 8 tramos
--      interpolados (migración 003) siguen sin fuente real, se mantienen NULL.
-- Solo mejora la documentación: reemplaza el fuente_id genérico
-- 'csv_semilla_validado' por una fuente real y citable para los ANCLAJES
-- nacionales ya cargados (2010, 2020, 2021).
-- ============================================================================

BEGIN;

INSERT INTO ym.fuentes (codigo, nombre, organismo, url, cobertura, metodo_obtencion, notas) VALUES
('inym_prensa_superficie_productores',
 'Superficie cultivada y cantidad de productores (relevamiento SIG del INYM, vía declaraciones juradas)',
 'INYM (vía inym.org.ar y prensa especializada)',
 'inym.org.ar/noticias/produccion-sustentable/79571-pequenos-productores-de-yerba-mate.html ; economis.com.ar/la-superficie-plantada-de-yerba-mate-crecio-18-en-dos-anos/',
 'Puntos sueltos: productores 2010/2021 (nacional), superficie 2020/2022 (nacional + Misiones/Corrientes)',
 'Cifras publicadas por el INYM o citadas de sus declaraciones juradas -- NO es el PDF interno "Superficie Cultivada por Departamento" (ese tiene cláusula de confidencialidad, ver docs/auditoria_datos.md §7.11, no se usa como fuente pública)',
 'Confirma que los anclajes nacionales ya cargados en ym.superficie_productores (suma de las 7 "ciudades": 2010=7.360 productores/191.000 ha, 2020=177.533 ha, 2021=9.334 productores) coinciden exacto con el dato real del INYM. NO resuelve el desglose por "ciudad" (no mapea a departamentos reales) ni los tramos interpolados de productores (siguen sin fuente, ver migración 003).')
ON CONFLICT (codigo) DO NOTHING;

UPDATE ym.tabla_fuente
SET fuente_id = (SELECT id FROM ym.fuentes WHERE codigo = 'inym_prensa_superficie_productores'),
    notas = 'Anclajes nacionales (suma de las 7 "ciudades") confirmados contra fuente real citable: 2010 y 2021 (productores), 2020 (superficie_ha) -- ver ym.fuentes. Tramos interpolados de productores (8, migración 003) y superficie_ha 2021-2024 (migración 008) siguen NULL, sin fuente real por partida -- ver docs/auditoria_datos.md §7.11 para el detalle completo (incluye por qué la columna "ciudad" no es reemplazable por departamento real del INYM).'
WHERE tabla_nombre = 'ym.superficie_productores';

COMMIT;
