"""ETL — Precio de góndola de yerba mate por marca, desde el dump SEPA.

Fuente: dump diario público de SEPA (Sistema Electrónico de Publicidad de
Precios Argentinos), datos.produccion.gob.ar/dataset/sepa-precios (Res.
678/2020). El portal solo mantiene 7 archivos ZIP rotativos (uno por día de
semana, se pisan cada semana) — NO hay backfill histórico posible. Cada
corrida de este script carga una FOTO del momento (fecha_snapshot = hoy).
Para tener serie temporal hay que volver a correr esto en sesiones futuras.

El dump (~280MB comprimidos, 2026-07-04) trae un ZIP por cadena de
supermercados, cada uno con un productos.csv de todas sus sucursales — sin
columna de categoría. Se filtra por texto "yerba" en la descripción libre
(dry-run real 2026-07-04: ~124.000 filas sucursal-producto matchean) y se
agrega por marca/presentación antes de cargar, para no meter cientos de
miles de filas crudas a la base — ver ym.precios_gondola en schema.sql.

La marca real viene mezclada en la descripción ("YERBA ROSAMONTE
X1KG.C/PALO"), no en la columna productos_marca (viene vacía). Se extrae
con regex. El precio "de referencia" del CSV tiene una normalización propia
poco confiable (columnas productos_cantidad_presentacion/unidad_medida
también vistas con valores inconsistentes en el dry-run) — se calcula
precio_ars_kg = precio_lista / tamaño_paquete_kg parseando el tamaño desde
la descripción, no desde las columnas estructuradas.

MARCA_A_EMPRESA mapea la marca de góndola a la empresa de ym.competencia
SOLO con las atribuciones ya citadas en docs/fuentes_competencia.md — no se
inventan mapeos nuevos. Marcas no listadas ahí quedan con empresa_ym NULL.

Uso:
    python -m backend.etl.etl_sepa_gondola --dry-run
    python -m backend.etl.etl_sepa_gondola
    python -m backend.etl.etl_sepa_gondola --dia-semana miercoles  # default: hoy
"""

from __future__ import annotations

import argparse
import csv
import io
import os
import re
import sys
import unicodedata
import zipfile
from collections import defaultdict
from datetime import date

import requests
from dotenv import load_dotenv

DATASET_BASE = "https://datos.produccion.gob.ar/dataset/6f47ec76-d1ce-4e34-a7e1-621fe9b1d0b5"

# URLs de recurso confirmadas manualmente contra la API CKAN de
# datos.produccion.gob.ar (2026-07-04) — CKAN no expone un patrón de URL
# predecible por nombre de archivo, hay que resolverlas vía package_show.
CKAN_PACKAGE_URL = "https://datos.produccion.gob.ar/api/3/action/package_show?id=sepa-precios"

DIAS = ["lunes", "martes", "miercoles", "jueves", "viernes", "sabado", "domingo"]

PATRON_YERBA = re.compile(r"yerba", re.IGNORECASE)
# Tamaño de paquete: se busca en cualquier parte de la descripción, no
# inmediatamente después de la marca — cada cadena de supermercado usa un
# formato de texto libre distinto (confirmado en dry-run 2026-07-04: no hay
# un patrón único "YERBA <marca> X<cantidad>" consistente entre comercios).
PATRON_TAMANO = re.compile(r"(?P<cantidad>\d+[.,]?\d*)\s*(?P<unidad>KG|GR|G)\b", re.IGNORECASE)

def _sin_acentos(s: str) -> str:
    return "".join(c for c in unicodedata.normalize("NFKD", s) if not unicodedata.combining(c))


# Atribuciones marca -> empresa citadas en docs/fuentes_competencia.md
# (research de Fase 8, 2026-07-04). No agregar mapeos sin fuente nueva.
# Claves ya sin acentos (la comparación con la descripción también los saca).
MARCA_A_EMPRESA = {
    "ROSAMONTE": "Hrenuk (Rosamonte)",
    "PLAYADITO": "Playadito",
    "AMANDA": "La Cachuera",
    "VERDEFLOR": "Cordeiro (Verde Flor)",
    "VERDE FLOR": "Cordeiro (Verde Flor)",
    "TARAGUI": "Las Marias",
    "LA MERCED": "Las Marias",
    "PIPORE": "Pipore",
    "CACHAMATE": "Gregorio Numo y Noel Werthein (Cachamal)",
    "CACHAMAI": "Gregorio Numo y Noel Werthein (Cachamal)",
    "CACHAMAL": "Gregorio Numo y Noel Werthein (Cachamal)",
    "NOBLEZA GAUCHA": "Yerbatera Misiones SRL",
    "CRUZ DE MALTA": "Yerbatera Misiones SRL",
    "LA TRANQUERA": "J Llorente y Cia (La Tranquera)",
    "AGUANTADORA": "Montecarlo (Aguantadora)",
    "ANDRESITO": "Yerbatera Andresito",
    "ROMANCE": "Gerula (Romance)",
    "CBSE": "Cbse",
    "SANTA ANA": "Cbse",
    "MATE ROJO": "Mate Rojo",
    "BONAFE": "Bonafe (Mas Sabor)",
    "LA CUMBRECITA": "La Cumbrecita",
    "SANESA": "Sanesa (Natura)",
    "LA HOJA": "Cooperativa La Hoja",
    "IMHOFF": "Establecimiento Imhoff (Buen Dia)",
    "BUEN DIA": "Establecimiento Imhoff (Buen Dia)",
    "NAVAR": "Navar SRL (Primicia)",
    "PRIMICIA": "Navar SRL (Primicia)",
}

# Marcas reales vistas en el dry-run (2026-07-04) sin atribución citada a una
# empresa de ym.competencia — se guardan igual (empresa_ym queda NULL) porque
# son marcas de góndola reales, no ruido; solo no se fuerza el vínculo.
MARCAS_SIN_EMPRESA_CONFIRMADA = [
    "UNION", "MULITA", "MANANITA", "CHAMIGO", "BUENAS Y SANTAS", "ADELGA MATE",
]

_KEYWORDS_ORDENADAS = sorted(
    {*MARCA_A_EMPRESA.keys(), *MARCAS_SIN_EMPRESA_CONFIRMADA}, key=len, reverse=True
)

# Filtro de calidad: descarta precios/kg fuera de este rango (probable dato
# corrupto o unidad mal parseada), no ajusta ni interpola nada.
PRECIO_ARS_KG_MIN = 100
PRECIO_ARS_KG_MAX = 100_000


def resolver_url_dia(dia_semana: str, timeout: int = 30) -> str:
    resp = requests.get(CKAN_PACKAGE_URL, timeout=timeout)
    resp.raise_for_status()
    recursos = resp.json()["result"]["resources"]
    for r in recursos:
        if _sin_acentos(r["name"].strip().lower()) == dia_semana:
            return r["url"]
    raise ValueError(f"No se encontró recurso para '{dia_semana}' en el dataset SEPA")


def descargar_dump(url: str, timeout: int = 300) -> bytes:
    resp = requests.get(url, timeout=timeout)
    resp.raise_for_status()
    return resp.content


def parsear_producto(descripcion: str) -> tuple[str, float] | None:
    """Devuelve (marca_normalizada, presentacion_kg) o None si no se puede
    identificar la marca (contra la lista conocida) o el tamaño de paquete."""
    descripcion_norm = _sin_acentos(descripcion.upper())
    marca = next((kw for kw in _KEYWORDS_ORDENADAS if kw in descripcion_norm), None)
    if marca is None:
        return None

    m = PATRON_TAMANO.search(descripcion)
    if not m:
        return None
    cantidad = float(m.group("cantidad").replace(",", "."))
    unidad = m.group("unidad").upper()
    kg = cantidad if unidad == "KG" else cantidad / 1000
    if kg <= 0 or kg > 5:  # paquetes de yerba real van de ~0.1 a ~2kg
        return None
    return marca, kg


def extraer_filas_yerba(dump_zip_bytes: bytes) -> list[tuple[str, float, float, str]]:
    """Devuelve lista de (marca, presentacion_kg, precio_ars_kg, id_comercio)."""
    filas: list[tuple[str, float, float, str]] = []
    outer = zipfile.ZipFile(io.BytesIO(dump_zip_bytes))
    for inner_name in outer.namelist():
        if not inner_name.endswith(".zip"):
            continue
        info = outer.getinfo(inner_name)
        if info.file_size == 0:
            continue
        with outer.open(inner_name) as inner_bytes:
            try:
                inner_zip = zipfile.ZipFile(io.BytesIO(inner_bytes.read()))
            except zipfile.BadZipFile:
                continue
            if "productos.csv" not in inner_zip.namelist():
                continue
            with inner_zip.open("productos.csv") as f:
                text = io.TextIOWrapper(f, encoding="utf-8-sig", errors="replace")
                reader = csv.reader(text, delimiter="|")
                next(reader, None)  # header
                for row in reader:
                    if len(row) < 10:
                        continue
                    descripcion = row[5]
                    if not PATRON_YERBA.search(descripcion):
                        continue
                    parsed = parsear_producto(descripcion)
                    if parsed is None:
                        continue
                    marca, kg = parsed
                    try:
                        precio_lista = float(row[9])
                    except ValueError:
                        continue
                    if precio_lista <= 0:
                        continue
                    precio_kg = precio_lista / kg
                    if not (PRECIO_ARS_KG_MIN <= precio_kg <= PRECIO_ARS_KG_MAX):
                        continue
                    filas.append((marca, kg, precio_kg, row[0]))
    return filas


def agregar(filas: list[tuple[str, float, float, str]]) -> list[tuple]:
    """Agrupa por (marca, presentacion_kg redondeada) -> promedio/min/max/n."""
    grupos: dict[tuple[str, float], list[tuple[float, str]]] = defaultdict(list)
    for marca, kg, precio_kg, id_comercio in filas:
        clave = (marca, round(kg, 3))
        grupos[clave].append((precio_kg, id_comercio))

    resultado = []
    for (marca, kg), obs in grupos.items():
        precios = [p for p, _ in obs]
        comercios = {c for _, c in obs}
        resultado.append(
            (
                marca,
                MARCA_A_EMPRESA.get(marca),
                kg,
                sum(precios) / len(precios),
                min(precios),
                max(precios),
                len(precios),
                len(comercios),
            )
        )
    return resultado


def upsert(conn, fecha_snapshot: date, filas_agregadas: list[tuple]) -> None:
    from psycopg2.extras import execute_values

    filas = [(fecha_snapshot, *f) for f in filas_agregadas]
    query = """
        INSERT INTO ym.precios_gondola (
            fecha_snapshot, marca_gondola, empresa_ym, presentacion_kg,
            precio_ars_kg_promedio, precio_ars_kg_min, precio_ars_kg_max,
            n_observaciones, n_comercios
        ) VALUES %s
        ON CONFLICT (fecha_snapshot, marca_gondola, presentacion_kg) DO UPDATE SET
            empresa_ym = EXCLUDED.empresa_ym,
            precio_ars_kg_promedio = EXCLUDED.precio_ars_kg_promedio,
            precio_ars_kg_min = EXCLUDED.precio_ars_kg_min,
            precio_ars_kg_max = EXCLUDED.precio_ars_kg_max,
            n_observaciones = EXCLUDED.n_observaciones,
            n_comercios = EXCLUDED.n_comercios
    """
    with conn.cursor() as cur:
        execute_values(cur, query, filas)


def main() -> None:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    load_dotenv()
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dia-semana", default=DIAS[date.today().weekday()], choices=DIAS)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    print(f"Resolviendo URL del recurso '{args.dia_semana}'...")
    url = resolver_url_dia(args.dia_semana)
    print(f"Descargando {url} ...")
    dump_bytes = descargar_dump(url)
    print(f"Descargado: {len(dump_bytes) / 1e6:.1f} MB. Filtrando 'yerba' y parseando...")

    filas_crudas = extraer_filas_yerba(dump_bytes)
    print(f"Filas sucursal-producto con 'yerba' parseadas OK: {len(filas_crudas)}")

    filas_agregadas = agregar(filas_crudas)
    filas_agregadas.sort(key=lambda f: -f[6])  # por n_observaciones desc
    print(f"Marcas/presentaciones agregadas: {len(filas_agregadas)}")
    print(f"{'marca':<20} {'empresa_ym':<35} {'kg':>6} {'prom $/kg':>10} {'min':>8} {'max':>8} {'n_obs':>7} {'n_com':>6}")
    for marca, empresa, kg, prom, pmin, pmax, n_obs, n_com in filas_agregadas[:30]:
        print(f"{marca:<20} {(empresa or '—'):<35} {kg:>6.2f} {prom:>10.0f} {pmin:>8.0f} {pmax:>8.0f} {n_obs:>7} {n_com:>6}")

    if args.dry_run:
        return

    import psycopg2

    conn = psycopg2.connect(os.environ["DATABASE_URL"])
    try:
        upsert(conn, date.today(), filas_agregadas)
        conn.commit()
        print(f"\nCommit OK — snapshot {date.today().isoformat()}, {len(filas_agregadas)} filas en ym.precios_gondola")
    finally:
        conn.close()


if __name__ == "__main__":
    main()
