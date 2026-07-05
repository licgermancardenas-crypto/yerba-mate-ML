from fastapi import APIRouter, Depends, Query
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from backend.api.db import get_session

router = APIRouter(prefix="/superficie", tags=["superficie"])


@router.get("")
async def listar_superficie(
    anio_desde: int | None = Query(default=None),
    anio_hasta: int | None = Query(default=None),
    provincia: str | None = Query(default=None),
    session: AsyncSession = Depends(get_session),
):
    """Productores y hectáreas cultivadas, por provincia/ciudad, mensual.

    El valor de superficie_ha se publica con cadencia anual (se repite los
    12 meses de cada año) — para rendimiento por hectárea, agregar a nivel
    anual en el cliente, no promediar los 12 meses.
    """
    stmt = text(
        """
        SELECT anio, mes, mes_nombre, provincia, ciudad, productores, superficie_ha
        FROM ym.superficie_productores
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
