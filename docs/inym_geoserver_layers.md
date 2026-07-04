# Capas GeoServer del INYM (descubiertas manualmente, no documentadas públicamente)

Base URL: https://gis.inym.org.ar/geoserver_disabled/wfs
Workspace: shapes_inym
Formato: GeoJSON, SRID nativo 3857

**Estado confirmado 2026-07-01**: la API está VIVA (a pesar de `/geoserver_disabled/`
en la URL — probablemente el nombre quedó de una migración vieja del INYM y
nunca se actualizó). Se corrió `etl_inym_gis.py --dry-run` contra las 20 capas
reales, todas responden con datos. Esquemas reales de columnas confirmados
abajo (algunos difieren de lo asumido inicialmente).

## Límites
- view_superficie_por_municipios — cols: `id_munic, id_depto, id_pcia, pcia, depto, municipio, sup_ym, superficie` (82 features)
- view_superficie_por_departamentos — cols: `id_depto, id_pcia, pcia, depto, sup_ym, superficie` (19 features)
- view_superficie_por_provincias — cols: `pcia, sup_ym, superficie` (2 features: Misiones y Corrientes)
- view_superficie_por_zonas — cols: `id, zona, sup_ym, superficie` (6 features)

**Ojo con `sup_ym` vs `superficie`**: `sup_ym` es la superficie efectivamente
cultivada con yerba mate (hectáreas); `superficie` es la superficie TOTAL de
la unidad administrativa (mucho más grande, ej. depto Apóstoles: sup_ym
18.359 ha vs superficie 102.939 ha). No confundir — `sup_ym / superficie` da
el % de uso del suelo dedicado a yerba mate.

## Edad de plantación
- view_superficie_edad_por_municipios / _departamentos / _provincias / _zonas
- cols base iguales a "Límites" + una columna `anio` (TEXT) que empaqueta la
  serie histórica completa como string delimitado, no como filas normalizadas:
  `"S/D: 1.071,04;2024: 13,61;2023: 6,14;...;2007: ,99"` (formato `año: ha_con_esa_edad;...`,
  `S/D` = sin dato/no clasificado). **Requiere un parser aparte** para explotar
  esto en filas `(anio_plantacion, hectareas)` si se quiere usar como serie temporal —
  no está implementado todavía, es trabajo de Fase 2b/3 pendiente.

## Densidad de plantación
- view_superficie_densidad_por_municipios / _departamentos / _provincias / _zonas
- cols base + `densidad` (TEXT), mismo patrón de empaquetado: tres franjas
  (BAJA/MEDIA/ALTA densidad) cada una con su desglose de plantas/ha separado
  por `@` y `;`, ej. `"BAJA Densidad: 108,13@833 plantas: 31,83;1111 plantas: 76,30//MEDIA..."`.
  Mismo comentario: requiere parser dedicado para normalizar.

## Cultivo consociado
- view_superficie_consociado_por_municipios / _departamentos / _provincias / _zonas
- cols base + `sup_cons` (ha consociadas), `sup_sin_cons` (ha sin consociar) YA
  normalizadas como números, más `consociado` (TEXT) con el desglose por tipo
  de cobertura (Heterogénea/Homogénea/Total), mismo patrón empaquetado que arriba.
  Los acentos (`Heterogénea`) están correctos en UTF-8 — si se ven mal en la
  consola de Windows es solo el codepage de cmd.exe, no corrupción de datos.

## Secaderos
- view_mat_gis_marketing_puntos_secaderos (puntos) — cols: `id, idplanta, dir_catastral, longitud, latitud` — **esquema confirmado igual al asumido**, 203 features
- view_gis_marketing_secaderos_por_municipios / _departamentos / _provincias / _zonas
  — cols: `id_munic/id_depto/id_pcia/id, municipio/depto/pcia/zona, cant, superficie`
  (`cant` = cantidad de secaderos agregada por unidad administrativa; ojo que
  aquí `superficie` es la misma superficie total del área, no ha de yerba)

## NO disponibles (existen en el menú del visor pero no disparan request)
- Superficies por Cob. de Árboles
- Mapas de Calor de Cultivos

## Diseño de carga (ya implementado en `backend/db/schema.sql` / `etl_inym_gis.py`)
El diseño original de cargar todo a `inym_gis.raw_features` con `properties JSONB`
sin asumir esquema fijo resultó ser la decisión correcta: cada capa devuelve
columnas distintas y algunas (edad/densidad/consociado) empaquetan sub-series
dentro de un solo campo string. La tabla genérica + JSONB soporta esto sin
cambios. Antes de usar edad/densidad/consociado en un modelo hay que sumar un
parser que explote esos campos empaquetados en filas normalizadas.