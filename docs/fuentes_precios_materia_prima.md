# Fuente: precio de la materia prima — hoja verde y yerba canchada

Documenta la procedencia de `ym.precios.precio_hoja_verde_ars` /
`precio_canchada_ars` (categoría B en `docs/auditoria_datos.md` hasta
2026-07-12: real, sin fuente citada). Investigado y validado 2026-07-12.

## Marco legal

El precio de la materia prima (hoja verde y yerba canchada) que pagan
secaderos/molinos a los productores tiene base legal en la **Ley 25.564**
(creación del INYM, 2002) y su **Decreto Reglamentario 1240/02**: el
Directorio del INYM debe fijarlo por unanimidad, en sesión especial, cada
semestre (abril-septiembre / octubre-marzo). Si no hay unanimidad — el caso
habitual en años recientes — lo fija por resolución la **Secretaría de
Agricultura, Ganadería y Pesca de la Nación (SAGyP)**, bajo Ministerio de
Economía.

## Dónde se publica

**No** está en los PDFs mensuales de estadísticas que ya scrapea
`etl_inym_pdf.py` (`inym.org.ar/descargar/publicaciones/estadisticas/`) — esos
traen ingreso de hoja verde por zona y salida de molino, no precio de materia
prima. La fuente real son dos secciones separadas de `inym.org.ar`:

- `inym.org.ar/tramites/normativa/` — texto de cada resolución numerada (ej.
  "RESOL-406-2023-APN-SAGYP_MEC — Valores de la Materia Prima"). Algunos slugs
  de este listado dieron 404 al revisarlos — no asumir URLs estables sin
  revalidar antes de automatizar.
- `inym.org.ar/noticias/precio/` — notas de prensa institucionales que
  anuncian cada resolución nueva con la tabla de valores y el número de
  resolución. Confirmado accesible y estable.

## Cadencia real

Semestral por resolución, con **escalonamiento por sub-período dentro del
semestre** (a veces mensual) — consistente con el patrón ya documentado en
`ym.precios` de "mismo valor durante varios meses seguidos, cambia cuando
sale la resolución siguiente". Desde marzo 2024 el INYM pasó a fijar precio
de referencia con frecuencia mensual (nota de El Territorio, 21/03/2024).

**⚠️ Mecanismo discontinuado 2026-03-31**: el Directorio del INYM rechazó
seguir fijando precio de referencia, por considerarlo contrario al Decreto
812 (desregulación). No hay garantía de que sigan publicándose valores
nuevos después de esa fecha — si `ym.precios` no tiene datos posteriores a
marzo-mayo 2026, es consistente con esto, no un problema del ETL.

## Validación (2026-07-12)

Resolución 406/2023 SAGyP (27/10/2023), anunciada en
[inym.org.ar/noticias/precio/80394](https://inym.org.ar/noticias/precio/80394-se-encuentran-vigentes-nuevos-precios-para-la-materia-prima.html),
vigente octubre 2023–marzo 2024:

| Período | Hoja verde (ARS/kg) | Canchada (ARS/kg) | `data/raw/precios_historicos.csv` |
|---|---|---|---|
| 1/12/2023–31/1/2024 | 210,00 | 798,00 | Enero 2024: $210,00 / $798,00 ✓ |
| 1/2–29/2/2024 | 240,00 | 912,00 | Febrero 2024: $240,00 / $912,00 ✓ |
| 1/3–31/3/2024 | 250,00 | 950,00 | Marzo 2024: $250,00 / $950,00 ✓ |

Coincide exacto — confirma que el CSV semilla del proyecto viene de estas
resoluciones (probablemente compilado a mano recorriendo `noticias/precio/`
mes a mes). No se validó el salto a $379,26 (hoja verde, jun-2025) contra una
resolución puntual — pendiente si se quiere cerrar del todo la serie 2025.

## Fuentes alternativas (si INYM no publica de forma estructurada)

- **El Territorio** (elterritorio.com.ar) — cobertura periodística sistemática
  de cada resolución, con tablas, casi en tiempo real.
- **Centro CEPA** (centrocepa.com.ar) — informes "Análisis sobre la evolución
  reciente del complejo yerbatero", compilan estos precios con contexto.
- **trivia.consejo.org.ar** — indexa las resoluciones SAGyP/MEC por número.

## Clasificación final

**Categoría B → A** (real, fuente primaria identificada y validada con 3
meses de coincidencia exacta). No se modificó ningún valor en la base — esto
es solo documentación de procedencia.
