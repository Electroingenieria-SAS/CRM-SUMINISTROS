-- V11.28.1 · Despacho server-to-server CRM Suministros -> AuditoriaERP
-- La outbox deja de depender del navegador: pg_net notifica la Edge Function
-- después del commit y pg_cron reintenta pendientes/fallidos cada minuto.

create extension if not exists pg_net with schema extensions;

alter table erp_supply.auditoria_erp_outbox
  add column if not exists delivery_token uuid default gen_random_uuid();

update erp_supply.auditoria_erp_outbox
set delivery_token=gen_random_uuid()
where delivery_token is null;

alter table erp_supply.auditoria_erp_outbox
  alter column delivery_token set default gen_random_uuid(),
  alter column delivery_token set not null;

create unique index if not exists uq_auditoria_erp_outbox_delivery_token_v11281
  on erp_supply.auditoria_erp_outbox(delivery_token);

create or replace function erp_supply.queue_auditoria_erp_receipt()
returns trigger
language plpgsql
security definer
set search_path = erp_supply, public, pg_catalog
as $$
begin
  if new.novelty_type is not null
     or new.novelty_note is not null
     or upper(coalesce(new.status,'')) in ('PARTIAL','NONCONFORMING') then
    insert into erp_supply.auditoria_erp_outbox(
      organization_id,event_key,receipt_id,status,delivery_token,updated_at
    ) values(
      new.organization_id,
      'CRM_WAREHOUSE_RECEIPT:' || new.id::text,
      new.id,
      'PENDING',
      gen_random_uuid(),
      now()
    )
    on conflict(event_key) do update set
      status='PENDING',
      delivery_token=gen_random_uuid(),
      last_error=null,
      updated_at=now();
  end if;
  return new;
end;
$$;

revoke all on function erp_supply.queue_auditoria_erp_receipt() from public, anon, authenticated;

create or replace function public.erp_x_auditoria_erp_claim_webhook(
  p_event_key text,
  p_delivery_token uuid
)
returns uuid
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

  return v_receipt_id;
end;
$$;

revoke all on function public.erp_x_auditoria_erp_claim_webhook(text,uuid) from public, anon, authenticated;
grant execute on function public.erp_x_auditoria_erp_claim_webhook(text,uuid) to service_role;

create or replace function erp_supply.dispatch_auditoria_erp_event()
returns trigger
language plpgsql
security definer
set search_path = erp_supply, public, pg_catalog
as $$
begin
  if new.status='PENDING' and new.attempts<10 and (
    tg_op='INSERT'
    or old.status is distinct from 'PENDING'
    or old.delivery_token is distinct from new.delivery_token
  ) then
    perform net.http_post(
      url:='https://hezjxcxxcjlpmyalftam.supabase.co/functions/v1/erp-auditoria-bridge',
      body:=jsonb_build_object(
        'source','database',
        'eventKey',new.event_key,
        'receiptId',new.receipt_id,
        'deliveryToken',new.delivery_token
      ),
      headers:='{"Content-Type":"application/json"}'::jsonb,
      timeout_milliseconds:=5000
    );
  end if;
  return new;
end;
$$;

revoke all on function erp_supply.dispatch_auditoria_erp_event() from public, anon, authenticated;

drop trigger if exists tr_dispatch_auditoria_erp_event on erp_supply.auditoria_erp_outbox;
create trigger tr_dispatch_auditoria_erp_event
after insert or update of status,delivery_token
on erp_supply.auditoria_erp_outbox
for each row execute function erp_supply.dispatch_auditoria_erp_event();

create or replace function erp_supply.dispatch_auditoria_erp_pending()
returns integer
language plpgsql
security definer
set search_path = erp_supply, public, pg_catalog
as $$
declare
  v_row record;
  v_count integer:=0;
begin
  for v_row in
    select event_key,receipt_id,delivery_token
    from erp_supply.auditoria_erp_outbox
    where attempts<10
      and (
        status in ('PENDING','FAILED')
        or (status='SYNCING' and coalesce(last_attempt_at,created_at)<now()-interval '5 minutes')
      )
    order by created_at
    limit 25
  loop
    perform net.http_post(
      url:='https://hezjxcxxcjlpmyalftam.supabase.co/functions/v1/erp-auditoria-bridge',
      body:=jsonb_build_object(
        'source','database',
        'eventKey',v_row.event_key,
        'receiptId',v_row.receipt_id,
        'deliveryToken',v_row.delivery_token
      ),
      headers:='{"Content-Type":"application/json"}'::jsonb,
      timeout_milliseconds:=5000
    );
    v_count:=v_count+1;
  end loop;
  return v_count;
end;
$$;

revoke all on function erp_supply.dispatch_auditoria_erp_pending() from public, anon, authenticated;
grant execute on function erp_supply.dispatch_auditoria_erp_pending() to service_role;

do $$
declare
  v_job_id bigint;
begin
  select jobid into v_job_id
  from cron.job
  where jobname='auditoria-erp-outbox-dispatch-v11281'
  limit 1;

  if v_job_id is not null then
    perform cron.unschedule(v_job_id);
  end if;

  perform cron.schedule(
    'auditoria-erp-outbox-dispatch-v11281',
    '* * * * *',
    'select erp_supply.dispatch_auditoria_erp_pending();'
  );
end;
$$;

-- Dispara inmediatamente cualquier evento que ya estuviera pendiente antes de V11.28.1.
update erp_supply.auditoria_erp_outbox
set delivery_token=gen_random_uuid(),
    updated_at=now()
where status in ('PENDING','FAILED')
  and attempts<10;
