-- ============================================================================
-- MIGRACIÓN 002 — Saneamiento post-auditoría de datos (2026-07-11)
-- Ver docs/auditoria_datos.md para el diagnóstico completo.
--
-- Qué hace:
--   1) Hace nullable las columnas de dataset_principal, consumo_interno
--      (mix envases), superficie_productores.productores e
--      importaciones.volumen_kg -- NULL pasa a ser un valor válido (dato
--      no disponible), nunca se rellena con algo inventado.
--   2) Crea ym.dataset_principal_anual: preserva los TOTALES ANUALES reales
--      2011-2024 (validados en la auditoría contra ym.inym_hoja_verde_zona /
--      ym.inym_salida_molino / comunicados oficiales del INYM) antes de
--      anular el desglose mensual, que es 100% sintético (T5 = correlación
--      de estacionalidad 1.000 exacta entre TODOS los años).
--   3) Crea ym.exportaciones_anual: mismo tratamiento para el desglose por
--      destino de ym.exportaciones.
--   4) Anula (SET NULL) el desglose mensual 2011-2024 y el año 2025 completo
--      (clon byte a byte de 2024, confirmado en las 7/7 ciudades) de
--      dataset_principal y ym.exportaciones.
--   5) Carga el año 2025 en las tablas _anual con las cifras reales del
--      comunicado oficial del INYM (02/02/2026), a nivel NACIONAL -- no hay
--      desglose real por ciudad/destino para 2025 todavía.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1) Nullable
-- ----------------------------------------------------------------------------
ALTER TABLE ym.dataset_principal
    ALTER COLUMN produccion_kg DROP NOT NULL,
    ALTER COLUMN consumo_interno_kg DROP NOT NULL,
    ALTER COLUMN exportaciones_kg DROP NOT NULL,
    ALTER COLUMN valor_fob_usd DROP NOT NULL;

ALTER TABLE ym.exportaciones
    ALTER COLUMN volumen_kg DROP NOT NULL,
    ALTER COLUMN valor_fob_usd DROP NOT NULL,
    ALTER COLUMN precio_fob_usd_kg DROP NOT NULL;

ALTER TABLE ym.consumo_interno
    ALTER COLUMN envase_05kg_pct DROP NOT NULL,
    ALTER COLUMN envase_1kg_pct DROP NOT NULL,
    ALTER COLUMN envase_2kg_pct DROP NOT NULL,
    ALTER COLUMN envase_025kg_pct DROP NOT NULL,
    ALTER COLUMN otros_envases_pct DROP NOT NULL,
    ALTER COLUMN sin_estampillas_pct DROP NOT NULL;

ALTER TABLE ym.superficie_productores
    ALTER COLUMN productores DROP NOT NULL,
    ALTER COLUMN superficie_ha DROP NOT NULL;

ALTER TABLE ym.importaciones
    ALTER COLUMN volumen_kg DROP NOT NULL;

-- ----------------------------------------------------------------------------
-- 2) ym.dataset_principal_anual — totales anuales reales, preservados antes
--    de anular el mensual. provincia/ciudad = '(nacional)' para años sin
--    desglose real por ciudad (2025).
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ym.dataset_principal_anual (
    anio                    SMALLINT NOT NULL,
    provincia               TEXT NOT NULL DEFAULT '(nacional)',
    ciudad                  TEXT NOT NULL DEFAULT '(nacional)',
    produccion_kg           NUMERIC(14,2),
    consumo_interno_kg      NUMERIC(14,2),
    exportaciones_kg        NUMERIC(14,2),
    precio_usd_kg_promedio  NUMERIC(8,4),
    valor_fob_usd           NUMERIC(14,2),
    fuente                  TEXT NOT NULL,     -- 'dataset_principal_original' | 'inym_comunicado_oficial'
    fuente_url              TEXT,
    PRIMARY KEY (anio, provincia, ciudad)
);
COMMENT ON TABLE ym.dataset_principal_anual IS
    'Totales anuales reales (categoría C de docs/auditoria_datos.md). El total NACIONAL de cada año está validado contra fuente independiente (hoja_verde_zona/salida_molino/comunicados INYM); el desglose por ciudad 2011-2024 suma correcto al total nacional pero NO tiene validación independiente propia a nivel ciudad -- ver caso E (Producción por ciudad) en la auditoría.';

INSERT INTO ym.dataset_principal_anual
    (anio, provincia, ciudad, produccion_kg, consumo_interno_kg, exportaciones_kg, precio_usd_kg_promedio, valor_fob_usd, fuente, fuente_url)
VALUES
(2011, 'Corrientes', 'Colonia Liebig', 48458196.00, 17155338.00, 2440988.00, 1.8000, 4393777.00, 'dataset_principal_original', NULL),
(2011, 'Corrientes', 'Gobernador Virasoro', 42972363.00, 15213228.00, 2164653.00, 1.8000, 3896371.00, 'dataset_principal_original', NULL),
(2011, 'Misiones', 'Apóstoles', 367128863.00, 129972256.00, 18493412.00, 1.8000, 33288147.00, 'dataset_principal_original', NULL),
(2011, 'Misiones', 'Montecarlo', 91782217.00, 32493060.00, 4623353.00, 1.8000, 8322036.00, 'dataset_principal_original', NULL),
(2011, 'Misiones', 'Oberá', 42831700.00, 15163430.00, 2157565.00, 1.8000, 3883617.00, 'dataset_principal_original', NULL),
(2011, 'Misiones', 'Otros', 48950516.00, 17329630.00, 2465788.00, 1.8000, 4438423.00, 'dataset_principal_original', NULL),
(2011, 'Misiones', 'Santo Pipó', 61188143.00, 21662045.00, 3082236.00, 1.8000, 5548024.00, 'dataset_principal_original', NULL),
(2012, 'Corrientes', 'Colonia Liebig', 50572600.00, 16880502.00, 2330677.00, 1.9000, 4428288.00, 'dataset_principal_original', NULL),
(2012, 'Corrientes', 'Gobernador Virasoro', 44847398.00, 14969497.00, 2066829.00, 1.9000, 3926976.00, 'dataset_principal_original', NULL),
(2012, 'Misiones', 'Apóstoles', 383148001.00, 127890000.00, 17657695.00, 1.9000, 33549617.00, 'dataset_principal_original', NULL),
(2012, 'Misiones', 'Montecarlo', 95787002.00, 31972500.00, 4414424.00, 1.9000, 8387400.00, 'dataset_principal_original', NULL),
(2012, 'Misiones', 'Oberá', 44700600.00, 14920498.00, 2060065.00, 1.9000, 3914124.00, 'dataset_principal_original', NULL),
(2012, 'Misiones', 'Otros', 51086402.00, 17052002.00, 2354359.00, 1.9000, 4473283.00, 'dataset_principal_original', NULL),
(2012, 'Misiones', 'Santo Pipó', 63858000.00, 21314998.00, 2942947.00, 1.9000, 5591600.00, 'dataset_principal_original', NULL),
(2013, 'Corrientes', 'Colonia Liebig', 47514427.00, 17762462.00, 2407777.00, 2.0000, 4815559.00, 'dataset_principal_original', NULL),
(2013, 'Corrientes', 'Gobernador Virasoro', 42135433.00, 15751616.00, 2135200.00, 2.0000, 4270400.00, 'dataset_principal_original', NULL),
(2013, 'Misiones', 'Apóstoles', 359978662.00, 134571886.00, 18241812.00, 2.0000, 36483624.00, 'dataset_principal_original', NULL),
(2013, 'Misiones', 'Montecarlo', 89994665.00, 33642974.00, 4560453.00, 2.0000, 9120905.00, 'dataset_principal_original', NULL),
(2013, 'Misiones', 'Oberá', 41997508.00, 15700050.00, 2128212.00, 2.0000, 4256424.00, 'dataset_principal_original', NULL),
(2013, 'Misiones', 'Otros', 47997156.00, 17942917.00, 2432241.00, 2.0000, 4864483.00, 'dataset_principal_original', NULL),
(2013, 'Misiones', 'Santo Pipó', 59996447.00, 22428646.00, 3040300.00, 2.0000, 6080600.00, 'dataset_principal_original', NULL),
(2014, 'Corrientes', 'Colonia Liebig', 53434033.00, 17648782.00, 2268947.00, 2.0000, 4537888.00, 'dataset_principal_original', NULL),
(2014, 'Corrientes', 'Gobernador Virasoro', 47384897.00, 15650808.00, 2012088.00, 2.0000, 4024165.00, 'dataset_principal_original', NULL),
(2014, 'Misiones', 'Apóstoles', 404826764.00, 133710672.00, 17189983.00, 2.0000, 34379964.00, 'dataset_principal_original', NULL),
(2014, 'Misiones', 'Montecarlo', 101206689.00, 33427670.00, 4297500.00, 2.0000, 8594988.00, 'dataset_principal_original', NULL),
(2014, 'Misiones', 'Oberá', 47229790.00, 15599582.00, 2005500.00, 2.0000, 4011000.00, 'dataset_principal_original', NULL),
(2014, 'Misiones', 'Otros', 53976903.00, 17828088.00, 2292000.00, 2.0000, 4584000.00, 'dataset_principal_original', NULL),
(2014, 'Misiones', 'Santo Pipó', 67471127.00, 22285108.00, 2865000.00, 2.0000, 5729995.00, 'dataset_principal_original', NULL),
(2015, 'Corrientes', 'Colonia Liebig', 55555725.00, 17235668.00, 2460277.00, 2.1000, 5166588.00, 'dataset_principal_original', NULL),
(2015, 'Corrientes', 'Gobernador Virasoro', 49266398.00, 15284458.00, 2181759.00, 2.1000, 4581689.00, 'dataset_principal_original', NULL),
(2015, 'Misiones', 'Apóstoles', 420901130.00, 130580805.00, 18639576.00, 2.1000, 39143112.00, 'dataset_principal_original', NULL),
(2015, 'Misiones', 'Montecarlo', 105225284.00, 32645200.00, 4659895.00, 2.1000, 9785776.00, 'dataset_principal_original', NULL),
(2015, 'Misiones', 'Oberá', 49105134.00, 15234428.00, 2174617.00, 2.1000, 4566700.00, 'dataset_principal_original', NULL),
(2015, 'Misiones', 'Otros', 56120149.00, 17410770.00, 2485276.00, 2.1000, 5219083.00, 'dataset_principal_original', NULL),
(2015, 'Misiones', 'Santo Pipó', 70150186.00, 21763467.00, 3106600.00, 2.1000, 6523853.00, 'dataset_principal_original', NULL),
(2016, 'Corrientes', 'Colonia Liebig', 56489997.00, 17372336.00, 1920659.00, 2.1000, 4033376.00, 'dataset_principal_original', NULL),
(2016, 'Corrientes', 'Gobernador Virasoro', 50094905.00, 15405656.00, 1703224.00, 2.1000, 3576771.00, 'dataset_principal_original', NULL),
(2016, 'Misiones', 'Apóstoles', 427979366.00, 131616227.00, 14551271.00, 2.1000, 30557671.00, 'dataset_principal_original', NULL),
(2016, 'Misiones', 'Montecarlo', 106994840.00, 32904055.00, 3637817.00, 2.1000, 7639417.00, 'dataset_principal_original', NULL),
(2016, 'Misiones', 'Oberá', 49930925.00, 15355225.00, 1697647.00, 2.1000, 3565064.00, 'dataset_principal_original', NULL),
(2016, 'Misiones', 'Otros', 57063915.00, 17548830.00, 1940171.00, 2.1000, 4074353.00, 'dataset_principal_original', NULL),
(2016, 'Misiones', 'Santo Pipó', 71329897.00, 21936036.00, 2425212.00, 2.1000, 5092947.00, 'dataset_principal_original', NULL),
(2017, 'Corrientes', 'Colonia Liebig', 47485583.00, 17907429.00, 2139347.00, 2.2000, 4706559.00, 'dataset_principal_original', NULL),
(2017, 'Corrientes', 'Gobernador Virasoro', 42109857.00, 15880168.00, 1897153.00, 2.2000, 4173741.00, 'dataset_principal_original', NULL),
(2017, 'Misiones', 'Apóstoles', 359760167.00, 135670206.00, 16208100.00, 2.2000, 35657823.00, 'dataset_principal_original', NULL),
(2017, 'Misiones', 'Montecarlo', 89940041.00, 33917552.00, 4052024.00, 2.2000, 8914453.00, 'dataset_principal_original', NULL),
(2017, 'Misiones', 'Oberá', 41972020.00, 15828194.00, 1890947.00, 2.2000, 4160077.00, 'dataset_principal_original', NULL),
(2017, 'Misiones', 'Otros', 47968025.00, 18089358.00, 2161077.00, 2.2000, 4754376.00, 'dataset_principal_original', NULL),
(2017, 'Misiones', 'Santo Pipó', 59960026.00, 22611702.00, 2701352.00, 2.2000, 5942971.00, 'dataset_principal_original', NULL),
(2018, 'Corrientes', 'Colonia Liebig', 55760206.00, 18063822.00, 2827517.00, 2.2000, 6220541.00, 'dataset_principal_original', NULL),
(2018, 'Corrientes', 'Gobernador Virasoro', 49447731.00, 16018858.00, 2507424.00, 2.2000, 5516329.00, 'dataset_principal_original', NULL),
(2018, 'Misiones', 'Apóstoles', 422450330.00, 136855080.00, 21421836.00, 2.2000, 47128041.00, 'dataset_principal_original', NULL),
(2018, 'Misiones', 'Montecarlo', 105612584.00, 34213770.00, 5355459.00, 2.2000, 11782012.00, 'dataset_principal_original', NULL),
(2018, 'Misiones', 'Oberá', 49285872.00, 15966426.00, 2499212.00, 2.2000, 5498271.00, 'dataset_principal_original', NULL),
(2018, 'Misiones', 'Otros', 56326710.00, 18247344.00, 2856247.00, 2.2000, 6283736.00, 'dataset_principal_original', NULL),
(2018, 'Misiones', 'Santo Pipó', 70408386.00, 22809178.00, 3570305.00, 2.2000, 7854676.00, 'dataset_principal_original', NULL),
(2019, 'Corrientes', 'Colonia Liebig', 57686940.00, 19108174.00, 2744565.00, 2.3000, 6312500.00, 'dataset_principal_original', NULL),
(2019, 'Corrientes', 'Gobernador Virasoro', 51156342.00, 16944985.00, 2433864.00, 2.3000, 5597877.00, 'dataset_principal_original', NULL),
(2019, 'Misiones', 'Apóstoles', 437047641.00, 144767313.00, 20793376.00, 2.3000, 47824776.00, 'dataset_principal_original', NULL),
(2019, 'Misiones', 'Montecarlo', 109261909.00, 36191829.00, 5198347.00, 2.3000, 11956199.00, 'dataset_principal_original', NULL),
(2019, 'Misiones', 'Oberá', 50988890.00, 16889518.00, 2425900.00, 2.3000, 5579559.00, 'dataset_principal_original', NULL),
(2019, 'Misiones', 'Otros', 58273020.00, 19302312.00, 2772453.00, 2.3000, 6376636.00, 'dataset_principal_original', NULL),
(2019, 'Misiones', 'Santo Pipó', 72841272.00, 24127882.00, 3465564.00, 2.3000, 7970800.00, 'dataset_principal_original', NULL),
(2020, 'Corrientes', 'Colonia Liebig', 56008809.00, 18520318.00, 2956153.00, 2.3000, 6799153.00, 'dataset_principal_original', NULL),
(2020, 'Corrientes', 'Gobernador Virasoro', 49668191.00, 16423678.00, 2621500.00, 2.3000, 6029441.00, 'dataset_principal_original', NULL),
(2020, 'Misiones', 'Apóstoles', 424333802.00, 140313600.00, 22396412.00, 2.3000, 51511741.00, 'dataset_principal_original', NULL),
(2020, 'Misiones', 'Montecarlo', 106083450.00, 35078400.00, 5599100.00, 2.3000, 12877936.00, 'dataset_principal_original', NULL),
(2020, 'Misiones', 'Oberá', 49505610.00, 16369920.00, 2612912.00, 2.3000, 6009700.00, 'dataset_principal_original', NULL),
(2020, 'Misiones', 'Otros', 56577840.00, 18708480.00, 2986188.00, 2.3000, 6868235.00, 'dataset_principal_original', NULL),
(2020, 'Misiones', 'Santo Pipó', 70722302.00, 23385600.00, 3732735.00, 2.3000, 8585288.00, 'dataset_principal_original', NULL),
(2021, 'Corrientes', 'Colonia Liebig', 60776000.00, 19488365.00, 2446571.00, 2.3000, 5627112.00, 'dataset_principal_original', NULL),
(2021, 'Corrientes', 'Gobernador Virasoro', 53895700.00, 17282136.00, 2169600.00, 2.3000, 4990077.00, 'dataset_principal_original', NULL),
(2021, 'Misiones', 'Apóstoles', 460450980.00, 147647700.00, 18535700.00, 2.3000, 42632100.00, 'dataset_principal_original', NULL),
(2021, 'Misiones', 'Montecarlo', 115112743.00, 36911920.00, 4633924.00, 2.3000, 10658024.00, 'dataset_principal_original', NULL),
(2021, 'Misiones', 'Oberá', 53719282.00, 17225565.00, 2162500.00, 2.3000, 4973747.00, 'dataset_principal_original', NULL),
(2021, 'Misiones', 'Otros', 61393463.00, 19686358.00, 2471424.00, 2.3000, 5684277.00, 'dataset_principal_original', NULL),
(2021, 'Misiones', 'Santo Pipó', 76741830.00, 24607952.00, 3089283.00, 2.3000, 7105353.00, 'dataset_principal_original', NULL),
(2022, 'Corrientes', 'Colonia Liebig', 57134448.00, 19003270.00, 2776947.00, 2.2000, 6109277.00, 'dataset_principal_original', NULL),
(2022, 'Corrientes', 'Gobernador Virasoro', 50666399.00, 16851960.00, 2462576.00, 2.2000, 5417664.00, 'dataset_principal_original', NULL),
(2022, 'Misiones', 'Apóstoles', 432861850.00, 143972562.00, 21038688.00, 2.2000, 46285117.00, 'dataset_principal_original', NULL),
(2022, 'Misiones', 'Montecarlo', 108215461.00, 35993137.00, 5259676.00, 2.2000, 11571276.00, 'dataset_principal_original', NULL),
(2022, 'Misiones', 'Oberá', 50500549.00, 16796802.00, 2454512.00, 2.2000, 5399929.00, 'dataset_principal_original', NULL),
(2022, 'Misiones', 'Otros', 57714913.00, 19196342.00, 2805159.00, 2.2000, 6171352.00, 'dataset_principal_original', NULL),
(2022, 'Misiones', 'Santo Pipó', 72143643.00, 23995428.00, 3506447.00, 2.2000, 7714188.00, 'dataset_principal_original', NULL),
(2023, 'Corrientes', 'Colonia Liebig', 53340125.00, 19666154.00, 2734724.00, 2.5000, 6836812.00, 'dataset_principal_original', NULL),
(2023, 'Corrientes', 'Gobernador Virasoro', 47301619.00, 17439800.00, 2425135.00, 2.5000, 6062829.00, 'dataset_principal_original', NULL),
(2023, 'Misiones', 'Apóstoles', 404115313.00, 148994652.00, 20718811.00, 2.5000, 51797012.00, 'dataset_principal_original', NULL),
(2023, 'Misiones', 'Montecarlo', 101028831.00, 37248660.00, 5179700.00, 2.5000, 12949253.00, 'dataset_principal_original', NULL),
(2023, 'Misiones', 'Oberá', 47146785.00, 17382713.00, 2417195.00, 2.5000, 6042988.00, 'dataset_principal_original', NULL),
(2023, 'Misiones', 'Otros', 53882043.00, 19865955.00, 2762512.00, 2.5000, 6906271.00, 'dataset_principal_original', NULL),
(2023, 'Misiones', 'Santo Pipó', 67352551.00, 24832440.00, 3453135.00, 2.5000, 8632836.00, 'dataset_principal_original', NULL),
(2024, 'Corrientes', 'Colonia Liebig', 67986222.00, 17832263.00, 3032929.00, 2.2200, 6733105.00, 'dataset_principal_original', NULL),
(2024, 'Corrientes', 'Gobernador Virasoro', 60289670.00, 15813513.00, 2689577.00, 2.2200, 5970865.00, 'dataset_principal_original', NULL),
(2024, 'Misiones', 'Apóstoles', 515077034.00, 135100725.00, 22978077.00, 2.2200, 51011336.00, 'dataset_principal_original', NULL),
(2024, 'Misiones', 'Montecarlo', 128769256.00, 33775184.00, 5744523.00, 2.2200, 12752835.00, 'dataset_principal_original', NULL),
(2024, 'Misiones', 'Oberá', 60092320.00, 15761751.00, 2680776.00, 2.2200, 5951324.00, 'dataset_principal_original', NULL),
(2024, 'Misiones', 'Otros', 68676936.00, 18013433.00, 3063747.00, 2.2200, 6801512.00, 'dataset_principal_original', NULL),
(2024, 'Misiones', 'Santo Pipó', 85846173.00, 22516790.00, 3829677.00, 2.2200, 8501888.00, 'dataset_principal_original', NULL),
(2025, '(nacional)', '(nacional)', 889253083.00, 266788512.00, 57980911.00, NULL, NULL, 'inym_comunicado_oficial', 'https://inym.org.ar/noticias/yerba-mate-argentina/80742-yerba-mate-el-cierre-del-2025-marco-un-crecimiento-del-73-con-record-historico-en-exportaciones-y-un-mercado-interno-en-franca-recuperacion.html')
ON CONFLICT (anio, provincia, ciudad) DO NOTHING;

-- ----------------------------------------------------------------------------
-- 3) ym.exportaciones_anual — mismo tratamiento, por destino
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ym.exportaciones_anual (
    anio                SMALLINT NOT NULL,
    destino             TEXT NOT NULL DEFAULT '(nacional)',
    volumen_kg          NUMERIC(14,2),
    valor_fob_usd       NUMERIC(14,2),
    precio_fob_usd_kg   NUMERIC(8,4),
    fuente              TEXT NOT NULL,
    fuente_url          TEXT,
    PRIMARY KEY (anio, destino)
);
COMMENT ON TABLE ym.exportaciones_anual IS
    'Totales anuales reales por destino 2011-2024 (suman correcto al total nacional validado, sin validación independiente propia por destino) + total nacional 2025 (sin desglose por destino real todavía) -- ver docs/auditoria_datos.md.';

INSERT INTO ym.exportaciones_anual (anio, destino, volumen_kg, valor_fob_usd, precio_fob_usd_kg, fuente)
VALUES
(2011, 'Chile', 5314200.00, 9565559.00, 1.8000, 'ym_exportaciones_original'),
(2011, 'Lebanon', 1771400.00, 3188523.00, 1.8000, 'ym_exportaciones_original'),
(2011, 'Others', 3542800.00, 6377041.00, 1.8000, 'ym_exportaciones_original'),
(2011, 'Spain', 1771400.00, 3188523.00, 1.8000, 'ym_exportaciones_original'),
(2011, 'Syria', 21256800.00, 38262241.00, 1.8000, 'ym_exportaciones_original'),
(2011, 'USA', 1771400.00, 3188523.00, 1.8000, 'ym_exportaciones_original'),
(2012, 'Chile', 4735777.00, 8997983.00, 1.9000, 'ym_exportaciones_original'),
(2012, 'Lebanon', 2029623.00, 3856276.00, 1.9000, 'ym_exportaciones_original'),
(2012, 'Others', 2367888.00, 4498988.00, 1.9000, 'ym_exportaciones_original'),
(2012, 'Spain', 1691353.00, 3213565.00, 1.9000, 'ym_exportaciones_original'),
(2012, 'Syria', 21311012.00, 40490923.00, 1.9000, 'ym_exportaciones_original'),
(2012, 'USA', 1691353.00, 3213565.00, 1.9000, 'ym_exportaciones_original'),
(2013, 'Chile', 4892441.00, 9784877.00, 2.0000, 'ym_exportaciones_original'),
(2013, 'Lebanon', 1747300.00, 3494600.00, 2.0000, 'ym_exportaciones_original'),
(2013, 'Others', 1747300.00, 3494600.00, 2.0000, 'ym_exportaciones_original'),
(2013, 'Spain', 1747300.00, 3494600.00, 2.0000, 'ym_exportaciones_original'),
(2013, 'Syria', 23413823.00, 46827641.00, 2.0000, 'ym_exportaciones_original'),
(2013, 'USA', 1397841.00, 2795677.00, 2.0000, 'ym_exportaciones_original'),
(2014, 'Chile', 4939653.00, 9879300.00, 2.0000, 'ym_exportaciones_original'),
(2014, 'Lebanon', 1317241.00, 2634477.00, 2.0000, 'ym_exportaciones_original'),
(2014, 'Others', 987929.00, 1975859.00, 2.0000, 'ym_exportaciones_original'),
(2014, 'Spain', 1646553.00, 3293100.00, 2.0000, 'ym_exportaciones_original'),
(2014, 'Syria', 23051700.00, 46103400.00, 2.0000, 'ym_exportaciones_original'),
(2014, 'USA', 987929.00, 1975859.00, 2.0000, 'ym_exportaciones_original'),
(2015, 'Chile', 5356200.00, 11248023.00, 2.1000, 'ym_exportaciones_original'),
(2015, 'Lebanon', 1071241.00, 2249600.00, 2.1000, 'ym_exportaciones_original'),
(2015, 'Others', 714159.00, 1499736.00, 2.1000, 'ym_exportaciones_original'),
(2015, 'Spain', 1785400.00, 3749341.00, 2.1000, 'ym_exportaciones_original'),
(2015, 'Syria', 25709759.00, 53990500.00, 2.1000, 'ym_exportaciones_original'),
(2015, 'USA', 1071241.00, 2249600.00, 2.1000, 'ym_exportaciones_original'),
(2016, 'Chile', 3902641.00, 8195547.00, 2.1000, 'ym_exportaciones_original'),
(2016, 'Lebanon', 836277.00, 1756188.00, 2.1000, 'ym_exportaciones_original'),
(2016, 'Others', 278759.00, 585400.00, 2.1000, 'ym_exportaciones_original'),
(2016, 'Spain', 1393800.00, 2926977.00, 2.1000, 'ym_exportaciones_original'),
(2016, 'Syria', 20628241.00, 43319300.00, 2.1000, 'ym_exportaciones_original'),
(2016, 'USA', 836277.00, 1756188.00, 2.1000, 'ym_exportaciones_original'),
(2017, 'Chile', 4347000.00, 9563400.00, 2.2000, 'ym_exportaciones_original'),
(2017, 'Lebanon', 931500.00, 2049300.00, 2.2000, 'ym_exportaciones_original'),
(2017, 'Others', 621000.00, 1366200.00, 2.2000, 'ym_exportaciones_original'),
(2017, 'Spain', 1552500.00, 3415500.00, 2.2000, 'ym_exportaciones_original'),
(2017, 'Syria', 22666500.00, 49866300.00, 2.2000, 'ym_exportaciones_original'),
(2017, 'USA', 931500.00, 2049300.00, 2.2000, 'ym_exportaciones_original'),
(2018, 'Chile', 5745323.00, 12639700.00, 2.2000, 'ym_exportaciones_original'),
(2018, 'Lebanon', 1641523.00, 3611347.00, 2.2000, 'ym_exportaciones_original'),
(2018, 'Others', 1231141.00, 2708512.00, 2.2000, 'ym_exportaciones_original'),
(2018, 'Spain', 2051900.00, 4514177.00, 2.2000, 'ym_exportaciones_original'),
(2018, 'Syria', 28726600.00, 63198523.00, 2.2000, 'ym_exportaciones_original'),
(2018, 'USA', 1641523.00, 3611347.00, 2.2000, 'ym_exportaciones_original'),
(2019, 'Chile', 4381747.00, 10078017.00, 2.3000, 'ym_exportaciones_original'),
(2019, 'Lebanon', 1195024.00, 2748553.00, 2.3000, 'ym_exportaciones_original'),
(2019, 'Others', 398341.00, 916188.00, 2.3000, 'ym_exportaciones_original'),
(2019, 'Spain', 1991700.00, 4580917.00, 2.3000, 'ym_exportaciones_original'),
(2019, 'Syria', 31468911.00, 72378493.00, 2.3000, 'ym_exportaciones_original'),
(2019, 'USA', 398341.00, 916188.00, 2.3000, 'ym_exportaciones_original'),
(2020, 'Chile', 6006700.00, 13815412.00, 2.3000, 'ym_exportaciones_original'),
(2020, 'Lebanon', 858100.00, 1973629.00, 2.3000, 'ym_exportaciones_original'),
(2020, 'Others', 429053.00, 986812.00, 2.3000, 'ym_exportaciones_original'),
(2020, 'Spain', 2145253.00, 4934076.00, 2.3000, 'ym_exportaciones_original'),
(2020, 'Syria', 32178753.00, 74011124.00, 2.3000, 'ym_exportaciones_original'),
(2020, 'USA', 1287153.00, 2960447.00, 2.3000, 'ym_exportaciones_original'),
(2021, 'Chile', 4971259.00, 11433900.00, 2.3000, 'ym_exportaciones_original'),
(2021, 'Lebanon', 1065271.00, 2450123.00, 2.3000, 'ym_exportaciones_original'),
(2021, 'Others', 710177.00, 1633412.00, 2.3000, 'ym_exportaciones_original'),
(2021, 'Spain', 1775453.00, 4083535.00, 2.3000, 'ym_exportaciones_original'),
(2021, 'Syria', 25566477.00, 58802900.00, 2.3000, 'ym_exportaciones_original'),
(2021, 'USA', 1420359.00, 3266829.00, 2.3000, 'ym_exportaciones_original'),
(2022, 'Chile', 5642564.00, 12413635.00, 2.2000, 'ym_exportaciones_original'),
(2022, 'Lebanon', 806077.00, 1773376.00, 2.2000, 'ym_exportaciones_original'),
(2022, 'Others', 725476.00, 1596041.00, 2.2000, 'ym_exportaciones_original'),
(2022, 'Spain', 2015200.00, 4433441.00, 2.2000, 'ym_exportaciones_original'),
(2022, 'Syria', 29905570.00, 65792257.00, 2.2000, 'ym_exportaciones_original'),
(2022, 'USA', 1209123.00, 2660064.00, 2.2000, 'ym_exportaciones_original'),
(2023, 'Chile', 5556765.00, 13891923.00, 2.5000, 'ym_exportaciones_original'),
(2023, 'Lebanon', 1587647.00, 3969123.00, 2.5000, 'ym_exportaciones_original'),
(2023, 'Others', 1111353.00, 2778388.00, 2.5000, 'ym_exportaciones_original'),
(2023, 'Spain', 1984559.00, 4961400.00, 2.5000, 'ym_exportaciones_original'),
(2023, 'Syria', 28260135.00, 70650336.00, 2.5000, 'ym_exportaciones_original'),
(2023, 'USA', 1190736.00, 2976841.00, 2.5000, 'ym_exportaciones_original'),
(2024, 'Chile', 6162700.00, 13681200.00, 2.2200, 'ym_exportaciones_original'),
(2024, 'Lebanon', 440189.00, 977229.00, 2.2200, 'ym_exportaciones_original'),
(2024, 'Others', 0.00, 0.00, 0.0000, 'ym_exportaciones_original'),
(2024, 'Spain', 2200965.00, 4886147.00, 2.2200, 'ym_exportaciones_original'),
(2024, 'Syria', 34335065.00, 76223841.00, 2.2200, 'ym_exportaciones_original'),
(2024, 'USA', 880388.00, 1954459.00, 2.2200, 'ym_exportaciones_original'),
(2025, '(nacional)', 57980911.00, NULL, NULL, 'inym_comunicado_oficial')
ON CONFLICT (anio, destino) DO NOTHING;

-- ----------------------------------------------------------------------------
-- 4) Anular el desglose mensual sintético 2011-2024 + el año 2025 clonado
--    en dataset_principal (T5=1.000 exacto y T1=7/7 ciudades respectivamente).
--    precio_usd_kg NO se toca -- categoría C, cadencia mensual real distinta.
-- ----------------------------------------------------------------------------
UPDATE ym.dataset_principal
SET produccion_kg = NULL, consumo_interno_kg = NULL, exportaciones_kg = NULL, valor_fob_usd = NULL
WHERE anio BETWEEN 2011 AND 2025;

-- ----------------------------------------------------------------------------
-- 5) Mismo tratamiento en ym.exportaciones (T5=1.000 en las 6 entidades,
--    T1=5/8 destinos en 2025)
-- ----------------------------------------------------------------------------
UPDATE ym.exportaciones
SET volumen_kg = NULL, valor_fob_usd = NULL, precio_fob_usd_kg = NULL
WHERE anio BETWEEN 2011 AND 2025;

COMMIT;
