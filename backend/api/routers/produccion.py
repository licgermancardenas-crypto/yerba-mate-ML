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


@router.get("/anual-real")
async def listar_produccion_anual_real(
    anio_desde: int | None = Query(default=None),
    anio_hasta: int | None = Query(default=None),
    session: AsyncSession = Depends(get_session),
):
    """Totales anuales reales (ver docs/auditoria_datos.md, ym.dataset_principal_anual).

    El desglose mensual de /produccion es sintético y quedó anulado tras la
    auditoría de 2026-07-11 — esta es la fuente correcta para vistas anuales.
    provincia/ciudad = '(nacional)' en los años sin desglose real por ciudad
    (2025 en adelante, hasta conseguir fuente).
    """
    stmt = text(
        """
        SELECT anio, provincia, ciudad, produccion_kg, consumo_interno_kg,
               exportaciones_kg, precio_usd_kg_promedio, valor_fob_usd, fuente, fuente_url
        FROM ym.dataset_principal_anual
        WHERE (CAST(:anio_desde AS INTEGER) IS NULL OR anio >= CAST(:anio_desde AS INTEGER))
          AND (CAST(:anio_hasta AS INTEGER) IS NULL OR anio <= CAST(:anio_hasta AS INTEGER))
        ORDER BY anio, provincia, ciudad
        """
    )
    result = await session.execute(
        stmt, {"anio_desde": anio_desde, "anio_hasta": anio_hasta}
    )
    return [dict(row._mapping) for row in result]
