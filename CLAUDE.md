# yerba-mate-ML — reglas permanentes de datos

Ver `docs/auditoria_datos.md` §7.1 para el detalle completo. Resumen exigible en cualquier ETL,
migración o endpoint nuevo:

- **NULL, nunca un relleno inventado.** Si falta un dato para un período/entidad, la columna queda
  NULL. No clonar el período anterior, no interpolar, no redondear a un valor "razonable". Esto
  aplica a ETLs, migraciones y a cualquier agregación en el frontend (`lib/agregaciones.ts`) —
  tratar NULL como "sin dato" explícito, no como 0.
- **Todo valor calculado/derivado que se muestre en el frontend necesita distinción visual**
  ("(estimado)"/"(calculado)" o un estilo distinto), no alcanza con documentarlo en `ym.fuentes`.
  Solo aplica cuando el valor es una aproximación real (proyección, imputación) — un cálculo
  matemático exacto sobre datos reales (ej. precio FOB = valor/kg) no necesita la etiqueta.
- **Toda tabla nueva necesita entrada en `ym.tabla_fuente`** (o columna `fuente_id` propia si
  mezcla fuentes por fila) antes de mergear — si no, el footer "Fuentes de esta vista" la muestra
  vacía.
- **Correr `python backend/etl/audit_datos.py`** antes de dar por buena una serie nueva. CI ya lo
  corre en PRs que tocan `backend/etl/**` o migraciones.
