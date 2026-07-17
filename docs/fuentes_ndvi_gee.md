# Fuente: NDVI satelital por departamento (Google Earth Engine, MODIS/061/MOD13Q1)

Variable del **Modelo 1 de Fase 5** (Producción por departamento, ver
`TODO.md`) — índice de vegetación (NDVI) mensual, agregado por los 19
departamentos reales de Misiones/Corrientes ya cargados en `inym_gis`.

## Fuente primaria

`MODIS/061/MOD13Q1` (Terra Vegetation Indices 16-Day, 250m), catálogo público
de Google Earth Engine: `developers.google.com/earth-engine/datasets/catalog/MODIS_061_MOD13Q1`.
Cobertura real: 2000-02-18 hasta ~3 semanas antes de la fecha actual (latencia
de procesamiento de NASA/USGS, no un hueco de nuestro ETL).

Composite de 16 días (no mensual nativo) — cada píxel del compuesto es el
valor de mayor calidad observado en esa ventana. Bandas relevantes:
`NDVI` (entero, factor de escala 0.0001) y `SummaryQA` (0=buena, 1=marginal,
2=nieve/hielo, 3=nublado).

## Método

`backend/etl/etl_gee_ndvi.py`:

1. Lee las 19 geometrías reales de departamentos desde
   `inym_gis.v_features_4326` (capa `view_superficie_por_departamentos`, las
   mismas que ya usa Mapa GIS y "Superficie cultivada por departamento" en
   Producción) — simplificadas con `ST_SimplifyPreserveTopology` (tolerancia
   0.001°) para acelerar el cómputo, no hace falta precisión de vértice para
   un promedio de zona a resolución de 250m.
2. Por cada mes calendario: filtra los composites de 16 días de MOD13Q1 que
   caen en ese mes (normalmente 1-2), enmascara por `SummaryQA<=1` (descarta
   nieve/hielo y nublado), promedia, y corre `reduceRegions` (mean + count)
   sobre las 19 geometrías en una sola llamada server-side.
3. `ndvi_promedio` queda `NULL` si el departamento quedó 100% cubierto de
   nubes ese mes (no se rellena ni se interpola) — `pixeles_validos` es la
   cantidad de píxeles de 250m que sí pasaron el filtro de calidad, sirve
   como indicador de cobertura/confianza del promedio.

## Autenticación (importante, no es una API key simple)

Earth Engine no usa una API key de un solo string. Se evaluó primero una
**cuenta de servicio** (patrón estándar para ETLs de este proyecto) pero la
política de organización de Google Cloud del usuario
(`iam.disableServiceAccountKeyCreation`) bloquea la descarga de la clave
privada — protección de seguridad que Google aplica por default en cuentas
nuevas, no algo que valga la pena desactivar para un caso de uso individual.

Se usa en su lugar **autenticación interactiva** (`ee.Authenticate()`,
`auth_mode='localhost'`): un login único por navegador con la cuenta de
Google del usuario, que guarda un token OAuth en
`~/.config/earthengine/credentials` de la máquina donde se corrió. Esto
significa que el ETL **solo puede correr en una máquina donde ya se hizo ese
login** — no es compatible tal cual con GitHub Actions/CI (a diferencia del
resto de los ETLs de este proyecto, que solo necesitan `DATABASE_URL`). Si en
el futuro hace falta correrlo desde CI, hay que migrar a Workload Identity
Federation (la alternativa que la propia consola de Google recomienda en vez
de claves de cuenta de servicio) o pedir que se desactive la política
org-wide, ninguna trivial.

`GEE_PROJECT_ID` en `.env` es el proyecto de Google Cloud asociado (creado
automático al registrarse en el tier no comercial de Earth Engine).

## Costo

Gratis para uso no comercial (tier registrado en
`earthengine.google.com/noncommercial/`) — desde el 27/04/2026 Google aplica
una cuota mensual de cómputo gratis por tier, no ilimitado como antes. El
backfill completo de este ETL (~186 meses × 19 departamentos, un
`reduceRegions` por mes) es una fracción muy chica de esa cuota.
