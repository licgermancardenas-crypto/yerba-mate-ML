-- ============================================================================
-- MIGRACIÓN 017 — ym.superficie_zona_historico (2026-07-29)
--
-- Completa el pendiente "cohortes de rendimiento por ciudad" (bloqueado
-- 2026-07-28, ver docs/auditoria_datos.md §7.12: produccion_kg por ciudad es
-- un prorrateo fabricado, sin reemplazo real). La geografía real del INYM
-- no es "ciudad" sino "zona" (Centro/Sur/Oeste/Noroeste/Noreste Misiones +
-- Corrientes) -- la misma que ya usan ym.inym_hoja_verde_zona (producción
-- real, Fase 3c) y la capa GIS view_superficie_por_zonas (superficie
-- ACTUAL real, inym_geoserver, ya usada en /produccion "Rendimiento por
-- zona"). Esta tabla agrega el anclaje histórico que faltaba para poder
-- armar un cohorte real de crecimiento de superficie (2010 -> actual).
--
-- Fuente: mismo hallazgo de hoy documentado en ym.fuentes
-- 'inym_prensa_superficie_productores' (ver migración 016) -- prensa que
-- cita al INYM directamente, sin la cláusula de confidencialidad del PDF
-- interno "Superficie Cultivada por Departamento".
--
-- Suma de control 2020 (6 zonas): 51.509,1 + 27.579 + 25.948 + 15.495 +
-- 33.918 + 23.085 = 177.534,1 ha -- coincide casi exacto con el total
-- nacional 2020 ya validado (177.534,92 ha, ver ym.fuentes id 23) pese a
-- venir de una agregación por zona totalmente independiente de la agregación
-- por "ciudad" -- buena señal cruzada, no arregla el problema de fondo de
-- que "ciudad" no mapea a geografía real (§7.11), pero confirma que esta
-- serie por zona sí es consistente.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS ym.superficie_zona_historico (
    anio            SMALLINT NOT NULL,
    zona            TEXT NOT NULL,      -- 'CENTRO'|'SUR'|'OESTE'|'NOROESTE'|'NORESTE'|'CORRIENTES' (sin prefijo "ZONA ", ver frontend/lib/zonas.ts)
    superficie_ha   NUMERIC(12,2) NOT NULL,
    es_derivado     BOOLEAN NOT NULL DEFAULT FALSE,  -- TRUE: no viene citado explícito en la fuente, se calculó como total_provincia - resto_de_zonas_citadas
    PRIMARY KEY (anio, zona)
);
COMMENT ON TABLE ym.superficie_zona_historico IS
    'Anclajes históricos reales de superficie por zona (categoría A/B, ver ym.tabla_fuente) -- NO es una serie anual completa, solo los puntos con fuente citable encontrados. Para superficie ACTUAL usar la capa GIS view_superficie_por_zonas (inym_gis.raw_features), más reciente y ya en category A.';

INSERT INTO ym.superficie_zona_historico (anio, zona, superficie_ha, es_derivado) VALUES
(2010, 'CENTRO', 56800.00, FALSE),
(2010, 'SUR', 35350.00, FALSE),
(2010, 'OESTE', 32520.00, FALSE),
(2010, 'NOROESTE', 22080.00, FALSE),
(2010, 'NORESTE', 29550.00, FALSE),
(2010, 'CORRIENTES', 18700.00, FALSE),
(2020, 'CENTRO', 51509.10, TRUE),   -- derivado: 154.449,1 ha (Misiones 2020, inym.org.ar) - suma de las otras 4 zonas de Misiones citadas explícitas
(2020, 'SUR', 27579.00, FALSE),
(2020, 'OESTE', 25948.00, FALSE),
(2020, 'NOROESTE', 15495.00, FALSE),
(2020, 'NORESTE', 33918.00, FALSE),
(2020, 'CORRIENTES', 23085.00, FALSE)
ON CONFLICT (anio, zona) DO NOTHING;

INSERT INTO ym.tabla_fuente (tabla_nombre, fuente_id, notas)
VALUES (
    'ym.superficie_zona_historico',
    (SELECT id FROM ym.fuentes WHERE codigo = 'inym_prensa_superficie_productores'),
    'Solo 2 anclajes (2010, 2020), no serie completa -- 2020.CENTRO es derivado (total Misiones - resto de zonas citadas), marcado es_derivado=TRUE. Para el año actual/reciente usar inym_gis.raw_features (layer_name=''view_superficie_por_zonas''), fuente independiente ya cargada.'
)
ON CONFLICT (tabla_nombre) DO UPDATE SET fuente_id = EXCLUDED.fuente_id, notas = EXCLUDED.notas;

COMMIT;
