# Runbook operativo y de incidentes

## Monitoreo diario

- disponibilidad del frontend;
- errores de Edge Function;
- errores 4xx/5xx de RPC;
- sesiones/auth failures anómalos;
- cola de outbox/alertas operativas si aplica;
- crecimiento DB y Drive.

## Monitoreo semanal

- Supabase Security Advisor;
- Performance Advisor;
- `pg_stat_statements` para queries lentas/frecuentes;
- usuarios activos/inactivos y Super Admin existentes;
- archivos/referencias huérfanas;
- tareas activas en pedidos finalizados;
- sesiones de tarea abiertas de forma anómala.

## Incidente de secreto expuesto

1. Revocar/rotar primero.
2. Identificar superficie y periodo de exposición.
3. Revisar logs de uso.
4. Limpiar historia Git.
5. Actualizar CI/Vercel/Supabase secrets.
6. Documentar incidente sin copiar el secreto al ticket.

## Incidente Auth

- comprobar estado Supabase;
- distinguir 401 (sesión/token) de 403 (autorización);
- verificar vínculo `profiles.auth_user_id`;
- no “arreglar” permisos dando `service_role` al cliente;
- revisar evento de auditoría antes de recrear cuentas.

## Incidente de flujo

No modificar `orders.current_step_code` manualmente en producción como primer recurso. Capturar order id, tarea activa, step/status, eventos recientes y ejecutar la corrección mediante RPC/migración transaccional aprobada.

## Recovery

Definir RPO/RTO empresarial. Para cambios de schema mantener migraciones reproducibles. Para datos críticos usar backups/PITR acorde al plan. Probar restauración; tener backup sin haber probado restore no equivale a tener recuperación garantizada.
