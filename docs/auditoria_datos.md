# Auditoría integral de datos — yerba-mate-ML

**Fecha:** 2026-07-11
**Alcance:** todas las tablas `ym.*` e `inym_gis.*` en Supabase + los 7 CSVs de `data/raw/`.
**Estado:** SOLO DIAGNÓSTICO. No se modificó ningún dato ni código de producción.
**Script:** `backend/etl/audit_datos.py` (reutilizable, de solo lectura — ver §6).

---

## 0. Resumen ejecutivo

El batch original de 7 CSVs (`data/raw/*.csv`, commit `223741e`, 2026-06-30) **no tiene fuente
primaria documentada en ningún lado del repo** — a diferencia de todo lo que se cargó después
(Fase 3: INDEC, BCRA, NASA POWER, scraper PDF del INYM), que sí tiene URL, organismo y fecha de
captura citados en `docs/`.

De esos 7 CSVs, ya sabíamos que **1 es 100% fabricado** (`competencia.csv`, auditado en Fase 8).
Esta auditoría encuentra que **los otros 6 no son enteramente reales tampoco, pero tampoco son
enteramente falsos** — el patrón es consistente en casi todos:

- **Los totales anuales de `dataset_principal` (producción, consumo, exportado) para 2011-2024
  son reales**, verificados de forma independiente contra el scraper PDF del INYM
  (`ym.inym_hoja_verde_zona`, `ym.inym_salida_molino`) cargado en Fase 3c — coinciden al 0,01% en
  la mayoría de los años.
- **El desglose mensual dentro de cada año es 100% sintético**: T5 (correlación de estacionalidad)
  da **1.000 exacto entre absolutamente todos los pares de años** (2011 vs 2012, 2011 vs 2013, ...,
  105 de 105 pares posibles) para producción, consumo y exportado, en las dos provincias. Es la
  misma curva de 12 meses aplicada como plantilla fija a cada ciudad y cada año.
- **2025 es un caso aparte y más grave**: producción, consumo y exportado de **cada una de las 7
  ciudades** están clonados byte a byte de 2024 (T1, confirmado en las 7/7 ciudades). Los datos
  reales (scraper INYM) muestran que 2025 fue un año distinto — producción cayó ~10%, consumo
  interno subió ~3%. El valor cargado como "2025" en `dataset_principal` es simplemente 2024
  repetido, no una medición.
- El mismo patrón de clon 2024→2025 aparece también en `ym.exportaciones` (por destino) y en
  `ym.superficie_productores` (superficie y productores, por ciudad) — no es exclusivo de
  `dataset_principal`.
- `consumo_interno.mix_envases` (formatos de envase) está **congelado idéntico 2011-2021 (11 años),
  salta a otro valor fijo 2022-2024 (3 años), y cambia de nuevo solo en 2025** — mismo patrón
  "escalón" que ya se encontró y confirmó fabricado en Competencia.
- `superficie_productores` tiene una corrida de interpolación lineal perfecta de **9 años seguidos**
  en la cantidad de productores de Apóstoles (2010-2019, +1.164 productores/año exacto) — mismo
  patrón que Playadito en Competencia.
- El caso reportado por el usuario ("el mapa dice 918.060.675 kg, el KPI dice 986.737.611 kg para
  2025") **no es un problema de datos** — es un bug de frontend: el mapa de Producción excluye la
  ciudad "Otros" porque no tiene coordenadas en `COORDENADAS_CIUDAD` (`produccion/page.tsx`). La
  diferencia entre ambos números (68.676.936) es exactamente la producción anual de "Otros". Ver §5.
- "Producción por ciudad" es una etiqueta engañosa (caso E): son 7 buckets comerciales/de
  planta, no las ~19 unidades geográficas reales que sí existen en las capas GIS del INYM ya
  cargadas. Apóstoles concentra 52% del total — más superficie que la que el propio INYM reporta
  para todo el país (ver §4.3).
- Las fuentes scrapeadas en Fase 3 (`inym_hoja_verde_zona`, `inym_salida_molino`, y la
  `competencia` ya saneada en Fase 8) pasan los tests limpias — sirven de control positivo de que
  el método de auditoría no está gritando lobo por gritar.
- **Verificación externa (T8) confirma todo lo anterior con fuente primaria real**: los
  comunicados oficiales del INYM (`inym.org.ar`) dan producción 2024 = 986.737.613 kg (coincide
  con `dataset_principal` casi al kg) y producción 2025 = 889.253.083 kg / consumo interno 2025 =
  266.788.512 kg (coinciden con las fuentes reales ya cargadas, `hoja_verde_zona`/`salida_molino`,
  al 0,02%-0,5%) — y **no** con el clon 2024=2025 de `dataset_principal`. El único benchmark del
  usuario que no se pudo confirmar fue el consumo per cápita 2025 (el INYM no lo publica de forma
  consistente) — ver §6.

---

## 1. Etapa 1 — Inventario de series

| Serie | Módulo(s) que la consume | Rango | Granularidad real | Origen declarado | Fuente primaria documentada | Resultado T1-T8 |
|---|---|---|---|---|---|---|
| `dataset_principal.produccion_kg` | Producción (KPI, tabla, mapa, heatmap viejo) | 2011-2025 | Anual (mensual es plantilla sintética) | CSV seed, sin cita | **NO** | T1=7/7 ciudades (2025=2024), T2=210, T5=1.000 en 105/105 pares |
| `dataset_principal.consumo_interno_kg` | Producción (tabla) | 2011-2025 | Anual (ídem) | CSV seed, sin cita | **NO** | T1=7/7, T2=210, T5=1.000 en 105/105 |
| `dataset_principal.exportaciones_kg` | Producción (tabla) | 2011-2025 | Anual (ídem) | CSV seed, sin cita | **NO** | T1=7/7, T5=1.000 en 105/105 |
| `dataset_principal.precio_usd_kg` | Producción (KPI, tabla) | 2011-2025 | Anual, publicado mensual (documentado) | CSV seed, sin cita | **NO** | T1=35 (esperado, ya documentado), T6=180 (mismo precio las 7 ciudades cada mes — precio nacional único, plausible) |
| `dataset_principal.valor_fob_usd` | Producción (KPI, tabla) | 2011-2025 | Anual (derivado: precio×kg) | CSV seed, sin cita | **NO** | T5=1.000 en 105/105 (hereda de kg) |
| `consumo_interno.consumo_per_capita_kg` | Consumo (KPI, tabla, heatmap) | 2011-2025 | Anual, publicado mensual (documentado) | CSV seed, sin cita | **NO** | T2=15 (esperado); 2025=5,59 es proyección vieja, no cierre (ver §4.2) |
| `consumo_interno.mix_envases` (6 cols) | Consumo (chart, tabla) | 2011-2025 | Debería ser anual real | CSV seed, sin cita | **NO** | **Congelado 2011-2021, otro valor 2022-2024, cambia 2025** — T1=72, T4=100% exacto siempre |
| `exportaciones.volumen_kg` (por destino) | Exportaciones (tabla, mapa de flujos) | 2011-2025 | Anual (mensual sintético) | CSV seed, sin cita | **NO** | T1=5/8 destinos (2025=2024), T5=1.000 en 105/105 |
| `importaciones.volumen_kg` | Importaciones | 2011-2025 | Anual, publicado mensual | CSV seed, sin cita | **NO** | **T1=7 años consecutivos congelados 2011-2018** (999.996 exacto) — contradice la documentación existente ("cambia año a año"), que solo es cierta desde 2019 |
| `precios.precio_hoja_verde_ars` / `_canchada_ars` | Precios | 2017-2025 | Anual, publicado mensual (documentado) | CSV seed, sin cita | **NO** | T2=21 (esperado); NULL real en 2020-10 ya documentado |
| `competencia.cuota_mercado_pct` / `volumen_kg` | Competencia | 2021-2025 (solo años con fuente) | Anual | Fuentes citadas por fila (Fase 8) | **SÍ** (post-saneamiento) | Limpio — control positivo |
| `superficie_productores.superficie_ha` | Producción (rendimiento) | 2010-2025 | Anual, publicado mensual | CSV seed, sin cita | **NO** | T1=70 (incluye 2024=2025 clon); total nacional real = **177.533 ha** (2020-2025, congelado 6 años); **2025 solo tiene 8/12 meses cargados** |
| `superficie_productores.productores` | Producción (rendimiento) | 2010-2025 | Anual, publicado mensual | CSV seed, sin cita | **NO** | T1=21, **T3=8 corridas de interpolación lineal perfecta** (Apóstoles 9 años seguidos) |
| `ym.inym_hoja_verde_zona.hoja_verde_kg` | Producción (heatmap nuevo), Cadena Productiva | 2012-2026 (parcial) | Mensual real | Scraper PDF INYM | **SÍ** (`docs/inym_scraper.md`) | Limpio (T6=10 casos TOTAL=ZONA CENTRO, benigno — ver §2.7) |
| `ym.inym_salida_molino.volumen_kg` | Cadena Productiva | 2008-2026 (parcial) | Mensual real | Scraper PDF INYM | **SÍ** | Limpio — control positivo |
| `ym.clima_mensual` | Producción (features clima, no visible en UI aún) | 2010-2025 | Mensual real | NASA POWER API | **SÍ** (schema.sql, TODO.md) | No auditado con T1-T6 (no es serie económica, bajo riesgo de fabricación — API pública verificable) |
| `ym.indec_series` | Precios (IPC) | 2004-2026 | Mensual real | INDEC API | **SÍ** (`docs/indec_series.md`) | No auditado — API pública, bajo riesgo |
| `ym.bcra_rem` | No consumida en frontend todavía | ~14 meses | Por informe | ArgentinaDatos (mirror BCRA) | **SÍ** (`docs/bcra_rem.md`) | No auditado — API pública, bajo riesgo |
| `ym.precios_gondola` | Precios (snapshot SEPA) | Snapshot único 2026-07-04 | Puntual | SEPA | **SÍ** (schema.sql) | No auditado — es una foto, no serie temporal |
| `ym.empresas` / `marcas` / `marca_empresa` | Competencia (identidad) | — | — | Fase 8 | **SÍ** | 22/19/21 filas, sin fabricación posible (son catálogos, no series) |
| `ym.despachos_empresa` | Ninguno (tabla sin usar) | — | — | Fase 8 | — | **Vacía (0 filas)** — no representa riesgo, no se consume |
| `inym_gis.raw_features` / `secaderos` / `catalogo_capas` | Mapa GIS, mapa de Producción | Snapshot | Geoespacial | GeoServer INYM + GeoNode INDEC | **SÍ** (`docs/inym_geoserver_layers.md`) | No auditado con T1-T6 (no aplica a geometría) |

---

## 2. Etapa 2 — Resultados de tests, con evidencia

### 2.1 — T1: duplicados exactos entre períodos (el caso 2024=2025)

Confirmado en **las 7 de 7 ciudades** para `produccion_kg`, `consumo_interno_kg` y
`exportaciones_kg` de `dataset_principal`, y en 5 de 8 destinos de `ym.exportaciones`:

```
Corrientes/Colonia Liebig       2024 == 2025   produccion_kg = 67.986.222
Corrientes/Gobernador Virasoro  2024 == 2025   produccion_kg = 60.289.670
Misiones/Apóstoles              2024 == 2025   produccion_kg = 515.077.034
Misiones/Montecarlo             2024 == 2025   produccion_kg = 128.769.256
Misiones/Oberá                  2024 == 2025   produccion_kg = 60.092.320
Misiones/Otros                  2024 == 2025   produccion_kg = 68.676.936
Misiones/Santo Pipó             2024 == 2025   produccion_kg = 85.846.173
```

(mismo patrón exacto para `consumo_interno_kg` y `exportaciones_kg`, con sus propios valores).

`superficie_productores` tiene el mismo clon 2024=2025 en las 7 ciudades, tanto en `superficie_ha`
como en `productores` (ver §2.6).

### 2.2 — T2: constantes repetidas 3+ períodos

- `dataset_principal` (produccion/consumo/exportaciones): 210 corridas de 3+ meses idénticos —
  esperado, es el corolario mensual de la plantilla sintética que confirma T5.
- `importaciones.volumen_kg`: **7 años consecutivos (2011-2018) con el mismo total anual exacto**
  (999.996 kg). La documentación existente (`schema.sql`, TODO.md) afirma que esta serie "cambia
  de año a año" — cierto solo *desde 2019*. 2011-2018 es un hallazgo nuevo, no documentado antes.
- `consumo_interno.mix_envases`: ver §2.5.

### 2.3 — T3: interpolación lineal perfecta

`superficie_productores.productores` — 8 corridas de diferencia interanual constante, la más larga
de **9 años seguidos**:

| Ciudad | Diferencia constante | Desde | Hasta | Años |
|---|---|---|---|---|
| Misiones/Apóstoles | +1.164 productores/año | 2010 | 2019 | 9 |
| Misiones/Santo Pipó | +192/año | 2011 | 2017 | 6 |
| Misiones/Otros | +156/año | 2010 | 2015 | 5 |
| Misiones/Otros | +156/año | 2016 | 2021 | 5 |
| Misiones/Montecarlo | +288/año | 2014 | 2018 | 4 |
| Misiones/Montecarlo | +288/año | 2010 | 2013 | 3 |
| Misiones/Oberá | +132/año | 2016 | 2019 | 3 |
| Misiones/Santo Pipó | +192/año | 2018 | 2021 | 3 |

Un registro real de productores no crece en un número exactamente idéntico todos los años durante
casi una década — es el mismo patrón que Playadito (+1,91 pp/año exacto) en la auditoría de
Competencia.

### 2.4 — T4: sumas demasiado perfectas

`consumo_interno.mix_envases`: **los 180 períodos (15 años × 12 meses) sin excepción suman
exactamente 100,00%**. Combinado con T1 (ver abajo), indica una composición inventada, no una
medición real con redondeo.

### 2.5 — T5: estacionalidad clonada (la más contundente)

Matriz de correlación entre la forma intra-anual (12 meses normalizados) de cada par de años:

| Serie | Entidades con correlación >0,999 | Pares evaluados | Pares que dan 1,000 exacto |
|---|---|---|---|
| `dataset_principal.produccion_kg` | Corrientes, Misiones | 105 c/u (15 años) | 105/105 en ambas |
| `dataset_principal.consumo_interno_kg` | Corrientes, Misiones | 105 c/u | 105/105 en ambas |
| `dataset_principal.exportaciones_kg` | Corrientes, Misiones | 105 c/u | 105/105 en ambas |
| `dataset_principal.valor_fob_usd` | Corrientes, Misiones | 105 c/u | 105/105 en ambas |
| `ym.exportaciones.volumen_kg` | Chile, Lebanon, Spain, Syria, USA, Others | 105 c/u (78 para Others) | 105/105 (78/78) en todas |

Esto significa: **ninguna ciudad, ninguna provincia, ningún destino de exportación, en ningún año
de los 15 disponibles, tiene una forma mensual distinta a las demás**. Es una única curva estacional
de 12 valores, reescalada y repetida como plantilla. La estacionalidad *real* (INYM, scraper PDF)
sí varía año a año — ver el heatmap de Producción ya corregido para usarla.

### 2.6 — Superficie y productores: el número real vs. el artefacto de agregación

`SUM(superficie_ha) GROUP BY anio` sobre las 12 filas mensuales da **2.130.396 ha para 2024** — un
número imposible (12× el área real del país). El motivo: `superficie_ha` se publica una vez al año
pero repetida en las 12 filas mensuales (mismo patrón que consumo per cápita/precio/importaciones),
así que sumar los 12 meses cuenta la misma hectárea 12 veces. Deduplicando por mes (`WHERE mes=1`):

| Año | Superficie real (ha) | Productores real |
|---|---|---|
| 2010-2016 | 191.000 (congelado) | crece +~180-220/año (real, variación orgánica) |
| 2017 | 187.633 | 8.616 |
| 2018 | 184.267 | 8.795 |
| 2019 | 180.903 | 8.976 |
| **2020-2025** | **177.533 (congelado 6 años)** | **9.334 (congelado 5 años)** |

**177.533 ha coincide con el benchmark del usuario.** El número es real. El riesgo real acá es
metodológico, no del dato: cualquier query o componente que sume `superficie_ha` a través de los
12 meses sin deduplicar (como hizo esta misma auditoría en su primera pasada) va a reportar un área
nacional 12 veces más grande que la real. `frontend/lib/agregaciones.ts::agregarRendimientoAnual`
ya lo hace bien (toma un solo mes por ciudad-año, con comentario explícito) — pero vale dejarlo
como regla explícita para cualquier query nueva sobre esta tabla (Etapa 4, regla de provenance).

`2025` de `superficie_productores` solo tiene 8 de 12 meses cargados (enero-agosto) — no es un
clon, es carga incompleta.

### 2.7 — Controles positivos (pasan limpio)

`ym.inym_hoja_verde_zona` y `ym.inym_salida_molino` (scraper PDF real, Fase 3c) no muestran T1/T2/T3
en esta auditoría — la única señal es T6 con 10 casos donde el valor de la zona "TOTAL" coincide
exactamente con "ZONA CENTRO" en el mismo mes. Con los datos a mano esto es consistente con meses
donde el resto de las zonas no publicó (hueco real de la fuente, ya documentado en
`docs/inym_scraper.md`: 2 archivos con 0 filas, 1 con datos parciales) — no ameritó más
profundización dado el resto de la evidencia, pero queda para revisar si se prioriza saneamiento.

`ym.competencia` (ya saneada en Fase 8) pasa limpia — confirma que el método no reporta falsos
positivos sobre datos que ya se sabe que son reales.

---

## 3. Etapa 3 — Clasificación A-E

| Serie / caso | Veredicto | Evidencia | Qué hacer |
|---|---|---|---|
| `dataset_principal.produccion_kg` — **total anual 2011-2024** | **C** (proxy/derivada válida, con matiz) | Coincide a <0,1% con `inym_hoja_verde_zona` TOTAL, fuente real e independiente | Documentar la metodología: "total anual ancla en cifra publicada, ver `ym.inym_hoja_verde_zona` para el desglose mensual real" |
| `dataset_principal.produccion_kg` — **desglose mensual y por ciudad, todos los años** | **D** | T5 = 1,000 exacto en 105/105 pares de años, en ambas provincias | Eliminar el desglose mensual/ciudad de esta columna; usar `ym.inym_hoja_verde_zona` (ya lo usa el heatmap de Producción desde 2026-07-11) |
| `dataset_principal.produccion_kg` / `consumo_interno_kg` / `exportaciones_kg` — **año 2025 completo** | **D** | Clon exacto de 2024 en 7/7 ciudades (T1); el scraper real muestra 2025 ≠ 2024 | NULL para 2025 hasta reemplazar por fuente real (`inym_hoja_verde_zona`/`inym_salida_molino`/exportaciones reales — pendiente de fuente, ver §4.1) |
| `dataset_principal.consumo_interno_kg` / `exportaciones_kg` — **total anual 2011-2024** | **C**, mismo matiz que producción | `consumo_interno_kg` coincide <0,5% con `inym_salida_molino` interno; `exportaciones_kg` coincide con `ym.exportaciones` (misma fuente, no independiente — ver nota) | Igual que arriba |
| `ym.exportaciones.volumen_kg` (por destino) | **D** en desglose mensual (T5=1,000) y en 2025 (clon); **B** en el total anual (no hay fuente independiente para exportaciones, a diferencia de producción/consumo) | `dataset_principal.exportaciones_kg` y `ym.exportaciones` son casi idénticos en total anual — son la MISMA cifra fabricada repartida de 2 formas (por ciudad de origen y por destino), no dos mediciones independientes que se validan entre sí | Buscar fuente real de exportaciones mensuales (candidatos: INDEC comercio exterior NCM 0903 — ya evaluado y descartado en Fase 3a por venir mezclado con café/té; o de vuelta a la fuente primaria INYM) |
| `dataset_principal.precio_usd_kg` / `valor_fob_usd` | **C**, con la limitación ya documentada (dato anual con cadencia mensual) | Consistente con la fuente citada en TODO.md | Ya está correctamente marcado en el schema, solo falta el footer de fuente en la UI (Etapa 4) |
| `consumo_interno.consumo_per_capita_kg` | **B** (toda la serie, incluido 2025) | Serie con variación real año a año, sin URL/organismo citado en ningún doc. El benchmark del usuario (~5,7-5,8 kg para 2025) **no se pudo confirmar contra fuente primaria** (el INYM no publica un cierre oficial consistente de este indicador, ver §6) — no hay evidencia de que 5,59 esté mal, solo que no está documentado | Buscar y documentar la fuente de toda la serie; conseguir el cierre oficial 2025 si el INYM lo publica en algún informe no indexado en su sitio de noticias |
| `consumo_interno.mix_envases` (6 columnas) | **D** | Congelado idéntico 11 años (2011-2021), otro valor fijo 3 años (2022-2024), T4=100% siempre exacto | Eliminar 2011-2024 (relleno hacia atrás disfrazado de serie), dejar solo si se consigue el año/fuente real de cada cambio real |
| `importaciones.volumen_kg` | **B** desde 2019 (varía, sin fuente citada), **D** 2011-2018 (7 años congelados, no documentado antes) | T1/T2 | Documentar fuente si existe; si no, NULL 2011-2018 |
| `precios.precio_hoja_verde_ars` / `_canchada_ars` | **B** | Cadencia mensual anual ya documentada, NULL real ya manejado, pero sin URL/organismo citado | Buscar y documentar fuente (candidato obvio: mismo INYM que hoja_verde_zona, sería raro que sea otra fuente) |
| `superficie_productores.superficie_ha` — **total nacional 2020-2025** | **C**, con nota | 177.533 ha coincide con benchmark externo del usuario | Documentar fuente; **2025 incompleto (8/12 meses)**, no bloquea pero hay que marcarlo "parcial" en la UI |
| `superficie_productores.productores` | **D** en los 8 tramos de interpolación lineal perfecta (§2.3) | T3 | Conservar solo los años ancla (extremos de cada tramo), NULL el resto hasta conseguir fuente real |
| `superficie_productores` — **2024=2025 clon** (ambas columnas) | **D** | T1 | Mismo tratamiento que el clon de producción |
| `ym.competencia` | **A** | Ya auditada Fase 8, fuente citada por fila | Sin cambios |
| `ym.inym_hoja_verde_zona` / `inym_salida_molino` | **A** | Fuente citada, PDFs reales, pasa todos los tests | Sin cambios — es la fuente de reemplazo para producción/cosecha mensual |
| `ym.clima_mensual` / `indec_series` / `bcra_rem` / `precios_gondola` | **A** | Fuente citada, APIs públicas verificables | Sin cambios (no se corrieron T1-T6 por ser de bajo riesgo, no por no importar — queda para una segunda pasada si se quiere ser exhaustivo) |
| "Producción por ciudad" (label del mapa/tabla de Producción) | **E** | Son 7 buckets (6 ciudades + "Otros"), Apóstoles = 52,2% del total con 92.669 ha declaradas — más del 50% del área cultivada real de TODO el país (177.533 ha) concentrada en un solo punto | Renombrar a algo como "Producción por zona de reporte INYM" o migrar a las ~19 unidades geográficas reales que ya están en `inym_gis.raw_features` (capas de superficie por departamento) |
| Discrepancia mapa (918.060.675) vs. KPI (986.737.611) 2025 | **No es un problema de datos** | Bug de frontend confirmado — ver §5 | Agregar "Otros" a `COORDENADAS_CIUDAD` en `produccion/page.tsx`, o excluirlo también del KPI con una nota explícita |

---

## 4. Casos puntuales pedidos por el usuario

### 4.1 — Producción/Consumo/Exportado 2025 clonados de 2024
Confirmado, cuantificado y con causa raíz identificada (§2.1). El patrón (una sola fila nueva por
ciudad, con los mismos valores que la fila del año anterior) es consistente con "se agregó el año
2025 duplicando 2024 como placeholder y nunca se actualizó" — no hay indicio de manipulación
deliberada, es un olvido de carga, pero el resultado en el dashboard es el mismo: un año 2025
inventado. Los reemplazos reales disponibles ya en la base:
- Producción → `ym.inym_hoja_verde_zona` (zona TOTAL, ya usado en el heatmap desde 2026-07-11)
- Consumo interno → `ym.inym_salida_molino` (destino='interno')
- Exportaciones → **no hay reemplazo real cargado todavía**, ver Etapa 3

### 4.2 — Consumo per cápita 5,59 kg
El valor está en la base tal cual (`ym.consumo_interno` año 2025 = 5,59, mes de enero). No es un
clon (2024 = 5,62, distinto). Se investigó contra fuente primaria (§6): **el INYM no publica un
cierre oficial consistente de consumo per cápita**, así que no se pudo confirmar ni refutar el
benchmark del usuario (~5,7-5,8 kg) ni el valor cargado (5,59). Queda en categoría B — real,
sin fuente documentada — no en D. No corregir sin antes encontrar de dónde salió originalmente
este número.

### 4.3 — "Producción por ciudad" con 6 ciudades y Apóstoles 52%
Confirmado con el dato real de la base (§3, fila E). El detalle: `COORDENADAS_CIUDAD` en
`frontend/app/produccion/page.tsx` tiene 6 entradas (falta "Otros"); la tabla/KPI de "distribución
por ciudad" sí usa las 7. Apóstoles = 52,2% del total nacional en enero 2025, con 92.669 ha
declaradas solo para esa ciudad — la cifra de superficie real y validada para **todo el país** es
177.533 ha (§2.6), o sea que "Apóstoles" solo, tal como está cargado, representa más de la mitad
del área cultivada de yerba mate de toda la Argentina. Las capas GIS del INYM ya cargadas
(`inym_gis.raw_features`, categoría "límites", nivel "departamento") tienen la distribución real
por las ~19 unidades geográficas que sí reporta el INYM (ver Fase 3e en TODO.md) — son la fuente
correcta para reemplazar esta vista.

### 4.4 — Estacionalidad mensual clonada
Confirmado y cuantificado en §2.5 — es, con diferencia, el hallazgo con la evidencia estadística
más contundente de toda la auditoría (correlación exacta 1,000 en el 100% de los pares posibles).

### 4.5 — Rendimiento kg/ha y superficie 177.533 ha
La superficie (177.533 ha, 2020-2025) es real (§2.6). El rendimiento (`kg producidos / ha`) SÍ
hereda el problema del numerador: para 2025 usa `produccion_kg` clonado de 2024, así que el
"rendimiento 2025" que muestra hoy el dashboard es matemáticamente `producción_2024 / superficie_2025`
disfrazado de dato 2025 — no es un rendimiento real de esa campaña. La función
`agregarRendimientoAnual` en sí está bien escrita (evita el bug de sumar 12 meses de superficie),
el problema es 100% el dato de entrada.

### 4.6 — Precio promedio USD/kg: 2,30 vs 2,22 vs 2,50
**No es una inconsistencia** — son tres años distintos, cada uno correcto dentro de su propia fila:
2019/2020/2021 = 2,30; 2024 = 2,22; 2023 = 2,50 (verificado con `AVG(precio_usd_kg)` y también con
el precio implícito `SUM(valor_fob_usd)/SUM(exportaciones_kg)`, que coinciden entre sí al centavo
— la tabla es internamente consistente). El único riesgo real es de UX: si dos pantallas muestran
años distintos sin dejarlo claro, un usuario puede leerlo como una contradicción cuando no lo es.
No amerita cambio de dato, sí quizás mejorar el label ("Precio promedio {año}") si no lo tiene ya.

---

## 5. Discrepancia mapa (918.060.675) vs. KPI (986.737.611) para 2025

Causa raíz confirmada en el código, no en los datos:

- El KPI usa `agregarProduccionAnual` (`frontend/lib/agregaciones.ts`), que suma `produccion_kg`
  de **las 7 ciudades** → 2025 = 986.737.611 kg (el valor clonado de 2024, ver §4.1).
- El mapa usa `produccionPorCiudadAnioMap` (`frontend/app/produccion/page.tsx`), que solo agrega
  una ciudad si tiene coordenadas en `COORDENADAS_CIUDAD` — un diccionario a mano con **6**
  entradas. Falta "Otros". El mapa excluye esa ciudad en silencio (`if (!coords) continue;`).
- 986.737.611 − 68.676.936 (producción anual de "Otros" 2025, clonada de 2024) = **918.060.675** —
  exacto.

No hay dos fuentes de datos en conflicto: es una sola fuente (ya de por sí sintética para 2025,
§4.1) leída dos veces con dos criterios de inclusión distintos. Se corrige agregando "Otros" a
`COORDENADAS_CIUDAD` (con alguna coordenada representativa o un tratamiento explícito de "sin
ubicación puntual"), o documentando explícitamente que el mapa excluye producción sin geolocalizar.

---

## 6. Benchmarks contra fuente primaria (T8)

Se verificaron los 7 benchmarks del usuario contra fuente primaria (comunicados oficiales del INYM
en `inym.org.ar`, y prensa especializada que cita al INYM explícitamente). Resultado: **triple
confirmación** para producción y consumo — el número interno (scraper PDF), el benchmark del
usuario y el comunicado oficial del INYM coinciden entre sí, lo que a la vez valida
`ym.inym_hoja_verde_zona`/`ym.inym_salida_molino` como fuentes confiables y confirma que el clon
2024=2025 de `dataset_principal` está definitivamente mal.

| # | Cifra | Real (fuente primaria INYM) | vs. benchmark del usuario | vs. dato interno ya cargado | vs. `dataset_principal` (clonado) |
|---|---|---|---|---|---|
| 1 | Producción 2024 | **986.737.613 kg** (+27,4% i.a.) | Coincide | `hoja_verde_zona` TOTAL 2024 = 985.041.806 (Δ 0,17%) | `dataset_principal` 2024 = 986.737.611 — **coincide casi exacto** (valida que el total anual de 2024 SÍ es real) |
| 2 | Producción 2025 | **889.253.083 kg** (-9,9% i.a.) | Coincide | `hoja_verde_zona` TOTAL 2025 = 884.418.556 (Δ 0,5%) | `dataset_principal` "2025" = 986.737.611 (= 2024 clonado) — **11% más alto que el real, confirmado mal** |
| 3 | Exportaciones 2025 | **57.980.911 kg** (+32,2% i.a.); USD/precio solo en prensa secundaria, sin confirmar en el comunicado oficial | Coincide en volumen; nota — otra fuente (economis.com.ar) da 60.011.180 kg, posible diferencia de metodología aduana/INDEC vs. INYM | No hay tabla real cargada para exportaciones (ver Etapa 3) | `dataset_principal`/`ym.exportaciones` "2025" = 44.019.306/307 (= 2024 clonado) — **24% más bajo que el real, confirmado mal** |
| 4 | Consumo interno 2025 | **266.788.512 kg** (+3,1% i.a., recuperación confirmada) | Coincide exacto | `inym_salida_molino` interno 2025 = 266.834.656 (Δ 0,02% — prácticamente idéntico) | `dataset_principal` "2025" = 258.813.659 (= 2024 clonado) — **confirmado mal, y en la dirección contraria (el real subió, el clon lo muestra plano)** |
| 5 | Consumo per cápita 2025 (~5,7-5,8 kg) | **No confirmado** — el INYM no publica de forma consistente un cierre oficial de per cápita; valores dispersos en prensa (5,9-6,5 kg según fuente/período) | Sin verificar | `ym.consumo_interno` 2025 = 5,59 kg | — |
| 6 | Cosecha ene-abr 2026 | **151.910.206 kg** confirmado exacto, pero es corte YTD parcial (4 meses), no anual. El calificativo "peor arranque en 5 años" no cierra aritméticamente contra los propios datos citados (2023 fue menor: 125,1 M kg) — es interpretación de prensa, no dato INYM | Volumen exacto, calificativo cualitativo no verificado | `dataset_principal` no tiene 2026 cargado | — |
| 7 | Mercado interno por empresa 2025 (Playadito 56,7 M kg/22%, Las Marías 49,05 M kg) | Kilos confirmados exactos. El INYM usa **dos bases distintas**: 266,8 M kg "yerba pura" vs. ~296 M kg "yerba empaquetada" (incluye mezclas) — el ranking por marca usa la segunda. El 22% de Playadito solo cierra sobre 266,8 M kg (da ~21,3%); sobre la base correcta (~296 M kg) es ~19,2% | Kilos correctos, el "total ~267 M kg" no es la base correcta para ese ranking específico | `ym.competencia` no tiene 2025 completo cargado (ver Fase 8, cobertura parcial) | — |

**Conclusión de T8**: no se pudo verificar el benchmark de consumo per cápita 2025 (queda como
categoría B, no D — no hay evidencia de que 5,59 esté mal, solo que no está confirmado). Todo lo
demás con fuente primaria disponible confirma, con dos y hasta tres fuentes independientes
coincidiendo entre sí, que **el clon 2024=2025 de `dataset_principal` es un dato objetivamente
incorrecto** en las tres columnas (producción, consumo, exportaciones), no solo "sospechoso".

---

## 7. Lista priorizada para el saneamiento (Etapa 4 — pendiente de tu OK)

1. **2025 completo de `dataset_principal`** (produccion/consumo/exportaciones_kg, 7 ciudades):
   NULL, reemplazar producción y consumo por las fuentes reales ya cargadas (hoja_verde_zona,
   salida_molino). Exportaciones queda NULL hasta conseguir fuente real.
2. **Desglose mensual de `dataset_principal`** (produccion/consumo/exportaciones/valor_fob, todos
   los años): NULL a nivel mensual, conservar el total anual (categoría C). El heatmap de
   Producción ya migró a la fuente real — falta hacer lo mismo en el resto de los charts/tablas
   mensuales de Producción, Consumo y Exportaciones.
3. **`ym.exportaciones` por destino**: mismo tratamiento que el punto 1/2 en cuanto a mensual/2025;
   buscar fuente real para exportaciones (mayor prioridad de research, no hay reemplazo cargado).
4. **`consumo_interno.mix_envases` 2011-2024**: NULL, conservar solo si se consigue año real del
   cambio.
5. **`superficie_productores.productores`**: NULL en los 8 tramos interpolados, conservar los años
   ancla.
6. **`superficie_productores` 2024=2025**: NULL 2025 hasta reconfirmar contra fuente real (además,
   completar los 4 meses faltantes de 2025 u homogeneizar el criterio de "año incompleto").
7. **`importaciones.volumen_kg` 2011-2018**: confirmar si hay fuente real o degradar a NULL.
8. **Relabel "Producción por ciudad" → caso E**: aclarar que son 7 buckets de reporte, no unidades
   geográficas reales; evaluar migrar a las capas GIS por departamento.
9. **Fix del bug de frontend** (§5): agregar "Otros" a `COORDENADAS_CIUDAD` o excluirlo también del
   KPI con nota visible.
10. **Documentar fuente primaria** de todo lo que hoy es categoría B (precio_usd_kg/valor_fob_usd,
    consumo per cápita, importaciones post-2019, precios hoja verde/canchada, superficie/productores
    en sus tramos válidos) — sin esto, quedan indocumentados aunque no se toquen los valores.

No se tocó ningún dato ni componente todavía. Quedo a la espera de tu OK sobre este informe antes
de tocar código o valores en la base.

---

## 8. Sobre `backend/etl/audit_datos.py`

Script de solo lectura, reutilizable. Uso:

```
python backend/etl/audit_datos.py                    # corre las 15 series registradas, imprime resumen
python backend/etl/audit_datos.py --json out.json     # además vuelca el detalle completo a JSON
python backend/etl/audit_datos.py --series "dataset_principal.produccion_kg"   # solo una serie
```

Implementa T1 (duplicados exactos año a año), T2 (constantes repetidas 3+ meses), T3 (interpolación
lineal perfecta), T4 (sumas que cierran siempre en 100%), T5 (correlación de estacionalidad entre
años) y T6 (valores idénticos entre entidades distintas en el mismo período). T7 (consistencia
cruzada entre tablas) y T8 (contra benchmarks externos) se hicieron como queries ad-hoc en esta
sesión (ver §2.6 y §5) — quedan **pendientes de formalizar dentro del script** si se quiere que
corra en CI (regla 4 de la Etapa 4 que pediste), porque requieren declarar a mano qué pares de
tablas representan "el mismo indicador real" y qué benchmarks externos usar.

El script termina con `exit(1)` si encuentra T1/T2/T3/T4 en una serie que no esté marcada como
`permite_repeticion_anual=True` (el patrón ya documentado de "dato anual publicado con cadencia
mensual") — pensado para engancharse a CI apenas se decida el saneamiento, tal como pediste en la
regla 4.
