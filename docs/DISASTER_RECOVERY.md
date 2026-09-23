# Recuperación ante desastre y reproducibilidad de base de datos

## Estado de referencia

Proyecto productivo: `hezjxcxxcjlpmyalftam`.

Desde V11.32.0 el repositorio distingue dos objetivos que antes estaban mezclados:

1. **DR operativo**: recuperar el servicio y los datos ante pérdida/incidente.
2. **Rebuild source-only**: construir una base equivalente desde una instancia PostgreSQL/Supabase vacía usando exclusivamente artefactos del repositorio.

El primer objetivo es obligatorio para operación. El segundo es el objetivo técnico final, pero **todavía no puede declararse reproducible** porque el historial productivo contiene migraciones antiguas aplicadas fuera de Git.

## Hallazgo histórico

La auditoría del 23/09/2026 verificó que `sql/00_INSTALL_ALL.sql` existió en Git hasta V11.5:

- último commit verificado: `5fd560ef91bb39ee5509f4bdb686436d0effa418`;
- blob: `29df83313a9381eeb805a077fd3d3f64c30c8cee`;
- tamaño: 4.051.446 bytes.

Ese archivo fue retirado durante el saneamiento V11.21. Su contenido no representa el esquema V11.32.0 y **no debe restaurarse como instalador actual**.

Supabase conserva además 27 migraciones históricas aplicadas para las que no existe un SQL equivalente verificable en el árbol actual. El inventario normativo está en:

`supabase/production-migration-ledger.json`

La CI ejecuta `npm run db:ledger` y prohíbe que esa deuda histórica aumente.

## Estrategia de DR vigente

Ante un incidente de producción, no reconstruir manualmente el esquema ejecutando SQL histórico por ensayo y error.

El orden operativo es:

1. preservar evidencia del incidente y detener escrituras si existe riesgo de corrupción;
2. recuperar la base mediante el mecanismo administrado de backup/snapshot/PITR aprobado para el proyecto;
3. comprobar proyecto, esquema, Auth, Edge Functions, Vault y extensiones;
4. aplicar únicamente las migraciones versionadas que sean posteriores al punto recuperado;
5. desplegar las Edge Functions correspondientes a la misma release;
6. ejecutar health checks, contratos de seguridad e integración;
7. validar login, pedidos, recepción, inventario, jornada, aprobaciones, reportes y administración;
8. promover el frontend de la misma release y comprobar el service worker.

Una recuperación no se considera cerrada únicamente porque PostgreSQL acepte conexiones.

## Rebuild source-only

Hasta que exista un baseline validado, queda prohibido afirmar que:

`base vacía → archivos actuales del repo → producción equivalente`

es una ruta certificada.

Para cerrar definitivamente este punto se debe generar un snapshot/baseline DDL desde el esquema productivo, probarlo en una base desechable vacía y demostrar:

- mismas tablas, columnas, tipos, constraints, índices y secuencias requeridas;
- mismas funciones/RPC, ownership, grants y `search_path`;
- RLS y policies equivalentes;
- triggers y extensiones requeridas;
- Edge Functions y secretos configurables sin valores embebidos;
- health checks y E2E autenticado en verde;
- migraciones posteriores aplicables sin drift.

Solo después de esa prueba podrá reducirse `debtBudget` del ledger hacia cero y archivarse SQL histórico adicional.

## Gobierno de nuevas migraciones

Desde V11.32.0:

- ningún DDL productivo se aplica sin archivo en `supabase/migrations/`;
- el nombre debe seguir `NNN_nombre.sql` o `YYYYMMDDHHMMSS_nombre.sql`;
- la migración debe entrar por PR;
- CI debe pasar antes de producción;
- después del despliegue se actualiza el ledger si cambia la historia aplicada;
- no se borran migraciones históricas por apariencia de obsolescencia;
- un squash/baseline solo puede sustituir historia después de una reconstrucción vacía comprobada.

## Simulacro recomendado

Periódicamente debe ejecutarse un simulacro aislado que mida:

- RTO: tiempo hasta servicio funcional;
- RPO: punto de datos recuperable;
- migraciones pendientes;
- Edge Functions y secretos;
- autenticación y permisos;
- operaciones críticas;
- evidencias del resultado.

La restauración nunca debe ensayarse directamente sobre producción.
