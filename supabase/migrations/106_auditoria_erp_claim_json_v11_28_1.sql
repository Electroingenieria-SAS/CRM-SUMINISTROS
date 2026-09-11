-- V11.28.1 · Claim server-to-server con respuesta JSON estable para PostgREST.

create or replace function public.erp_x_auditoria_erp_claim_webhook_v2(
  p_event_key text,
  p_delivery_token uuid
)
returns jsonb
language plpgsql
security definer
set search_path = erp_supply, public, pg_catalog
as $$
declare
  v_receipt_id uuid;
begin
  update erp_supply.auditoria_erp_outbox
  set status='SYNCING',
      attempts=attempts+1,
      last_error=null,
      last_attempt_at=now(),
      updated_at=now()
  where event_key=p_event_key
    and delivery_token=p_delivery_token
    and attempts<10
    and (
      status in ('PENDING','FAILED')
      or (status='SYNCING' and coalesce(last_attempt_at,created_at)<now()-interval '5 minutes')
    )
  returning receipt_id into v_receipt_id;

  return jsonb_build_object(
    'claimed',v_receipt_id is not null,
    'receiptId',v_receipt_id
  );
end;
$$;

revoke all on function public.erp_x_auditoria_erp_claim_webhook_v2(text,uuid) from public, anon, authenticated;
grant execute on function public.erp_x_auditoria_erp_claim_webhook_v2(text,uuid) to service_role;

notify pgrst, 'reload schema';
