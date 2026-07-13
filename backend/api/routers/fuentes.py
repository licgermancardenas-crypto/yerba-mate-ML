from fastapi import APIRouter, Depends, Query
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from backend.api.db import get_session

router = APIRouter(prefix="/fuentes", tags=["fuentes"])

# Tablas con provenance por FILA (columna fuente_id propia) en vez de por
# tabla (ym.tabla_fuente) -- ver migración 006 y docs/auditoria_datos.md.
_TABLAS_FILA = {"ym.dataset_principal_anual", "ym.exportaciones_anual"}

_FUENTE_COLUMNAS = "id, codigo, nombre, organismo, url, cobertura, metodo_obtencion, notas"
_FUENTE_COLUMNAS_F = "f.id, f.codigo, f.nombre, f.organismo, f.url, f.cobertura, f.metodo_obtencion, f.notas"


@router.get("")
async def listar_fuentes(session: AsyncSession = Depends(get_session)):
    """Catálogo completo de fuentes de datos (Etapa 4 regla 1, docs/auditoria_datos.md)."""
    stmt = text(f"SELECT {_FUENTE_COLUMNAS} FROM ym.fuentes ORDER BY codigo")
    result = await session.execute(stmt)
    return [dict(row._mapping) for row in result]


@router.get("/por-tabla")
async def fuentes_por_tabla(
    tablas: str = Query(..., description="Lista de tablas separadas por coma, ej: ym.produccion,ym.consumo_interno"),
    session: AsyncSession = Depends(get_session),
):
    """Fuente(s) de una o más tablas, para el footer 'Fuentes de esta vista' del frontend.

    La mayoría de las tablas tienen una fuente principal por TABLA
    (ym.tabla_fuente). dataset_principal_anual y exportaciones_anual mezclan
    CSV semilla + comunicados INYM 2025, así que tienen fuente_id por FILA
    -- para esas se devuelven todas las fuentes distintas presentes en los
    datos.
    """
    nombres = [t.strip() for t in tablas.split(",") if t.strip()]
    out: dict[str, list[dict]] = {}

    for tabla in nombres:
        if tabla in _TABLAS_FILA:
            stmt = text(
                f"""
                SELECT DISTINCT {_FUENTE_COLUMNAS_F}
                FROM ym.fuentes f
                JOIN {tabla} t ON t.fuente_id = f.id
                ORDER BY f.codigo
                """
            )
            result = await session.execute(stmt)
        else:
            stmt = text(
                f"""
                SELECT {_FUENTE_COLUMNAS_F}
                FROM ym.fuentes f
                JOIN ym.tabla_fuente tf ON tf.fuente_id = f.id
                WHERE tf.tabla_nombre = :tabla
                """
            )
            result = await session.execute(stmt, {"tabla": tabla})
        out[tabla] = [dict(row._mapping) for row in result]

    return out
