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
