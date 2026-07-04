from fastapi import APIRouter, Depends, Query
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from backend.api.db import get_session

router = APIRouter(prefix="/produccion", tags=["produccion"])


@router.get("")
async def listar_produccion(
    anio_desde: int | None = Query(default=None),
    anio_hasta: int | None = Query(default=None),
    provincia: str | None = Query(default=None),
    session: AsyncSession = Depends(get_session),
):
    stmt = text(
        """
        SELECT anio, mes, mes_nombre, provincia, ciudad,
               produccion_kg, consumo_interno_kg, exportaciones_kg,
               precio_usd_kg, valor_fob_usd
        FROM ym.dataset_principal
        WHERE (CAST(:anio_desde AS INTEGER) IS NULL OR anio >= CAST(:anio_desde AS INTEGER))
          AND (CAST(:anio_hasta AS INTEGER) IS NULL OR anio <= CAST(:anio_hasta AS INTEGER))
          AND (CAST(:provincia AS TEXT) IS NULL OR provincia = CAST(:provincia AS TEXT))
        ORDER BY anio, mes, provincia, ciudad
        """
    )
    result = await session.execute(
        stmt,
        {"anio_desde": anio_desde, "anio_hasta": anio_hasta, "provincia": provincia},
    )
    return [dict(row._mapping) for row in result]
