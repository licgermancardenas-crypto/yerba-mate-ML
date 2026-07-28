import os

from dotenv import load_dotenv
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

load_dotenv()


def _async_url(url: str) -> str:
    if url.startswith("postgresql://"):
        url = url.replace("postgresql://", "postgresql+asyncpg://", 1)
    # El pooler de Supabase en :5432 es modo SESIÓN -- tope duro de 15
    # conexiones TOTALES compartidas entre todo lo que se conecte (este
    # backend + cualquier script directo), sin importar qué pool_size pida
    # esta app. Confirmado 2026-07-28: con el backend ya sirviendo tráfico
    # normal, cualquier conexión directa nueva (script de verificación)
    # rebotaba con "max clients reached in session mode - pool_size: 15".
    # :6543 es el mismo pooler en modo TRANSACCIÓN (multiplexa muchas más
    # conexiones lógicas sobre menos conexiones físicas) -- el modo correcto
    # para una app con conexiones cortas por-request como esta, en vez de
    # session mode (pensado para sesiones largas/con estado). No requiere
    # cambiar la env var en Render: el swap de puerto es idempotente si
    # DATABASE_URL ya apunta a 6543.
    if ":5432/" in url:
        url = url.replace(":5432/", ":6543/", 1)
    return url


DATABASE_URL = _async_url(os.environ["DATABASE_URL"])

# pool_size/max_overflow: igual que antes del cambio a modo transacción (ver
# _async_url) -- no hacía falta subirlos más, el problema real de fondo era
# el modo del pooler, no cuántas conexiones pedía esta app.
#
# statement_cache_size=0: pgbouncer en modo transacción no garantiza que 2
# queries de la misma sesión lógica caigan en la misma conexión física
# subyacente -- asyncpg por default cachea "prepared statements" con nombre
# y los reusa entre queries, lo que rompe con errores crípticos de
# "prepared statement does not exist" bajo ese modo. Con esto en 0, asyncpg
# usa statements sin nombre (un poco más de overhead de parseo por query,
# necesario para ser compatible con transaction-mode pooling) -- fix
# estándar y documentado para asyncpg + pgbouncer transaction mode.
engine = create_async_engine(
    DATABASE_URL,
    pool_pre_ping=True,
    pool_size=15,
    max_overflow=20,
    connect_args={"statement_cache_size": 0},
)
async_session = async_sessionmaker(engine, expire_on_commit=False)


async def get_session() -> AsyncSession:
    async with async_session() as session:
        yield session
