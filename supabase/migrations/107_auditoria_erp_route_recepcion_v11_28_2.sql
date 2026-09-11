-- V11.28.2 · La novedad de Recepción CRM se gestiona en Recepción de AuditoriaERP.
-- Mantiene la outbox, pg_net y pg_cron; solo cambia el destino funcional y
-- separa el identificador de Recepción del antiguo target_audit_id.

alter table erp_supply.auditoria_erp_outbox
  add column if not exists target_reception_id text;

create or replace function public.erp_x_auditoria_erp_claim_receipt(p_receipt_id uuid)
returns boolean
language plpgsql
security definer
set search_path = erp_supply, public, pg_catalog
as $$
begin
  update erp_supply.auditoria_erp_outbox
  set status='SYNCING',
      attempts=attempts+1,
      last_error=null,
      last_attempt_at=now(),
      updated_at=now()
  where receipt_id=p_receipt_id
    and attempts<10
    and (
      status in ('PENDING','FAILED')
      or (status='SYNCING' and coalesce(last_attempt_at,created_at)<now()-interval '5 minutes')
    );

  return found;
end;
$$;

revoke all on function public.erp_x_auditoria_erp_claim_receipt(uuid) from public, anon, authenticated;
grant execute on function public.erp_x_auditoria_erp_claim_receipt(uuid) to service_role;

create or replace function public.erp_x_auditoria_erp_mark_reception(
  p_event_key text,
  p_status text,
  p_error text default null,
  p_target_reception_id text default null
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

  update erp_supply.auditoria_erp_outbox
  set status=v_status,
      target_reception_id=case
        when p_target_reception_id is not null then p_target_reception_id
        else target_reception_id
      end,
      last_error=case
        when v_status='FAILED' then left(coalesce(p_error,'Error no especificado'),2000)
        else null
      end,
      last_attempt_at=case
        when v_status in ('SYNCING','FAILED','SYNCED') then now()
        else last_attempt_at
      end,
      synced_at=case
        when v_status='SYNCED' then now()
        when v_status in ('PENDING','FAILED') then null
        else synced_at
      end,
      updated_at=now()
  where event_key=p_event_key;

  return found;
end;
$$;

revoke all on function public.erp_x_auditoria_erp_mark_reception(text,text,text,text) from public, anon, authenticated;
grant execute on function public.erp_x_auditoria_erp_mark_reception(text,text,text,text) to service_role;

-- Transición de registros que fueron sincronizados al módulo equivocado.
-- Al regenerar delivery_token, el trigger pg_net los reenvía al bridge ya corregido.
update erp_supply.auditoria_erp_outbox
set status='PENDING',
    target_audit_id=null,
    target_reception_id=null,
    synced_at=null,
    last_error=null,
    delivery_token=gen_random_uuid(),
    updated_at=now()
where status='SYNCED'
  and target_audit_id is not null
  and attempts<10;
