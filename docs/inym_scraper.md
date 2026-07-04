# Scraper INYM (PDF) — Fase 3c

**Estado 2026-07-01: implementado y validado con dry-run real.** El sitio
había caído a mitad de la primera exploración (ver historial más abajo);
al volver se completó el mapeo y se escribió `backend/etl/etl_inym_pdf.py`.

## Fuente

`https://inym.org.ar/descargar/publicaciones/estadisticas/{página}.html`

**NO usar** `/noticias/estadisticas/{año}.html` — esa ruta son noticias de
prensa con acumulados irregulares (enero, enero-bimestre, enero-trimestre...),
no series limpias.

- `2019.html` ... `2026.html` — un informe **mensual** por página, ~12 PDFs/año
- `2018-a-2011.html` — página única con 8 informes **anuales** (2011-2018),
  cada uno con el detalle completo de los 12 meses de ese año adentro
- Cada link de descarga es `https://inym.org.ar/descargar.html?archivo=<token>`,
  `Content-Type: application/pdf`, ~1.3 MB cada uno

## Estructura del PDF (confirmada con `PyMuPDF.find_tables()`, no regex)

Cada PDF mensual (~8 páginas) trae, en tablas reales (no imágenes):

1. **Cuadro 1. Ingreso de Hoja Verde por Zona** — detalle del período
   reportado por zona (Centro/Noroeste/Noreste/Oeste/Sur/Corrientes/Total).
   Confirma que "Avance de Cosecha" = ingreso de hoja verde a secadero.
2. **Cuadro 2. ... Comparativo Enero-{mes}** — acumulado por zona, año a
   año (no se carga, es redundante con el detalle mensual de Cuadro 1 across
   todos los informes).
3. **Cuadro 3. Ingreso de Hoja Verde - Histórico** — total nacional (sin
   desagregar por zona) por mes, columnas = últimos ~5 años. Redundante con
   Cuadro 1 (se descarta explícitamente en el parser para no duplicar).
4. **Cuadro 5. Salida de Molino – Mercado Interno – Histórico** — por mes,
   columnas = últimos ~5 años.
5. Página de "Análisis de Ventas según Formato" (mezcla de envases) — es un
   **gráfico circular, no una tabla real** (`find_tables()` devuelve 0 acá).
   **No se scrapea**: ya está cubierta por `ym.consumo_interno`
   (`envase_05kg_pct`, etc.) desde los CSV históricos — los valores no son
   idénticos entre ambas fuentes (miden puntos distintos de la cadena
   comercial) pero no vale la pena parsear un gráfico para una variable
   redundante.
6. **Cuadro 6. Salida ... Mercado Externo – Histórico** — igual que el 5,
   para exportaciones.

Los PDFs **anuales** (2011-2018) tienen el mismo contenido pero repartido
distinto: el Cuadro de hoja verde por zona trae los 12 meses de ESE año en
una sola tabla (filas `enero-12`, `febrero-12`, ...), y el cuadro de salida
de molino histórico solo cubre **mercado interno** — no se encontró tabla de
mercado externo en el PDF anual de 2012 (puede que exista en otra sección no
revisada, o que el reporte de exportaciones separado no exista para años
viejos — no confirmado, pendiente si hace falta).

## Por qué NO coincide con los datos que ya teníamos

"Salida de molino" (declaraciones juradas del INYM) y "consumo
interno"/"exportaciones" de `dataset_principal.csv` **miden cosas
distintas** — confirmado con datos reales de enero 2025:
- Consumo interno (CSV, suma de las 7 ciudades): 20.129.952 kg
- Salida de molino mercado interno (PDF): 22.038.385 kg
- Exportaciones (CSV, suma de las 7 ciudades): 3.521.544 kg
- Salida de molino mercado externo (PDF): 2.498.081 kg

Son cercanos pero no iguales (~9-29% de diferencia) — puntos distintos de
la cadena de estimación/declaración. Por eso se cargan en tablas separadas
(`ym.inym_hoja_verde_zona`, `ym.inym_salida_molino`), no se pisan con lo
existente.

## Bug encontrado y corregido durante el desarrollo

El detector de encabezado de tabla (`_encontrar_header`) inicialmente
buscaba la palabra "ZONA" en toda la fila — pero el título de la tabla
("Cuadro 1. Ingreso de Hoja Verde **por Zona**") también contiene esa
palabra, causando falsos positivos que tomaban el título como si fuera el
encabezado real. Se corrigió exigiendo que una CELDA individual sea
exactamente un nombre de zona (`ZONA CENTRO`, etc.), no que la fila la
mencione en cualquier parte.

## Limitación conocida: anomalías puntuales de layout

Al menos un informe (**Junio 2025**) tiene el título y el encabezado de la
tabla de hoja verde fusionados en una sola celda mal formada por PyMuPDF
(probablemente por un salto de columna distinto ese mes) — ese archivo
puntual devuelve 0 filas de hoja verde. No se investigó a fondo (afecta un
solo archivo de ~104); si hace falta rescatar ese mes puntual, revisar
manualmente con `fitz` + `find_tables()` sobre ese PDF.

## Historial de la caída del sitio (2026-07-01, sesión anterior)

El sitio `inym.org.ar` se cayó a mitad de la primera exploración (pasó de
522 Cloudflare a timeout total, ni la home respondía). No era un bloqueo de
nuestro lado — volvió a responder normalmente unas horas después y se pudo
completar el mapeo sin cambios adicionales.
