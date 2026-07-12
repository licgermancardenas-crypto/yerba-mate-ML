# Plataforma de Inteligencia Yerbatera — Plan de Tareas

Repo: https://github.com/licgermancardenas-crypto/yerba-mate-ML.git
Stack: Next.js (Vercel) · FastAPI (Render/Railway) · Postgres+PostGIS (Supabase) · ETL/ML jobs (GitHub Actions)

---

## FASE 0 — Scaffolding del repositorio
**Estado: COMPLETA**

- [x] Clonar repo `yerba-mate-ML` en el escritorio
- [x] Definir estructura de carpetas definitiva:
  ```
  yerba-mate-ML/
  ├── backend/
  │   ├── api/          # FastAPI app
  │   ├── db/           # schema.sql, migraciones
  │   └── etl/          # jobs ETL/ML
  ├── frontend/         # Next.js app
  ├── data/             # CSVs fuente (sin subir si son grandes)
  ├── docs/             # inventario de fuentes, decisiones de diseño
  └── .github/workflows/# cron jobs CI/CD
  ```
- [x] Copiar archivos existentes a sus rutas destino:
  - `schema.sql` → `backend/db/schema.sql`
  - `etl_inym_gis.py` → `backend/etl/etl_inym_gis.py`
  - `geo server inym.txt` → `docs/inym_geoserver_layers.md`
  - CSVs → `data/raw/`
- [x] Primer commit: estructura base + archivos existentes
- [x] `pyproject.toml` o `requirements.txt` para backend
- [x] `.env.example` con variables esperadas (`DATABASE_URL`, etc.)

---

## FASE 1 — Backend: DB + FastAPI skeleton
**Estado: COMPLETA** (2026-07-03)

- [x] Ejecutar `schema.sql` en Supabase (schema `inym_gis` + PostGIS) — corrido contra la instancia real, 19 tablas creadas. El rol `postgres` tenía un bug de plataforma (reset de password no propagaba); se resolvió conectando con un rol nuevo (`ym_app`) creado por SQL con los permisos necesarios
- [x] Ampliar schema para datos históricos (tablas de series temporales, sección "ESQUEMA YM" en `backend/db/schema.sql`):
  - `ym.dataset_principal` (año, mes, provincia, ciudad, producción/consumo/exportaciones kg, precio USD, valor FOB) — reemplaza el `ym.produccion_mensual` planeado: el CSV real trae estas 5 métricas juntas por provincia/ciudad
  - `ym.consumo_interno` (año, mes, per_cápita, mix_envases)
  - `ym.exportaciones` (año, mes, destino, volumen_kg, valor_fob_usd, precio_fob_usd_kg)
  - `ym.importaciones` (año, mes, volumen_kg)
  - `ym.competencia` (año, empresa, cuota_mercado, volumen_kg)
  - `ym.superficie_productores` (año, mes, provincia, ciudad, productores, superficie_ha)
  - `ym.precios` (año, mes, precio_hoja_verde_ars, precio_canchada_ars)
- [x] FastAPI skeleton: `backend/api/main.py`, routers por dominio (`/produccion`, `/consumo`, `/exportaciones`, `/precios`, `/competencia`, `/geo/{layer}`) — queries reales contra `ym.*`, sin paginación/auth/cache todavía (eso es Fase 4)
- [x] Conexión a Supabase con SQLAlchemy async (`backend/api/db.py`, driver `asyncpg`)
- [x] Health check endpoint (`/health`) — confirmado contra la DB real
- [x] Los 6 routers (`produccion`, `consumo`, `exportaciones`, `precios`, `competencia`, `geo/{layer}`) probados en vivo contra Supabase real. Se encontró y arregló un bug real presente en los 5 routers con filtros opcionales: `asyncpg` no puede inferir el tipo de un parámetro cuando aparece primero en `:param IS NULL` (`AmbiguousParameterError`) — se resolvió con `CAST(:param AS TIPO)` explícito. También se agregó el caso especial de `geo/{layer}` para los 203 secaderos (viven en `inym_gis.secaderos`, no en `raw_features` como las otras 19 capas)
- [ ] Tests de integración básicos (pytest + testcontainers o Supabase test project)

---

## FASE 2 — ETL: Datos ya disponibles (CSVs + GeoServer INYM)
**Estado: COMPLETA** (2026-07-03) · Dependencias: Fase 1

### 2a — Carga de CSVs históricos
- [x] Script `backend/etl/etl_csv_historicos.py`: lee los 7 CSVs, normaliza separadores (`;`), parsea números en formato argentino (`$`, `.` miles, `,` decimal — formato varía por archivo, el parser detecta el caso), y hace upsert idempotente a las tablas `ym.*`. Validado con `--dry-run` real: 1260+180+1080+180+104+225+1316 filas parseadas sin errores
- [x] Validar rangos: producción 2011–2025, precios 2017–2025, superficies 2010–2025 (confirmado en los CSV reales)
- [x] Documentar limitaciones conocidas: **resuelto** — consumo per cápita, precio USD/kg e importaciones se repiten los 12 meses de cada año pero SÍ cambian de año a año (ej. precio USD/kg 1,80 en 2011 → 2,50 en 2023; importaciones 83.333 kg/mes solo en 2011). Son datos anuales publicados con cadencia mensual, no placeholders — no bloquea el ETL ni el modelado
- [x] Correr el ETL contra la instancia Supabase real — cargado con éxito. Se encontró y arregló un problema real de datos: `precios_historicos.csv` tiene un mes (2020-10) sin precio publicado por el INYM (hueco real de la fuente); se cambiaron `precio_hoja_verde_ars`/`precio_canchada_ars` de NOT NULL a nullable en vez de inventar un valor
- [x] **Auditoría integral 2026-07-11 (`docs/auditoria_datos.md`) — SANEADO**: se confirmó y amplió el hallazgo original (desglose mensual 100% sintético en `produccion_kg`/`consumo_interno_kg`/`exportaciones_kg`/`valor_fob_usd`, T5 = correlación de estacionalidad 1.000 exacta entre TODOS los años) y se encontró que 2025 completo estaba clonado byte a byte de 2024 en las 7 ciudades — mismo patrón en `ym.exportaciones`, `consumo_interno.mix_envases` (congelado 2011-2021 + 2022-2024) y `ym.superficie_productores.productores` (8 tramos de interpolación lineal perfecta). Migraciones `backend/db/migrations/002` y `003` aplicadas contra Supabase real: se anuló (NULL) todo lo fabricado, se preservaron los totales anuales reales 2011-2024 en `ym.dataset_principal_anual`/`ym.exportaciones_anual` (validados contra `ym.inym_hoja_verde_zona`/`ym.inym_salida_molino` y comunicados oficiales del INYM), y se cargó 2025 nacional real (producción 889.253.083 kg, consumo 266.788.512 kg, exportaciones 57.980.911 kg — INYM oficial). Frontend de Producción/Consumo/Exportaciones/Importaciones/Resumen reescrito para usar las fuentes reales; heatmap y chart mensual de Producción ya usaban `ym.inym_hoja_verde_zona` desde antes. Exportaciones mensual/por destino queda sin reemplazo real cargado todavía — fuente real ya identificada y validada (INDEC Comercio Exterior, NCM 09030010/09030090, 96% cobertura vs. INYM), falta construir el ETL (ver Fase 3e)

### 2b — GeoServer INYM
- [x] Correr `etl_inym_gis.py --dry-run` contra la API real (`gis.inym.org.ar/geoserver_disabled/wfs`) — **API viva**, las 20 capas responden con datos
- [x] Registrar esquemas reales de columnas de capas de polígono (edad/densidad/consociado) — ver `docs/inym_geoserver_layers.md`. Los de "límites" coincidían con lo asumido; edad/densidad/consociado tienen columnas base normalizadas + 1 campo TEXT que empaqueta la serie histórica/desglose como string delimitado (no en filas separadas)
- [x] Corregir ETL según lo que devuelva el dry-run — **no hizo falta corregir nada**: el diseño de `raw_features` con `properties JSONB` genérico ya soporta cualquier esquema de columnas sin cambios de código
- [x] Carga completa a `inym_gis.raw_features` (513 features, 19 capas) + tabla especializada `inym_gis.secaderos` (203 puntos)
- [x] Documentar: URL, frecuencia sugerida (mensual/semanal — estos datos cambian poco), capas no disponibles (Cob. de Árboles, Mapas de Calor) — ver `docs/inym_geoserver_layers.md`
- [ ] Construir parser para explotar los campos empaquetados `anio`/`densidad`/`consociado` en filas normalizadas (no urgente — no bloquea la carga cruda, sólo hace falta antes de usarlos como series temporales en Fase 5)

---

## FASE 3 — ETL: Fuentes externas
**Estado: PENDIENTE** · Dependencias: Fase 1

### 3a — INDEC
**Estado: PARCIAL** (2026-07-01) — ver `docs/indec_series.md` para el detalle completo

- [x] **IPC mensual**: API INDEC (`apis.datos.gob.ar/series/api/series`) — serie IPC Nacional nivel general, base dic-2016=100, id `148.3_INIVELNAL_DICI_M_26`. Dry-run real: 114 valores, 2016-12 → 2026-05
- [x] **EMAE**: id `143.3_NO_PR_2004_A_21` (índice original, base 2004). Dry-run real: 268 valores, 2004-01 → 2026-04
- [x] **Bonus no planeado**: IPC específico de yerba mate (GBA), id `105.1_I2YM_2016_M_19` — más útil que un IPC genérico de "infusiones" para Modelo 2. Dry-run real: 122 valores, 2016-04 → 2026-05
- [x] Script `backend/etl/etl_indec_series.py` + tabla genérica `ym.indec_series` (serie_id, serie_nombre, anio, mes, valor, unidad) — permite sumar series nuevas sin migrar el schema
- [~] **Comercio exterior HS 0903**: investigado y **descartado** — la única serie disponible en esta API viene agregada como "café, té, yerba mate y especias" (NCM combinado), no aísla yerba mate. Los datos de `ym.exportaciones` (INYM, ya cargados) son mejores: yerba mate pura por destino. No implementar esto.
- [ ] **Proyecciones de población**: no hay serie nacional limpia con Censo 2022 en esta API (solo proyecciones viejas post-Censo 2010, catálogo distinto). Pendiente, baja prioridad — iría directo a INDEC/portalgeoestadistico si hace falta, no bloquea los modelos actuales (consumo ya viene per cápita)
- [x] Documentar: endpoints, lag de publicación (~1-2 meses, no 30 días fijos), series históricas disponibles — ver `docs/indec_series.md`
- [x] Correr el ETL real contra Supabase (2026-07-03) — 504 valores cargados en `ym.indec_series` (3 series)

### 3b — BCRA
**Estado: COMPLETA** (2026-07-01) — ver `docs/bcra_rem.md`

- [x] **REM (Relevamiento de Expectativas de Mercado)**: inflación y PBI esperados — **cambio de plan**: en vez de parsear el Excel multi-hoja del BCRA, se usó la API JSON de ArgentinaDatos (`api.argentinadatos.com/v1/rems/{año}/{mes}`, mismo dato, ya normalizado, cero parsing). Trae 9 indicadores (IPC nivel general y núcleo, PBI, tipo de cambio, TAMAR, desocupación, exportaciones, importaciones, resultado fiscal) x horizonte (mensual/trimestral/anual), con mediana/percentiles/participantes
- [x] Script `backend/etl/etl_bcra_rem.py` + tabla `ym.bcra_rem` (estructura calcada de la fuente). Dry-run real: 132 filas/informe, 14 informes disponibles (2025-04 → 2026-05) = 1848 filas totales, sin duplicados
- [x] Documentar: URL, formato — **OJO limitación importante**: esta API solo tiene los últimos 14 meses, NO el histórico completo del REM (que en BCRA arranca ~2004). Sirve como insumo de expectativas para el horizonte de pronóstico de Fase 5, no como regresor histórico 2011-2024. Si hace falta el histórico completo habría que parsear el Excel original del BCRA (no implementado, cada fila trae el link `xlsxUrl` por si hace falta ir a la fuente)
- [x] Correr el ETL real contra Supabase (2026-07-03) — 1848 filas cargadas en `ym.bcra_rem`

### 3c — INYM (scraper PDF/HTML)
**Estado: COMPLETA** (2026-07-01, sitio volvió a responder y se terminó el mapeo + scraper) — ver `docs/inym_scraper.md` para el detalle completo

- [x] Mapear estructura de `inym.org.ar/noticias/estadisticas/` — esa ruta es solo noticias de prensa con acumulados irregulares, NO usar. La fuente correcta es `/descargar/publicaciones/estadisticas/{año}.html` (2019-2026, un PDF por mes) + `2018-a-2011.html` (2011-2018, un PDF por año con el detalle de los 12 meses adentro)
- [x] Confirmar formato real de archivo: **PDF** (~1.3MB), con tablas REALES extraíbles vía `PyMuPDF.find_tables()` (no imágenes, no hace falta regex sobre texto plano)
- [x] Script `backend/etl/etl_inym_pdf.py` + tablas `ym.inym_hoja_verde_zona` y `ym.inym_salida_molino`:
  - **Ingreso de hoja verde a secadero (kg), por zona** — confirmado que "Avance de Cosecha" = esto. Dry-run real completo (94 PDFs descubiertos, 2011-2026): 4044 filas, 92/94 archivos OK
  - **Salida de molino (mercado interno + externo), mensual (kg)** — confirmado que NO coincide con `consumo_interno`/`exportaciones` de `ym.dataset_principal` (miden puntos distintos de la cadena: declaración jurada a salida de molino vs producción/consumo estimado) — se cargan en tabla separada, no se pisan. Dry-run real: 9575 filas
  - **Mezcla de envases**: NO se scrapea — es un gráfico circular en el PDF (no una tabla real), y ya está cubierto por `ym.consumo_interno` desde los CSV históricos. No vale la pena parsear un gráfico para dato redundante
- [x] Documentar: frecuencia mensual, formato PDF con tablas estructuradas, 2 archivos con 0 filas (2011 anual con layout distinto/más simple — es el primer año publicado; y un duplicado roto de 2023-01) y 1 con datos parciales (junio 2025, título y encabezado de tabla fusionados por un bug de layout del PDF) — ver `docs/inym_scraper.md` para el detalle completo de cada anomalía
- [x] Correr el ETL real (no dry-run) contra Supabase — cargado: 1033 filas hoja_verde_zona, 370 filas salida_molino (deduplicadas de las 4044/9575 procesadas porque los reportes mensuales del INYM son acumulativos del año, el upsert idempotente resuelve bien la deduplicación)

### 3d — Clima (NASA POWER)
**Estado: COMPLETA** (carga real contra Supabase confirmada 2026-07-03: 1152 filas, 6 ciudades × 192 meses)

- [x] ETL contra API NASA POWER (`power.larc.nasa.gov/api/temporal/monthly/point`) — `backend/etl/etl_nasa_power.py`, para las 6 ciudades reales de `dataset_principal.csv` (se agregaron Colonia Liebig y Santo Pipó a las 4 "clave" del plan original, para que el clima quede a la misma granularidad que producción — se excluye 'Otros' por no tener ubicación puntual):
  - Precipitación mensual (`PRECTOTCORR`) — **OJO: viene en mm/día promedio del mes, NO mm totales del mes**. Para total aproximado: multiplicar por días del mes.
  - Temperatura media mensual (`T2M`, °C)
  - Coordenadas usadas: Colonia Liebig (-27.53,-55.72), Gob. Virasoro (-28.07,-56.03), Apóstoles (-27.90,-55.75), Montecarlo (-26.57,-54.77), Oberá (-27.49,-55.12), Santo Pipó (-27.20,-55.05)
- [x] Crear variables rezagadas (lag 6, 12, 18, 24 meses) — implementado como vista SQL `ym.v_clima_con_lags` (window functions `LAG(...)`), no materializada, para no duplicar datos
- [x] Documentar: API gratuita sin auth, resolución espacial nativa ~0.5°x0.5° (MERRA-2), cobertura histórica desde 1981. Validado 2010–2025 para las 6 ciudades: 192 filas cada una (16 años × 12 meses), **0 valores faltantes** (NASA reporta huecos como fill_value -999.0, se mapean a NULL en el ETL). La respuesta trae una clave extra `YYYY13` con el promedio/total anual — el ETL la descarta, solo carga meses 01-12.
- **OJO al correr en 2026+**: el default de `--end-year` es el año actual, pero la API todavía no tiene datos de 2026 completo (da 422) — pasar `--end-year 2025` explícito hasta que la API lo publique.

### 3e — Opcionales (post-MVP)
- [ ] **PRIORIDAD ALTA — ETL de exportaciones reales por destino, mensual** (investigado 2026-07-11, ver `docs/auditoria_datos.md`): fuente real encontrada y validada — INDEC Comercio Exterior (`comexbe.indec.gob.ar/public-api/search`), posiciones NCM `09030010`/`09030090` (yerba mate con posición propia, no mezclada con café/té como la serie de `apis.datos.gob.ar` ya descartada), mensual, por país (ISO2), 2002-presente, público sin auth. Validado: 96% de cobertura vs. el total oficial 2025 del INYM (55,6M de 58,0M kg; el resto son celdas con secreto estadístico, `isConfidential=true`, cargar como NULL no como 0). Reemplaza la tabla `ym.exportaciones` mensual (anulada por sintética, ver Fase 2a) — es la pieza que falta para cerrar el saneamiento post-auditoría
- [ ] UN Comtrade / OEC: comercio bilateral por país destino (alternativa/respaldo a INDEC de arriba — estrictamente peor, agrega a 6 dígitos y pide cuenta para históricos)
- [ ] Google Trends (pytrends): "yerba mate" como proxy de demanda internacional
- [x] **Composición exportación granel vs. fraccionado** (investigado y cargado 2026-07-04): no está en `ym.exportaciones` ni en ninguna fuente ya integrada (ni INDEC NCM, ni los PDF del INYM que ya scrapeamos). Único dato real encontrado: Bolsa de Comercio de Rosario, Informativo Semanal N.° 2222 (28/11/2025) — 57% a granel (bolsas 50kg) / 29% fraccionado minorista (1/4-2kg), sobre ene-sep 2025. Es un análisis puntual en un artículo de texto, no un dataset/API — no hay forma de automatizar el ETL, cada punto futuro requeriría buscar a mano si BCR publicó otro informe similar. Cargado como anotación estática (no tabla) en `/exportaciones`, mismo criterio que Competencia (dato real citado, sin inventar series)
- [x] **Rendimiento por hectárea** (2026-07-04): sin research nuevo — cruza `ym.dataset_principal` (producción) con `ym.superficie_productores` (ya cargada, sin endpoint hasta ahora) por (año, provincia, ciudad), las 7 ciudades matchean exacto entre ambas fuentes. Nuevo endpoint `GET /superficie`. KPI + chart en Producción. Validado con datos reales: 3.600-5.600 kg/ha 2011-2025, rango agronómicamente plausible para yerba mate
- [x] **Estacionalidad de cosecha** (2026-07-04): sin research nuevo — promedio de `ym.inym_hoja_verde_zona` (zona TOTAL) por mes calendario a través de todos los años, en Cadena Productiva. Confirma el patrón real: pico abril-septiembre (95-138M kg/mes), caída fuerte octubre-diciembre (época de floración, <1M-29M kg/mes)
- [x] **Cartografía censal INDEC (radios censales, "todo")** (2026-07-05): el IGN (`ign.gob.ar`, incluidos sus links de descarga directa) es inalcanzable desde este entorno — timeout confirmado en 2 sesiones distintas, con `curl` directo (no solo fetch), DNS resuelve bien pero la conexión se cae. En su lugar se usó el WFS de GeoNode del INDEC (`geonode.indec.gob.ar`, sí responde) — una de sus capas ("jurisdicciones") declara `sag: IGN` como fuente, o sea cartografía originada en el IGN pero republicada por INDEC. `backend/etl/etl_indec_censal.py` descargó y cargó 5 capas del Marco Geoestadístico Nacional filtradas a Misiones+Corrientes: jurisdicciones (2), departamentos (42), fracciones censales (506), **radios censales (3.997)**, localidades (283) — 4.830 features reales, reproyectadas a 4326, en la misma `inym_gis.raw_features` que ya usa el ETL del INYM (el schema, pese al nombre, es agnóstico a la fuente). Aparecen automáticas en el selector de Mapa GIS (5 categorías nuevas `indec_*`) sin tocar el backend. Además: overlay de radios censales (contorno amarillo, toggleable) agregado directo al mapa de Producción

---

## FASE 4 — API: Endpoints FastAPI
**Estado: EN PROGRESO** (2026-07-04) · Dependencias: Fases 1-3

- [x] GET `/produccion` — serie mensual agregada y por región, con filtros (año_desde, año_hasta, provincia)
- [x] GET `/consumo` — consumo per cápita + mix de envases
- [x] GET `/exportaciones` — volumen y valor FOB por destino y período
- [x] GET `/importaciones` — volumen mensual (agregado 2026-07-04, tabla existía cargada sin endpoint)
- [x] GET `/precios` — serie histórica precios hoja verde y canchada
- [x] GET `/competencia` — cuotas de mercado por empresa y año
- [x] GET `/cadena-productiva/hoja-verde` y `/cadena-productiva/salida-molino` (agregado 2026-07-04, mismo caso: tablas cargadas desde Fase 3c sin ningún endpoint)
- [x] GET `/geo/{layer}` — features geoespaciales (GeoJSON) del INYM
- [x] GET `/geo` — catálogo de capas (agregado junto con el Mapa GIS)
- [ ] GET `/predicciones/{modelo}` — resultados pre-calculados de ML (sin entrenar en request)
- [ ] Paginación, filtros de fecha, caching con Redis o `fastapi-cache`
- [ ] Auth básica (API key o JWT) si se expone públicamente

---

## FASE 5 — ML: Diseño y desarrollo de modelos
**Estado: PLANIFICADO — No implementar sin discutir primero**

### Modelo 1 — Producción por departamento
- Algoritmo tentativo: SARIMAX o regresión espacial (GeoDa/PySAL)
- Variables: clima rezagado (precipitación, temperatura), edad/densidad plantación (GIS), superficie cosechable, NDVI satelital (Google Earth Engine, futuro)
- Validación: walk-forward, ventana mínima 12 meses de test
- Restricción agronómica: producción no puede crecer más del X% por año (límite biológico de las plantas)

### Modelo 2 — Consumo interno nacional
- Algoritmo tentativo: SARIMAX con regresores exógenos
- Variables: salario real (salario nominal / IPC), IPC específico de infusiones, precio relativo de la yerba vs otros bienes, estacionalidad mensual, dummy Día del Mate (30/11)
- OJO: consumo per cápita parece tener variación inter-anual pero poca intra-anual en los datos actuales — revisar si los datos mensuales son interpolaciones del dato anual

### Modelo 3 — Exportaciones
- Algoritmo tentativo: modelo gravitacional de comercio (GDP importador × GDP exportador / distancia)
- Variables: PBI país destino, distancia geográfica, tipo de cambio, dummy diáspora siria/libanesa (variable binaria que rompe la gravedad pura)
- Dato clave: Siria es históricamente el principal importador, pero por migración histórica, no por proximidad o PBI — esto es un supuesto de negocio crítico

### Para los 3 modelos:
- [ ] Serie histórica corta (2011–2024): ser conservador en complejidad
- [ ] Modelos interpretables preferibles a black-box
- [ ] Walk-forward validation (no random split)
- [ ] Guardar predicciones + intervalos de confianza en DB para que el backend solo lea
- [ ] Registrar métricas (MAPE, RMSE) por modelo en tabla `ym.ml_evaluaciones`

---

## FASE 6 — Frontend: Dashboard Next.js
**Estado: EN PROGRESO** (2026-07-04, 7 de 9 secciones conectadas a la API real) · Dependencias: Fase 4

- [x] Setup Next.js 16 con TypeScript, Tailwind CSS 4
- [x] Layout principal: sidebar de navegación + área de contenido
- [x] **Tab Producción**: gráfico de serie temporal (Recharts) + tabla de distribución por ciudad — conectado a `/produccion` real. **Sub-tab "Mapa" agregado 2026-07-04, rediseñado 2026-07-05, pulido 2026-07-05**: la primera versión (satelital/topo + burbujas de producción + límites) no convenció al usuario ("no me gusta"). Se ofrecieron 4 alternativas y se implementaron las 2 elegidas: **(1) Coroplético** — solo los 19 departamentos con dato real del INYM se colorean por % de superficie cultivada (rango real 1,0%-17,8%); los 42 departamentos de Misiones/Corrientes (INDEC) se muestran siempre de fondo en gris como contexto ("sin dato"), para distinguir claramente qué zonas nos competen; **(2) Clústeres de secaderos** — 203 plantas agrupadas por zoom. Pulido pedido por el usuario ("más amor y profesionalismo"): labels de provincia (grandes, siempre visibles), departamento (desde zoom 7) y municipio (desde zoom 9,5, con el contorno punteado del municipio) — todos con halo de texto para legibilidad sobre cualquier basemap; **filtros dinámicos de Provincia y Departamento** (dependiente) que atenúan lo que no pertenece a la selección y hacen `fitBounds` automático a la zona elegida; control de escala (`ScaleControl`) agregado
- [x] **Tab Consumo**: evolución per cápita, mix de envases (stacked bar) — conectado a `/consumo` real
- [x] **Tab Exportaciones**: serie mensual + tabla de distribución por destino — conectado a `/exportaciones` real. Treemap/mapa de burbujas pendiente (mejora visual, no bloqueante)
- [x] **Tab Importaciones** (módulo aparte, 2026-07-04): vivía como sección dentro de Exportaciones, se separó a `/importaciones` con su propio ítem de sidebar — KPI de volumen + balanza comercial (cruza con `/exportaciones`), chart mensual, tabla histórica Anual/Mensual
- [x] **Tab Precios**: serie precios hoja verde y canchada — conectado a `/precios` real. **Relación con IPC agregada 2026-07-04**: `/precios` suma `ipc_nacional`/`ipc_yerba_mate` (LEFT JOIN con `ym.indec_series`, ya cargada desde Fase 3a pero sin usar) — precio real deflactado + índice relativo yerba mate vs. inflación general (ambos con base dic-2016=100). **Precio de góndola (SEPA) agregado 2026-07-04**: nueva tabla `ym.precios_gondola` + `backend/etl/etl_sepa_gondola.py` + endpoint `/precios-gondola` — snapshot único (SEPA solo mantiene 7 archivos rotativos, no hay backfill; para serie histórica hay que re-correr el ETL en sesiones futuras). 62 marca/presentación cargadas del snapshot 2026-07-04, con `empresa_ym` mapeado solo cuando la atribución marca→empresa está citada en `docs/fuentes_competencia.md`
- [x] **Tab Competencia**: evolución cuotas de mercado (top 4 + "Otras") — conectado a `/competencia` real
- [x] **Tab Cadena Productiva** (nueva, 2026-07-04): ingreso de hoja verde a secadero por zona + salida de molino interno/externo — conectado a `/cadena-productiva/*`. Datos que estaban cargados desde Fase 3c pero sin ningún endpoint ni vista
- [x] **Tablas históricas tipo Excel** en todos los módulos (2026-07-04): toggle Anual/Mensual, formato profesional (sticky header, zebra rows, `Intl.NumberFormat`), desde el primer año disponible hasta el más reciente
- [x] **Charts rediseñados** (2026-07-04): toggle Línea/Barra en los 4 charts de serie temporal, área con degradé, tooltip tipo tarjeta, grid sólido, paleta categórica revalidada con la skill `dataviz` (la anterior tenía un color bajo el piso de croma y dos verdes indistinguibles para daltonismo)
- [ ] **Tab ML/Predicciones**: sigue "Coming Soon" — depende de Fase 5 (no implementar sin discutir primero)
- [x] **Tab Mapa GIS**: implementado con MapLibre GL (basemap gratuito CARTO Positron, sin necesitar token de Mapbox) — selector de capa agrupado por categoría (límites/edad/densidad/consociado/secaderos), popup con propiedades al hacer click, fit bounds automático. Se agregó `GET /geo` al backend (catálogo desde `inym_gis.catalogo_capas`) y un route handler proxy en Next.js (`/api/geo/[layer]`) para que el cliente cambie de capa sin problemas de CORS. De paso se arregló un bug real en `/geo/{layer}`: la query de polígonos no dedupeaba por snapshot más reciente (`DISTINCT ON` agregado) — hubiera acumulado features duplicados en cada corrida futura del ETL
- [x] **Filtros dinámicos** (2026-07-04) en los 9 módulos: rango de año (Desde/Hasta, o selector de año único en Resumen) + dimensión relevante por módulo (provincia en Producción, destino en Exportaciones, empresa en Competencia; Consumo/Precios/Cadena Productiva solo año). Mapa GIS: el selector de capa existente ahora también vive en la URL (`?capa=...`). Implementado con `searchParams` de Next.js (query string, no estado de cliente aislado) — filtros compartibles/bookmarkeables, cada página re-renderiza server-side con los datos ya filtrados sin request extra a la API (se sigue pidiendo el dataset completo una vez, cacheado 1h, y se filtra en el server component)
- [x] **Filtro de año por gráfico individual** (2026-07-04): cada gráfico de cada módulo (14 en total) suma su propio Desde/Hasta independiente del filtro general de la página, que sigue controlando KPIs/tablas/el resto de la página. Dos componentes cliente reutilizables: `SerieChartConFiltro` (líneas/áreas mensuales, 11 usos) y `AnnualChartConFiltro` (barras apiladas anuales — cuotas, HHI, envases, 4 usos). Filtro por gráfico vive en estado local de React (no en la URL, a diferencia del filtro general) y se resetea al rango completo si cambia el filtro general de la página
- [x] **Toggle kg/toneladas** (2026-07-04) en Producción, Exportaciones, Importaciones y Cadena Productiva — un solo toggle por página (en el `FilterBar`, `?unidad=t` en la URL) que afecta todos los KPIs y gráficos de esa página a la vez, en vez de un toggle independiente por widget (más consistente: no tendría sentido ver un KPI en kg al lado de otro en toneladas en la misma pantalla)
- [x] **UX premium en las 9 páginas** (2026-07-05): referencias visuales provistas por el usuario (4 dashboards con gauges, badges circulares, sidebar oscuro). Validado con la skill `ui-ux-pro-max`: la paleta ya usada (`#15803D`/`#A16207`) coincide exactamente con la recomendada para "Agriculture/Farm Tech" — no se tocaron colores de marca, solo componentes. Pilotado primero en Resumen y aprobado, luego replicado en las 9 páginas: `Sidebar` con gradiente verde oscuro, `KpiCard` elevado (badge circular grande con ring, `rounded-2xl`, hover con elevación, delta como píldora) + variante `destacado` (card hero sólida, 1 por página en el KPI principal), `GaugeCard` nuevo (gauge radial con Recharts) aplicado a 6 KPIs de 0-100% que antes eran número plano (sin estampilla en Consumo; concentración top4 en Competencia; % externo salida molino y estacionalidad en Cadena Productiva; composición granel/fraccionado en Exportaciones), `ChartCard` nuevo reemplazando el `<div rounded-xl border...>` repetido a mano en cada página (consistencia + hover)
- [x] **Mapa de Producción — nivel avanzado** (2026-07-06): 3 modos nuevos sobre la base coroplético+clústeres aprobada. **Heatmap**: densidad de los 203 secaderos (capa `heatmap` nativa de MapLibre, degradé verde→rojo). **Burbujas**: producción por ciudad (tamaño proporcional a kg, con selector de año independiente). **Flujo**: línea de cada ciudad productora a su secadero geográficamente más cercano (haversine calculado en el cliente) — grosor de línea proporcional a la producción; rotulado explícitamente como "proximidad geográfica, no ruta logística verificada" en la leyenda y el popup, porque `inym_gis.secaderos.departamento_id/municipio_id` están sin completar (no existe join real origen→destino en la fuente). **Resaltado de departamento**: al elegir uno en el selector existente, ese territorio queda con opacidad casi plena y el resto del contexto se sombrea (antes solo se hacía fit-bounds, sin diferenciar visualmente el resto). El clustering dinámico (zoom out agrupa, zoom in desglosa) ya lo daba gratis `cluster: true` de MapLibre desde la versión anterior — no fue necesario código nuevo para ese punto del pedido
- [x] **Mapas de calor año×mes en Producción y Consumo** (2026-07-11): componente nuevo `HeatmapTable` (`frontend/components/heatmap-table.tsx`), pedido con una imagen de referencia (tabla Excel semáforo rojo-amarillo-verde). Se usó rampa secuencial de un solo hue (verde de marca `--color-primary`, clara→oscura) en vez del semáforo de la referencia — semáforo es una paleta diverging/status, y acá el valor no tiene polaridad "bueno/malo", solo magnitud (ver skill `dataviz`, `color-formula.md`). Escala de color configurable por fila (resalta estacionalidad dentro de cada año — usada en Producción) o global (resalta tendencia entre años — usada en Consumo, porque su dato solo tiene cadencia anual real). Columna Total anual + Var % con el mismo patrón de píldora verde/roja que ya usa `KpiCard`. Construyendo el de Producción se encontró el hallazgo real de datos documentado en Fase 2a (desglose mensual de `produccion_kg` sintético) y se resolvió apuntando a la fuente mensual real (`ym.inym_hoja_verde_zona`)
- [ ] Auth (next-auth o Clerk) si se publica con acceso restringido
- [ ] i18n: español argentino por defecto
- **Bugs reales encontrados y corregidos al correr `next build` por primera vez** (nunca se había corrido): `recharts` y `lucide-react` estaban en `node_modules` pero no declarados en `package.json` (build limpio los hubiera roto); y las 5 páginas conectadas pasaban funciones (`formatValor`) desde Server Components a Client Components (`"use client"` charts) — React Server Components no permite serializar funciones a través de ese límite. Se resolvió reemplazando por `Intl.NumberFormatOptions` + prefijo/sufijo serializables

---

## FASE 7 — Deploy y operaciones
**Estado: EN PROGRESO** (base en vivo confirmada 2026-07-11) · Dependencias: Fases 4-6

- [x] Frontend → Vercel (auto-deploy desde main) — proyecto `yerba-mate-intelligence`, live en `https://frontend-peach-five-64.vercel.app`
- [x] Backend API → Render — servicio `yerba-mate-ml-api` (`render.yaml`, plan free), live en `https://yerba-mate-ml-api.onrender.com`, `/health` responde 200
- [x] Variables de entorno: `DATABASE_URL` en Render; `NEXT_PUBLIC_API_URL` en Vercel — **bug real encontrado y corregido 2026-07-11**: `NEXT_PUBLIC_API_URL` estaba seteada pero vacía en Production y Preview (el frontend estaba deployado y andando desde hace ~8 días pero sin poder llegar al backend). Corregida a `https://yerba-mate-ml-api.onrender.com` en ambos entornos y redeployado — verificado con datos reales en `/produccion`
- [ ] GitHub Actions: cron jobs para ETL (frecuencia por fuente) y reentrenamiento ML (mensual)
- [ ] Monitoreo básico: Sentry para errores frontend + backend
- [ ] Rate limiting en FastAPI para evitar abusos
- [ ] Backend en plan free de Render duerme por inactividad (cold start ~30-50s) — evaluar upgrade de plan o keep-alive si molesta en uso real
- [ ] Dominio custom (hoy solo subdominios `.vercel.app`/`.onrender.com`)

---

## FASE 8 — Auditoría y refactor: módulo Competencia
**Estado: COMPLETA (2026-07-04)** — schema migrado (`ALTER` + tablas relacionales) y ETL corrido contra Supabase real: 232 filas en `ym.competencia`, 25 con dato real (2021: 2, 2024: 2, 2025: 21). Commiteado y pusheado a `origin/main`.

### Hallazgo — origen del problema

`data/raw/competencia.csv` (226 filas, 15 empresas × 15 años 2011-2025) está en el repo desde el commit de scaffolding inicial (`223741e`, antes de esta sesión). El ETL (`transformar_competencia` en `backend/etl/etl_csv_historicos.py`) es un passthrough sin lógica de relleno — **la fabricación está en el CSV fuente, no en el código**.

Evidencia matemática de que 2011-2024 no es dato real:
- Cada empresa tiene el **mismo valor exacto 2011→2021** (11 años idénticos al centésimo).
- 2022→2025 es una **interpolación lineal perfecta** hacia el valor de 2025 (ej. Playadito: +1.91 pp/año exacto los 4 años; Cbse: −0.2 pp/año exacto).
- Las cuotas suman **exactamente 100,00% los 15 años** — un dataset real de 15 filas independientes casi nunca cierra así de limpio por redondeo.

**Buena noticia parcial**: los dos extremos (2021 y 2025) SÍ coinciden con rankings reales publicados:
- 2021: Agrofy News (11/2022, cita INYM) — Top10 = 72,7% del mercado, Top3 ≈ 41%, J. Llorente #10 con 2,8% (7,9M kg). Nuestro CSV 2021: Las Marías 19,1 + Playadito 14,4 + Cbse 7,8 = 41,3% ✓ y J. Llorente 2,8% ✓ — coincide.
- 2025: Plan B Misiones (10/03/2025, cita INYM), ranking de 65 empresas — Playadito 22,04%, Las Marías 18,4%, La Cachuera 8,9%, Cbse 7%, Rosamonte 5,4%, Montecarlo/Aguantadora 3,4%, Yerbatera Misiones SRL 3,2%, Piporé 3,1%, Cordeiro 3,1%, Gerula 2% — coincide con nuestro CSV 2025 número por número.

Conclusión: alguien tomó 2 rankings reales (2021 y 2025) y (a) extendió el de 2021 hacia atrás como valor plano 2011-2020, y (b) interpoló linealmente 2022-2024 entre ambos extremos, sin buscar los rankings reales de esos años intermedios. **13 de 15 años son inventados; 2 son reales pero sin cita documentada en el repo.**

⚠️ Pendiente de confirmar antes de implementar: si el "2021" y "2025" de las notas de prensa son año calendario completo o un corte a una fecha de publicación (los medios a veces mezclan datos YTD con anuales) — hay que verificarlo contra la fuente primaria de INYM antes de cargarlo como "dato anual real".

### Rankings reales encontrados (parciales, hace falta completar antes de implementar)

| Año | Fuente | Qué se pudo confirmar |
|---|---|---|
| 2021 | Agrofy News, 11/2022, cita INYM | Top10 = 72,7%, Top3 ≈ 41%, J. Llorente #10 = 2,8% (7,9M kg). Cargado (parcial, 2 empresas). |
| 2022 | Sin ranking anual completo encontrado (research cerrado 2026-07-04) | Solo fragmentos de posición sin %: Cooperativa Montecarlo #8, Andresito #14 (6,39M kg), La Cachuera #4, J. Llorente #9. Sigue NULL. |
| 2023 | Sin ranking anual completo encontrado (research cerrado 2026-07-04) | Total mercado interno confirmado (285,43M kg, INYM) pero sin desglose por empresa verificable. Sigue NULL. |
| 2024 | Plan B Misiones, 25/02/2026 (comparación interanual dentro de la retrospectiva 2025), cita INYM | Las Marías 50M kg (19,32%) y Playadito 47,1M kg (18,20%). Cargado (parcial, 2 empresas). |
| 2025 | Infobae, 06/03/2026, "El ranking de las 20 yerbas más vendidas...", cita INYM vía Plan B Misiones | Ranking completo top 20 (de 65 empresas totales) con %. Cargado. Denominador (267M) reverificado contra cierre oficial INYM — confirmado. |

**Research 2022-2024 cerrado 2026-07-04**: se reintentó `noticiasdelmate.com` (sigue con timeout DNS) y se verificó Wayback Machine (sin snapshot útil). Se revisaron 3 notas de Plan B Misiones que por fecha de publicación parecían rankings anuales cerrados y las 3 resultaron ser cortes mensuales/YTD al leer el texto completo (jun-2024, ene-2025 x2) — no calificican como año calendario. Detalle completo en `docs/fuentes_competencia.md`. Sin fuente primaria nueva, 2022/2023 quedan `NULL` indefinidamente salvo que `noticiasdelmate.com` vuelva a estar disponible (tiene artículos dedicados a esos años, pendiente confirmar período exacto de cada uno).

**Hallazgo adicional que valida el Problema 4 (mejoras)**: la fuente real tiene **65 empresas**; nuestro dataset solo modela 14 + "Others". El "Others" actual mezcla ~51 empresas reales en una sola categoría — correcto como simplificación, pero el label debería aclararlo.

### Problema 3 — nota importante, matiza la hipótesis del usuario

Según Plan B Misiones (2025): *"Yerbatera Misiones SRL (Puerta) elabora a fazón para Molinos Río de la Plata las marcas Nobleza Gaucha y Cruz de Malta"* — es decir, Ramón Puerta (ex gobernador de Misiones) es dueño de la planta de Apóstoles y la alquila a Molinos, que fabrica ahí sus marcas. Esto **no confirma automáticamente** que "Molinos" y "Yerbatera Misiones SRL" sean la misma operación comercial en el ranking — puede ser que INYM atribuya el volumen a quien fabrica físicamente (Yerbatera Misiones SRL, maquila) en vez de a quien es dueño de la marca (Molinos), lo cual sería un cambio de **metodología de declaración**, no necesariamente un traspaso de negocio. No encontré una fuente que confirme el año exacto de ese cambio de atribución — y como el quiebre en nuestro CSV empieza justo en 2022 (mismo año donde arranca la interpolación lineal fabricada), **no puedo descartar que ese "quiebre" sea un artefacto de la fabricación y no un evento real**. Hace falta investigar esto puntualmente (o confirmarlo con el usuario, que conoce el sector) antes de modelarlo como vigencia temporal en `marca_empresa`.

### Plan de implementación — EJECUTADO 2026-07-04 (falta correr contra Supabase real + commitear)

1. [x] **Schema**: `cuota_mercado_pct`/`volumen_kg` ahora nullable + columna `fuente_url`/`fuente_medio`/`fuente_fecha`/`cobertura_ranking`. Se optó por columnas directas en `ym.competencia` (no tabla separada, más simple). Además se creó el modelo relacional completo del punto 3.
2. [x] **Datos**: `data/raw/competencia.csv` reemplazado — sin relleno 2011-2020 ni interpolación 2022-2024. 2021 y 2025 confirmados y cargados; 2024 parcial (2 empresas) agregado en el cierre del research; 2022/2023 quedan NULL (ver research cerrado arriba).
3. [x] **Modelo relacional** (Problema 3): tablas `ym.empresas`/`ym.marcas`/`ym.marca_empresa`/`ym.despachos_empresa` creadas en schema. **No pobladas todavía** — el caso Molinos/Yerbatera Misiones SRL sigue sin confirmar el año de cambio de atribución, no se carga vigencia temporal sin esa fuente.
4. [x] **API**: no cambió el contrato de `/competencia` (mismas columnas + las nuevas opcionales), no hizo falta versionar.
5. [x] **Frontend**: HHI chart agregado, cobertura mínima 50% para excluir años con dato parcial del stacked chart, filtro "Desde" ajustado al primer año con dato real. Toggle empresa/marca-linaje (dependía de Problema 3) **no implementado** — Problema 3 sigue sin confirmar.
6. [x] **Tests**: `frontend/lib/metricas-competencia.test.ts`, 6 tests, todos pasan (`npx vitest run`).
7. [x] **Docs**: `docs/fuentes_competencia.md` con cada fuente + cierre de research 2022-2024.

### Fase siguiente (no arrancar sin confirmación aparte)

Precios de góndola vía SEPA — **snapshot inicial cargado 2026-07-04** (ver Fase 6, Tab Precios). Pendiente si se quiere profundizar: scatter precio×cuota de mercado cruzando `ym.precios_gondola.empresa_ym` con `ym.competencia`, o acumular más snapshots en el tiempo para tener evolución.

---

## NOTAS Y SUPUESTOS A VERIFICAR

1. ~~**Datos mensuales vs anuales**~~ **RESUELTO** (2026-07-01): se repiten dentro del año pero varían año a año en los 3 CSVs marcados (consumo per cápita 5,59–6,27 kg/persona; precio USD/kg 1,80–2,50; importaciones 83.333–3.222.222 kg/mes). Son series anuales publicadas con cadencia mensual (valor constante los 12 meses de cada año), consistente con la fuente (INYM/aduana suele publicar así). No son placeholders — se pueden usar en el ETL y en los modelos tal cual, documentando la granularidad real (anual, no mensual) al construir features de Fase 5.
2. ~~**GeoServer INYM**~~ **RESUELTO** (2026-07-01): la URL sigue activa pese al `/geoserver_disabled/` en el path (probablemente resto de una migración vieja del INYM, nunca actualizado) — dry-run real contra las 20 capas confirmó que todas responden.
3. **Siria como principal exportador**: dato que va contra la intuición económica pura, está documentado y es correcto — dummy de diáspora es crítica en el modelo gravitacional.
4. ~~**Importaciones**~~ ver punto 1 — variable año a año, no placeholder.
5. ~~**Precio FOB**~~ ver punto 1 — variable año a año, no placeholder.

---

## ORDEN DE PRIORIDAD PARA ARRANCAR

1. **Hoy**: Fase 0 (repo + estructura)
2. **Próximo**: Fase 1 (schema ym.* + FastAPI skeleton)
3. **Luego**: Fase 2a (carga CSVs) + Fase 2b (dry-run GeoServer INYM)
4. **Después**: Fase 3 (fuentes externas, en paralelo por fuente)
5. **Cuando los datos estén**: Fases 4 + 6 en paralelo
6. **Al final**: Fase 5 ML (validar datos primero antes de modelar)
7. **Al deployar**: Fase 7
