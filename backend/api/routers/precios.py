from fastapi import APIRouter, Depends, Query
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from backend.api.db import get_session

router = APIRouter(prefix="/precios", tags=["precios"])


@router.get("")
async def listar_precios(
    anio_desde: int | None = Query(default=None),
    anio_hasta: int | None = Query(default=None),
    session: AsyncSession = Depends(get_session),
):
    stmt = text(
        """
        SELECT anio, mes, mes_nombre, precio_hoja_verde_ars, precio_canchada_ars
        FROM ym.precios
        WHERE (CAST(:anio_desde AS INTEGER) IS NULL OR anio >= CAST(:anio_desde AS INTEGER))
          AND (CAST(:anio_hasta AS INTEGER) IS NULL OR anio <= CAST(:anio_hasta AS INTEGER))
        ORDER BY anio, mes
        """
    )
    result = await session.execute(
        stmt, {"anio_desde": anio_desde, "anio_hasta": anio_hasta}
    )
    return [dict(row._mapping) for row in result]
