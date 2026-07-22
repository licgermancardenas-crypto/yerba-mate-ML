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


@router.get("/ndvi-zona")
async def listar_ndvi_zona(session: AsyncSession = Depends(get_session)):
    """NDVI (MODIS/061/MOD13Q1) agregado de departamento a zona -- promedio
    ponderado por píxeles válidos, vía el mapeo real departamento->zona
    (ST_Contains sobre las geometrías reales de inym_gis, cada departamento
    cae 100% dentro de una sola zona). Mismo cálculo que
    backend/ml/build_panel_modelo1.py::cargar_ndvi_por_zona -- primer uso
    de ym.ndvi_mensual fuera de Fase 5 (ahí se probó como exógena y no
    ayudó a predecir producción; acá es solo lectura descriptiva de
    condición actual del cultivo, no una entrada de modelo).
    """
    stmt = text(
        """
        WITH mapeo AS (
            SELECT d.properties->>'depto' AS depto, z.properties->>'zona' AS zona
            FROM inym_gis.v_features_4326 d
            JOIN inym_gis.v_features_4326 z ON z.layer_name = 'view_superficie_por_zonas'
              AND ST_Contains(z.geom_4326, ST_Centroid(d.geom_4326))
            WHERE d.layer_name = 'view_superficie_por_departamentos'
        )
        SELECT m.zona, n.anio, n.mes,
               SUM(n.ndvi_promedio * n.pixeles_validos) / SUM(n.pixeles_validos) AS ndvi_promedio
        FROM ym.ndvi_mensual n
        JOIN mapeo m ON m.depto = n.depto
        WHERE n.ndvi_promedio IS NOT NULL
        GROUP BY m.zona, n.anio, n.mes
        ORDER BY m.zona, n.anio, n.mes
        """
    )
    result = await session.execute(stmt)
    return [dict(row._mapping) for row in result]
