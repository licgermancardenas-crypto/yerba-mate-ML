from fastapi import APIRouter, Depends, Query
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from backend.api.db import get_session

router = APIRouter(prefix="/exportaciones", tags=["exportaciones"])


@router.get("")
async def listar_exportaciones(
    anio_desde: int | None = Query(default=None),
    anio_hasta: int | None = Query(default=None),
    destino: str | None = Query(default=None),
    session: AsyncSession = Depends(get_session),
):
    stmt = text(
        """
        SELECT anio, mes, mes_nombre, destino,
               volumen_kg, valor_fob_usd, precio_fob_usd_kg
        FROM ym.exportaciones
        WHERE (CAST(:anio_desde AS INTEGER) IS NULL OR anio >= CAST(:anio_desde AS INTEGER))
          AND (CAST(:anio_hasta AS INTEGER) IS NULL OR anio <= CAST(:anio_hasta AS INTEGER))
          AND (CAST(:destino AS TEXT) IS NULL OR destino = CAST(:destino AS TEXT))
        ORDER BY anio, mes, destino
        """
    )
    result = await session.execute(
        stmt,
        {"anio_desde": anio_desde, "anio_hasta": anio_hasta, "destino": destino},
    )
    return [dict(row._mapping) for row in result]
