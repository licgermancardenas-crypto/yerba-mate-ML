# Modelo 1 (Fase 5) — Producción por zona: estado real, 2026-07-17

Arranque de Fase 5 a pedido explícito del usuario ("empecemos con el modelo
1"). Este documento registra lo investigado y probado en esta sesión —
incluye un hallazgo que cambia el título del modelo en `TODO.md` y dos
rondas de pruebas con resultado negativo, documentadas para no repetirlas.

## 1. Corrección de granularidad: zona, no departamento

`TODO.md` tenía el modelo como "Producción por departamento", pero **no
existe producción real en kg a nivel departamento** — el INYM nunca lo
publicó a ese nivel (mismo hallazgo que "Producción por ciudad" en julio,
ver `docs/auditoria_datos.md`). El target real es por **zona** (6 unidades:
Centro, Corrientes, Noreste, Noroeste, Oeste, Sur — `ym.inym_hoja_verde_zona`,
real, mensual, 2012-presente).

Verificado con `ST_Contains` que los 19 departamentos reales de `inym_gis`
caen 100% dentro de una sola zona cada uno (sin partirse entre dos) — así
que NDVI (por departamento) se agrega hacia arriba a zona sin fabricar
ningún desglose. Confirmado con el usuario: modelar por zona, no prorratear
producción a departamento (que hubiera sido una estimación nuestra, no un
dato real).

`ym.clima_mensual` (por ciudad, Fase 3d) solo cubre 4 de las 6 zonas — se
cargó `ym.clima_zona_mensual` nueva (migración 010, `etl_nasa_power_zona.py`)
consultando NASA POWER en el centroide de cada zona ponderado por
superficie cultivada real, no el centroide geométrico del polígono completo.

## 2. Panel de datos (`backend/ml/build_panel_modelo1.py`)

Zona x mes, 2012-2026 (877 filas), uniendo `hoja_verde_kg` (target),
`ndvi_promedio` (agregado de departamento a zona, ponderado por
`pixeles_validos`) y `clima_zona_mensual`. Missingness real: 0% en target y
NDVI, 3-4% en clima (huecos reales de NASA POWER, no interpolados).

## 3. Baseline estacional (`backend/ml/modelo1_baseline.py`)

SARIMA por zona sobre `log(hoja_verde_kg)` (transform seguro, la serie es
siempre positiva, mínimo real 6.500 kg). Walk-forward real (reentrena en
cada paso), últimos 24 meses de test. Orden elegido por AIC sobre 4
candidatos conservadores (no auto-ARIMA exhaustivo).

**Resultado**: MAE = 20-30% del promedio histórico de cada zona (razonable
para un primer baseline puramente estacional). El MAPE global salía
inflado (hasta 1000%) por los meses de valle (oct-nov, producción casi
cero) — artefacto conocido de esa métrica cerca de cero, no un modelo malo.

## 4. ¿Ayuda NDVI/clima como exógena? — NO, probado dos veces

**Primera ronda**: correlación de anomalías mensuales (valor de cada mes
menos el promedio histórico de ESE mes calendario, para aislar la señal
real de la estacionalidad pura) contra `hoja_verde_kg` — precipitación y
temperatura dieron prácticamente cero (-0,03 a +0,02), NDVI dio la única
señal débil-moderada (0,16-0,25 en Corrientes/Sur, casi nula en el resto).

**Segunda ronda** (`modelo1_exog_comparacion.py`, evaluación mucho más
robusta — 9 años de test en vez de 2, 18 puntos por variante en vez de 4):
se probó un indicador de "atraso de temporada" (anomalía de NDVI y de
lluvia acumulada de enero-febrero, sin leakage -- el promedio histórico de
referencia excluye el año evaluado) como exógena SOLO en marzo/abril,
específicamente apuntado al problema real encontrado (ver §5). Resultado:
**el baseline sin exógena gana o empata en 5 de las 6 zonas**. NDVI empeora
el modelo en las 6 zonas sin excepción. Lluvia queda neutral.

Conclusión: con datos mensuales, ni NDVI ni lluvia acumulada mejoran el
modelo de forma medible. Quedan cargados en la base (son datos reales y
reusables) pero no se usan como exógenas activas en este modelo por ahora.
No se descarta que otra forma de featurizarlos (ventanas más largas,
variables no lineales) funcione mejor -- no se probó, ver §6.

## 5. Por qué Centro anda peor que el resto

Centro tiene el error más alto en temporada alta (54,8% vs. 20-25% del
resto). Investigado: **2024 fue un año de arranque de temporada fuerte**
(marzo 22M kg, abril 45M kg) y **2025 y 2026 fueron consecutivamente
tardíos/débiles** (marzo 2025 = 2,2M kg vs. 22M el año anterior; marzo 2026
= 6,4M kg; abril de ambos años muy por debajo del promedio histórico de
31,5M kg). El baseline, entrenado con el patrón 2012-2024, no lo vio venir.

Esto no es exclusivo de Centro (Noreste y Oeste también tienen marzo/abril
muy variables año a año, ~50% de coeficiente de variación) pero la ventana
de test de Centro (2024-2026) coincidió con dos años seguidos de arranque
tardío real.

## 6. Hipótesis regulatoria (evidencia parcial, no concluyente)

Investigado a pedido del usuario ("¿alguna ley o decreto en el pasado?").
Proceso de desregulación yerbatera en curso desde 2023:

- **Dic 2023** (DNU 70/23): le quita al INYM la potestad de fijar precios
  de la materia prima.
- **Nov 2025** (Decreto 812/2025): prohíbe al INYM intervenir en el mercado
  o fijar precios, lo redefine como solo controlador de calidad.
- **Ene 2026** (Resolución 2/2026, INYM): **elimina la veda de cosecha
  octubre-noviembre** que existía históricamente, + reduce controles de
  calidad/trazabilidad (deroga Resoluciones 152/2021, 373/2021, 347/2021).

Si antes estaba prohibido cosechar en oct-nov, una porción de esa cosecha
se acumulaba forzosamente para marzo-abril. Al liberar el calendario, parte
de "abril más bajo de lo normal" en 2025-2026 podría no ser una demora
real sino cosecha que se corrió a meses antes prohibidos.

**Evidencia real encontrada, con matices**: histórico de octubre/noviembre
en las 6 zonas (14 años) es casi siempre NULL o mínimo (6.500 a 1,15M kg
máximo). **Corrientes, octubre 2025 = 2.371.274 kg** — 2 a 90 veces más
grande que cualquier otro valor de oct/nov en todo el dataset. Matices
honestos: (a) la veda se eliminó formalmente recién en enero 2026, este
dato es de octubre 2025 -- puede ser relajación de facto anticipada al
proceso de desregulación, o que Corrientes no estuviera sujeta a la misma
veda que Misiones; (b) es un solo dato puntual en una sola zona --
noviembre 2025 de Corrientes volvió a caer a 28.760 kg, en línea con lo
histórico. Sugestivo pero no concluyente.

**Implicancia real para el modelo**: si el calendario de cosecha
efectivamente cambió de forma estructural, el período 2012-2024 y
2025-presente podrían no ser directamente comparables para un modelo
estacional fijo -- vale la pena revisar esto cuando haya más datos
post-liberalización (recién un año de transición hasta ahora).

## 7. Estado y próximo paso real

**Modelo 1 v1 = baseline estacional puro (SARIMA por zona), sin exógenas.**
Es la versión más simple e interpretable que superó a todas las
alternativas probadas -- consistente con la regla del TODO ("modelos
interpretables preferibles a black-box", "ser conservador en complejidad").

Pendiente real, no bloqueante:
- Revisar el efecto del cambio regulatorio con más datos post-enero 2026
  (recién arrancó, un año no alcanza para separar señal de ruido).
- Si se quiere insistir con clima/NDVI, probar ventanas acumuladas de
  varios meses en vez de anomalía de un mes puntual (no se probó en esta
  sesión).
- El modelo no está integrado al backend/frontend todavía (`/predicciones`
  sigue "Coming Soon") -- eso es un paso aparte, no evaluado en esta sesión.
