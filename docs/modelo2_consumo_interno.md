# Modelo 2 (Fase 5) — Consumo interno: estado real, 2026-07-17

Arranque a pedido explícito del usuario, mismo día que se cerró el Modelo 1.

## 1. Corrección de target (mismo patrón que Modelo 1)

`ym.consumo_interno.consumo_per_capita_kg` es un dato **anual** publicado
con cadencia mensual (mismo valor los 12 meses, cambia solo año a año —
ya documentado en `TODO.md` desde julio). No sirve como target de un
SARIMAX mensual — no hay variación intra-anual real que modelar.

Target real usado: `ym.inym_salida_molino` (`destino='interno'`) — salida
de molino hacia el mercado interno, real y mensual desde 2008 (scraper PDF
INYM, Fase 3c). Mide un punto distinto de la cadena que "consumo final"
(más cerca de fábrica) pero es la única serie mensual real disponible de
ese lado. Nacional, sin desglose geográfico (no hizo falta resolver
granularidad esta vez).

## 2. Variables

- ✅ **Precio relativo**: `ipc_gba_yerba_mate / ipc_nacional_nivel_general`
  (las dos ya cargadas, categoría A)
- ✅ **Salario real**: `ripte / ipc_nacional_nivel_general` — RIPTE
  (Remuneración Imponible Promedio de los Trabajadores Estables, INDEC/
  Trabajo) cargado nuevo esta sesión (`etl_indec_series.py`, serie
  `158.1_REPTE_0_0_5`, real, mensual 1994-2026 -- elegido sobre el "Índice
  de Salarios" general de INDEC porque ese solo arranca en 2016-10, RIPTE
  cubre todo el rango necesario)
- ✅ **Dummy Día del Mate** (30/11): trivial, `mes == 11`
- IPC/RIPTE solo tienen serie limpia desde 2016 -- el panel completo va
  2008-2026 (todo el rango real del target), los predictores quedan NaN
  antes de 2016, no se rellena.

## 3. Estacionalidad: mucho más débil que en Producción

Promedio mensual del target: mínimo ~19-20M kg (dic/ene), máximo ~23M kg
(jul/ago) -- solo ~20% de diferencia. Muy distinto del Modelo 1 (casi cero
en el valle vs. picos de decenas de millones) -- consistente con ser un
bien de consumo cotidiano, no una cosecha agrícola.

## 4. Baseline SARIMA + exógenas (`backend/ml/modelo2_baseline.py`)

Walk-forward real (reentrena en cada paso), sobre `log(salida_molino_interno_kg)`
(seguro, serie siempre positiva, mínimo real 13M kg).

| | MAPE |
|---|---|
| Baseline, 60 meses de test (todo el rango disponible) | **6,3%** |
| Baseline, mismo rango recortado que la prueba con exógenas | 7,6% |
| Con exógenas (precio relativo + salario real) | 8,0% |

**Mismo patrón que el Modelo 1**: las exógenas macro no mejoran el modelo
(el baseline gana en la comparación directa sobre el mismo rango). A
diferencia del Modelo 1, acá la muestra ya es grande (n=60) desde la
primera prueba -- no hizo falta una segunda ronda para confirmarlo.

El baseline solo ya es bastante bueno (6,3% MAPE) -- mucho mejor que el
20-25% del Modelo 1, esperable dado que el consumo de un bien cotidiano es
más estable que una cosecha sujeta al clima.

## 5. Dónde falla el baseline

Los peores errores del walk-forward se concentran en **marzo-junio 2024**
(4 de los 6 peores meses), todos con el modelo **sobreestimando** --
consumo real por debajo de lo que el patrón estacional histórico
anticipaba. Coincide con el contexto macro real conocido: 2024 fue un año
de recesión fuerte y caída pronunciada del salario real en Argentina. No
investigado con más profundidad en esta sesión (no se armó una variable
específica de "shock macro" -- el intento de usar salario real como
exógena mensual ya se probó y no ayudó, ver §4).

## 6. Estado y próximo paso real

**Modelo 2 v1 = baseline estacional (SARIMA), sin exógenas.** Igual
conclusión que el Modelo 1: la versión más simple superó a las
alternativas probadas.

Pendiente real, no bloqueante:
- El error se concentra en shocks macro agudos (2024) -- no probado si una
  variable de crisis/recesión (ej. variación interanual del salario real,
  no el nivel) ayudaría más que el nivel de salario real usado acá.
- No integrado al frontend (`/predicciones` sigue "Coming Soon").
