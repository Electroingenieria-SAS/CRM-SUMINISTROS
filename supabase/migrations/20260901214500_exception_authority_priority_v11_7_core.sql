-- CRM Suministros V11.7.0
-- Autoridad del Centro de Excepciones + prioridades Baja/Media/Urgente.

create or replace function erp_supply.can_manage_exception_center()
returns boolean
language sql
stable
security definer
set search_path='erp_supply','public','auth','pg_catalog'
as $$
  select erp_supply.has_role('super_admin')
      or erp_supply.has_role('gerencia')
      or erp_supply.has_role('jefe_logistica')
      or erp_supply.has_role('lider_logistica');
$$;

revoke all on function erp_supply.can_manage_exception_center() from public, anon;
grant execute on function erp_supply.can_manage_exception_center() to authenticated, service_role;

insert into erp_supply.role_module_permissions(role_code,module_code,can_read,can_create,can_update,can_approve,can_admin)
values
 ('gerencia','approvals',true,true,true,true,true),
 ('jefe_logistica','approvals',true,true,true,true,true),
 ('lider_logistica','approvals',true,true,true,true,true),
 ('super_admin','approvals',true,true,true,true,true)
on conflict(role_code,module_code) do update set
 can_read=excluded.can_read,
 can_create=excluded.can_create,
 can_update=excluded.can_update,
 can_approve=excluded.can_approve,
 can_admin=excluded.can_admin;

create or replace function erp_supply.normalize_order_priority(p_value text)
returns text
language sql
immutable
set search_path='pg_catalog'
as $$
  select case upper(trim(coalesce(p_value,'')))
    when 'LOW' then 'LOW' when 'BAJA' then 'LOW' when 'BAJO' then 'LOW'
    when 'MEDIUM' then 'MEDIUM' when 'MEDIA' then 'MEDIUM' when 'MEDIO' then 'MEDIUM' when 'NORMAL' then 'MEDIUM'
    when 'URGENT' then 'URGENT' when 'URGENTE' then 'URGENT'
    when 'HIGH' then 'URGENT' when 'ALTA' then 'URGENT' when 'ALTO' then 'URGENT'
    when 'CRITICAL' then 'URGENT' when 'CRITICA' then 'URGENT' when 'CRÍTICA' then 'URGENT'
    when 'CRITICO' then 'URGENT' when 'CRÍTICO' then 'URGENT'
    when 'MAXIMA' then 'URGENT' when 'MÁXIMA' then 'URGENT' when 'MAXIMO' then 'URGENT' when 'MÁXIMO' then 'URGENT'
    else null
  end;
$$;

update erp_supply.orders
set priority=coalesce(erp_supply.normalize_order_priority(priority),'MEDIUM')
where priority is distinct from coalesce(erp_supply.normalize_order_priority(priority),'MEDIUM');

alter table erp_supply.orders drop constraint if exists orders_priority_check;
alter table erp_supply.orders add constraint orders_priority_check check(priority in('LOW','MEDIUM','URGENT'));

create or replace function erp_supply.orders_priority_v117_before()
returns trigger
language plpgsql
set search_path='erp_supply','public','auth','pg_catalog'
as $$
declare v_priority text; v_sales boolean:=false;
begin
  v_priority:=erp_supply.normalize_order_priority(new.priority);
  if v_priority is null then raise exception 'Prioridad inválida. Use Baja, Media o Urgente.'; end if;
  new.priority:=v_priority;
  if tg_op='INSERT' and v_priority='URGENT' then
    select exists(select 1 from erp_supply.profile_roles pr where pr.profile_id=new.seller_profile_id and pr.role_code='ventas') into v_sales;
    if v_sales then
      new.priority:='MEDIUM';
      new.metadata:=coalesce(new.metadata,'{}'::jsonb)||jsonb_build_object('urgencyRequest',jsonb_build_object(
        'requestedPriority','URGENT','status','PENDING','requestedAt',now(),'source','SALES_ORDER_CREATE','version','11.7.0'));
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_orders_priority_v117_before on erp_supply.orders;
create trigger trg_orders_priority_v117_before before insert or update of priority on erp_supply.orders
for each row execute function erp_supply.orders_priority_v117_before();

create or replace function erp_supply.orders_urgency_request_v117_after()
returns trigger
language plpgsql
security definer
set search_path='erp_supply','public','auth','pg_catalog'
as $$
declare v_request_id uuid; v_actor_role text;
begin
  if coalesce(new.metadata#>>'{urgencyRequest,status}','')<>'PENDING' then return new; end if;
  if exists(select 1 from erp_supply.approval_requests a where a.order_id=new.id and a.request_type='PRIORITY' and a.status='PENDING') then return new; end if;
  select pr.role_code into v_actor_role from erp_supply.profile_roles pr where pr.profile_id=new.seller_profile_id order by pr.is_primary desc,pr.granted_at limit 1;
  insert into erp_supply.approval_requests(organization_id,order_id,request_type,status,requested_by,assigned_role_code,reason,request_payload)
  values(new.organization_id,new.id,'PRIORITY','PENDING',new.seller_profile_id,'jefe_logistica',
    'El asesor marcó el pedido como Urgente al registrarlo.',
    jsonb_build_object('priority','URGENT','requestedPriority','URGENT','exceptionCode','URGENCIA_PEDIDO','requestedByRole',v_actor_role,
      'eligibleRoles',jsonb_build_array('lider_logistica','jefe_logistica','gerencia','super_admin'),'version','11.7.0'))
  returning id into v_request_id;
  update erp_supply.orders set metadata=jsonb_set(coalesce(metadata,'{}'::jsonb),'{urgencyRequest}',
    coalesce(metadata->'urgencyRequest','{}'::jsonb)||jsonb_build_object('requestId',v_request_id),true) where id=new.id;
  insert into erp_supply.order_events(organization_id,order_id,event_type,action_code,to_step_code,to_status,actor_profile_id,actor_role_code,payload)
  values(new.organization_id,new.id,'APPROVAL_REQUESTED','REQUEST_URGENT_PRIORITY',new.current_step_code,new.status,new.seller_profile_id,v_actor_role,
    jsonb_build_object('requestId',v_request_id,'requestType','PRIORITY','requestedPriority','URGENT','version','11.7.0'));
  return new;
end;
$$;

drop trigger if exists trg_orders_urgency_request_v117_after on erp_supply.orders;
create trigger trg_orders_urgency_request_v117_after after insert on erp_supply.orders
for each row execute function erp_supply.orders_urgency_request_v117_after();
