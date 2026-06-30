# Plataforma de Inteligencia Yerbatera — Plan de Tareas

Repo: https://github.com/licgermancardenas-crypto/yerba-mate-ML.git
Stack: Next.js (Vercel) · FastAPI (Render/Railway) · Postgres+PostGIS (Supabase) · ETL/ML jobs (GitHub Actions)

---

## FASE 0 — Scaffolding del repositorio
**Estado: PENDIENTE**

- [ ] Clonar repo `yerba-mate-ML` en el escritorio
- [ ] Definir estructura de carpetas definitiva:
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
- [ ] Copiar archivos existentes a sus rutas destino:
  - `schema.sql` → `backend/db/schema.sql`
  - `etl_inym_gis.py` → `backend/etl/etl_inym_gis.py`
  - `geo server inym.txt` → `docs/inym_geoserver_layers.md`
  - CSVs → `data/raw/`
- [ ] Primer commit: estructura base + archivos existentes
- [ ] `pyproject.toml` o `requirements.txt` para backend
- [ ] `.env.example` con variables esperadas (`DATABASE_URL`, etc.)

---

## FASE 1 — Backend: DB + FastAPI skeleton
**Estado: PENDIENTE** · Dependencias: Fase 0

- [ ] Ejecutar `schema.sql` en Supabase (schema `inym_gis` + PostGIS)
- [ ] Ampliar schema para datos históricos (tablas de series temporales):
  - `ym.produccion_mensual` (año, mes, provincia, ciudad, kg)
  - `ym.consumo_interno` (año, mes, per_cápita, mix_envases)
  - `ym.exportaciones` (año, mes, destino, volumen_kg, valor_fob_usd)
  - `ym.importaciones` (año, mes, volumen_kg)
  - `ym.competencia` (año, empresa, cuota_mercado, volumen_kg)
  - `ym.superficie_productores` (año, mes, provincia, ciudad, productores, superficie_ha)
  - `ym.precios` (año, mes, precio_hoja_verde_ars, precio_canchada_ars)
- [ ] FastAPI skeleton: `main.py`, routers por dominio (`/produccion`, `/consumo`, `/exportaciones`, `/geo`)
- [ ] Conexión a Supabase con SQLAlchemy async
- [ ] Health check endpoint + docs OpenAPI funcionando
- [ ] Tests de integración básicos (pytest + testcontainers o Supabase test project)

---

## FASE 2 — ETL: Datos ya disponibles (CSVs + GeoServer INYM)
**Estado: PENDIENTE** · Dependencias: Fase 1

### 2a — Carga de CSVs históricos
- [ ] Script `etl_csv_historicos.py`: lee los 7 CSVs, normaliza separadores (`;`), limpia símbolos `$` y `.` de los números, y carga a las tablas `ym.*` del schema
- [ ] Validar rangos: producción 2011–presente, precios 2017–presente, superficies 2010–presente
- [ ] Documentar limitaciones conocidas: consumo interno parece constante por año (mismo valor repetido en los 12 meses) — revisar si es dato anual distribuido uniformemente

### 2b — GeoServer INYM
- [ ] Correr `etl_inym_gis.py --dry-run` contra la API real (`gis.inym.org.ar/geoserver_disabled/wfs`)
- [ ] Registrar esquemas reales de columnas de capas de polígono (edad/densidad/consociado) — probablemente difieren de los supuestos
- [ ] Corregir ETL según lo que devuelva el dry-run
- [ ] Carga completa a `inym_gis.raw_features` + tabla especializada `inym_gis.secaderos`
- [ ] Documentar: URL, frecuencia sugerida (mensual/semanal), capas no disponibles

---

## FASE 3 — ETL: Fuentes externas
**Estado: PENDIENTE** · Dependencias: Fase 1

### 3a — INDEC
- [ ] **IPC mensual**: API INDEC (`apis.datos.gob.ar`) — serie IPC Nacional, base 2016=100
- [ ] **EMAE**: API INDEC — Estimador Mensual de Actividad Económica
- [ ] **Comercio exterior HS 0903**: exportaciones e importaciones de yerba mate por NCM
- [ ] **Proyecciones de población**: Censo 2022 + proyecciones por provincia
- [ ] Documentar: endpoints, lag de publicación (~30 días), series históricas disponibles

### 3b — BCRA
- [ ] **REM (Relevamiento de Expectativas de Mercado)**: inflación y PBI esperados — disponible como Excel en BCRA, frecuencia mensual
- [ ] Documentar: URL descarga, formato (Excel con múltiples sheets), variables a extraer

### 3c — INYM (scraper PDF/HTML)
- [ ] Mapear estructura de `inym.org.ar/noticias/estadisticas/` — qué PDFs/tablas HTML hay disponibles
- [ ] Scraper/parser para:
  - Salida de molino (mercado interno + externo), mensual
  - Mezcla de envases (% por tamaño)
  - Ingreso de hoja verde a secadero (kg)
- [ ] Documentar: frecuencia de publicación, lag, formato (PDF vs HTML)

### 3d — Clima (NASA POWER)
- [ ] ETL contra API NASA POWER (`power.larc.nasa.gov/api/`) para Misiones y Corrientes:
  - Precipitación mensual (PRECTOTCORR)
  - Temperatura media mensual (T2M)
  - Coordenadas clave: Apóstoles (~-27.9, -55.8), Oberá, Montecarlo, Virasoro
- [ ] Crear variables rezagadas (lag 6, 12, 18, 24 meses) — la cosecha que se consume hoy se cosechó 6-24 meses atrás
- [ ] Documentar: API gratuita sin auth, resolución espacial (~0.5°x0.5°), cobertura histórica

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

1. **Datos mensuales vs anuales**: varios CSVs repiten el mismo valor en los 12 meses de un año (consumo per cápita, precios, superficies). Confirmar si son datos anuales interpolados o datos reales mensuales antes de usarlos en series temporales.
2. **GeoServer INYM**: la URL base tiene `/geoserver_disabled/` — verificar si sigue activa o si cambió.
3. **Siria como principal exportador**: dato que va contra la intuición económica pura, está documentado y es correcto — dummy de diáspora es crítica en el modelo gravitacional.
4. **Importaciones**: el CSV muestra 83.333 kg/mes constante (= 1.000.000 kg/año) — confirmar si es el valor real o un placeholder.
5. **Precio FOB**: aparece como `$ 1,80` constante en 2011 en todos los registros del dataset principal — revisar si es un supuesto inicial o dato real.

---

## ORDEN DE PRIORIDAD PARA ARRANCAR

1. **Hoy**: Fase 0 (repo + estructura)
2. **Próximo**: Fase 1 (schema ym.* + FastAPI skeleton)
3. **Luego**: Fase 2a (carga CSVs) + Fase 2b (dry-run GeoServer INYM)
4. **Después**: Fase 3 (fuentes externas, en paralelo por fuente)
5. **Cuando los datos estén**: Fases 4 + 6 en paralelo
6. **Al final**: Fase 5 ML (validar datos primero antes de modelar)
7. **Al deployar**: Fase 7
