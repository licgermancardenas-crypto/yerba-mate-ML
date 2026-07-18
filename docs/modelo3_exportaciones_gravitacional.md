# Modelo 3 (Fase 5) — Exportaciones (gravitacional): estado real, 2026-07-18

Arranque a pedido explícito del usuario, mismo día que se cerró el Modelo 2.

## 1. Diseño distinto a los Modelos 1 y 2

Un modelo gravitacional de comercio es un **panel país x año** (regresión
cross-sectional/panel), no una serie de tiempo univariada -- distinto en
naturaleza a los SARIMAX de Producción/Consumo. Confirmado con el usuario
antes de construir nada.

## 2. Alcance: 20 países, no los 87 reales

`ym.exportaciones_indec` tiene 87 destinos reales (2002-2026), pero el
comercio está brutalmente concentrado: **Siria + Chile + Brasil = 86,3%
del volumen total**, y 48 de 86 países tienen menos de 100.000 kg en 24
años (embarques sueltos, ruido estadístico). Restringido a los **20
destinos con volumen real y consistente** (2011-2025) -- ajustar el modelo
a los 87 hubiera significado ajustar mayormente ruido.

## 3. Fuentes nuevas cargadas esta sesión

- ✅ **PBI por país** (`ym.pbi_pais_anual`, migración 011,
  `etl_pbi_paises.py`): Banco Mundial, indicador `NY.GDP.MKTP.CD`, USD
  corrientes, anual, 2011-2025, los 20 países. 295/300 filas con dato real
  -- **Siria (nuestro destino #1) sin PBI publicado 2023-2025** (guerra
  civil, hueco real del Banco Mundial, no un bug nuestro). Emiratos y
  Líbano tampoco tienen 2025 todavía (rezago normal de publicación).
- ✅ **Tipo de cambio oficial** (`ym.tipo_cambio_anual`, `etl_tipo_cambio.py`):
  ArgentinaDatos, cotizaciones diarias "oficial" agregadas a promedio
  anual, 2011-2026 (16 años, cobertura diaria casi completa cada año). Más
  largo y mejor que el BCRA REM ya cargado (`ym.bcra_rem`, solo 14 meses).
- **Distancia geográfica**: no es una fuente nueva -- se calculó (haversine
  desde Buenos Aires) reusando las coordenadas de capital ya cargadas en
  `frontend/lib/paises-destino.ts` (del mapa de flujos de exportaciones).
- **Dummy diáspora** (Siria + Líbano = 1): no es un dato, es el supuesto
  de negocio ya documentado desde el planeamiento original.

## 4. Regresión (`backend/ml/modelo3_gravitacional.py`)

```
log(volumen_kg) = b0 + b1*log(PBI) + b2*log(distancia_km)
                   + b3*dummy_diaspora + b4*log(tipo_cambio) + e
```

OLS sobre 232 de 300 observaciones posibles (77% -- el resto sin dato real
de volumen, PBI o tipo de cambio ese país-año, se excluyen, no se imputan).

| Variable | Coeficiente | p-valor | Lectura |
|---|---|---|---|
| PBI destino (log) | +0,335 | <0,001 | Signo correcto, significativo -- países más ricos importan más |
| Distancia (log) | -0,859 | <0,001 | Signo correcto, significativo -- decae con la distancia, como predice la teoría de gravedad |
| **Dummy diáspora** | **+4,789** | **<0,001** | **exp(4,79) ≈ 120x más volumen** -- el hallazgo central |
| Tipo de cambio (log) | -0,026 | 0,637 | **No significativo** -- mismo resultado que clima/NDVI (Modelo 1) y salario/precio relativo (Modelo 2): las exógenas macro no aportan en este diseño |

R² = 0,423 (42% de la varianza explicada).

**El hallazgo central**: lo que estaba documentado como "supuesto de
negocio crítico" desde el planeamiento original (Siria importa por
diáspora histórica, no por gravedad económica pura) queda **cuantificado
con estadística real y muy significativa** -- la diáspora multiplica el
volumen esperado por ~120x sobre lo que predicen PBI y distancia solos.

## 5. Predicción a futuro: floja, y es esperable

Walk-forward por año (entrena con años anteriores, predice el año
siguiente, últimos 5 años = 2021-2025): **145% de MAPE global**, muy
variable por país -- bien en algunos (Francia 1,9%, Polonia 29%,
Emiratos 12%), mal en otros (Israel 608%, Líbano 727%, China 280%).

Esto es una limitación real del método, no un bug: con un panel chico
(~15 años, países con comercio muy irregular año a año) un modelo
gravitacional cross-sectional sirve para **entender qué mueve el
comercio** (los coeficientes, con toda su significancia estadística) más
que para **predecir con precisión el volumen exacto del año próximo** a
nivel de un país individual -- es la naturaleza estándar de este tipo de
modelo en la literatura de comercio internacional, no algo específico de
esta implementación.

## 6. Nota metodológica: por qué no se modelan los ceros

~21% de las combinaciones país-año no tienen volumen real (dato no
publicado, no necesariamente cero real). El log-log estándar no admite
cero ni NaN, así que esas filas se excluyen de la regresión -- supuesto
simplificador. Un modelo **PPML (Poisson Pseudo-Maximum-Likelihood)**
sería más riguroso para manejar ceros de comercio reales sin descartarlos
-- no implementado en esta v1, queda como mejora pendiente si se quiere
profundizar.

## 7. Estado y próximo paso real

**Modelo 3 v1 = regresión gravitacional log-log, 20 países.** Fuerte para
explicar el patrón estructural del comercio (coeficientes muy
significativos, diáspora cuantificada), débil para pronosticar el volumen
exacto del año próximo por país -- limitación esperada del método con un
panel de este tamaño, no un defecto de implementación.

Pendiente real, no bloqueante:
- Probar PPML en vez de OLS log-log (maneja los ceros reales sin descartarlos).
- Ampliar la cobertura de PBI de Siria si el Banco Mundial publica 2023+
  en el futuro (guerra civil sigue sin datos).

## 8. Integración a frontend

`backend/ml/scoring_modelo3.py` reentrena la regresión de §3 sobre TODO
`df` (sin split) y persiste dos cosas distintas en `ym.ml_predicciones`
(`modelo='modelo3_exportaciones'`):

- **Ajustado-vs-real** (`fitted_vs_actual`): una fila por país-año real
  del panel, `es_pronostico=false`, con `valor_real`/`valor_predicho`/IC
  del *mean* de `get_prediction().summary_frame()`. Es la pieza
  explicativa (qué tan bien el modelo explica el patrón ya observado).
- **Proyección año próximo** (`proyeccion_siguiente_anio`): una fila por
  país, `es_pronostico=true`, asumiendo PBI y tipo de cambio congelados en
  el último dato real conocido de cada país por separado (Siria y Líbano
  quedan en años distintos al resto, ver §4/§6) -- el supuesto exacto por
  país queda en la columna `supuestos`, nunca implícito.

Se sirve por `GET /predicciones?modelo=modelo3_exportaciones&es_pronostico=<bool>`
y se muestra en `/predicciones` (tab "Exportaciones"): un
`ReliabilityBadge` de página con el R²/MAPE de este documento (el más
visible de los 3, es el modelo menos confiable para volumen exacto), 5
`ChartCard` de ajustado-vs-real (top 5 destinos) y la tabla completa de 20
países con la proyección + `ReliabilityBadge tipo="supuesto"` por fila.

## Con esto, los 3 modelos de Fase 5 tienen v1 completa, documentada e
integrada a `/predicciones` (`docs/modelo1_produccion_zona.md`,
`docs/modelo2_consumo_interno.md`, este documento).
