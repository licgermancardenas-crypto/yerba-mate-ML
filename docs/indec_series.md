# Series INDEC vía API de series de tiempo (datos.gob.ar)

Base URL: `https://apis.datos.gob.ar/series/api/series/`
Búsqueda: `https://apis.datos.gob.ar/series/api/search/?q=<término>`
Formato: JSON, sin autenticación. Parámetros: `ids`, `limit` (máx 1000), `sort` (`asc`/`desc`), `format`.

**Estado confirmado 2026-07-01**: el catálogo original es de la ex Subsecretaría
de Programación Macroeconómica (`sspm`, creado 2017), pero las series de INDEC
que usamos se siguen actualizando ahí con normalidad (no está discontinuado
para estos IDs puntuales, aunque el catálogo en general tiene series viejas
"SERIE DISCONTINUADA" mezcladas con series vivas — hay que verificar cada ID).

## Series confirmadas y en uso (`backend/etl/etl_indec_series.py`)

| serie_nombre | id | descripción | base/unidad | cobertura confirmada |
|---|---|---|---|---|
| `ipc_nacional_nivel_general` | `148.3_INIVELNAL_DICI_M_26` | IPC Nacional, nivel general, mensual | índice, dic-2016=100 | 2016-12 → 2026-05 |
| `emae_nivel_general` | `143.3_NO_PR_2004_A_21` | EMAE, nivel general, índice original (no desestacionalizado), mensual | índice, base 2004 | 2004-01 → 2026-04 |
| `ipc_gba_yerba_mate` | `105.1_I2YM_2016_M_19` | IPC-GBA, precio específico de yerba mate, mensual | índice, dic-2016=100 | 2016-04 → 2026-05 |

Lag de publicación observado: ~1-2 meses respecto a la fecha de corrida (a
2026-07-01, el dato más reciente disponible era 2026-05 para IPC y 2026-04
para EMAE).

`ipc_gba_yerba_mate` es más útil que un IPC genérico de "infusiones" para el
Modelo 2 (consumo interno) porque aísla el precio del producto específico —
ojo que es GBA, no nacional (INDEC no publica IPC de yerba mate a nivel país
por producto, solo por región).

## Buscadas y descartadas

- **Comercio exterior NCM "café, té, yerba mate y especias"** (ids
  `162.x_XFE_TE_IAS_...`, `75.2_ICTYME_0_T_31`): vienen agregadas con otros
  productos del mismo capítulo arancelario, no aíslan yerba mate. Los datos
  de `ym.exportaciones` (fuente INYM, ya cargados) son mejores: yerba mate
  pura, por país destino, mensual. No vale la pena duplicar con una serie
  peor.
- **Proyecciones de población por provincia (Censo 2022)**: no aparece una
  serie nacional limpia en esta API — lo que hay son proyecciones viejas
  post-Censo 2010 (`obras_07_03_*`, hasta 2022) de un catálogo de
  indicadores sociodemográficos, no series de tiempo per se. Si hace falta
  población real Censo 2022 por provincia, mejor ir directo a INDEC
  (censo.gob.ar / portalgeoestadistico) en vez de esta API — pendiente,
  baja prioridad (el consumo ya está normalizado per cápita en los datos
  del INYM, no depende de este dato para los modelos actuales).

## Cómo agregar una serie nueva

1. Buscar: `curl "https://apis.datos.gob.ar/series/api/search/?q=<término>&limit=10"`
2. Confirmar con `metadata=full` que el `dataset.title` y `distribution` son
   los esperados (los resultados de búsqueda mezclan series vigentes con
   descontinuadas del mismo tema).
3. Agregar el id a la lista `SERIES` en `etl_indec_series.py` — la tabla
   destino (`ym.indec_series`) es genérica, no hace falta migrar el schema.
