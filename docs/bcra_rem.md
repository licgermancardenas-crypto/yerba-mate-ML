# BCRA REM (Relevamiento de Expectativas de Mercado)

Fuente elegida: **API JSON de ArgentinaDatos** (mirror comunitario del REM),
no el Excel crudo que publica el BCRA — ya viene normalizado, cero trabajo
de parsing.

Endpoint por período: `https://api.argentinadatos.com/v1/rems/{año}/{mes}`
(ej. `/v1/rems/2026/03`). Sin auth. Cada informe mensual trae ~132 filas:
9 indicadores x varios horizontes de pronóstico (mensual/trimestral/anual).

Los endpoints `/v1/rems` y `/v1/rems/ultimo` documentados en el spec de
ArgentinaDatos **no sirven** para descubrir períodos ni para el último dato:
`/v1/rems/ultimo` devuelve `[]` (vacío) y `/v1/rems` solo devuelve
`["/rems/ultimo"]`. Hay que pedir los períodos directamente por año/mes.

## Indicadores disponibles (confirmado 2026-07-01)

- Precios minoristas (IPC nivel general-Nacional; INDEC) — **inflación esperada**, el dato clave para Modelo 2
- Precios minoristas (IPC núcleo-Nacional; INDEC)
- PIB a precios constantes — **PBI esperado**
- Tipo de cambio nominal
- Tasa de interés (TAMAR)
- Desocupación abierta
- Exportaciones
- Importaciones
- Resultado Primario del SPNF

Cada fila trae mediana/promedio/desvío/máximo/mínimo/percentiles (10/25/75/90)
y cantidad de participantes de la encuesta — permite usar la mediana como
punto estimado y el resto como banda de incertidumbre.

## LIMITACIÓN IMPORTANTE: ventana de datos corta

Se probó mes a mes desde 2019 hasta 2026: **solo hay datos entre 2025-04 y
2026-05** (14 meses a la fecha de esta prueba). Meses anteriores devuelven
404. Esta API comunitaria NO replica el histórico completo del REM (que en
el BCRA arranca ~2004) — parece ser un mirror que solo retiene una ventana
reciente.

**Implicancia para los modelos**: el REM sirve como insumo de expectativas
de mercado para el horizonte de pronóstico de Fase 5 (1-2 años hacia
adelante), no como regresor histórico para entrenar sobre 2011-2024. Si en
algún momento hace falta el REM histórico completo para walk-forward
validation, hay que parsear el Excel original del BCRA
(`bcra.gob.ar/PublicacionesEstadisticas/Relevamiento_Expectativas_de_Mercado.asp`,
multi-hoja, un archivo por informe) — no implementado, cada fila del JSON
ya trae el link (`xlsxUrl`) al Excel original de ese informe puntual si
hace falta ir a la fuente primaria.

## Tabla destino

`ym.bcra_rem` — estructura calcada de la fuente (ver `backend/db/schema.sql`),
PK `(informe, indicador, muestra, periodo, periodo_tipo)`, confirmada sin
duplicados en los 14 informes probados.
