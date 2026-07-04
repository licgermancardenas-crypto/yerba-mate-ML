from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from backend.api.db import get_session

router = APIRouter(prefix="/geo", tags=["geo"])


SECADEROS_LAYER = "view_mat_gis_marketing_puntos_secaderos"


@router.get("/{layer}")
async def obtener_capa(layer: str, session: AsyncSession = Depends(get_session)):
    """Devuelve las features de una capa GIS del INYM como GeoJSON.

    Los puntos de secaderos se cargan en la tabla especializada
    `inym_gis.secaderos` (no en `raw_features`, a diferencia de las 19
    capas de polígonos) porque su esquema de columnas ya estaba confirmado
    de antemano — por eso este layer tiene su propia query.
    """
    if layer == SECADEROS_LAYER:
        stmt = text(
            """
            SELECT id::text AS feature_gid,
                   ST_AsGeoJSON(geom)::json AS geometry,
                   jsonb_build_object(
                       'idplanta', idplanta,
                       'dir_catastral', dir_catastral,
                       'municipio_id', municipio_id,
                       'departamento_id', departamento_id,
                       'provincia_id', provincia_id
                   ) AS properties
            FROM inym_gis.secaderos
            ORDER BY id
            """
        )
        result = await session.execute(stmt)
        rows = result.mappings().all()
        if not rows:
            raise HTTPException(status_code=404, detail=f"Sin datos cargados para la capa '{layer}'")
        return {
            "type": "FeatureCollection",
            "features": [
                {
                    "type": "Feature",
                    "id": row["feature_gid"],
                    "geometry": row["geometry"],
                    "properties": row["properties"],
                }
                for row in rows
            ],
        }

    stmt = text(
        """
        SELECT feature_gid, ST_AsGeoJSON(geom_4326)::json AS geometry, properties
        FROM inym_gis.v_features_4326
        WHERE layer_name = :layer
        ORDER BY snapshot_date DESC
        """
    )
    result = await session.execute(stmt, {"layer": layer})
    rows = result.mappings().all()
    if not rows:
        raise HTTPException(status_code=404, detail=f"Sin datos cargados para la capa '{layer}'")
    return {
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "id": row["feature_gid"],
                "geometry": row["geometry"],
                "properties": row["properties"],
            }
            for row in rows
        ],
    }
