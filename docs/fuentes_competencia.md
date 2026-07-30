# Fuentes de datos — `ym.competencia`

## Actualización 2026-07-29 — `noticiasdelmate.com` volvió a estar disponible

El timeout DNS persistente documentado en julio (bloqueaba 2+ sesiones distintas) se resolvió solo, sin cambios de nuestro lado — confirmado accediendo al sitio directamente. Esto permitió encontrar 3 fuentes nuevas con desglose real por empresa que no existían en el research anterior (2019, 2021 ampliado a top 10, 2022). Detalle en las secciones correspondientes más abajo. **2022 y 2023 siguen sin desglose por empresa a nivel año calendario completo** — ver sección "2022, 2023" actualizada.

**Denominadores usados para calcular `cuota_mercado_pct` en esta ronda**: en vez de usar el total de mercado que cita cada nota de prensa (que varía ligeramente entre fuentes), se usó `ym.dataset_principal_anual.consumo_interno_kg` (ciudad='(nacional)') ya cargado y auditado en este proyecto — 2019: 277.332.013 kg; 2021: 282.849.996 kg; 2022: 275.809.501 kg. Se cruzó contra los totales que citan las fuentes de prensa (277M, 282,85M/282.989.915, 275.807.989 respectivamente) — coinciden dentro de ±0,05%, confirmando que ambas fuentes miden lo mismo (despacho a mercado interno).

### 2019 — 6 de ~15 empresas (año calendario completo)

Fuente: [Ranking Yerbatero 2019: Un año verde marcado por el "regreso" de Las Marías, la confirmación de Playadito, y el desempeño de La Tranquera](https://economis.com.ar/ranking-yerbatero-2019-un-ano-verde-marcado-por-el-regreso-de-las-marias-la-confirmacion-de-playadito-y-el-desempeno-de-la-tranquera/) — Economis. El artículo confirma explícitamente que cubre el cierre del año calendario 2019 ("277 millones de kilos" vendidos en el mercado interno ese año — coincide con el total ya auditado en `ym.dataset_principal_anual`). **Fecha de publicación exacta no confirmada** (la página solo muestra "6 años atrás" relativo a la fecha de acceso) — se cargó `2020-02-01` como aproximación, consistente con el patrón de publicación de este tipo de nota (enero-marzo del año siguiente). El artículo no cita a INYM explícitamente en el texto, a diferencia de otros artículos de la misma serie.

| Empresa | Kg | % (sobre 277.332.013 kg) |
|---|---|---|
| Las Marías | 50.600.000 | 18,25% |
| Playadito | 35.600.000 | 12,84% |
| La Cachuera (Amanda) | 21.700.000 | 7,82% |
| J. Llorente y Cía (La Tranquera) | 10.800.000 | 3,89% |
| Andresito | 8.300.000 | 2,99% |
| Gerula (Romance) | 7.700.000 | 2,78% |

### 2021 — ampliado a top 10 (antes solo 2 de ~14 empresas)

Fuente nueva: [Las marcas de yerba mate más vendidas en la Argentina en el 2021](https://noticiasdelmate.com/las-marcas-de-yerba-mate-mas-vendidas-en-la-argentina-en-el-2021/) — Noticias del Mate, 2022-01-14, cita a `www.economis.com.ar` como fuente de los datos. Confirma "mercado interno acumuló 282,85 millones de kilos" en 2021 — coincide con el total ya auditado. Se agregaron 7 empresas nuevas (Playadito y J. Llorente ya estaban cargados desde el research de julio con fuente propia — Plan B Misiones/Agrofy — y **no se tocaron** para no mezclar 2 fuentes en la misma fila; los valores de esta fuente nueva para esas 2 empresas — Playadito 40M kg/14,14%, Llorente 7,9M kg/2,79% — son consistentes con lo ya cargado, ligera diferencia de redondeo).

| Empresa | Kg | % (sobre 282.849.996 kg) |
|---|---|---|
| Las Marías (Taragüí) | 54.000.000 | 19,09% |
| CBSé | 22.000.000 | 7,78% |
| La Cachuera (Amanda) | 18.000.000 | 6,36% |
| Rosamonte | 15.600.000 | 5,52% |
| Verdeflor | 11.800.000 | 4,17% |
| Andresito | 10.200.000 | 3,61% |
| Cachamai/Cachamal ⚠️ (misma ambigüedad de nombre ya documentada para 2025) | 9.500.000 | 3,36% |

No se cargó "Cruz de Malta (Yerbatera Misiones)" de esta fuente — el artículo la menciona como "15+ millones de kg" sin cifra exacta, no alcanza el estándar de precisión del resto de las filas.

### 2022 — 3 de ~65 empresas (año calendario completo, primer dato real para este año)

Fuente: [Yerba: ¿Qué marcas dominaron el mercado en un año top?](https://economis.com.ar/yerba-que-marcas-dominaron-el-mercado-en-un-ano-top/) — Economis. El foco del artículo es 2023 (parcial, enero-octubre, no cargado — no califica como año calendario completo), pero cita 3 cifras de 2022 completo como comparación interanual, con lenguaje explícito ("vendió 41 millones **en todo el año pasado**", "56,7 millones de kilos vendidos **en 2022**", "**en 2022** había ocupado el puesto catorce, con 6.393.280 kilos"). **Fecha de publicación exacta no confirmada** (misma limitación que el artículo de 2019) — se cargó `2023-11-01` como aproximación (coherente con datos "hasta octubre" de 2023 ya cerrados en el texto).

| Empresa | Kg | % (sobre 275.809.501 kg) |
|---|---|---|
| Las Marías | 56.700.000 | 20,56% |
| Playadito | 41.000.000 | 14,87% |
| Andresito | 6.393.280 | 2,32% |

Este mismo artículo también confirma el total de mercado interno 2022 (**275.807.989 kg**, casi idéntico a los 275.809.501 kg ya auditados en `ym.dataset_principal_anual` — diferencia de 1.512 kg, redondeo) — primera vez que se documenta una cifra real de cierre para este año (antes solo había un acumulado enero-noviembre sin cerrar, ver sección "2022, 2023" abajo).

## Actualización 2026-07-29 (continuación) — 2016 y 2017 encontrados

Retomando el pendiente de 2011-2018 (quedaba 100% vacío tras la ronda anterior del mismo día).
Fuente: [La pelea por el mercado de la yerba mate: Las Marías lidera, pero Liebig no para de crecer y Rosamonte relegó a Molinos](https://economis.com.ar/la-pelea-por-el-mercado-de-la-yerba-mate-las-marias-lidera-pero-liebig-no-para-de-crecer-y-rosamonte-relego-a-molinos/)
— Economis, cita explícita al INYM ("despachos a salida de molino"). Fecha de publicación exacta no
confirmada (misma limitación que otros artículos de esta serie) — se cargó `2018-02-01` como
aproximación. Total de mercado citado ("casi 260 millones de kg") coincide con el real ya auditado
en `ym.dataset_principal_anual` para 2017 (259.904.609 kg) — confirma que el artículo mide lo mismo
que nuestro denominador.

**2017 — top 10 completo**, verificado con 2 lecturas literales del texto original antes de cargar
(mismo método de toda la sesión):

| Empresa | % | Kg |
|---|---|---|
| Las Marías | 19,5% | 50.681.398 (derivado, ver nota) |
| Playadito (Liebig) | 11,7% | 30.400.000 (directo del texto) |
| Rosamonte | 9,0% | 23.391.415 (derivado) |
| Molinos | 8,5% | 22.091.892 (derivado) |
| La Cachuera | 7,9% | 20.532.464 (derivado) |
| Establecimiento Santa Ana (CBSé) | 6,2% | 16.114.086 (derivado) |
| Llorente | 3,9% | 10.136.280 (derivado) |
| Cooperativa de Santo Pipó (Piporé) | 3,4% | 8.836.757 (derivado) |
| Cooperativa de Monte Carlo (Aguantadora) | 3,4% | 8.836.757 (derivado) |
| Gerula (Romance) | 3,1% | 8.100.000 (directo del texto) |

**Kg "derivado"** = % × 259.904.609 kg (mercado interno real 2017, ya validado en `ym.dataset_principal_anual`),
usado para las empresas donde el texto solo da % sin kg. **Discrepancia real encontrada y resuelta**:
el texto dice explícitamente "La empresa de Gobernador Virasoro [Las Marías] vendió 55 millones de
kilos" — pero 55M/259,9M = 21,16%, no 19,5% (el % que el mismo texto atribuye a Las Marías). Verificado
que Playadito (30,4M/259,9M = 11,70%) y Gerula (8,1M/259,9M = 3,12%) SÍ cruzan casi exacto entre su %
y su kg citados — así que se descartó la cifra de "55 millones" para Las Marías como error puntual del
artículo (probable errata) y se usó el kg derivado del % en su lugar, igual que el resto de las filas
sin kg propio.

**2016 — parcial (4 de ~14 empresas)**, citadas como comparación interanual dentro del mismo artículo
(denominador real 2016: 252.138.365 kg, `ym.dataset_principal_anual`):

| Empresa | % | Kg (derivado) |
|---|---|---|
| Las Marías | 21,1% | 53.201.196 |
| Playadito | 10,3% | 25.970.251 |
| Molinos | 9,4% | 23.701.006 |
| La Cachuera | 8,2% | 20.675.346 |

La Cachuera 2016 es derivado en 2 pasos: el texto no da el % de 2016 directo, dice "conservó [el 5°
lugar] con el 7,9% del mercado [2017], **un 0,3 punto porcentual menos que el año anterior**" → 2016 = 7,9 + 0,3 = 8,2%.

**Coincidencia real, no error de carga**: Monte Carlo y Santo Pipó reportan la MISMA cuota (3,4%) en
2017 — confirmado con 2 lecturas literales del artículo, es un redondeo real de la fuente entre 2
empresas de participación similar. Documentado en `backend/etl/audit_datos.py` (T6, `permite_repeticion_anual`)
para que no dispare una alerta de CI sin contexto.

**Con esto, el hueco 2011-2018 se reduce a 2011-2015** (6 años, sigue sin fuente encontrada) — 2016 y
2017 quedan con dato real.

## Contexto (auditoría 2026-07-04, Fase 8)

El `data/raw/competencia.csv` original (presente desde el commit de scaffolding inicial, antes de cualquier sesión documentada) tenía **relleno sintético** en 13 de 15 años: 2011-2021 con el mismo valor exacto repetido, y 2022-2024 interpolados linealmente hacia un valor de 2025 — sin ninguna fuente real. Ver diagnóstico completo en `TODO.md` (Fase 8).

Se reemplazó por **solo datos con fuente verificable**. Todo lo demás quedó `NULL` en `ym.competencia` — nunca 0, nunca inventado. Los dos años con dato real hoy son **2021** (parcial, 2 de ~14 empresas) y **2025** (top 20 de 65 empresas totales).

**Lección para años futuros**: antes de cargar un ranking de prensa, verificar explícitamente qué período calendario cubre — los medios argentinos publican tanto rankings anuales (año calendario completo, con ~2 meses de rezago) como cortes mensuales/YTD, y ambos se referencian con lenguaje similar ("el ranking de yerba mate 2025"). En esta auditoría, una fuente que parecía cubrir "2025" en realidad era enero de 2025 únicamente (ver más abajo) — el año calendario 2025 completo lo cubre otra fuente distinta y posterior.

## Fuentes cargadas

### 2021 — parcial (2 de ~14 empresas)

| Empresa | Dato | Fuente | Medio | Fecha de publicación |
|---|---|---|---|---|
| Playadito | 14,4% cuota de mercado | [Cada vez hay menos yerbateras misioneras en el "top ten"...](https://planbmisiones.com/2023/03/04/nota/cada-vez-hay-menos-yerbateras-misioneras-en-el-top-ten-donde-suben-corrientes-y-cordoba/) | Plan B Misiones | 2023-03-04 |
| J. Llorente y Cía (La Tranquera) | 2,8% cuota / 7.900.000 kg (posición #10) | [Ranking de marcas: las 10 familias y cooperativas...](https://news.agrofy.com.ar/noticia/202283/ranking-marcas-10-familias-y-cooperativas-yerba-mate-que-manejan-tradiciones-mas) | Agrofy News | 2022-11-11 |

Ambas fuentes citan datos oficiales del INYM y declaran explícitamente que cubren el **año calendario 2021** (no un corte mensual). Se cruzó Playadito 14,4% con el mismo valor citado independientemente por Agrofy — coincide.

**Contexto adicional no cargado (solo referencia, no dato por empresa)**: Agrofy reporta para 2021 Top10 = 72,7% del mercado, Top3 ≈ 41%. No se cargó como fila individual porque no identifica qué 3 empresas exactamente ni su desglose — coincide aproximadamente con Las Marías+Playadito+Cbse de nuestro dataset previo (41,3%), pero no es una confirmación independiente empresa por empresa.

### 2025 — top 20 de 65 empresas totales (año calendario completo)

Fuente: [El ranking de las 20 yerbas más vendidas de la Argentina...](https://www.infobae.com/economia/2026/03/06/el-ranking-de-las-20-yerbas-mas-vendidas-de-la-argentina-cuales-son-las-dos-potencias-que-pelean-por-el-primer-puesto/) — Infobae, 2026-03-06, cita datos oficiales del INYM procesados por Plan B Misiones. Declara explícitamente "durante el año 2025" (año calendario completo, no YTD).

| Pos. | Empresa (en la fuente) | Empresa cargada en `ym.competencia` | Kg | % (sobre mercado total 267M kg) |
|---|---|---|---|---|
| 1 | Playadito | Playadito | 56.700.000 | 21,24% |
| 2 | Las Marías | Las Marias | 49.050.000 | 18,37% |
| 3 | CBSé | Cbse | 24.500.000 | 9,18% |
| 4 | La Cachuera (Amanda) | La Cachuera | 19.900.000 | 7,45% |
| 5 | Cordeiro (Verdeflor) | Cordeiro (Verde Flor) | 15.500.000 | 5,81% |
| 6 | Rosamonte | Hrenuk (Rosamonte) | 14.300.000 | 5,36% |
| 7 | Yerbatera Misiones SRL (Nobleza Gaucha, Cruz de Malta) | Yerbatera Misiones SRL | 10.900.000 | 4,08% |
| 8 | Coop. Montecarlo (Aguantadora, Pampa, Sinceridad) | Montecarlo (Aguantadora) | 9.300.000 | 3,48% |
| 9 | Llorente y Cía (La Tranquera) | J Llorente y Cia (La Tranquera) | 8.900.000 | 3,33% |
| 10 | Piporé | Pipore | 6.700.000 | 2,51% |
| 11 | Andresito | Yerbatera Andresito | 6.600.000 | 2,47% |
| 12 | Cachamai (Cachamate) | Gregorio Numo y Noel Werthein (Cachamal) ⚠️ | 6.300.000 | 2,36% |
| 13 | Romance | Gerula (Romance) | 5.700.000 | 2,13% |
| 14 | Navar SRL (Primicia) | Navar SRL (Primicia) — **empresa nueva** | 4.700.000 | 1,76% |
| 15 | Estab. Imhoff (Buen Día) | Establecimiento Imhoff (Buen Dia) — **empresa nueva** | 4.200.000 | 1,57% |
| 16 | Coop. La Hoja | Cooperativa La Hoja — **empresa nueva** | 4.100.000 | 1,54% |
| 17 | Bonafé (Más Sabor) | Bonafe (Mas Sabor) — **empresa nueva** | 3.700.000 | 1,39% |
| 18 | La Cumbrecita | La Cumbrecita — **empresa nueva** | 3.500.000 | 1,31% |
| 19 | Sanesa (Natura) | Sanesa (Natura) — **empresa nueva** | 3.200.000 | 1,20% |
| 20 | Mate Rojo | Mate Rojo — **empresa nueva** | 2.600.000 | 0,97% |
| — | Resto (45 empresas restantes de 65) | Others | 6.650.000 (residual) | 2,49% |

⚠️ **Empresa #12 sin confirmar al 100%**: la fuente dice "Cachamai (Cachamate)"; nuestro dataset previo tenía "Gregorio Numo y Noel Werthein (Cachamal)". Es muy probablemente la misma empresa (nombre/marca con variación menor entre fuentes — "Cachamal" vs "Cachamate" como marca, "Cachamai" como posible apócope del apellido), pero no se confirmó contra una fuente primaria (padrón INYM). Revisar antes de usar este dato para análisis de precisión.

**Denominador usado**: mercado total 2025 ≈ 267 millones de kg (citado en nota de Centro CEPA sobre concentración de mercado, enero 2025). Los % de la tabla son kg-de-la-empresa / 267M — no vienen directamente de la fuente (que solo da kg absolutos), así que quedan sujetos al error de ese denominador. `Others` es el residual (267M − suma del top 20), no una cifra publicada directamente.

**Molinos Río de la Plata**: no aparece como línea propia en el ranking 2025 (queda `NULL` en `ym.competencia`, no 0). Ver sección siguiente.

### 2024 — parcial (2 de ~65 empresas)

| Empresa | Dato | Fuente | Medio | Fecha de publicación |
|---|---|---|---|---|
| Las Marías | 50.000.000 kg → 19,32% | [Exclusivo: El "top 20" yerbatero, Playadito N°1 y las ganadoras y perdedoras de un año de dura competencia](https://planbmisiones.com/2026/02/25/nota/exclusivo-el-top-20-yerbatero-playadito-n1-y-las-ganadoras-y-perdedoras-de-un-ano-de-dura-competencia/) | Plan B Misiones | 2026-02-25 |
| Playadito | 47.100.000 kg → 18,20% | ídem | ídem | ídem |

Estos dos valores aparecen como base de comparación interanual dentro de la nota retrospectiva completa de 2025 (no son el foco del artículo, pero están citados como cifras cerradas de 2024, con fuente INYM). Denominador usado: **258.789.745 kg**, mercado interno 2024 según cierre oficial INYM (`inym.org.ar`, nota "el cierre del 2025 marcó un crecimiento del 7,3%..."), consistente con el valor citado independientemente por Infobae (258.813.653 kg, 2025-02-06) — diferencia de 24 mil kg, dentro del margen de revisión de cifras preliminares vs. cierre.

Resto de las ~63 empresas restantes de 2024: sin fuente con desglose verificado — quedan `NULL`.

### 2022, 2023 — research cerrada 2026-07-04, ampliada 2026-07-29

**Actualización 2026-07-29**: 2022 ya no está 100% vacío — ver sección nueva arriba (3 empresas + denominador real confirmado). 2023 sigue sin ningún dato de empresa cargado: se encontró un artículo dedicado ("Las marcas de yerba mate Argentina más vendidas en 2023", `noticiasdelmate.com`, mirror en `regionlitoral.net` porque la URL original da 404) pero, pese al título, el texto confirma que es un corte parcial enero-octubre 2023 ("Verdeflor en agosto creció...", publicado 2023-10-09) — no un cierre de año calendario, y tampoco da cifras exactas en kg/%, solo el ranking de posiciones. No calificaba para cargar bajo el mismo criterio que 2022, 2019, 2021.

(Histórico, ya no vigente) Se había reintentado `noticiasdelmate.com` (fuente con artículos dedicados a "marcas más vendidas" 2021/2023/2024) sin éxito — timeout DNS persistente en 2+ sesiones. **El sitio volvió a estar disponible el 2026-07-29** (ver sección nueva arriba) sin cambios de nuestro lado. El artículo de 2023 del sitio SÍ se pudo leer esta vez (vía mirror, la URL original da 404) — confirmado corte parcial, no sirve como cierre anual (ver arriba). Se verificó también Wayback Machine (`archive.org/wayback/available`) en la auditoría original: la URL de 2023 no tenía snapshot en ese momento; la de 2024 sí (`web.archive.org/web/20240904014253/...`) pero el snapshot es de **septiembre de 2024** — no puede ser el cierre de año calendario completo, descartado como fuente de 2024 anual.

Se revisaron además 3 notas de Plan B Misiones que por su fecha de publicación parecían candidatas a ranking anual cerrado, y las 3 resultaron ser cortes mensuales/YTD al leer el texto completo (no alcanza con la fecha de publicación para inferir el período, hay que verificar el texto):
- `2024/08/13` ("Misiones retrocedió en el top 10") → datos de **junio de 2024** únicamente.
- `2025/02/28` ("Playadito superó a Las Marías...") → datos de **enero de 2025** únicamente.
- `2025/03/10` ("Quiénes son, paquete a paquete, las 65 yerbateras") → también **enero de 2025** únicamente, pese al título que sugiere año completo.

Totales agregados de mercado interno SÍ confirmados para contexto/denominador futuro, aunque sin desglose por empresa:
- **2023**: 285.430.373 kg (INYM, cierre de año, cifra récord — vía economis.com.ar).
- **2022**: cifra de cierre CONFIRMADA 2026-07-29 (antes solo se conocía el acumulado enero-noviembre, ~256M, sin cierre) — **275.807.989 kg**, ver sección nueva arriba.

**Sigue sin cargarse ningún valor de empresa para 2023** — queda `NULL` en las ~65 empresas, siguiendo la regla "sin fuente confirmada = NULL, nunca inventado". `noticiasdelmate.com` volvió a estar disponible 2026-07-29 (ver arriba) pero su artículo de 2023 resultó ser corte parcial, no cierre anual — si en el futuro aparece una fuente nueva con cierre de año calendario completo para 2023, cargar siguiendo el mismo criterio ya usado para 2019/2021/2022.

### Nota sobre el denominador de 2025 (revalidado 2026-07-04)

Se encontraron cifras de prensa (Infobae, La Nación, marzo 2026) que hablan de un mercado interno 2025 de "296 millones de kilos" — un número distinto al ~267M ya usado como denominador de este documento. Se verificó contra la nota oficial de cierre del INYM (`inym.org.ar`, "el cierre del 2025 marcó un crecimiento del 7,3%..."): mercado interno 2025 = **266.788.512 kg** = 324.769.423 kg despachado total − 57.980.911 kg exportado (cuadra exactamente). El "296M" de la prensa no cuadra contra esa aritmética propia del INYM (324,77 − 296 = 28,77M, muy lejos de los 58M de exportación real) — se descarta como error o confusión de alcance en la nota de prensa. **El denominador ~267M ya cargado queda confirmado, sin cambios.**

## Molinos Río de la Plata / Yerbatera Misiones SRL — pendiente, NO modelado

La hipótesis original de la auditoría era que "Molinos Río de la Plata" y "Yerbatera Misiones SRL" son la misma operación comercial renombrada en el ranking. La investigación matiza esto:

> "Yerbatera Misiones SRL (Puerta) elabora a fazón para Molinos Río de la Plata las marcas Nobleza Gaucha y Cruz de Malta" — [Plan B Misiones, 2025-03-10](https://planbmisiones.com/2025/03/10/nota/quienes-son-paquete-a-paquete-las-65-yerbateras-de-argentina-2-top-correntinas-venden-igual-que-30-industrias-misioneras/)

Ramón Puerta (Yerbatera Misiones SRL) es dueño de la planta de Apóstoles y se la alquila a Molinos Río de la Plata, que fabrica ahí sus marcas. Esto puede significar que el INYM atribuye el volumen a quien fabrica físicamente (maquila/elaborador) en vez de al dueño de la marca — un cambio de **metodología de declaración**, no necesariamente un traspaso real de negocio.

**No se encontró fuente que confirme el año exacto de ese cambio de atribución.** El quiebre en el dataset original (fabricado) empezaba justo en 2022 — el mismo año donde arrancaba la interpolación lineal inventada — así que no se puede descartar que ese "quiebre" fuera puro artefacto de la fabricación, sin ninguna base real.

**Decisión**: no se carga ninguna fila de `ym.marca_empresa` para este caso todavía. Las tablas `ym.empresas`, `ym.marcas` y `ym.marca_empresa` (rol `propietario`/`elaborador`, con vigencia temporal) están creadas en el schema para modelarlo en cuanto se consiga la fuente — ver `backend/db/schema.sql`, sección 6b. Los despachos por empresa (`ym.competencia`, `ym.despachos_empresa`) se cargan **tal cual los publica cada fuente, sin reasignación nuestra** — si la fuente dice "Yerbatera Misiones SRL 3,2%", se carga así, no se reparte hacia Molinos ni viceversa.
