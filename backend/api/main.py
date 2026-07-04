from fastapi import FastAPI

from backend.api.routers import competencia, consumo, exportaciones, geo, precios, produccion

app = FastAPI(title="Yerba Mate ML API", version="0.1.0")

app.include_router(produccion.router)
app.include_router(consumo.router)
app.include_router(exportaciones.router)
app.include_router(precios.router)
app.include_router(competencia.router)
app.include_router(geo.router)


@app.get("/health")
async def health():
    return {"status": "ok"}
