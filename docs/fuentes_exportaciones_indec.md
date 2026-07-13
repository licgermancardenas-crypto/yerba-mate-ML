# Fuente: comercio exterior de yerba mate (INDEC Comercio Exterior)

Reemplaza el desglose mensual/por destino de `ym.exportaciones` (anulado el
2026-07-11 por ser sintético, ver `docs/auditoria_datos.md`) y a
`ym.importaciones` (categoría B / parcialmente anulado, sin fuente
documentada) como fuente de verdad para comercio exterior de yerba mate.

Mismo endpoint, mismo formato, un solo parámetro distinto
(`commerceType=export` vs. `commerceType=import`) — la lógica de fetch/
transformación/upsert está compartida en `backend/etl/lib_indec_comex.py`,
usada por `etl_indec_comex_exportaciones.py` y `etl_indec_comex_importaciones.py`.

## Fuente primaria

INDEC, Sistema de Consulta de Comercio Exterior de Bienes — `comex.indec.gob.ar`.
Backend REST público sin autenticación, descubierto detrás de la UI web:

```
GET https://comexbe.indec.gob.ar/public-api/search/
    ?commerceType=export
    &year={año}
    &period=month
    &countryQuery=allCountries
    &products=["09030010","09030090"]
    &countries=[]
```

Devuelve, para todo un año en una sola llamada, una fila por (mes, NCM, país):

```json
{
  "product": { "id": "09030010", "description": { "es": "Yerba mate simplemente canchada" } },
  "country": { "name": "Chile", "iso2": "CL", "id": "208" },
  "month": 8,
  "amount": 484285.77,
  "weight": 329224
}
```

## Posiciones NCM

Yerba mate tiene posición arancelaria propia de 8 dígitos — a diferencia de la
serie de `apis.datos.gob.ar/series` (ya evaluada y descartada en Fase 3a), acá
no viene mezclada con café/té/especias:

- `09030010` — Yerba mate simplemente canchada
- `09030090` — Yerba mate excluida simplemente canchada (la gran mayoría del volumen)

## Cobertura

Mensual, por país, **2002 hasta el presente** (2026 ya tiene meses cargados,
parcial). Se carga todo el rango completo, no solo desde 2011 como el resto
del proyecto.

## Secreto estadístico

Cuando hay pocos operadores para una combinación NCM×país×mes, esa fila viene
con `"isConfidential": true` y `weight`/`amount` en 0 — **ese 0 es un dummy,
no un valor real**. Se carga como `NULL` en `peso_kg`/`monto_fob_usd`
(`es_confidencial = true`), nunca como 0, siguiendo la regla del proyecto de
que NULL es el único valor válido para "sin dato" (ver `docs/auditoria_datos.md`,
Etapa 4 regla 2).

Tasa de confidencialidad real cargada (2002-2026): 1.425 de 6.094 filas
(23,4%) — concentrada casi toda desde 2018 en adelante; 2002-2017 no tiene
ninguna fila confidencial.

**Bucket "Confidencial" (`pais_iso2='ZZ'`)**: además de marcar filas
individuales como confidenciales, INDEC también reporta un país-placeholder
`ZZ` ("Confidencial") con el **agregado real** de todo lo enmascarado ese
mes — no es una fila NULL, tiene peso/monto reales. Se carga igual que
cualquier otro país (queda en la tabla), pero el frontend lo excluye
explícitamente del desglose por destino y del mapa de flujos (no es un país
geolocalizable) — sí queda incluido en cualquier total nacional que sume
todos los países.

## Validación (2026-07-11/12)

Suma de `peso_kg` no confidencial, 2025, todas las posiciones/países:
**55.633.560 kg** vs. el total oficial publicado por el INYM para 2025
(**57.980.911 kg**, comunicado oficial 02/02/2026) → **96,0% de cobertura**.
El 4% restante es el volumen bajo secreto estadístico sin país publicado.

## Gotcha real encontrado en la carga (2026-07-12)

INDEC reporta algunas zonas aduaneras especiales como "país" separado
compartiendo el mismo ISO2 que el país real — ej. `"Chile"` (id 208) y
`"Punta Arenas (Chile)"` (id 261) ambos con `iso2="CL"`. Rompe la PK
`(anio, mes, ncm, pais_iso2)` si no se agregan antes de insertar. El ETL
(`backend/etl/etl_indec_comex_exportaciones.py`) suma estas filas por
`(mes, ncm, pais_iso2)` antes del upsert — `es_confidencial` queda `True`
solo si **todas** las filas agregadas para esa clave lo son.

## Esquema

`ym.exportaciones_indec` / `ym.importaciones_indec` — mismas columnas
`(anio, mes, ncm, pais_iso2, pais_nombre, peso_kg, monto_fob_usd,
es_confidencial)`, PK `(anio, mes, ncm, pais_iso2)`. Ver `backend/db/schema.sql`
secciones 14-15 y migraciones `004_indec_exportaciones_2026-07-12.sql` /
`005_indec_importaciones_2026-07-12.sql`.

## Endpoints

- `GET /exportaciones/indec` (`anio_desde`, `anio_hasta`, `pais_iso2` opcionales)
- `GET /importaciones/indec` (mismos parámetros, `pais_iso2` = país de origen)

Ambos agregan las 2 posiciones NCM por país/mes; `es_confidencial` verdadero
solo si NINGUNA de las 2 posiciones tiene dato real ese mes.

## Importaciones — sin secreto estadístico

A diferencia de exportaciones, las 340 filas cargadas de importaciones
(2002-2026) tienen **0% de confidencialidad** — los volúmenes de importación
son mucho menores y aparentemente no disparan el umbral de secreto
estadístico del INDEC. Validación: 2020 da 31.399.188,94 kg reales vs.
31.400.004 kg que ya estaba cargado en `ym.importaciones` (categoría B, sin
cita de fuente) → Δ 0,003%, confirma que el dato original del CSV semilla
venía de esta misma fuente (o una equivalente) — solo que 2011-2018 habían
quedado congelados/fabricados ahí. `ym.importaciones_indec` reemplaza a
`ym.importaciones` como fuente de verdad para el frontend.

## Re-ejecutar los ETL

```
python -m backend.etl.etl_indec_comex_exportaciones --dry-run
python -m backend.etl.etl_indec_comex_exportaciones --start-year 2002 --end-year 2026

python -m backend.etl.etl_indec_comex_importaciones --dry-run
python -m backend.etl.etl_indec_comex_importaciones --start-year 2002 --end-year 2026
```

Idempotentes (upsert por PK) — correr de nuevo actualiza los años ya
cargados sin duplicar. Pensado para correrse periódicamente (mensual)
vía GitHub Actions cuando se implemente esa pieza de Fase 7 (pendiente).

## Coordenadas del mapa de flujos

`frontend/lib/paises-destino.ts` solo tiene coordenadas (capital del país,
aproximación ilustrativa) para los ~30 destinos con volumen histórico
relevante — un país fuera de esa lista simplemente no dibuja arco en el
mapa (no rompe nada, mismo criterio que ya existía para "Others" con los
datos viejos). Si un país nuevo empieza a tener volumen significativo,
agregar su entrada ahí.
