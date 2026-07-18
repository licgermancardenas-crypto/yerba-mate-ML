"""Orquestador — corre los 3 scripts de scoring de Fase 5 en secuencia y
escribe todo en ym.ml_predicciones.

Uso:
    python -m backend.ml.generar_predicciones --dry-run
    python -m backend.ml.generar_predicciones
"""

from __future__ import annotations

import argparse
import sys

from backend.ml import scoring_modelo1, scoring_modelo2, scoring_modelo3


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    argv_original = sys.argv
    sys.argv = ["generar_predicciones"] + (["--dry-run"] if args.dry_run else [])
    try:
        for nombre, modulo in [
            ("Modelo 1 (Producción por zona)", scoring_modelo1),
            ("Modelo 2 (Consumo interno)", scoring_modelo2),
            ("Modelo 3 (Exportaciones gravitacional)", scoring_modelo3),
        ]:
            print(f"\n{'=' * 60}\n{nombre}\n{'=' * 60}")
            modulo.main()
    finally:
        sys.argv = argv_original


if __name__ == "__main__":
    main()
