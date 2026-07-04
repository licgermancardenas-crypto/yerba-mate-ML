# Fuentes de datos — `ym.competencia`

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

### 2022, 2023 — research cerrada 2026-07-04, sigue sin dato de empresa (NULL)

Se reintentó `noticiasdelmate.com` (fuente con artículos dedicados a "marcas más vendidas" 2021/2023/2024) — sigue devolviendo timeout DNS, igual que en la auditoría original. Se verificó Wayback Machine (`archive.org/wayback/available`): la URL de 2023 no tiene snapshot; la de 2024 sí (`web.archive.org/web/20240904014253/...`) pero el snapshot es de **septiembre de 2024**, es decir el artículo "más vendidas en 2024" fue capturado a mitad de año — no puede ser el cierre de año calendario completo, descartado como fuente de 2024 anual.

Se revisaron además 3 notas de Plan B Misiones que por su fecha de publicación parecían candidatas a ranking anual cerrado, y las 3 resultaron ser cortes mensuales/YTD al leer el texto completo (no alcanza con la fecha de publicación para inferir el período, hay que verificar el texto):
- `2024/08/13` ("Misiones retrocedió en el top 10") → datos de **junio de 2024** únicamente.
- `2025/02/28` ("Playadito superó a Las Marías...") → datos de **enero de 2025** únicamente.
- `2025/03/10` ("Quiénes son, paquete a paquete, las 65 yerbateras") → también **enero de 2025** únicamente, pese al título que sugiere año completo.

Totales agregados de mercado interno SÍ confirmados para contexto/denominador futuro, aunque sin desglose por empresa:
- **2023**: 285.430.373 kg (INYM, cierre de año, cifra récord — vía economis.com.ar).
- **2022**: ronda los 256 millones de kg, pero la nota disponible (ambito.com, noviembre 2022) aclara que el INYM todavía no tenía cerrados los datos de diciembre al momento de publicarse — no hay una cifra de cierre anual confirmada, solo el acumulado enero-noviembre.

**No se cargó ningún valor de empresa para 2022/2023** — quedan `NULL` en las ~15-65 empresas, siguiendo la regla "sin fuente confirmada = NULL, nunca inventado". Si `noticiasdelmate.com` vuelve a estar disponible, ahí están los artículos dedicados a 2021/2023/2024 con desglose por marca — revisar el texto completo (no solo el título) para confirmar si cada uno es año calendario o corte parcial antes de cargar.

### Nota sobre el denominador de 2025 (revalidado 2026-07-04)

Se encontraron cifras de prensa (Infobae, La Nación, marzo 2026) que hablan de un mercado interno 2025 de "296 millones de kilos" — un número distinto al ~267M ya usado como denominador de este documento. Se verificó contra la nota oficial de cierre del INYM (`inym.org.ar`, "el cierre del 2025 marcó un crecimiento del 7,3%..."): mercado interno 2025 = **266.788.512 kg** = 324.769.423 kg despachado total − 57.980.911 kg exportado (cuadra exactamente). El "296M" de la prensa no cuadra contra esa aritmética propia del INYM (324,77 − 296 = 28,77M, muy lejos de los 58M de exportación real) — se descarta como error o confusión de alcance en la nota de prensa. **El denominador ~267M ya cargado queda confirmado, sin cambios.**

## Molinos Río de la Plata / Yerbatera Misiones SRL — pendiente, NO modelado

La hipótesis original de la auditoría era que "Molinos Río de la Plata" y "Yerbatera Misiones SRL" son la misma operación comercial renombrada en el ranking. La investigación matiza esto:

> "Yerbatera Misiones SRL (Puerta) elabora a fazón para Molinos Río de la Plata las marcas Nobleza Gaucha y Cruz de Malta" — [Plan B Misiones, 2025-03-10](https://planbmisiones.com/2025/03/10/nota/quienes-son-paquete-a-paquete-las-65-yerbateras-de-argentina-2-top-correntinas-venden-igual-que-30-industrias-misioneras/)

Ramón Puerta (Yerbatera Misiones SRL) es dueño de la planta de Apóstoles y se la alquila a Molinos Río de la Plata, que fabrica ahí sus marcas. Esto puede significar que el INYM atribuye el volumen a quien fabrica físicamente (maquila/elaborador) en vez de al dueño de la marca — un cambio de **metodología de declaración**, no necesariamente un traspaso real de negocio.

**No se encontró fuente que confirme el año exacto de ese cambio de atribución.** El quiebre en el dataset original (fabricado) empezaba justo en 2022 — el mismo año donde arrancaba la interpolación lineal inventada — así que no se puede descartar que ese "quiebre" fuera puro artefacto de la fabricación, sin ninguna base real.

**Decisión**: no se carga ninguna fila de `ym.marca_empresa` para este caso todavía. Las tablas `ym.empresas`, `ym.marcas` y `ym.marca_empresa` (rol `propietario`/`elaborador`, con vigencia temporal) están creadas en el schema para modelarlo en cuanto se consiga la fuente — ver `backend/db/schema.sql`, sección 6b. Los despachos por empresa (`ym.competencia`, `ym.despachos_empresa`) se cargan **tal cual los publica cada fuente, sin reasignación nuestra** — si la fuente dice "Yerbatera Misiones SRL 3,2%", se carga así, no se reparte hacia Molinos ni viceversa.
