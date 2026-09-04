# Auditoría operativa · V11.8.2

La V11.8.2 reconstruye el módulo **Auditoría de la operación** como una herramienta de control y trazabilidad para el proceso de suministros.

## Alcance funcional

- Indicadores de pedidos auditados, eventos, aprobaciones pendientes, incidencias, tiempo promedio por etapa y pedidos críticos.
- Filtros por periodo, proceso/etapa, responsable, prioridad, cliente y búsqueda libre.
- Navegación por creación de pedidos, acciones del flujo, decisiones y trazabilidad.
- Bitácora enriquecida con responsable, rol, duración, riesgo contextual y evidencia asociada.
- Detalle del evento con antes/después, payload registrado, referencia técnica y acceso al expediente del pedido.
- Resumen lateral con alertas, cuellos de botella, responsables con más eventos y cumplimiento SLA cuando exista base de comparación.
- Exportación CSV de la vista filtrada para papeles de trabajo o análisis externo.

## Backend

El RPC `public.erp_x_audit_dashboard(jsonb)` consolida información de `order_events`, `orders`, `order_tasks`, `approval_requests`, `order_issues`, `operational_alerts`, `drive_files` y `profiles`. El acceso continúa sujeto al permiso `audit.read`.

## Principios de auditoría

La interfaz muestra únicamente información respaldada por datos existentes. Cuando no existe evidencia suficiente —por ejemplo, SLA sin fecha prometida o un archivo no registrado— se presenta explícitamente como información no disponible y no se infiere ni inventa.

## Archivos principales

- `assets/js/modules/audit.js`
- `assets/css/audit-v1182.css`
- `supabase/migrations/081_audit_dashboard_v11_8_2.sql`
- `supabase/migrations/082_audit_dashboard_step_sort_fix_v11_8_2.sql`
