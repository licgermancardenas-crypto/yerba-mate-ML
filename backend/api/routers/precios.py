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
        SELECT
            p.anio, p.mes, p.mes_nombre, p.precio_hoja_verde_ars, p.precio_canchada_ars,
            ipc_gral.valor AS ipc_nacional,
            ipc_ym.valor AS ipc_yerba_mate
        FROM ym.precios p
        LEFT JOIN ym.indec_series ipc_gral
          ON ipc_gral.serie_nombre = 'ipc_nacional_nivel_general' AND ipc_gral.anio = p.anio AND ipc_gral.mes = p.mes
        LEFT JOIN ym.indec_series ipc_ym
          ON ipc_ym.serie_nombre = 'ipc_gba_yerba_mate' AND ipc_ym.anio = p.anio AND ipc_ym.mes = p.mes
        WHERE (CAST(:anio_desde AS INTEGER) IS NULL OR p.anio >= CAST(:anio_desde AS INTEGER))
          AND (CAST(:anio_hasta AS INTEGER) IS NULL OR p.anio <= CAST(:anio_hasta AS INTEGER))
        ORDER BY p.anio, p.mes
        """
    )
    result = await session.execute(
        stmt, {"anio_desde": anio_desde, "anio_hasta": anio_hasta}
    )
    return [dict(row._mapping) for row in result]
