"""ETL — Ingreso de hoja verde por zona y salida de molino (INYM, PDF).

Fuente: https://inym.org.ar/descargar/publicaciones/estadisticas/{año}.html
(NO usar /noticias/estadisticas/ — son noticias de prensa con acumulados
irregulares, ver docs/inym_scraper.md).

Cada informe mensual (2019-presente) es un PDF de ~8 páginas con tablas
reales (extraídas con `page.find_tables()` de PyMuPDF, no regex sobre texto
plano). Los años 2011-2018 están en 8 PDFs ANUALES (un archivo por año, con
el detalle de los 12 meses adentro), listados en una sola página
`2018-a-2011.html` en vez de una página por año.

Variables extraídas (confirmado 2026-07-01 contra archivos reales):
- Ingreso de hoja verde por zona (Centro/Noroeste/Noreste/Oeste/Sur/Corrientes)
  — la tabla se titula literalmente "Cuadro 1. Ingreso de Hoja Verde por
  Zona", confirma que "Avance de Cosecha" = esto.
- Salida de molino, mercado interno y mercado externo (kg) — tablas
  "históricas" que traen hasta 5 años de comparación por mes en cada informe.

NO se scrapea "mezcla de envases" (Cuadro de formato de venta): ya está
cubierta por `ym.consumo_interno` (envase_05kg_pct, etc.) desde los CSV
históricos — aunque los valores no son idénticos (son mediciones en puntos
distintos de la cadena), no vale la pena duplicar el esfuerzo de parsing de
un gráfico circular (no es una tabla real, `find_tables()` no la detecta).

Uso:
    python -m backend.etl.etl_inym_pdf --dry-run --years 2020,2025
    python -m backend.etl.etl_inym_pdf --dry-run          # descubre y procesa TODO (2011-presente)
    python -m backend.etl.etl_inym_pdf                    # carga real a la DB
"""

from __future__ import annotations

import argparse
import os
import re
from datetime import date

import fitz
import requests
from dotenv import load_dotenv

BASE = "https://inym.org.ar"
LISTADO_URL = BASE + "/descargar/publicaciones/estadisticas/{pagina}.html"
DESCARGA_RE = re.compile(r'<a[^>]+href="(https://inym\.org\.ar/descargar\.html\?archivo=[^"]+)"[^>]*>(.*?)</a>', re.S)

MESES = {
    "enero": 1, "febrero": 2, "marzo": 3, "abril": 4, "mayo": 5, "junio": 6,
    "julio": 7, "agosto": 8, "septiembre": 9, "setiembre": 9, "octubre": 10,
    "noviembre": 11, "diciembre": 12,
}
ZONAS_COLUMNAS = ["ZONA CENTRO", "ZONA NOROESTE", "ZONA NORESTE", "ZONA OESTE", "ZONA SUR", "CORRIENTES", "TOTAL"]


def _parse_periodo_mes(celda: str) -> int | None:
    """'Enero 2025' / 'enero-12' / 'Enero' -> número de mes, o None si no matchea."""
    texto = celda.strip().lower()
    texto = re.split(r"[\s-]", texto)[0]
    return MESES.get(texto)


def _parse_numero(valor: str | None) -> float | None:
    if valor is None:
        return None
    s = valor.strip().replace(".", "")
    if s in ("", "-"):
        return None
    try:
        return float(s)
    except ValueError:
        return None


def descubrir_pdfs(anio_desde: int = 2011, anio_hasta: int | None = None) -> list[dict]:
    """Devuelve [{url, anio, mes (None si es anual), tipo}] descubiertos en las
    páginas de publicaciones. Años 2011-2018 vienen en una sola página anual."""
    anio_hasta = anio_hasta or date.today().year
    pdfs = []

    if anio_desde <= 2018:
        html = requests.get(LISTADO_URL.format(pagina="2018-a-2011"), timeout=30).text
        for url, label in DESCARGA_RE.findall(html):
            label_limpio = re.sub("<[^<]+?>", " ", label)
            label_limpio = re.sub(r"\s+", " ", label_limpio).strip()
            m = re.search(r"(\d{4})", label_limpio)
            if not m:
                continue
            anio = int(m.group(1))
            if anio_desde <= anio <= min(anio_hasta, 2018):
                pdfs.append({"url": url, "anio": anio, "mes": None, "tipo": "anual"})

    for anio in range(max(anio_desde, 2019), anio_hasta + 1):
        resp = requests.get(LISTADO_URL.format(pagina=anio), timeout=30)
        if resp.status_code != 200:
            continue
        for url, label in DESCARGA_RE.findall(resp.text):
            label_limpio = re.sub("<[^<]+?>", " ", label)
            label_limpio = re.sub(r"\s+", " ", label_limpio).strip()
            mes = _parse_periodo_mes(label_limpio)
            if mes is None:
                continue
            pdfs.append({"url": url, "anio": anio, "mes": mes, "tipo": "mensual"})

    return pdfs


_ZONAS_ESTRICTAS = {"ZONA CENTRO", "ZONA NOROESTE", "ZONA NORESTE", "ZONA OESTE", "ZONA SUR"}


def _encontrar_header(filas: list[list]) -> tuple[int, list, str] | tuple[None, None, None]:
    """Busca la fila de encabezado real entre las primeras filas — en los
    reportes mensuales la fila 0 es un título ('Cuadro 1. Ingreso de Hoja
    Verde por Zona') y el encabezado real está en la fila 1; en los anuales
    la fila 0 YA es el encabezado. Hay que detectarlo, no asumir la posición.
    OJO: no alcanza con buscar la palabra 'ZONA' en la fila entera — el
    título también la contiene ('...por Zona'), hay que exigir que alguna
    CELDA sea exactamente un nombre de zona, no que la fila la mencione."""
    for i, fila in enumerate(filas[:3]):
        celdas_norm = {re.sub(r"\s+", " ", str(c)).strip().upper() for c in fila if c}
        if celdas_norm & _ZONAS_ESTRICTAS:
            return i, fila, "hoja_verde"
        primera = str(fila[0]).strip().lower() if fila[0] else ""
        resto = [c for c in fila[1:] if c]
        if primera in ("periodo",) and resto and all(re.fullmatch(r"\d{4}", str(c).strip()) for c in resto):
            return i, fila, "salida_ambiguo"
    return None, None, None


def parsear_pdf(contenido: bytes, anio_reporte: int) -> dict:
    """Devuelve {'hoja_verde': [(anio,mes,zona,kg)], 'salida_molino': [(anio,mes,destino,kg)]}."""
    hoja_verde: list[tuple] = []
    salida_molino: list[tuple] = []

    doc = fitz.open(stream=contenido, filetype="pdf")
    for page in doc:
        texto_pagina = page.get_text()
        for tabla in page.find_tables().tables:
            filas = tabla.extract()
            if not filas:
                continue
            header_idx, header, tipo = _encontrar_header(filas)
            if tipo is None:
                continue
            filas_datos = filas[header_idx + 1:]

            if tipo == "hoja_verde":
                col_zona = {}
                for idx, nombre in enumerate(header):
                    if not nombre:
                        continue
                    nombre_norm = re.sub(r"\s+", " ", nombre).strip().upper()
                    if nombre_norm in ZONAS_COLUMNAS:
                        col_zona[idx] = nombre_norm
                for fila in filas_datos:
                    if not fila or not fila[0]:
                        continue
                    mes = _parse_periodo_mes(fila[0])
                    if mes is None:
                        continue  # fila de total anual, no de mes
                    m_anio = re.search(r"[\s-](\d{2,4})$", fila[0].strip())
                    anio_fila = anio_reporte
                    if m_anio:
                        yy = m_anio.group(1)
                        anio_fila = int(yy) if len(yy) == 4 else 2000 + int(yy)
                    for idx, zona in col_zona.items():
                        kg = _parse_numero(fila[idx]) if idx < len(fila) else None
                        if kg is not None:
                            hoja_verde.append((anio_fila, mes, zona, kg))

            elif tipo == "salida_ambiguo":
                texto_lower = texto_pagina.lower()
                if "hoja verde" in texto_lower or "cosecha" in texto_lower:
                    continue  # tabla comparativa nacional de hoja verde (redundante con el detalle por zona)
                if "mercado externo" in texto_lower or ("externo" in texto_lower and "interno" not in texto_lower):
                    destino = "externo"
                else:
                    destino = "interno"
                anos_columna = [int(c.strip()) if c and re.fullmatch(r"\d{4}", c.strip()) else None for c in header]
                for fila in filas_datos:
                    if not fila or not fila[0]:
                        continue
                    mes = _parse_periodo_mes(fila[0])
                    if mes is None:
                        continue
                    for idx, anio_col in enumerate(anos_columna):
                        if anio_col is None or idx >= len(fila):
                            continue
                        kg = _parse_numero(fila[idx])
                        if kg is not None:
                            salida_molino.append((anio_col, mes, destino, kg))

    return {"hoja_verde": hoja_verde, "salida_molino": salida_molino}


def upsert_hoja_verde(conn, filas: list[tuple]) -> None:
    from psycopg2.extras import execute_values

    query = """
        INSERT INTO ym.inym_hoja_verde_zona (anio, mes, zona, hoja_verde_kg)
        VALUES %s
        ON CONFLICT (anio, mes, zona) DO UPDATE SET hoja_verde_kg = EXCLUDED.hoja_verde_kg
    """
    with conn.cursor() as cur:
        execute_values(cur, query, filas)


def upsert_salida_molino(conn, filas: list[tuple]) -> None:
    from psycopg2.extras import execute_values

    query = """
        INSERT INTO ym.inym_salida_molino (anio, mes, destino, volumen_kg)
        VALUES %s
        ON CONFLICT (anio, mes, destino) DO UPDATE SET volumen_kg = EXCLUDED.volumen_kg
    """
    with conn.cursor() as cur:
        execute_values(cur, query, filas)


def main() -> None:
    load_dotenv()
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--years", help="Ej. '2020,2025' — limita el descubrimiento a estos años (para pruebas)")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    if args.years:
        anios = sorted(int(a) for a in args.years.split(","))
        pdfs = [p for p in descubrir_pdfs(min(anios), max(anios)) if p["anio"] in anios]
    else:
        pdfs = descubrir_pdfs()

    print(f"PDFs descubiertos: {len(pdfs)}")

    conn = None
    if not args.dry_run:
        import psycopg2

        conn = psycopg2.connect(os.environ["DATABASE_URL"])

    try:
        total_hoja_verde, total_salida = 0, 0
        for pdf in pdfs:
            etiqueta = f"{pdf['anio']}" + (f"-{pdf['mes']:02d}" if pdf["mes"] else " (anual)")
            resp = requests.get(pdf["url"], timeout=45)
            resp.raise_for_status()
            datos = parsear_pdf(resp.content, pdf["anio"])
            print(f"{etiqueta}: {len(datos['hoja_verde'])} filas hoja_verde, {len(datos['salida_molino'])} filas salida_molino")
            total_hoja_verde += len(datos["hoja_verde"])
            total_salida += len(datos["salida_molino"])
            if not args.dry_run:
                if datos["hoja_verde"]:
                    upsert_hoja_verde(conn, datos["hoja_verde"])
                if datos["salida_molino"]:
                    upsert_salida_molino(conn, datos["salida_molino"])
        print(f"Total filas hoja_verde: {total_hoja_verde}, salida_molino: {total_salida}")
        if conn is not None:
            conn.commit()
            print("Commit OK")
    finally:
        if conn is not None:
            conn.close()


if __name__ == "__main__":
    main()
