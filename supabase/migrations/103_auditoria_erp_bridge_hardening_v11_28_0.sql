-- V11.28.0 · Hardening del puente CRM Suministros -> AuditoriaERP
-- Autoriza cada recepción con el contexto del usuario, reclama cada evento una sola vez
-- y hace reintentables los estados SYNCING abandonados.

create or replace function public.erp_x_auditoria_erp_authorize(p_receipt_id uuid)
returns boolean
language plpgsql
security definer
stable
set search_path = erp_supply, public, auth, pg_catalog
as $$
declare
  v_org uuid:=erp_supply.current_org_id();
begin
  perform erp_supply.require_profile();

  if not (
    erp_supply.can_access_module('receiving','read')
    or erp_supply.can_access_module('receiving','create')
    or erp_supply.can_access_module('receiving','update')
    or erp_supply.has_role('super_admin')
  ) then
    return false;
  end if;

  return exists(
    select 1
    from erp_supply.warehouse_receipts wr
    where wr.id=p_receipt_id
      and wr.organization_id=v_org
  );
end;
$$;

revoke all on function public.erp_x_auditoria_erp_authorize(uuid) from public, anon;
grant execute on function public.erp_x_auditoria_erp_authorize(uuid) to authenticated, service_role;

create or replace function public.erp_x_auditoria_erp_pending(p_limit integer default 20)
returns jsonb
language plpgsql
security definer
stable
set search_path = erp_supply, public, auth, pg_catalog
as $$
declare
  v_org uuid:=erp_supply.current_org_id();
  v_result jsonb;
begin
  perform erp_supply.require_profile();
  if not (
    erp_supply.can_access_module('receiving','read')
    or erp_supply.can_access_module('receiving','create')
    or erp_supply.can_access_module('receiving','update')
    or erp_supply.has_role('super_admin')
  ) then
    raise exception 'No autorizado para consultar la cola de AuditoriaERP' using errcode='42501';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'eventKey',q.event_key,
    'receiptId',q.receipt_id,
    'status',q.status,
    'attempts',q.attempts
  ) order by q.created_at),'[]'::jsonb)
  into v_result
  from (
    select event_key,receipt_id,status,attempts,created_at
    from erp_supply.auditoria_erp_outbox
    where organization_id=v_org
      and (
        status in ('PENDING','FAILED')
        or (status='SYNCING' and coalesce(last_attempt_at,created_at)<now()-interval '5 minutes')
      )
      and attempts < 10
    order by created_at
    limit greatest(1,least(coalesce(p_limit,20),50))
  ) q;

  return v_result;
end;
$$;

revoke all on function public.erp_x_auditoria_erp_pending(integer) from public, anon;
grant execute on function public.erp_x_auditoria_erp_pending(integer) to authenticated, service_role;

create or replace function public.erp_x_auditoria_erp_mark(
  p_event_key text,
  p_status text,
  p_error text default null,
  p_target_audit_id text default null
)
returns boolean
language plpgsql
security definer
set search_path = erp_supply, public, pg_catalog
as $$
declare
  v_status text:=upper(coalesce(p_status,''));
begin
  if v_status not in ('PENDING','SYNCING','SYNCED','FAILED') then
    raise exception 'Estado de integración inválido';
  end if;

  if v_status='SYNCING' then
    update erp_supply.auditoria_erp_outbox
    set status='SYNCING',
        attempts=attempts+1,
        last_error=null,
        last_attempt_at=now(),
        updated_at=now()
    where event_key=p_event_key
      and attempts<10
      and (
        status in ('PENDING','FAILED')
        or (status='SYNCING' and coalesce(last_attempt_at,created_at)<now()-interval '5 minutes')
      );
    return found;
  end if;

  update erp_supply.auditoria_erp_outbox
  set status=v_status,
      target_audit_id=coalesce(p_target_audit_id,target_audit_id),
      last_error=case when v_status='FAILED' then left(coalesce(p_error,'Error no especificado'),2000) else null end,
      synced_at=case when v_status='SYNCED' then now() else synced_at end,
      updated_at=now()
  where event_key=p_event_key;

  return found;
end;
$$;

revoke all on function public.erp_x_auditoria_erp_mark(text,text,text,text) from public, anon, authenticated;
grant execute on function public.erp_x_auditoria_erp_mark(text,text,text,text) to service_role;
