from fastapi import APIRouter, Depends, Query
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from backend.api.db import get_session

router = APIRouter(prefix="/cadena-productiva", tags=["cadena-productiva"])


@router.get("/hoja-verde")
async def listar_hoja_verde(
    anio_desde: int | None = Query(default=None),
    anio_hasta: int | None = Query(default=None),
    zona: str | None = Query(default=None),
    session: AsyncSession = Depends(get_session),
):
    """Ingreso de hoja verde a secadero (kg), por zona (fuente: PDFs mensuales del INYM).

    La zona 'TOTAL' es el agregado nacional que ya publica la fuente
    (no sumar las demás zonas para evitar duplicar).
    """
    stmt = text(
        """
        SELECT anio, mes, zona, hoja_verde_kg
        FROM ym.inym_hoja_verde_zona
        WHERE (CAST(:anio_desde AS INTEGER) IS NULL OR anio >= CAST(:anio_desde AS INTEGER))
          AND (CAST(:anio_hasta AS INTEGER) IS NULL OR anio <= CAST(:anio_hasta AS INTEGER))
          AND (CAST(:zona AS TEXT) IS NULL OR zona = CAST(:zona AS TEXT))
        ORDER BY anio, mes, zona
        """
    )
    result = await session.execute(
        stmt, {"anio_desde": anio_desde, "anio_hasta": anio_hasta, "zona": zona}
    )
    return [dict(row._mapping) for row in result]


@router.get("/salida-molino")
async def listar_salida_molino(
    anio_desde: int | None = Query(default=None),
    anio_hasta: int | None = Query(default=None),
    session: AsyncSession = Depends(get_session),
):
    """Salida de molino (mercado interno + externo), mensual (kg).

    OJO: no coincide con consumo_interno_kg/exportaciones_kg de
    ym.dataset_principal — miden puntos distintos de la cadena
    (declaración jurada a salida de molino vs producción/consumo estimado).

    Incluye EMAE (nivel general, INDEC) por anio/mes -- primer uso real de
    esta serie (cargada desde Fase 3a pero nunca antes cableada a ningún
    endpoint). Se repite igual en las 2 filas (interno/externo) de un mismo
    mes -- no es un dato fabricado, es el mismo valor real de EMAE aplicado
    a ambas.
    """
    stmt = text(
        """
        SELECT sm.anio, sm.mes, sm.destino, sm.volumen_kg, emae.valor AS emae
        FROM ym.inym_salida_molino sm
        LEFT JOIN ym.indec_series emae
          ON emae.serie_nombre = 'emae_nivel_general' AND emae.anio = sm.anio AND emae.mes = sm.mes
        WHERE (CAST(:anio_desde AS INTEGER) IS NULL OR sm.anio >= CAST(:anio_desde AS INTEGER))
          AND (CAST(:anio_hasta AS INTEGER) IS NULL OR sm.anio <= CAST(:anio_hasta AS INTEGER))
        ORDER BY sm.anio, sm.mes, sm.destino
        """
    )
    result = await session.execute(
        stmt, {"anio_desde": anio_desde, "anio_hasta": anio_hasta}
    )
    return [dict(row._mapping) for row in result]
