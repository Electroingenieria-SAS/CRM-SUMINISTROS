-- CRM SUMINISTROS V11.30.0
-- Auditoría integral 2026-09-14
-- Corrige el canario de Shipping (la dirección canónica se materializa al enviar a Cierre,
-- no al registrar la guía) y convierte controles críticos de integridad/seguridad en
-- health checks permanentes, sin modificar datos operativos.

create or replace function public.erp_x_health_check()
returns table(section text,check_name text,ok boolean,detail text)
language sql
stable security definer
set search_path to 'erp_supply','public','auth','pg_catalog'
as $function$
with defs as (
  select
    pg_get_functiondef(to_regprocedure('public.erp_x_register_drive_file(jsonb)')) drive_def,
    pg_get_functiondef(to_regprocedure('public.erp_x_execute_action(uuid,text,jsonb,integer,text)')) action_def,
    pg_get_functiondef(to_regprocedure('public.erp_x_shipping_send_to_closure(uuid,jsonb)')) shipping_closure_def
)
select * from (values
('01_BASE'::text,'Organización activa'::text,
  exists(select 1 from erp_supply.organizations where code='EI' and active),
  'Organización EI disponible'::text),
('01_BASE','Núcleo operativo instalado',
  to_regclass('erp_supply.orders') is not null
  and to_regclass('erp_supply.order_tasks') is not null
  and to_regclass('erp_supply.inventory_movements') is not null,
  'Pedidos, tareas e inventario disponibles'),
('02_SESION','Perfil de sesión vinculado',
  exists(select 1 from erp_supply.profiles p where p.auth_user_id=auth.uid() and p.active),
  'Perfil autenticado activo'),
('03_RESERVAS','Identidad Profile en reservas',
  position('auth.uid()' in pg_get_functiondef(to_regprocedure('erp_supply.refresh_material_reservation(uuid)')))=0
  and position('current_profile_id' in pg_get_functiondef(to_regprocedure('erp_supply.refresh_material_reservation(uuid)')))>0,
  'Las FK de reservas usan profiles.id'),
('03_ENRUTAMIENTO','Compra opcional realmente enrutable',
  erp_supply.initial_step('PVC','CREDIT',true,false,false)='COMPRAS'
  and erp_supply.next_step('CARTERA','PVC','CREDIT','CLIENT_POINT',false,true)='COMPRAS',
  'Requiere compra participa en el flujo'),
('04_OWNERSHIP','Guardas de propietario instaladas',
  to_regprocedure('erp_supply.active_task_owned_by_actor(uuid,text,uuid,boolean)') is not null
  and exists(select 1 from pg_trigger where tgname='trg_guard_invoice_task_owner_v1033' and not tgisinternal),
  'Las mutaciones sensibles validan responsable'),
('05_AUDITORIA','Auditoría protegida como solo lectura',
  exists(select 1 from pg_trigger where tgname='trg_guard_order_issue_write_v1033' and not tgisinternal)
  and exists(select 1 from pg_trigger where tgname='trg_guard_audit_order_comments_v1033' and not tgisinternal)
  and exists(select 1 from pg_trigger where tgname='trg_guard_audit_issue_update_v1033' and not tgisinternal),
  'Creación y resolución operativa están protegidas'),
('06_SHIPPING','Destino canónico de Ventas en Shipping',
  coalesce((select position('SALES_ORDER_ADDRESS' in shipping_closure_def)>0 from defs),false),
  'Despacho conserva el snapshot de Ventas al enviar el pedido a Cierre'),
('07_CORTE','Modelo productivo de Corte instalado',
  to_regprocedure('erp_supply.sync_cut_execution_state(uuid,uuid)') is not null
  and to_regprocedure('public.erp_x_cutting_finalize(uuid)') is not null,
  'Ejecución y cierre de Corte disponibles'),
('07_CORTE','Sin ejecuciones sintéticas activas',
  not exists(select 1 from erp_supply.cut_executions where group_key like concat('S','BX:%')),
  'No quedan ejecuciones de prueba en Corte'),
('07_CORTE','Evidencia de Corte autorizada por ejecución',
  (select position('CUTTING_EVIDENCE' in drive_def)>0
      and position('cut_execution_requirements' in drive_def)>0
      and position('authorizationVersion' in drive_def)>0 from defs),
  'El auxiliar de Corte puede registrar evidencia de su propia ejecución'),
('08_INVENTARIO','Inventario operativo vinculado a Siesa',
  not exists(select 1 from erp_supply.inventory_items where active and material_master_id is null),
  'No hay ítems activos fuera del maestro oficial'),
('08_INVENTARIO','Sin saldos negativos por lote',
  not exists(
    select 1 from erp_supply.inventory_lots
    where coalesce(quantity_available,0)<0
       or coalesce(quantity_reserved,0)<0
       or coalesce(quantity_blocked,0)<0
  ),
  'Disponible, reservado y bloqueado permanecen no negativos'),
('09_FLUJO','Sin tareas activas en pedidos finalizados',
  not exists(
    select 1
    from erp_supply.orders o
    join erp_supply.order_tasks t on t.order_id=o.id
    where o.status in('CLOSED','CANCELLED')
      and t.status in('QUEUED','ASSIGNED','IN_PROGRESS','WAITING','BLOCKED')
  ),
  'Estados finales y tareas activas son consistentes'),
('10_IDEMPOTENCIA','Reintento de acciones protegido',
  (select position('p_idempotency_key is not null and exists' in action_def)>0
      and position('return erp_supply.execute_action_internal' in action_def)>
          position('p_idempotency_key is not null and exists' in action_def) from defs),
  'Un reintento con la misma clave se resuelve antes del control de versión'),
('11_INTEGRACIONES','Trigger CRM → AuditoriaERP instalado',
  exists(
    select 1 from pg_trigger
    where tgname='tr_queue_auditoria_erp_receipt'
      and tgrelid='erp_supply.warehouse_receipts'::regclass
      and not tgisinternal and tgenabled<>'D'
  )
  and to_regprocedure('erp_supply.dispatch_auditoria_erp_pending()') is not null,
  'Recepciones no conformes cuentan con trigger y dispatcher server-to-server'),
('11_INTEGRACIONES','Cola CRM → AuditoriaERP saludable',
  not exists(
    select 1 from erp_supply.auditoria_erp_outbox
    where status='FAILED'
       or (status='PENDING' and created_at<now()-interval '5 minutes')
       or (status='SYNCING' and coalesce(last_attempt_at,updated_at,created_at)<now()-interval '10 minutes')
       or (status<>'SYNCED' and attempts>=10)
  ),
  'No hay eventos fallidos, pendientes vencidos, atascados ni agotados'),
('12_IDENTIDAD','Perfiles activos vinculados a Auth',
  not exists(
    select 1
    from erp_supply.profiles p
    left join auth.users u on u.id=p.auth_user_id
    where p.active and (p.auth_user_id is null or u.id is null)
  ),
  'Todo perfil operativo activo conserva usuario de autenticación válido'),
('13_SEGURIDAD','RLS habilitado en todo erp_supply',
  not exists(
    select 1
    from pg_class c
    join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='erp_supply' and c.relkind='r' and not c.relrowsecurity
  ),
  'Todas las tablas base del esquema operativo tienen RLS habilitado'),
('13_SEGURIDAD','RPC ERP sin ejecución anónima',
  not exists(
    select 1
    from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname like 'erp_x_%'
      and has_function_privilege('anon',p.oid,'EXECUTE')
  ),
  'Ningún RPC erp_x_* puede ejecutarse con rol anon'),
('13_SEGURIDAD','Triggers operativos habilitados',
  not exists(
    select 1
    from pg_trigger t
    join pg_class c on c.oid=t.tgrelid
    join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='erp_supply' and not t.tgisinternal and t.tgenabled='D'
  ),
  'No hay triggers de usuario deshabilitados en el esquema operativo')
) v(section,check_name,ok,detail)
order by section,check_name
$function$;

revoke all on function public.erp_x_health_check() from public,anon;
grant execute on function public.erp_x_health_check() to authenticated,service_role;
