# Auditoría integral CRM Suministros — 2026-09-14

## Alcance

Auditoría técnica integral sobre las tres capas productivas del CRM Suministros:

- GitHub: composición del frontend, módulos ES, seguridad estática, arquitectura canónica, service worker, configuración Vercel, Edge Functions y migraciones.
- Vercel: proyecto productivo, deployment vigente, build, cabeceras, CSP, assets y errores de runtime.
- Supabase: salud del proyecto, migraciones, funciones RPC, RLS, privilegios, Edge Functions, cron, pg_net, integridad de datos, estadísticas y Advisors.

No se realizan cambios de negocio ni correcciones masivas basadas únicamente en lints. Toda modificación incluida en esta auditoría debe responder a un defecto reproducible o a un control preventivo sustentado por evidencia.

## Resultado ejecutivo

Estado general: **estable, sin hallazgos críticos ni pérdida de integridad operativa**.

Hallazgos confirmados:

1. **Health check de Shipping desactualizado — MEDIO.** El canario `06_SHIPPING` buscaba `SALES_ORDER_ADDRESS` en `erp_x_shipping_save_guide()`, aunque desde V10.11.6 la dirección canónica se materializa correctamente en `erp_x_shipping_send_to_closure()`. Shipping productivo conserva el contrato; fallaba el diagnóstico, no el flujo.
2. **Protección contra contraseñas filtradas deshabilitada en Supabase Auth — MEDIO.** El Advisor de seguridad lo reporta. Requiere configuración de Auth/Management API; no debe simularse como corregido mediante SQL.
3. **11 usuarios Auth históricos sin perfil activo — BAJO / mantenimiento.** Los 11 corresponden a perfiles inactivos, ninguno registra inicio de sesión y no existe ningún usuario Auth sin antecedente de perfil. No se eliminan automáticamente por tratarse de una acción destructiva de identidad.
4. **Advisor de índices: 127 FK sin índice — INFORMATIVO.** No se crean índices masivos. La mayoría de tablas afectadas son pequeñas o las consultas actuales ya utilizan índices compuestos alternativos. La decisión se cruza con estadísticas reales antes de indexar.
5. **74 índices sin uso registrado — INFORMATIVO.** No se eliminan: varios son preventivos, recientes o pertenecen a flujos con poco volumen. Eliminar índices por una ventana estadística corta podría degradar operaciones futuras.
6. **Metadatos de versión/caché V11.27 frente a módulos V11.28/V11.29 — BAJO.** Es deuda de release metadata; el runtime productivo es network-first y sirve el código actual. Debe resolverse en un release coordinado, no mediante un cambio parcial de versión que rompa los invariantes canónicos.

## Código y arquitectura GitHub

El repositorio conserva cuatro familias CSS canónicas: `core-shell.css`, `operations.css`, `analytics.css` y `experience.css`. La CI prohíbe familias adicionales, lo cual reduce contaminación visual accidental.

El grafo ES parte de `assets/js/app-entry.js` y cubre aproximadamente 89 archivos JavaScript alcanzables. El verificador `scripts/link-check.mjs` detecta imports rotos y módulos huérfanos. El control de seguridad inspecciona JavaScript, TypeScript y SQL, bloquea secretos privados/service-role en cliente y prohíbe acceso directo a tablas Supabase desde `assets/js`.

Los módulos de mayor complejidad se concentran en Pedidos, Jornada, Operacional, PACO, Administración, Reportes, Corte, Picking, Recepción e Inventario. No se detectó evidencia de importaciones rotas ni módulos huérfanos en la última validación canónica.

La arquitectura del navegador continúa siendo RPC-only para datos operativos. `assets/js/services/supabase.js` conserva sesiones PKCE/autorefresh y `assets/js/services/api.js` centraliza RPC y Edge Functions.

## Supabase — seguridad

- Proyecto: `hezjxcxxcjlpmyalftam`, estado `ACTIVE_HEALTHY`, PostgreSQL 17.6.
- Todas las tablas base de `erp_supply` tienen RLS habilitado.
- Ningún RPC `public.erp_x_*` concede `EXECUTE` a `anon`.
- Los RPC SECURITY DEFINER autenticados revisados utilizan `require_profile`, permisos de módulo/rol o delegan en una función interna que los aplica.
- Los RPC internos de la integración AuditoriaERP permanecen reservados a `service_role` cuando corresponde.
- No hay índices inválidos.
- No hay triggers de usuario deshabilitados en `erp_supply`.
- La única constraint `NOT VALID` pertenece al esquema administrado `realtime`, no al CRM.

El Advisor marca múltiples tablas RLS sin políticas. En `erp_supply` esto es en gran medida **deny-by-default deliberado**: el frontend no consulta tablas directamente y opera mediante RPC SECURITY DEFINER con controles de autorización. No se agregan políticas permisivas para silenciar el linter.

### Pendiente de configuración

Supabase Auth reporta `auth_leaked_password_protection` deshabilitado. Debe habilitarse desde la configuración Auth del proyecto o Management API autorizada. No existe una acción SQL segura equivalente dentro del alcance del conector utilizado en esta auditoría.

## Supabase — integridad operativa

Comprobaciones directas:

- pedidos finalizados con tareas activas: **0**;
- números de pedido no cancelados duplicados: **0**;
- pedidos con más de una tarea activa: **0**;
- inventario activo sin `material_master_id`: **0**;
- lotes con disponible/reservado/bloqueado negativo: **0**;
- reservas de material negativas: **0**;
- eventos AuditoriaERP `FAILED`: **0**;
- eventos AuditoriaERP `PENDING`: **0**;
- eventos AuditoriaERP `SYNCING` atascados: **0**;
- perfiles activos sin usuario Auth válido: **0**;
- email operativo duplicado en perfiles activos: **0**;
- código de empleado duplicado en perfiles activos: **0**;
- email distinto entre perfil activo y Auth: **0**.

Se observaron 105 lotes donde `quantity_reserved > quantity_available`. No constituyen sobreasignación: en la importación Siesa, `quantity_available` representa el saldo libre; `physicalExistence` se distribuye entre disponible, reservado y bloqueado. En 2 lotes el snapshot de `physicalExistence` no coincide con la suma actual debido a movimientos `ISSUE` posteriores al último archivo Siesa, comportamiento esperado y trazable.

## Supabase — integración AuditoriaERP

- Trigger productivo: `tr_queue_auditoria_erp_receipt` activo sobre `warehouse_receipts`.
- Dispatcher server-to-server instalado.
- Cron de reintento AuditoriaERP: cada minuto.
- Cola productiva sin pendientes/fallos/atascos al momento de la auditoría.
- Edge `erp-auditoria-bridge`: activa; webhook DB protegido mediante delivery token/claim y fallback de navegador con validación de identidad.
- Métricas AuditoriaERP continúan separadas y agregadas.

La migración 108 añade canarios permanentes para el trigger/dispatcher y la salud de la cola.

## Supabase — rendimiento

Mediciones actuales con contexto autenticado de solo lectura:

- `erp_x_dashboard()`: ~33 ms;
- `erp_x_list_orders()`: ~25 ms;
- `erp_x_inventory_filtered({})`: ~176 ms sobre el catálogo actual;
- `erp_x_work_my_day(current_date)`: ~300 ms.

`pg_stat_statements` mostraba promedios históricos superiores para algunos hot paths, pero incluye actividad anterior a las optimizaciones 099–101. Las mediciones actuales no justifican cambios agresivos.

El Advisor lista 127 foreign keys sin índice y 74 índices sin uso. No se aplican cambios masivos: los datos reales muestran tablas pequeñas, índices compuestos ya utilizados en varios casos y una carga operacional todavía baja en numerosas tablas. La indexación debe responder a planes de ejecución y crecimiento real.

## Vercel

- Proyecto: `crm-suministros`.
- Deployment productivo auditado: `main@7bbc095` antes de aplicar este paquete.
- Estado: `READY`.
- Errores de runtime de los últimos 7 días: **0**.
- Build auditado: completado sin errores; despliegue estático en ~112 ms.
- CSP, HSTS, `X-Content-Type-Options`, `X-Frame-Options`, Referrer Policy y Permissions Policy están activos.
- El asset productivo `app-entry.js` responde 200 y contiene los módulos actuales, incluida la capa de guías V11.29.1.

## Shipping — diagnóstico del canario

El health check histórico verificaba:

`SALES_ORDER_ADDRESS` dentro de `erp_x_shipping_save_guide()`.

El contrato V10.11.6 separó responsabilidades:

- `erp_x_shipping_save_guide()` registra guía/transportadora/costo/factura;
- `erp_x_shipping_send_to_closure()` toma la dirección registrada por Ventas y persiste el destino con `source='SALES_ORDER_ADDRESS'` al despachar.

Producción confirma que `erp_x_shipping_send_to_closure()` contiene el contrato y `erp_x_shipping_save_guide()` no, por diseño. Se corrige únicamente el health check.

## Corrección aplicada por esta auditoría

`supabase/migrations/108_integral_health_audit_v11_30_0.sql`:

- corrige el canario de Shipping;
- conserva todos los canarios anteriores;
- añade salud de saldos de inventario;
- añade integridad CRM → AuditoriaERP (trigger/dispatcher y outbox);
- añade integridad perfil/Auth;
- añade RLS global de `erp_supply`;
- añade control de no ejecución anónima de `erp_x_*`;
- añade control de triggers operativos deshabilitados.

La migración no modifica datos operativos, workflows, permisos funcionales, inventario, pedidos ni UI.

## Riesgos que NO se modifican automáticamente

- activar leaked-password protection: requiere configuración Auth, no SQL de negocio;
- borrar los 11 usuarios Auth históricos vinculados a perfiles inactivos: operación destructiva que debe obedecer a una política de retención/identidad;
- eliminar 74 índices no usados: insuficiente evidencia para una eliminación segura;
- crear 127 índices FK: insuficiente justificación de costo/beneficio;
- limpiar árboles históricos `sql/migrations`: son evidencia/versionado histórico y no deben reescribirse durante una auditoría productiva.

## Criterio de cierre

El paquete solo puede pasar a `main` cuando:

1. JavaScript syntax = SUCCESS;
2. ES module dependency graph = SUCCESS;
3. security contract = SUCCESS;
4. canonical architecture = SUCCESS;
5. release invariants = SUCCESS;
6. browser smoke desktop/mobile = SUCCESS;
7. migración 108 aplicada sin error;
8. `erp_x_health_check()` nuevo retorna todos los controles operativos en verde en un contexto autenticado, exceptuando cualquier prueba que dependa de una sesión cuando se ejecute desde SQL administrativo;
9. Vercel despliega exactamente el SHA fusionado y queda `READY`;
10. no aparecen errores nuevos de runtime ni eventos pendientes/fallidos de AuditoriaERP.
