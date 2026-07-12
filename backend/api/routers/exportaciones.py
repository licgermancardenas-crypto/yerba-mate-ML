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


@router.get("/indec")
async def listar_exportaciones_indec(
    anio_desde: int | None = Query(default=None),
    anio_hasta: int | None = Query(default=None),
    pais_iso2: str | None = Query(default=None),
    session: AsyncSession = Depends(get_session),
):
    """Exportaciones reales por país, mensual (INDEC Comercio Exterior, NCM
    09030010/09030090 -- ver docs/fuentes_exportaciones_indec.md). Agregado
    por país (suma las 2 posiciones NCM). `es_confidencial=true` cuando
    NINGUNA de las 2 posiciones tiene dato real ese mes -- peso_kg/
    monto_fob_usd vienen NULL en ese caso, no en 0.
    """
    stmt = text(
        """
        SELECT anio, mes, pais_iso2, MAX(pais_nombre) AS pais_nombre,
               SUM(peso_kg) AS peso_kg,
               SUM(monto_fob_usd) AS monto_fob_usd,
               bool_and(es_confidencial) AS es_confidencial
        FROM ym.exportaciones_indec
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


@router.get("/anual-real")
async def listar_exportaciones_anual_real(
    anio_desde: int | None = Query(default=None),
    anio_hasta: int | None = Query(default=None),
    session: AsyncSession = Depends(get_session),
):
    """Totales anuales reales por destino (ver docs/auditoria_datos.md, ym.exportaciones_anual).

    El desglose mensual de /exportaciones es sintético y quedó anulado tras
    la auditoría de 2026-07-11. destino = '(nacional)' en los años sin
    desglose real por destino (2025 en adelante, hasta conseguir fuente).
    """
    stmt = text(
        """
        SELECT anio, destino, volumen_kg, valor_fob_usd, precio_fob_usd_kg, fuente, fuente_url
        FROM ym.exportaciones_anual
        WHERE (CAST(:anio_desde AS INTEGER) IS NULL OR anio >= CAST(:anio_desde AS INTEGER))
          AND (CAST(:anio_hasta AS INTEGER) IS NULL OR anio <= CAST(:anio_hasta AS INTEGER))
        ORDER BY anio, destino
        """
    )
    result = await session.execute(
        stmt, {"anio_desde": anio_desde, "anio_hasta": anio_hasta}
    )
    return [dict(row._mapping) for row in result]
