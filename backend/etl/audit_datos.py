"""Auditoría de integridad de datos -- yerba-mate-ML.

Corre los tests T1-T8 descriptos en docs/auditoria_datos.md sobre las series
cargadas en Supabase. Es de SOLO LECTURA -- no modifica ninguna tabla.

Uso:
    python backend/etl/audit_datos.py                  # corre todo, imprime resumen
    python backend/etl/audit_datos.py --json out.json  # además vuelca el detalle a JSON
    python backend/etl/audit_datos.py --series produccion_dataset_principal

Pensado para correr en CI (Fase 4 de Etapa 4 del informe): exit code 1 si
aparece un T1/T2/T3/T4 nuevo sobre datos que no estén ya documentados como
"cadencia anual publicada mensualmente" (ver ALLOWLIST más abajo).
"""

from __future__ import annotations

import argparse
import itertools
import json
import os
import sys
from dataclasses import dataclass, field
from typing import Callable

import numpy as np
import pandas as pd
import psycopg2
from dotenv import load_dotenv

load_dotenv()


def get_conn():
    url = os.environ.get("DATABASE_URL")
    if not url:
        raise SystemExit("Falta DATABASE_URL (ver .env / .env.example)")
    return psycopg2.connect(url)


def query(sql: str) -> pd.DataFrame:
    with get_conn() as conn:
        return pd.read_sql(sql, conn)


# ============================================================================
# Definición de series a auditar
# ============================================================================
# Cada serie declara: de qué tabla sale, qué columnas son "entidad" (grupos
# independientes -- una ciudad, un destino, una empresa...), y qué columnas
# numéricas hay que testear. `permite_repeticion_anual` marca las series que
# YA se documentaron como "mismo valor publicado los 12 meses del año, pero
# cambia de año a año" (ver TODO.md Fase 2a) -- ahí T2 dentro de un año NO es
# un hallazgo nuevo, así que se corre igual pero no cuenta como alerta nueva.


@dataclass
class Serie:
    nombre: str
    sql: str
    entity_cols: list[str]
    value_cols: list[str]
    mensual: bool = True
    permite_repeticion_anual: bool = False
    nota: str = ""


SERIES: list[Serie] = [
    Serie(
        nombre="dataset_principal.produccion_kg",
        sql="SELECT anio, mes, provincia, ciudad, produccion_kg AS valor FROM ym.dataset_principal ORDER BY provincia, ciudad, anio, mes",
        entity_cols=["provincia", "ciudad"],
        value_cols=["valor"],
        nota="Producción elaborada declarada, por ciudad. Fuente sin documentar (ver Etapa 1).",
    ),
    Serie(
        nombre="dataset_principal.consumo_interno_kg",
        sql="SELECT anio, mes, provincia, ciudad, consumo_interno_kg AS valor FROM ym.dataset_principal ORDER BY provincia, ciudad, anio, mes",
        entity_cols=["provincia", "ciudad"],
        value_cols=["valor"],
        nota="Fuente sin documentar (ver Etapa 1).",
    ),
    Serie(
        nombre="dataset_principal.exportaciones_kg",
        sql="SELECT anio, mes, provincia, ciudad, exportaciones_kg AS valor FROM ym.dataset_principal ORDER BY provincia, ciudad, anio, mes",
        entity_cols=["provincia", "ciudad"],
        value_cols=["valor"],
        nota="Fuente sin documentar (ver Etapa 1). Exportaciones por ciudad de origen -- comparar con ym.exportaciones (por destino) en T7.",
    ),
    Serie(
        nombre="dataset_principal.precio_usd_kg",
        sql="SELECT anio, mes, provincia, ciudad, precio_usd_kg AS valor FROM ym.dataset_principal ORDER BY provincia, ciudad, anio, mes",
        entity_cols=["provincia", "ciudad"],
        value_cols=["valor"],
        permite_repeticion_anual=True,
        nota="Documentado en TODO.md: dato anual (precio USD/kg), publicado con cadencia mensual.",
    ),
    Serie(
        nombre="dataset_principal.valor_fob_usd",
        sql="SELECT anio, mes, provincia, ciudad, valor_fob_usd AS valor FROM ym.dataset_principal ORDER BY provincia, ciudad, anio, mes",
        entity_cols=["provincia", "ciudad"],
        value_cols=["valor"],
        nota="Fuente sin documentar (ver Etapa 1).",
    ),
    Serie(
        nombre="consumo_interno.consumo_per_capita_kg",
        sql="SELECT anio, mes, consumo_per_capita_kg AS valor FROM ym.consumo_interno ORDER BY anio, mes",
        entity_cols=[],
        value_cols=["valor"],
        permite_repeticion_anual=True,
        nota="Documentado en TODO.md: dato anual publicado con cadencia mensual.",
    ),
    Serie(
        nombre="consumo_interno.mix_envases",
        sql="SELECT anio, mes, envase_05kg_pct, envase_1kg_pct, envase_2kg_pct, envase_025kg_pct, otros_envases_pct, sin_estampillas_pct FROM ym.consumo_interno ORDER BY anio, mes",
        entity_cols=[],
        value_cols=["envase_05kg_pct", "envase_1kg_pct", "envase_2kg_pct", "envase_025kg_pct", "otros_envases_pct", "sin_estampillas_pct"],
        permite_repeticion_anual=True,
        nota="Mix de envases -- T4 (suma=100%) aplica.",
    ),
    Serie(
        nombre="exportaciones.volumen_kg",
        sql="SELECT anio, mes, destino, volumen_kg AS valor FROM ym.exportaciones ORDER BY destino, anio, mes",
        entity_cols=["destino"],
        value_cols=["valor"],
        nota="Fuente sin documentar (ver Etapa 1).",
    ),
    Serie(
        nombre="importaciones.volumen_kg",
        sql="SELECT anio, mes, volumen_kg AS valor FROM ym.importaciones ORDER BY anio, mes",
        entity_cols=[],
        value_cols=["valor"],
        permite_repeticion_anual=True,
        nota="Documentado en TODO.md: dato anual publicado con cadencia mensual.",
    ),
    Serie(
        nombre="precios.hoja_verde_canchada",
        sql="SELECT anio, mes, precio_hoja_verde_ars, precio_canchada_ars FROM ym.precios ORDER BY anio, mes",
        entity_cols=[],
        value_cols=["precio_hoja_verde_ars", "precio_canchada_ars"],
        permite_repeticion_anual=True,
        nota="NULLs reales documentados (2020-10). T2 (corridas de 3-23 meses en el mismo valor, con "
        "escalones crecientes entre corridas: 6,01 -> 7,02 -> 8,4 -> ... -> 250,0) es el mecanismo real "
        "de fijación semestral con escalonamiento mensual (Ley 25.564/Decreto 1240/02), no fabricación "
        "-- ya validado contra Resolución 406/2023 SAGyP, categoría A (ver docs/fuentes_precios_materia_prima.md).",
    ),
    Serie(
        nombre="superficie_productores.superficie_ha",
        sql="SELECT anio, mes, provincia, ciudad, superficie_ha AS valor FROM ym.superficie_productores ORDER BY provincia, ciudad, anio, mes",
        entity_cols=["provincia", "ciudad"],
        value_cols=["valor"],
        permite_repeticion_anual=True,
        nota="Fuente sin documentar (ver Etapa 1). Investigado en dos rondas: (1) §2.6, 191.000 ha "
        "congelado 2010-2016 -- todavía sin fuente que lo confirme ni lo descarte. (2) §7.11 "
        "(2026-07-16): la serie histórica real del INYM ('Superficie Cultivada por Departamento', "
        "2016-2025) mostró que el '177.533 ha congelado 2020-2024' que se había dado por validado en "
        "julio en realidad solo coincide con el real de 2020 -- el real sigue creciendo cada año "
        "después (231.352 ha en 2025). Se anuló 2021-2024 (migración 008), se conserva 2020 como "
        "último año con valor real. La columna 'ciudad' tampoco corresponde a ningún 'departamento' "
        "real del INYM (comparado 1 a 1: factores de 0,44x a 5,2x sin patrón), documentado como no "
        "verificable por partida en §7.11.",
    ),
    Serie(
        nombre="superficie_productores.productores",
        sql="SELECT anio, mes, provincia, ciudad, productores AS valor FROM ym.superficie_productores ORDER BY provincia, ciudad, anio, mes",
        entity_cols=["provincia", "ciudad"],
        value_cols=["valor"],
        permite_repeticion_anual=True,
        nota="Mismo mecanismo que superficie_ha (§2.6): crece orgánicamente 2010-2019 (real), congelado "
        "en 9.334 desde 2020 hasta el próximo censo de productores.",
    ),
    Serie(
        nombre="inym_hoja_verde_zona.hoja_verde_kg",
        sql="SELECT anio, mes, zona, hoja_verde_kg AS valor FROM ym.inym_hoja_verde_zona WHERE zona != 'TOTAL' ORDER BY zona, anio, mes",
        entity_cols=["zona"],
        value_cols=["valor"],
        nota="Scraper PDF real INYM (Fase 3c) -- se espera que pase limpio, sirve de control. 'TOTAL' "
        "excluido del SQL: es la fila agregada de las otras zonas, no una entidad independiente -- "
        "comparándola contra sus propios componentes disparaba T6 falsos en meses donde solo una zona "
        "reportó actividad (TOTAL == esa única zona no nula, no una coincidencia real entre dos zonas).",
    ),
    Serie(
        nombre="inym_salida_molino.volumen_kg",
        sql="SELECT anio, mes, destino, volumen_kg AS valor FROM ym.inym_salida_molino ORDER BY destino, anio, mes",
        entity_cols=["destino"],
        value_cols=["valor"],
        nota="Scraper PDF real INYM (Fase 3c) -- se espera que pase limpio, sirve de control.",
    ),
    Serie(
        nombre="clima_mensual.precipitacion_temperatura",
        sql="SELECT anio, mes, ubicacion, precipitacion_mm_dia, temperatura_media_c FROM ym.clima_mensual ORDER BY ubicacion, anio, mes",
        entity_cols=["ubicacion"],
        value_cols=["precipitacion_mm_dia", "temperatura_media_c"],
        permite_repeticion_anual=True,
        nota="API en vivo (NASA POWER, Fase 3d) -- auditado 2026-07-13, T1-T5 limpio. T6 (18 coincidencias "
        "cruzadas entre ciudades sobre 2.880 pares posibles) es un artefacto esperado de la grilla nativa "
        "~0.5°x0.5° (~50km) de MERRA-2: ciudades cercanas caen en la misma celda y comparten valor exacto "
        "algunos meses, no es fabricación. Feature directo de Fase 5 (ML).",
    ),
    Serie(
        nombre="ndvi_mensual.ndvi_promedio",
        sql="SELECT anio, mes, depto, ndvi_promedio AS valor FROM ym.ndvi_mensual ORDER BY depto, anio, mes",
        entity_cols=["depto"],
        value_cols=["valor"],
        permite_repeticion_anual=True,
        nota="Google Earth Engine (MODIS/061/MOD13Q1, Fase 5 Modelo 1), auditado 2026-07-16 -- backfill "
        "2011-2026 completo (3.534 filas, 186 meses x 19 departamentos, 0 NULL), T1-T5 limpio. T6 dio 17 "
        "coincidencias sobre ~31.806 pares posibles (186 meses x C(19,2) departamentos) -- inspeccionado caso "
        "por caso: cada coincidencia es un par de departamentos DISTINTO (nunca se repite el mismo par), nunca "
        "3+ departamentos a la vez, sin ningún patrón de desfasaje constante -- consistente con colisión de "
        "redondeo a 4 decimales entre solo 19 muestras por mes (paradoja del cumpleaños), no con fabricación. "
        "Contraste con los patrones fabricados ya encontrados en este proyecto (mismo par repetido, offset "
        "constante entre corridas) -- acá no hay ninguno de esos dos.",
    ),
    Serie(
        nombre="competencia.cuota_mercado_pct",
        sql="SELECT anio, empresa, cuota_mercado_pct AS valor FROM ym.competencia WHERE cuota_mercado_pct IS NOT NULL ORDER BY empresa, anio",
        entity_cols=["empresa"],
        value_cols=["valor"],
        mensual=False,
        nota="Ya auditado y saneado en Fase 8 -- se espera que pase limpio, sirve de control negativo.",
    ),
]


# ============================================================================
# T1 -- duplicados exactos entre períodos (a nivel año, por entidad)
# ============================================================================
def t1_duplicados_exactos(df: pd.DataFrame, entity_cols: list[str], value_cols: list[str]) -> list[dict]:
    hallazgos = []
    anual = df.groupby(entity_cols + ["anio"], as_index=False)[value_cols].sum() if "mes" in df.columns else df
    grupos = anual.groupby(entity_cols) if entity_cols else [((), anual)]
    for entidad, grupo in grupos:
        grupo = grupo.sort_values("anio")
        anios = grupo["anio"].tolist()
        for i in range(1, len(anios)):
            fila_prev = grupo[grupo["anio"] == anios[i - 1]][value_cols].iloc[0]
            fila_cur = grupo[grupo["anio"] == anios[i]][value_cols].iloc[0]
            if (fila_prev.to_numpy() == fila_cur.to_numpy()).all() and fila_prev.abs().sum() > 0:
                hallazgos.append(
                    {"entidad": entidad, "anio_a": int(anios[i - 1]), "anio_b": int(anios[i]), "valor": fila_prev.to_dict()}
                )
    return hallazgos


# ============================================================================
# T2 -- constantes repetidas 3+ períodos consecutivos (a nivel mensual)
# ============================================================================
def t2_constantes_repetidas(df: pd.DataFrame, entity_cols: list[str], value_col: str, min_run: int = 3) -> list[dict]:
    if "mes" not in df.columns:
        return []
    hallazgos = []
    grupos = df.groupby(entity_cols) if entity_cols else [((), df)]
    for entidad, grupo in grupos:
        # NULL es "sin dato" documentado (ver docs/auditoria_datos.md §7.1
        # regla 2), no una corrida de valor repetido -- se descarta antes de
        # buscar runs, si no `float(None)` explota en columnas nuleadas.
        grupo = grupo.dropna(subset=[value_col]).sort_values(["anio", "mes"])
        valores = grupo[value_col].to_numpy()
        periodos = list(zip(grupo["anio"], grupo["mes"]))
        i = 0
        while i < len(valores):
            j = i
            while j + 1 < len(valores) and valores[j + 1] == valores[i]:
                j += 1
            run_len = j - i + 1
            if run_len >= min_run:
                hallazgos.append(
                    {
                        "entidad": entidad,
                        "valor": float(valores[i]),
                        "desde": periodos[i],
                        "hasta": periodos[j],
                        "largo_corrida": run_len,
                    }
                )
            i = j + 1
    return hallazgos


# ============================================================================
# T3 -- interpolación lineal perfecta (diffs interanuales idénticos, 3+)
# ============================================================================
def t3_interpolacion_lineal(df: pd.DataFrame, entity_cols: list[str], value_cols: list[str], min_run: int = 3) -> list[dict]:
    hallazgos = []
    anual = df.groupby(entity_cols + ["anio"], as_index=False)[value_cols].sum() if "mes" in df.columns else df
    grupos = anual.groupby(entity_cols) if entity_cols else [((), anual)]
    for entidad, grupo in grupos:
        grupo = grupo.sort_values("anio")
        for col in value_cols:
            valores = grupo[col].to_numpy(dtype=float)
            anios = grupo["anio"].to_numpy()
            if len(valores) < min_run + 1:
                continue
            diffs = np.round(np.diff(valores), 4)
            i = 0
            while i < len(diffs):
                j = i
                while j + 1 < len(diffs) and abs(diffs[j + 1] - diffs[i]) < 1e-6:
                    j += 1
                run_len = j - i + 1
                if run_len >= min_run and abs(diffs[i]) > 1e-6:
                    hallazgos.append(
                        {
                            "entidad": entidad,
                            "columna": col,
                            "diff_constante": float(diffs[i]),
                            "desde_anio": int(anios[i]),
                            "hasta_anio": int(anios[j + 1]),
                            "largo_corrida": run_len,
                        }
                    )
                i = j + 1
    return hallazgos


# ============================================================================
# T4 -- sumas demasiado perfectas (composiciones que cierran en 100.00%)
# ============================================================================
def t4_sumas_perfectas(df: pd.DataFrame, value_cols: list[str], objetivo: float = 100.0, tol: float = 0.01) -> dict:
    periodo_cols = [c for c in ["anio", "mes"] if c in df.columns]
    sumas = df.groupby(periodo_cols)[value_cols].sum().sum(axis=1)
    exactos = (sumas.sub(objetivo).abs() < tol).sum()
    total = len(sumas)
    return {
        "periodos_evaluados": int(total),
        "periodos_exactos_100": int(exactos),
        "pct_exactos": round(100 * exactos / total, 1) if total else None,
        "sospechoso": total > 0 and exactos == total,
    }


# ============================================================================
# T5 -- estacionalidad clonada (correlación de la forma intra-anual)
# ============================================================================
def t5_estacionalidad_clonada(df: pd.DataFrame, entity_col: str | None, value_col: str, umbral: float = 0.999) -> dict:
    if "mes" not in df.columns:
        return {"aplica": False}
    # Si hay entidad, testear cada una por separado
    resultado = {"aplica": True, "por_entidad": {}}
    grupos = df.groupby(entity_col) if entity_col else [(None, df)]
    for entidad, grupo in grupos:
        # min_count=1: si un (año, mes) es 100% NULL, sum() debe dar NaN (y
        # caer en el dropna de abajo), no 0 -- el default de pandas trata
        # "ningún valor real" igual que "suma de puros ceros", lo que
        # después producía 0/0 (ZeroDivisionError) en series ya nuleadas.
        pivot = grupo.pivot_table(index="anio", columns="mes", values=value_col, aggfunc=lambda x: x.sum(min_count=1))
        pivot = pivot.dropna(how="any")
        if len(pivot) < 2:
            continue
        # normalizar cada año (forma, no magnitud) para aislar estacionalidad de la tendencia
        norm = pivot.div(pivot.sum(axis=1), axis=0)
        corr = norm.T.corr()
        anios = corr.index.tolist()
        pares_altos = []
        for a, b in itertools.combinations(anios, 2):
            c = corr.loc[a, b]
            if c > umbral:
                pares_altos.append({"anio_a": int(a), "anio_b": int(b), "correlacion": round(float(c), 5)})
        if pares_altos:
            resultado["por_entidad"][str(entidad)] = pares_altos
    return resultado


# ============================================================================
# T6 -- redondez sospechosa / valores idénticos entre entidades distintas
# ============================================================================
def t6_redondez_y_cruce_entidades(df: pd.DataFrame, entity_cols: list[str], value_col: str) -> dict:
    periodo_cols = [c for c in ["anio", "mes"] if c in df.columns]
    cruces = []
    if entity_cols and periodo_cols:
        for periodo, grupo in df.groupby(periodo_cols):
            vc = grupo[value_col].value_counts()
            repetidos = vc[vc > 1]
            for valor, n in repetidos.items():
                if valor == 0:
                    continue
                entidades = grupo[grupo[value_col] == valor][entity_cols].to_dict("records")
                cruces.append({"periodo": periodo, "valor": float(valor), "n_entidades": int(n), "entidades": entidades})
    return {"valores_identicos_entre_entidades": cruces[:20], "total_casos": len(cruces)}


# ============================================================================
# Runner
# ============================================================================
def auditar_serie(serie: Serie) -> dict:
    df = query(serie.sql)
    resultado = {
        "serie": serie.nombre,
        "nota": serie.nota,
        "permite_repeticion_anual": serie.permite_repeticion_anual,
        "filas": len(df),
        "rango_anios": [int(df["anio"].min()), int(df["anio"].max())] if len(df) else None,
        "t1_duplicados_exactos": [],
        "t2_constantes_repetidas": [],
        "t3_interpolacion_lineal": [],
        "t4_sumas_perfectas": None,
        "t5_estacionalidad_clonada": None,
        "t6_redondez": None,
    }
    if df.empty:
        return resultado

    for col in serie.value_cols:
        resultado["t1_duplicados_exactos"] += t1_duplicados_exactos(df, serie.entity_cols, [col])
        resultado["t2_constantes_repetidas"] += [
            {**h, "columna": col} for h in t2_constantes_repetidas(df, serie.entity_cols, col)
        ]
        resultado["t3_interpolacion_lineal"] += t3_interpolacion_lineal(df, serie.entity_cols, [col])

    if len(serie.value_cols) > 1:
        resultado["t4_sumas_perfectas"] = t4_sumas_perfectas(df, serie.value_cols)

    if serie.mensual and "mes" in df.columns:
        entity_col = serie.entity_cols[0] if serie.entity_cols else None
        resultado["t5_estacionalidad_clonada"] = t5_estacionalidad_clonada(df, entity_col, serie.value_cols[0])

    if serie.entity_cols:
        resultado["t6_redondez"] = t6_redondez_y_cruce_entidades(df, serie.entity_cols, serie.value_cols[0])

    return resultado


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--json", help="Ruta donde volcar el detalle completo en JSON")
    ap.add_argument("--series", help="Correr solo una serie por nombre")
    args = ap.parse_args()

    series_a_correr = [s for s in SERIES if not args.series or s.nombre == args.series]
    resultados = []
    for serie in series_a_correr:
        print(f"Auditando {serie.nombre} ...", file=sys.stderr)
        resultados.append(auditar_serie(serie))

    hubo_hallazgo_no_documentado = False
    for r in resultados:
        n_t1, n_t2, n_t3 = len(r["t1_duplicados_exactos"]), len(r["t2_constantes_repetidas"]), len(r["t3_interpolacion_lineal"])
        flags = []
        if n_t1:
            flags.append(f"T1={n_t1}")
        if n_t2:
            flags.append(f"T2={n_t2}")
        if n_t3:
            flags.append(f"T3={n_t3}")
        if r["t4_sumas_perfectas"] and r["t4_sumas_perfectas"]["sospechoso"]:
            flags.append("T4=100%exacto")
        if r["t5_estacionalidad_clonada"] and r["t5_estacionalidad_clonada"].get("por_entidad"):
            flags.append(f"T5={len(r['t5_estacionalidad_clonada']['por_entidad'])}entidades")
        if r["t6_redondez"] and r["t6_redondez"]["total_casos"]:
            flags.append(f"T6={r['t6_redondez']['total_casos']}")

        estado = "ALERTA" if flags else "ok"
        if flags and not r["permite_repeticion_anual"]:
            hubo_hallazgo_no_documentado = True
        print(f"[{estado:6}] {r['serie']:45} {' '.join(flags)}")

    if args.json:
        with open(args.json, "w", encoding="utf-8") as f:
            json.dump(resultados, f, ensure_ascii=False, indent=2, default=str)
        print(f"\nDetalle completo en {args.json}", file=sys.stderr)

    if hubo_hallazgo_no_documentado:
        sys.exit(1)


if __name__ == "__main__":
    main()
