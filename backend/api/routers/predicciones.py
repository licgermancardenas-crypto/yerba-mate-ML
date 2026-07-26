from fastapi import APIRouter, Depends, Query
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from backend.api.db import get_session

router = APIRouter(prefix="/predicciones", tags=["predicciones"])


@router.get("")
async def listar_predicciones(
    modelo: str = Query(..., description="modelo1_produccion_zona | modelo2_consumo_interno | modelo3_exportaciones"),
    dimension: str | None = Query(default=None, description="zona (modelo1) o pais_iso2 (modelo3); ignorar en modelo2"),
    es_pronostico: bool | None = Query(default=None, description="true=pronóstico/proyección futura, false=ajustado-vs-real histórico, ausente=ambos"),
    session: AsyncSession = Depends(get_session),
):
    """Salida de los 3 modelos de Fase 5 (ym.ml_predicciones) -- no es dato
    observado, es salida de modelo (declarado en `metodo`/`supuestos`)."""
    stmt = text(
        """
        SELECT modelo, dimension, anio, mes, es_pronostico, valor_real, valor_predicho,
               ic_inferior, ic_superior, nivel_confianza, unidad, metodo, supuestos, generado_en
        FROM ym.ml_predicciones
        WHERE modelo = :modelo
          AND (CAST(:dimension AS TEXT) IS NULL OR dimension = CAST(:dimension AS TEXT))
          AND (CAST(:es_pronostico AS BOOLEAN) IS NULL OR es_pronostico = CAST(:es_pronostico AS BOOLEAN))
        ORDER BY dimension, anio, mes NULLS FIRST
        """
    )
    result = await session.execute(
        stmt,
        {"modelo": modelo, "dimension": dimension, "es_pronostico": es_pronostico},
    )
    return [dict(row._mapping) for row in result]


@router.get("/rem-tipo-cambio")
async def listar_rem_tipo_cambio(session: AsyncSession = Depends(get_session)):
    """Expectativa REM (BCRA) del tipo de cambio ANUAL para el año de la
    proyección del Modelo 3 (exportaciones), a lo largo de las sucesivas
    encuestas -- para contrastar contra el supuesto que usa el modelo
    (último tipo de cambio oficial REAL conocido, congelado, ver
    `ym.ml_predicciones.supuestos` y docs/modelo3_exportaciones_gravitacional.md).

    El año de proyección se deriva de `ym.ml_predicciones` (no hardcodeado):
    si el modelo se vuelve a correr con un año más de datos, este endpoint
    sigue el mismo año sin cambios de código. `tc_real_parcial` puede venir
    de un año todavía incompleto (promedio de los meses ya transcurridos,
    ym.tipo_cambio_anual) -- real, no una proyección, pero parcial.
    """
    stmt = text(
        """
        WITH anio_proyeccion AS (
            SELECT MIN(anio) AS anio
            FROM ym.ml_predicciones
            WHERE modelo = 'modelo3_exportaciones' AND es_pronostico = true
        )
        SELECT
            (SELECT anio FROM anio_proyeccion) AS anio_proyeccion,
            (SELECT ars_usd_oficial FROM ym.tipo_cambio_anual
                WHERE anio = (SELECT anio FROM anio_proyeccion) - 1) AS tc_congelado_modelo,
            (SELECT ars_usd_oficial FROM ym.tipo_cambio_anual
                WHERE anio = (SELECT anio FROM anio_proyeccion)) AS tc_real_parcial,
            r.fecha AS fecha_encuesta,
            r.mediana AS rem_tc_esperado
        FROM ym.bcra_rem r
        WHERE r.indicador = 'Tipo de cambio nominal'
          AND r.muestra = 'todos'
          AND r.periodo_tipo = 'anual'
          AND EXTRACT(YEAR FROM r.periodo_desde)::int = (SELECT anio FROM anio_proyeccion)
        ORDER BY r.fecha
        """
    )
    result = await session.execute(stmt)
    return [dict(row._mapping) for row in result]
