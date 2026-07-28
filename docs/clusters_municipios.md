# Tipología productiva por municipio (clustering) — 2026-07-27

A pedido explícito del usuario ("se le puede agregar algún mapa o gráfico de
clusters o cohortes en algún concepto?"). Segmentación no supervisada
(K-means) de los municipios de Misiones+Corrientes por perfil productivo
real, usando datos ya cargados del INYM (nunca antes usados juntos).

## 1. Features consideradas y descartadas

Candidatas iniciales: % superficie cultivada, edad de plantación, densidad
de plantación, % cultivo consociado (las 4 capas GIS ya cargadas a nivel
municipio).

**Edad de plantación descartada**: el campo `anio` de
`view_superficie_edad_por_municipios` empaqueta un desglose año→hectáreas
con una categoría `S/D` (sin dato) grande. Verificado con SQL directo antes
de construir nada: en promedio solo **23,7%** de la superficie de cada
municipio tiene año de plantación registrado (mediana 18,9%, máximo 91,2%)
-- el resto es `S/D`. Insuficiente cobertura para confiar en un
`edad_promedio` calculado sobre ese subconjunto no representativo.

## 2. Features finales

- `pct_cultivado` = `sup_ym / superficie * 100` (ya usado en otros lados de la app).
- `pct_alta_densidad` = hectáreas en el bucket "ALTA Densidad" / total (parseado
  del campo empaquetado `densidad`, formato `"BAJA Densidad: X@...//MEDIA
  Densidad: Y@...//ALTA Densidad: Z@..."`).
- `pct_consociado` = `sup_cons / superficie * 100` (`sup_cons` ya viene
  numérico en `view_superficie_consociado_por_municipios`, no hace falta
  parsear texto para esta).

Estandarizadas (z-score) antes de clusterizar, dado que están en escalas
distintas (todas son % 0-100 en este caso, pero con rangos/varianzas muy
distintos entre sí).

## 3. Cobertura y k elegido

79 de 82 municipios tienen las 3 features completas (3 sin `pct_consociado`:
Cerro Corá, Santa Ana, Bompland -- quedan `cluster_id=NULL`, "Sin
clasificar (dato incompleto)", nunca se les inventa un grupo).

K-means probado con k=2..5 (`sklearn`, `random_state=42`, `n_init=10`),
silhouette score:

| k | silhouette | tamaños |
|---|---|---|
| 2 | 0,35 | [26, 53] |
| **3** | **0,48** | [50, 25, 4] |
| **4** | 0,47 | [46, 27, 4, 2] |
| 5 | 0,35 | [24, 23, 26, 4, 2] |

k=3 da el silhouette más alto, pero junta en un solo grupo "resto" 2
perfiles atípicos reales bien distintos (alta densidad vs. alto
consociado) que k=4 separa con una pérdida marginal de silhouette (0,47
vs 0,48). Se eligió **k=4** por ser más interpretable/útil, confirmado con
el usuario mostrando la composición real antes de construir el pipeline
completo (no solo el número de silhouette).

## 4. Resultado (composición real)

| Cluster | n | pct_cultivado | pct_alta_densidad | pct_consociado |
|---|---|---|---|---|
| Baja intensidad | 46 | 4,2% | 6,5% | 0,6% |
| Núcleo yerbatero | 27 | 15,9% | 7,0% | 2,1% |
| Alta densidad de plantación | 4 | 9,0% | 45,3% | 0,5% |
| Cultivo consociado intensivo | 2 | 30,6% | 2,5% | 7,1% |

Las etiquetas se asignan programáticamente por características reales del
centroide (`backend/ml/clusters_municipios.py::_etiquetar_clusters`), no
por el índice arbitrario que devuelve K-means -- estable entre corridas
aunque cambie el orden interno.

## 5. Persistencia e integración

`backend/ml/clusters_municipios.py` corre el pipeline completo (fetch →
parseo → clustering → etiquetado) y escribe el resultado como una capa GIS
nueva (`clusters_municipios`) en `inym_gis.raw_features`, reusando la
geometría real de `view_superficie_por_municipios` -- mismo mecanismo
genérico que cualquier otra capa (migración `013`, catálogo +
provenance). No es una tabla/endpoint aparte: se sirve automáticamente por
`GET /geo/clusters_municipios` (igual que las otras 19 capas) y aparece
seleccionable en el dropdown "Capa" de Mapa GIS.

Frontend: `campoChoropleto()`/`resumirCapa()`/`detalleFeature()`
(`lib/gis-resumen.ts`) ganan un caso `categoria === "clusters"`.
`gis-map.tsx` gana una paleta cualitativa de 4 colores fijos
(`PALETA_CLUSTERS`, sin relación de orden entre sí -- a diferencia de la
rampa verde secuencial que usa el resto de las capas, acá interpolar entre
2 colores sería semánticamente incorrecto porque cluster_id es una
categoría, no una magnitud). Leyenda categórica nueva en
`mapa-gis-client.tsx` (color + label por cluster, derivado de los datos
reales cargados, no hardcodeado).

## 6. Reproducibilidad

```
python -m backend.ml.clusters_municipios --dry-run   # solo imprime, no escribe
python -m backend.ml.clusters_municipios              # persiste en Supabase
```

Re-correr con datos más nuevos (si el INYM publica una actualización de
estas 3 capas) recalcula todo desde cero y actualiza las 82 filas
(`ON CONFLICT ... DO UPDATE`), sin necesitar cambios de código en el
frontend.
