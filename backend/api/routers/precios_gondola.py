from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from backend.api.db import get_session

router = APIRouter(prefix="/precios-gondola", tags=["precios-gondola"])


@router.get("")
async def listar_precios_gondola(session: AsyncSession = Depends(get_session)):
    """Precio de góndola por marca (fuente: dump SEPA, ver ym.precios_gondola).

    Devuelve solo el snapshot más reciente cargado — no es una serie
    histórica (el portal SEPA no permite backfill), cada corrida del ETL
    agrega un nuevo fecha_snapshot.
    """
    stmt = text(
        """
        SELECT fecha_snapshot, marca_gondola, empresa_ym, presentacion_kg,
               precio_ars_kg_promedio, precio_ars_kg_min, precio_ars_kg_max,
               n_observaciones, n_comercios
        FROM ym.precios_gondola
        WHERE fecha_snapshot = (SELECT MAX(fecha_snapshot) FROM ym.precios_gondola)
        ORDER BY n_observaciones DESC
        """
    )
    result = await session.execute(stmt)
    return [dict(row._mapping) for row in result]
