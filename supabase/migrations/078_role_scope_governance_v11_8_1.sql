-- V11.8.1 · Gobierno de alcance por rol
-- Documenta la corrección aplicada en producción como role_scope_governance_v1181.
-- Auditoría queda en solo lectura; Coordinación aprueba su ámbito; Javier se formaliza como Líder Logístico.

-- 1) AUDITORÍA: observación total, sin capacidad de alterar procesos.
update erp_supply.role_module_permissions
set can_read = true,
    can_create = false,
    can_update = false,
    can_approve = false,
    can_admin = false
where role_code = 'auditoria';

update erp_supply.step_roles
set can_view = true,
    can_claim = false,
    can_assign = false,
    can_start = false,
    can_complete = false,
    can_block = false,
    can_override = false
where role_code = 'auditoria';

-- 2) COORDINACIÓN LOGÍSTICA: operación y aprobación dentro de su ámbito.
insert into erp_supply.role_module_permissions
  (role_code,module_code,can_read,can_create,can_update,can_approve,can_admin)
values
  ('coordinador_logistico','dashboard',true,false,false,false,false),
  ('coordinador_logistico','approvals',true,true,true,true,false),
  ('coordinador_logistico','orders',true,false,true,true,false),
  ('coordinador_logistico','picking',true,false,true,true,false),
  ('coordinador_logistico','receiving',true,true,true,true,false),
  ('coordinador_logistico','billing',true,true,true,true,false),
  ('coordinador_logistico','shipping',true,true,true,true,false),
  ('coordinador_logistico','workforce',true,true,true,true,false)
on conflict (role_code,module_code) do update
set can_read=excluded.can_read,
    can_create=excluded.can_create,
    can_update=excluded.can_update,
    can_approve=excluded.can_approve,
    can_admin=excluded.can_admin;

-- 3) LÍDER LOGÍSTICO: rol formal para la operación nacional.
update erp_supply.roles set active=true where code='lider_logistica';

insert into erp_supply.role_module_permissions
  (role_code,module_code,can_read,can_create,can_update,can_approve,can_admin)
values
  ('lider_logistica','dashboard',true,false,false,false,false),
  ('lider_logistica','approvals',true,true,true,true,false),
  ('lider_logistica','orders',true,false,true,true,false),
  ('lider_logistica','billing',true,true,true,true,false),
  ('lider_logistica','shipping',true,true,true,true,false),
  ('lider_logistica','workforce',true,true,true,true,false)
on conflict (role_code,module_code) do update
set can_read=excluded.can_read,
    can_create=excluded.can_create,
    can_update=excluded.can_update,
    can_approve=excluded.can_approve,
    can_admin=excluded.can_admin;

insert into erp_supply.step_roles
  (step_code,role_code,can_view,can_claim,can_assign,can_start,can_complete,can_block,can_override)
values
  ('FACTURACION','lider_logistica',true,true,false,true,true,true,false),
  ('NATIONAL_DISPATCH','lider_logistica',true,true,false,true,true,true,false),
  ('CLOSURE','lider_logistica',true,true,false,true,true,true,false)
on conflict (step_code,role_code) do update
set can_view=excluded.can_view,
    can_claim=excluded.can_claim,
    can_assign=excluded.can_assign,
    can_start=excluded.can_start,
    can_complete=excluded.can_complete,
    can_block=excluded.can_block,
    can_override=excluded.can_override;

-- Formalizar a Javier Laverde como Líder Logístico sin hardcodear UUIDs.
insert into erp_supply.profile_roles(profile_id,role_code,is_primary,granted_at,granted_by)
select p.id,'lider_logistica',true,now(),null
from erp_supply.profiles p
where lower(p.email)=lower('j.laverde@ei.com.co') and p.active
on conflict (profile_id,role_code) do update set is_primary=true;

delete from erp_supply.profile_roles pr
using erp_supply.profiles p
where pr.profile_id=p.id
  and lower(p.email)=lower('j.laverde@ei.com.co')
  and pr.role_code='despacho_nacional';

-- Reencaminar las reglas nacionales al rol formal manteniendo el responsable nominal.
update erp_supply.routing_rules
set assigned_role_code='lider_logistica'
where assigned_role_code='despacho_nacional';

-- Migrar únicamente el trabajo activo; conservar la trazabilidad histórica ya completada.
update erp_supply.orders
set current_role_code='lider_logistica'
where current_role_code='despacho_nacional'
  and status not in ('CLOSED','CANCELLED');

update erp_supply.order_tasks
set assigned_role_code='lider_logistica'
where assigned_role_code='despacho_nacional'
  and status in ('QUEUED','ASSIGNED','IN_PROGRESS','WAITING','BLOCKED');

-- El rol temporal deja de utilizarse.
update erp_supply.roles set active=false where code='despacho_nacional';

-- 4) Alcance de aprobación por responsabilidad.
create or replace function erp_supply.can_approve_order_scope(p_order_id uuid)
returns boolean
language sql
stable
security definer
set search_path to 'erp_supply','public','auth','pg_catalog'
as $$
  select exists(
    select 1
    from erp_supply.orders o
    where o.id=p_order_id
      and o.organization_id=erp_supply.current_org_id()
      and (
        erp_supply.has_role('super_admin')
        or erp_supply.has_role('gerencia')
        or erp_supply.has_role('jefe_logistica')
        or (
          erp_supply.has_role('coordinador_logistico')
          and (
            o.current_step_code in ('RECEPCION_PEDIDO','ALISTAMIENTO','CLIENT_POINT','CLIENT_PICKUP','LOCAL_DISPATCH')
            or (o.current_step_code in ('FACTURACION','CLOSURE') and coalesce(o.delivery_route_code,'')<>'NATIONAL_DISPATCH')
          )
        )
        or (
          erp_supply.has_role('lider_logistica')
          and (
            o.current_step_code='NATIONAL_DISPATCH'
            or (o.current_step_code in ('FACTURACION','CLOSURE') and o.delivery_route_code='NATIONAL_DISPATCH')
          )
        )
      )
  );
$$;
