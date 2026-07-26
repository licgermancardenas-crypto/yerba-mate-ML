import os

from dotenv import load_dotenv
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

load_dotenv()


def _async_url(url: str) -> str:
    if url.startswith("postgresql+asyncpg://"):
        return url
    if url.startswith("postgresql://"):
        return url.replace("postgresql://", "postgresql+asyncpg://", 1)
    return url


DATABASE_URL = _async_url(os.environ["DATABASE_URL"])

# pool_size/max_overflow por default (5+10=15) quedaba justo al límite de
# las 13 requests concurrentes que dispara /insights (Promise.all) -- bajo
# la latencia real Render->Supabase, alguna se quedaba sin conexión
# disponible y el backend respondía 500 (visto en el build de Vercel,
# reproducible siempre en el mismo endpoint).
engine = create_async_engine(DATABASE_URL, pool_pre_ping=True, pool_size=15, max_overflow=20)
async_session = async_sessionmaker(engine, expire_on_commit=False)


async def get_session() -> AsyncSession:
    async with async_session() as session:
        yield session
