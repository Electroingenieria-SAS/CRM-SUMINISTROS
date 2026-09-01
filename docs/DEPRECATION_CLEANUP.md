# ERP EI · Limpieza y deprecación · 2026-09-01

## Objetivo

Reducir deuda de repositorio sin borrar evidencia técnica necesaria para reconstruir, auditar o migrar el ERP.

## Eliminado del runtime

- `assets/js/modules/qa.js`
- `assets/js/modules/qa-total.js`
- `assets/js/modules/qa-flow.js`
- `assets/js/modules/sandbox.js`
- `tests/load/erp-capacity.js`
- `tests/qa-total/`
- `supabase/functions/erp-e2e-bot/`

Motivo: el validador V10.33.1 exige explícitamente que QA/Sandbox no forme parte del runtime productivo y `main.js` no depende de esos módulos. La Edge Function `erp-e2e-bot` tampoco está desplegada en el proyecto Supabase productivo verificado.

## Documentación obsoleta retirada

Se retiraron `INSTRUCCIONES_V10_12.md` a `INSTRUCCIONES_V10_21_5.md`, `README_V10_16_2.md`, documentos de QA Bot/QA Total y archivos de validación de versiones anteriores. Su contenido operativo queda reemplazado por:

- `/README.md`
- `/docs/ARCHITECTURE.md`
- `/docs/FUNCTIONAL_FLOWS.md`
- `/docs/SECURITY.md`
- `/docs/AUDITORIA_INTEGRAL_2026-09-01.md`
- `/docs/QA_RELEASE_CHECKLIST.md`
- `/docs/OPERATIONS_RUNBOOK.md`

## Conservado deliberadamente

No se borró el historial SQL ni las migraciones anteriores. Aunque parte de ese material sea histórico, hoy es evidencia de evolución de esquema y puede ser necesaria para:

1. reconstruir una instalación existente;
2. comparar drift de base de datos;
3. investigar regresiones;
4. elaborar una futura migración de consolidación.

Eliminarlo sin producir primero un baseline reproducible de esquema sería una pérdida de trazabilidad y un riesgo operativo.

## Próxima deprecación recomendada

El Security Advisor todavía identifica una superficie amplia de RPC `SECURITY DEFINER`, en especial familias heredadas `erp_v9_*` y helpers antiguos. No se eliminaron automáticamente porque la ausencia de referencias en el frontend no demuestra que no exista consumo externo. Antes de retirarlos se debe revisar telemetría/logs de PostgREST, crear una lista de consumidores y ejecutar una ventana de deprecación controlada.
