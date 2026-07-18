"""Modelo 3 (Fase 5) — arma el panel país x año para el modelo gravitacional
de exportaciones.

Panel, no serie de tiempo univariada (a diferencia de Modelo 1/2) -- cada
fila es un (país, año). Target: volumen exportado real (`ym.exportaciones_indec`,
agregado a anual). Restringido a los 20 países destino con volumen real y
consistente 2011-2025 (ver `docs/modelo3_exportaciones_gravitacional.md`) --
el resto del comercio es ruido estadístico (embarques sueltos), no señal de
gravedad comercial real.

Predictores:
- PBI del país destino (`ym.pbi_pais_anual`, Banco Mundial)
- distancia geográfica Buenos Aires -> capital del país (haversine, mismas
  coordenadas que `frontend/lib/paises-destino.ts` -- no se duplican como
  fuente de verdad nueva, solo se reusan acá para el cálculo)
- tipo de cambio oficial ARS/USD (`ym.tipo_cambio_anual`, nacional, mismo
  valor para todos los países en un año dado)
- dummy diáspora siria/libanesa (Siria y Líbano = 1, resto = 0) -- supuesto
  de negocio documentado desde el planeamiento original de este modelo

Uso:
    python -m backend.ml.build_panel_modelo3
"""

from __future__ import annotations

import math
import os

import pandas as pd
from dotenv import load_dotenv

ORIGEN_BUENOS_AIRES = (-58.3816, -34.6037)  # (lon, lat), Puerto de Buenos Aires

# Mismas coordenadas que frontend/lib/paises-destino.ts (lon, lat) -- capital
# de cada país, aproximación estándar en modelos gravitacionales (no la
# ubicación real del comprador/puerto).
COORDS_PAISES = {
    "SY": (36.2765, 33.5138), "CL": (-70.6693, -33.4489), "BR": (-47.8825, -15.7942),
    "UY": (-56.1645, -34.9011), "ES": (-3.7038, 40.4168), "LB": (35.5018, 33.8938),
    "US": (-77.0369, 38.9072), "FR": (2.3522, 48.8566), "DE": (13.405, 52.52),
    "BO": (-68.1193, -16.4897), "IL": (35.2137, 31.7683), "CA": (-75.6972, 45.4215),
    "IT": (12.4964, 41.9028), "AE": (54.3773, 24.4539), "KR": (126.978, 37.5665),
    "MX": (-99.1332, 19.4326), "AU": (149.13, -35.2809), "CN": (116.4074, 39.9042),
    "TR": (32.8597, 39.9334), "PL": (21.0122, 52.2297),
}

DUMMY_DIASPORA = {"SY", "LB"}


def haversine_km(origen: tuple[float, float], destino: tuple[float, float]) -> float:
    lon1, lat1, lon2, lat2 = map(math.radians, [*origen, *destino])
    dlon, dlat = lon2 - lon1, lat2 - lat1
    a = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2) ** 2
    return 2 * 6371 * math.asin(math.sqrt(a))


def _conn():
    import psycopg2

    load_dotenv()
    return psycopg2.connect(os.environ["DATABASE_URL"])


def armar_panel(anio_desde: int = 2011, anio_hasta: int = 2025) -> pd.DataFrame:
    conn = _conn()
    try:
        target = pd.read_sql(
            """
            SELECT pais_iso2, anio, SUM(peso_kg) AS volumen_kg, bool_and(es_confidencial) AS totalmente_confidencial
            FROM ym.exportaciones_indec
            WHERE pais_iso2 = ANY(%(paises)s) AND anio BETWEEN %(desde)s AND %(hasta)s
            GROUP BY pais_iso2, anio
            """,
            conn,
            params={"paises": list(COORDS_PAISES), "desde": anio_desde, "hasta": anio_hasta},
        )
        pbi = pd.read_sql("SELECT pais_iso2, anio, pbi_usd FROM ym.pbi_pais_anual", conn)
        tc = pd.read_sql("SELECT anio, ars_usd_oficial FROM ym.tipo_cambio_anual", conn)
    finally:
        conn.close()

    # grilla completa país x año -- si un país no tiene fila en exportaciones_indec
    # ese año es porque no hubo dato real cargado (no un cero real), queda NaN
    paises_anios = pd.MultiIndex.from_product(
        [list(COORDS_PAISES), range(anio_desde, anio_hasta + 1)], names=["pais_iso2", "anio"]
    ).to_frame(index=False)

    panel = paises_anios.merge(target, on=["pais_iso2", "anio"], how="left")
    panel.loc[panel["totalmente_confidencial"] == True, "volumen_kg"] = None  # noqa: E712
    panel = panel.merge(pbi, on=["pais_iso2", "anio"], how="left")
    panel = panel.merge(tc, on="anio", how="left")

    panel["distancia_km"] = panel["pais_iso2"].map(
        lambda p: haversine_km(ORIGEN_BUENOS_AIRES, COORDS_PAISES[p])
    )
    panel["dummy_diaspora"] = panel["pais_iso2"].isin(DUMMY_DIASPORA).astype(int)

    return panel.drop(columns=["totalmente_confidencial"]).sort_values(["pais_iso2", "anio"]).reset_index(drop=True)


def diagnostico(panel: pd.DataFrame) -> None:
    print(f"Panel: {len(panel)} filas ({panel['pais_iso2'].nunique()} países x {panel['anio'].nunique()} años)")
    cols = ["volumen_kg", "pbi_usd"]
    print("\n% NaN por columna:")
    print((panel[cols].isna().mean() * 100).round(1))
    print("\nPaíses/años sin PBI (Banco Mundial no publicó):")
    print(panel[panel["pbi_usd"].isna()][["pais_iso2", "anio"]].to_string(index=False))
    print("\nDistancia (km) por país:")
    print(panel.drop_duplicates("pais_iso2")[["pais_iso2", "distancia_km", "dummy_diaspora"]].sort_values("distancia_km").to_string(index=False))


if __name__ == "__main__":
    panel = armar_panel()
    diagnostico(panel)
    out_dir = os.path.join(os.path.dirname(__file__), "outputs")
    os.makedirs(out_dir, exist_ok=True)
    panel.to_csv(os.path.join(out_dir, "panel_modelo3.csv"), index=False)
    print(f"\nGuardado: {out_dir}/panel_modelo3.csv")
