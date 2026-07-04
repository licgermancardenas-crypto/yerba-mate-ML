from fastapi import APIRouter, Depends, Query
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from backend.api.db import get_session

router = APIRouter(prefix="/competencia", tags=["competencia"])


@router.get("")
async def listar_competencia(
    anio_desde: int | None = Query(default=None),
    anio_hasta: int | None = Query(default=None),
    empresa: str | None = Query(default=None),
    session: AsyncSession = Depends(get_session),
):
    stmt = text(
        """
        SELECT anio, empresa, cuota_mercado_pct, volumen_kg,
               cobertura_ranking, fuente_url, fuente_medio, fuente_fecha
        FROM ym.competencia
        WHERE (CAST(:anio_desde AS INTEGER) IS NULL OR anio >= CAST(:anio_desde AS INTEGER))
          AND (CAST(:anio_hasta AS INTEGER) IS NULL OR anio <= CAST(:anio_hasta AS INTEGER))
          AND (CAST(:empresa AS TEXT) IS NULL OR empresa = CAST(:empresa AS TEXT))
        ORDER BY anio, empresa
        """
    )
    result = await session.execute(
        stmt,
        {"anio_desde": anio_desde, "anio_hasta": anio_hasta, "empresa": empresa},
    )
    return [dict(row._mapping) for row in result]
