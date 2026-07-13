from fastapi import APIRouter, Depends, Query
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from backend.api.db import get_session

router = APIRouter(prefix="/importaciones", tags=["importaciones"])


@router.get("")
async def listar_importaciones(
    anio_desde: int | None = Query(default=None),
    anio_hasta: int | None = Query(default=None),
    session: AsyncSession = Depends(get_session),
):
    stmt = text(
        """
        SELECT anio, mes, mes_nombre, volumen_kg
        FROM ym.importaciones
        WHERE (CAST(:anio_desde AS INTEGER) IS NULL OR anio >= CAST(:anio_desde AS INTEGER))
          AND (CAST(:anio_hasta AS INTEGER) IS NULL OR anio <= CAST(:anio_hasta AS INTEGER))
        ORDER BY anio, mes
        """
    )
    result = await session.execute(
        stmt, {"anio_desde": anio_desde, "anio_hasta": anio_hasta}
    )
    return [dict(row._mapping) for row in result]


@router.get("/indec")
async def listar_importaciones_indec(
    anio_desde: int | None = Query(default=None),
    anio_hasta: int | None = Query(default=None),
    pais_iso2: str | None = Query(default=None),
    session: AsyncSession = Depends(get_session),
):
    """Importaciones reales por país de origen, mensual (INDEC Comercio
    Exterior -- ver docs/fuentes_exportaciones_indec.md). Agregado por país
    (suma las 2 posiciones NCM). Reemplaza a /importaciones (categoría B /
    parcialmente anulada, ver docs/auditoria_datos.md) como fuente de verdad.
    """
    stmt = text(
        """
        SELECT anio, mes, pais_iso2, MAX(pais_nombre) AS pais_nombre,
               SUM(peso_kg) AS peso_kg,
               SUM(monto_fob_usd) AS monto_fob_usd,
               bool_and(es_confidencial) AS es_confidencial
        FROM ym.importaciones_indec
        WHERE (CAST(:anio_desde AS INTEGER) IS NULL OR anio >= CAST(:anio_desde AS INTEGER))
          AND (CAST(:anio_hasta AS INTEGER) IS NULL OR anio <= CAST(:anio_hasta AS INTEGER))
          AND (CAST(:pais_iso2 AS TEXT) IS NULL OR pais_iso2 = CAST(:pais_iso2 AS TEXT))
        GROUP BY anio, mes, pais_iso2
        ORDER BY anio, mes, pais_iso2
        """
    )
    result = await session.execute(
        stmt, {"anio_desde": anio_desde, "anio_hasta": anio_hasta, "pais_iso2": pais_iso2}
    )
    return [dict(row._mapping) for row in result]
