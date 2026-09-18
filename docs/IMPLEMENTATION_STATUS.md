# Estado de implementación

## Estado de release — V11.30.1 · 2026-09-18

CRM Suministros mantiene la línea funcional V11.30.0 y prepara el hardening V11.30.1 sobre Vercel + Supabase `hezjxcxxcjlpmyalftam`. La operación productiva usa Supabase Auth, RPC `public.erp_x_*`, esquema privado `erp_supply`, Edge Functions administrativas y la integración server-to-server CRM → AuditoriaERP.

## Incluido y operativo

- Esquema independiente `erp_supply` con RLS habilitado.
- Supabase Auth, perfiles operativos, roles y permisos por módulo.
- Motor transaccional de pedidos, tareas, sesiones y calendario laboral.
- Cartera, Caja, Compras, Recepción, Alistamiento, Corte, Facturación, Despachos y Cierre.
- Inventario con maestro Siesa, lotes, reservas, movimientos, conteos ciegos, revisión y trazabilidad.
- Crédito, aprobaciones, comentarios, Drive y auditoría.
- Importación histórica, VSM, reportes, Administración y Jornada/actividades.
- Integración de novedades de Recepción hacia el módulo Recepción de AuditoriaERP mediante outbox, trigger, `pg_net`/dispatcher, Edge Function e idempotencia.
- PWA network-first con cache versionada.
- Vercel Speed Insights básico.

## Validación canónica

La CI `Validate CRM Suministros` exige:

- sintaxis JavaScript;
- grafo ES Modules completo y sin módulos huérfanos;
- contrato de seguridad del árbol actual;
- escaneo de secretos del historial Git completo;
- arquitectura canónica y cuatro familias CSS;
- invariantes de release/PWA;
- contrato estático CRM → AuditoriaERP;
- smoke público desktop y móvil en PR y nuevamente post-merge;
- empaquetado del frontend desplegable.

El backend productivo dispone de `erp_x_health_check()` con 21 canarios. Tras la auditoría integral del 14 de septiembre de 2026 el resultado fue **21/21 OK**. La integración AuditoriaERP dispone además de `erp_x_auditoria_erp_contract_check()` service-role-only. V11.30.1 añade `erp_x_security_definer_contract_check()` como control service-role-only de privilegios.

## Integridad verificada

En la auditoría V11.30.0 se comprobó:

- 0 pedidos finalizados con tareas activas;
- 0 números de pedido activos duplicados;
- 0 ítems activos de inventario fuera del maestro oficial;
- 0 saldos negativos de lote;
- 0 reservas negativas;
- 0 eventos de integración AuditoriaERP pendientes vencidos, fallidos o atascados;
- 0 perfiles operativos activos sin identidad Auth válida;
- 0 RPC `erp_x_*` ejecutables por `anon`;
- 0 triggers operativos deshabilitados.

## Pendientes de plataforma, no de código

- **Supabase Auth · Leaked Password Protection:** el Security Advisor la reporta deshabilitada. Debe activarse en la configuración Auth del proyecto.
- **Supabase Auth · rate limiting / anti-bot:** cerrar a nivel plataforma; el guard local no sustituye el control server-side.
- **GitHub · protección de `main`:** activar ruleset/branch protection con PR + `Validate CRM Suministros`, sin force-push ni borrado.
- Los 11 usuarios Auth históricos asociados a perfiles inactivos nunca han iniciado sesión. Se conservan hasta definir formalmente una política de retención/eliminación; no constituyen perfiles operativos activos.
- El Advisor informa FKs sin índice e índices sin uso. No se aplicarán cambios masivos: cualquier optimización debe justificarse con volumen y `pg_stat_statements` para evitar degradar escrituras.

## Regla de cambio

No modificar estados, inventario, permisos o tablas directamente para resolver incidencias si existe un RPC/transición. Todo cambio de esquema debe quedar como migración reproducible; toda modificación de frontend debe pasar la CI canónica antes de llegar a `main`.
