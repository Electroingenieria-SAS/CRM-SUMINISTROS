# Shipping V11.43.1 — Cutover controlado

**Migración:** `supabase/migrations/20261001205000_shipping_carrier_persistence_v11_43_1.sql`  
**RPC:** `public.erp_x_shipping_save_guide(uuid,jsonb)`  
**Proyecto verificado:** `hezjxcxxcjlpmyalftam`  
**Fecha del preflight read-only:** 2026-10-01

> Este documento prepara el cutover. **NO ejecutar en producción desde este runbook** durante la fase de preparación. La aplicación remota requiere ventana aprobada, backup/evidencia previa y operador autorizado.

## PREFLIGHT

Antes de aplicar, guardar como evidencia en el ticket/cambio:

1. SHA exacto que contiene la migración.
2. Resultado de CI del SHA final integrado.
3. Definición previa completa de la función:
   ```sql
   select pg_get_functiondef('public.erp_x_shipping_save_guide(uuid,jsonb)'::regprocedure);
   ```
4. Firma, SECURITY DEFINER, search_path y ACL:
   ```sql
   select p.oid::regprocedure::text as signature,
          p.prosecdef as security_definer,
          p.proconfig,
          p.proacl
   from pg_proc p
   join pg_namespace n on n.oid=p.pronamespace
   where n.nspname='public' and p.proname='erp_x_shipping_save_guide';
   ```
5. Grants efectivos:
   ```sql
   select grantee, privilege_type
   from information_schema.routine_privileges
   where specific_schema='public'
     and routine_name='erp_x_shipping_save_guide'
   order by grantee, privilege_type;
   ```
6. Columnas canónicas:
   ```sql
   select column_name,data_type,is_nullable
   from information_schema.columns
   where table_schema='erp_supply' and table_name='deliveries'
     and column_name in (
       'carrier','tracking_number','carrier_invoice_number',
       'carrier_cost','carrier_cost_currency',
       'carrier_cost_recorded_by','carrier_cost_recorded_at','metadata'
     )
   order by ordinal_position;
   ```
7. Estado de migration history:
   ```sql
   select version,name
   from supabase_migrations.schema_migrations
   where version='20261001205000'
      or name='shipping_carrier_persistence_v11_43_1';
   ```
   Debe devolver **0 filas antes de aplicar**.
8. Confirmar que no existe una migración posterior en el branch integrado que reemplace `erp_x_shipping_save_guide`.
9. Ejecutar local/CI:
   - `node --test scripts/tests/shipping-guide-migration-cutover.test.mjs`
   - `node --test scripts/tests/shipping-guide-persistence-contract.test.mjs`
   - `node scripts/migration-ledger-check.mjs`
   - required migration contract dentro del gate canónico.
10. Verificar que el SHA integrado no introduce cambios ajenos a Shipping.

### Baseline read-only observado el 2026-10-01

- RPC resolvible con firma `erp_x_shipping_save_guide(uuid,jsonb)`: **PASS**.
- `SECURITY DEFINER`: **PASS**.
- search_path actual: `erp_supply, public, auth, pg_catalog`: **PASS**.
- grants actuales: `authenticated=EXECUTE`, `service_role=EXECUTE`, `postgres=EXECUTE`: **PASS**.
- cinco columnas carrier canónicas: **PASS**.
- versión `20261001205000` aplicada: **NO**.
- migración posterior en repositorio: **NO**; V11.43.1 es la última migración versionada del candidato.
- ledger histórico: 27/27 entradas database-only; no ampliar ese budget.

### Contrato de roles

La migración debe conservar:

- `erp_supply.can_access_module('shipping','update')` o `super_admin`;
- asignación de tarea al actor;
- excepción existente para `super_admin` / `jefe_logistica`;
- EXECUTE para `authenticated` y `service_role`;
- revocación a `public` y `anon`.

No añadir roles ni ampliar permisos durante el cutover.

### Alcance de datos

La **aplicación de la migración** reemplaza la función, ajusta grants y recarga el schema cache. No ejecuta un backfill ni UPDATE/DELETE masivo sobre entregas existentes.

Cuando la RPC es invocada por negocio, además de `erp_supply.deliveries`, conserva su trazabilidad existente en `delivery_milestones` y `order_events`. Eso es comportamiento Shipping ya existente, no un backfill del cutover.

## APLICACIÓN CONTROLADA

Solo en ventana aprobada:

1. Congelar temporalmente nuevos saves de Shipping o asegurar una ventana sin operaciones concurrentes.
2. Adjuntar a la evidencia: definición previa de función, grants, migration history y SHA.
3. Aplicar **exactamente** la migración V11.43.1 mediante el mecanismo oficial de migraciones.
4. No ejecutar SQL manual adicional que modifique tablas o datos.
5. No marcar manualmente la migración como aplicada.
6. Pasar inmediatamente al POSTFLIGHT.

Si el mecanismo de despliegue no ofrece atomicidad verificable para todo el archivo, tratar cualquier error como “estado indeterminado” y ejecutar primero las comprobaciones de recuperación; no reintentar a ciegas.

## POSTFLIGHT

### 1. Migration history

```sql
select version,name
from supabase_migrations.schema_migrations
where version='20261001205000'
   or name='shipping_carrier_persistence_v11_43_1';
```

Esperado: una única entrada correspondiente a V11.43.1.

### 2. RPC y hardening

Repetir `pg_get_functiondef`, firma, `prosecdef`, `proconfig` y ACL. Debe continuar:

- firma `erp_x_shipping_save_guide(uuid,jsonb)`;
- SECURITY DEFINER;
- search_path `erp_supply, public, auth, pg_catalog`;
- EXECUTE para authenticated/service_role;
- sin EXECUTE para anon/public.

### 3. Lectura exacta de entrega de prueba

Usar **solo un pedido de QA/control autorizado**, nunca un pedido productivo real sin aprobación:

```sql
select id,order_id,carrier,tracking_number,
       carrier_invoice_number,carrier_cost,carrier_cost_currency,
       carrier_cost_recorded_by,carrier_cost_recorded_at,
       metadata->>'guideFileId' as guide_file_id
from erp_supply.deliveries
where order_id = '<ORDER_ID_QA>'::uuid
order by created_at desc
limit 1;
```

Confirmar persistencia en columnas. Para los tres campos corregidos, no aceptar como éxito un valor presente solo en metadata:

- `carrier_invoice_number`;
- `carrier_cost`;
- `carrier_cost_currency`.

### 4. Semántica funcional

Con el mismo pedido QA y rol autorizado:

- INSERT lógico con carrier + tracking + invoice + cost + COP.
- UPDATE de solo `carrierCost`: tracking/carrier/invoice/currency/guideFileId se conservan.
- UPDATE de los cinco campos: los cinco cambian.
- payload con moneda distinta de COP: rechazo esperado.
- payload con campo requerido explícitamente vacío: rechazo esperado.
- payload que omite un campo carrier: conserva el valor previo.
- update no relacionado: `carrier_cost_recorded_by/at` no se borran.
- backend rejection debe mostrarse como error; no falso success.
- verificar exactamente una operación de save desde el frontend/harness.

### 5. Ledger

Volver a ejecutar `node scripts/migration-ledger-check.mjs`. La deuda histórica debe seguir en 27; la migración nueva no debe convertirse en “database-only debt”.

## ROLLBACK / RECOVERY

### Caso 1 — fallo ANTES de aplicar

No tocar remoto. Corregir source/CI, generar nuevo SHA y repetir PREFLIGHT.

### Caso 2 — fallo DURANTE aplicación

No reintentar a ciegas.

1. Consultar `supabase_migrations.schema_migrations`.
2. Consultar `pg_get_functiondef` y ACL reales.
3. Comparar con la evidencia previa.
4. Clasificar si la función quedó previa, nueva o en estado no verificable.
5. Si no puede determinarse con seguridad, **BLOCKED** hasta revisión por operador DB autorizado.

No borrar filas del historial de migraciones para “hacer que pase”.

### Caso 3 — función reemplazada pero smoke falla

Preferencia: **restaurar la definición previa de función** capturada en PREFLIGHT, con sus grants originales, o desplegar un forward-fix aprobado.

- No borrar columnas.
- No borrar datos.
- No ejecutar una “down migration” destructiva.
- Si V11.43.1 ya aparece aplicada en migration history, no falsear ese historial; el arreglo posterior debe ser un forward-fix versionado.

### Caso 4 — persistencia incorrecta detectada después

1. Suspender nuevos saves Shipping si operacionalmente es posible.
2. Capturar timeframe, order IDs, delivery IDs, milestones y order_events afectados.
3. Guardar evidencia de valores actuales y valores esperados.
4. Corregir la función primero para detener nuevas escrituras incorrectas.
5. Preparar corrección de datos **dirigida por IDs/evidencia**, revisada antes de ejecutar.
6. Nunca ejecutar UPDATE masivo sin WHERE exacto.

### Caso 5 — restaurar definición previa

Usar exclusivamente el `pg_get_functiondef` guardado antes del cutover como fuente de restore. Después restaurar/revalidar ACL y schema cache.

No asumir que una migración antigua del repositorio reproduce exactamente el estado remoto previo.

### Caso 6 — datos ya escritos incorrectamente

Preferir forward-fix:

- identificar solo filas afectadas;
- corregir columnas canónicas;
- preservar `metadata`, milestones y eventos;
- registrar quién, cuándo y por qué hizo la corrección;
- validar read-back después de cada lote.

**NO borrar columnas ni datos canónicos.**

## SMOKE DE NEGOCIO

Requiere un pedido QA/control autorizado en etapa Shipping, tarea tomada por el actor de prueba y permisos reales de Shipping.

1. Abrir el flujo Shipping.
2. Guardar guía con:
   - carrier;
   - trackingNumber;
   - carrierInvoiceNumber;
   - carrierCost > 0;
   - carrierCostCurrency = COP.
3. Confirmar éxito UI.
4. Ejecutar read-back SQL del delivery.
5. Confirmar equivalencia exacta UI → columnas.
6. Editar **solo un dato soportado por el contrato actual**, por ejemplo `carrierCost`, y volver a leer.
7. No probar vehicle data: el contrato Shipping actual no expone vehicle/plate.
8. Intentar un payload non-COP en entorno QA: debe rechazar.
9. Forzar un backend rejection controlado si existe un escenario QA seguro: la UI debe mostrar error y no éxito.
10. Confirmar exactly-once mediante evidencia de una sola operación válida/evento para la acción esperada.

Este smoke cambia datos del pedido QA. **No ejecutarlo sobre producción real desde esta preparación.**

## Requisitos remotos pendientes para el cutover real

- ventana aprobada;
- actor DB autorizado;
- pedido QA/control permitido en el entorno donde se haga el smoke;
- evidencia previa de función/grants/history;
- mecanismo oficial de aplicación de migraciones;
- autorización para suspender/restringir saves si se requiere rollback;
- plan de observación inmediata posterior al deploy.

Sin esos requisitos, el cutover remoto queda **BLOCKED**, aunque source/tests estén verdes.
