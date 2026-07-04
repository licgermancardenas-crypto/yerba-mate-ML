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
- [ ] UN Comtrade / OEC: comercio bilateral por país destino
- [ ] Google Trends (pytrends): "yerba mate" como proxy de demanda internacional

---

## FASE 4 — API: Endpoints FastAPI
**Estado: PENDIENTE** · Dependencias: Fases 1-3

- [ ] GET `/produccion` — serie mensual agregada y por región, con filtros (año_desde, año_hasta, provincia)
- [ ] GET `/consumo` — consumo per cápita + mix de envases
- [ ] GET `/exportaciones` — volumen y valor FOB por destino y período
- [ ] GET `/precios` — serie histórica precios hoja verde y canchada
- [ ] GET `/competencia` — cuotas de mercado por empresa y año
- [ ] GET `/geo/{layer}` — features geoespaciales (GeoJSON) del INYM
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
**Estado: PENDIENTE** · Dependencias: Fase 4

- [ ] Setup Next.js 14+ con TypeScript, Tailwind CSS
- [ ] Layout principal: sidebar de navegación + área de contenido
- [ ] **Tab Producción**: gráfico de serie temporal (Recharts/Nivo), mapa coroplético por departamento (deck.gl/Mapbox GL), tabla AG Grid
- [ ] **Tab Consumo**: evolución per cápita, mix de envases (stacked bar)
- [ ] **Tab Exportaciones**: treemap/mapa de burbujas por destino, evolución FOB
- [ ] **Tab Precios**: serie precios hoja verde y canchada, relación con IPC
- [ ] **Tab Competencia**: evolución cuotas de mercado
- [ ] **Tab ML/Predicciones**: selector de modelo, horizonte (1-2 años), intervalos de confianza
- [ ] **Tab Mapa GIS**: capas del INYM (superficie, edad, densidad, secaderos)
- [ ] Auth (next-auth o Clerk) si se publica con acceso restringido
- [ ] i18n: español argentino por defecto

---

## FASE 7 — Deploy y operaciones
**Estado: PENDIENTE** · Dependencias: Fases 4-6

- [ ] Frontend → Vercel (auto-deploy desde main)
- [ ] Backend API → Render o Railway (Docker o buildpack Python)
- [ ] GitHub Actions: cron jobs para ETL (frecuencia por fuente) y reentrenamiento ML (mensual)
- [ ] Variables de entorno: `DATABASE_URL`, `MAPBOX_TOKEN`, API keys INDEC/BCRA si aplica
- [ ] Monitoreo básico: Sentry para errores frontend + backend
- [ ] Rate limiting en FastAPI para evitar abusos

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
