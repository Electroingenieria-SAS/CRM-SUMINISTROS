-- CRM SUMINISTROS V11.30.0
-- Contrato observable CRM -> AuditoriaERP / módulo Recepción.
-- Solo agrega diagnóstico service_role; no modifica datos ni lógica operacional.

create or replace function public.erp_x_auditoria_erp_contract_check()
returns table(check_name text, ok boolean, detail text)
language sql
stable security definer
set search_path to 'erp_supply','public','pg_catalog'
as $function$
select * from (values
  ('Fuente de recepción completa'::text,
    to_regclass('erp_supply.warehouse_receipts') is not null
    and exists(select 1 from information_schema.columns where table_schema='erp_supply' and table_name='warehouse_receipts' and column_name='novelty_type')
    and exists(select 1 from information_schema.columns where table_schema='erp_supply' and table_name='warehouse_receipts' and column_name='novelty_note')
    and exists(select 1 from information_schema.columns where table_schema='erp_supply' and table_name='warehouse_receipts' and column_name='information_captured')
    and exists(select 1 from information_schema.columns where table_schema='erp_supply' and table_name='warehouse_receipts' and column_name='verification_note'),
    'La recepción conserva estado, tipo y escritura humana de la novedad.'::text),

  ('Outbox con destino Recepción',
    to_regclass('erp_supply.auditoria_erp_outbox') is not null
    and exists(select 1 from information_schema.columns where table_schema='erp_supply' and table_name='auditoria_erp_outbox' and column_name='target_reception_id')
    and exists(select 1 from information_schema.columns where table_schema='erp_supply' and table_name='auditoria_erp_outbox' and column_name='delivery_token')
    and exists(
      select 1
      from pg_index i
      join pg_class c on c.oid=i.indrelid
      join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='erp_supply' and c.relname='auditoria_erp_outbox' and i.indisunique
        and pg_get_indexdef(i.indexrelid) ilike '%event_key%'
    ),
    'La cola conserva idempotencia, token de entrega y target_reception_id.'),

  ('RPC privados de integración instalados',
    to_regprocedure('public.erp_x_auditoria_erp_payload(uuid)') is not null
    and to_regprocedure('public.erp_x_auditoria_erp_claim_webhook_v2(text,uuid)') is not null
    and to_regprocedure('public.erp_x_auditoria_erp_mark_reception(text,text,text,text)') is not null
    and to_regprocedure('public.erp_x_auditoria_erp_target_config()') is not null,
    'Payload, claim, marcado y configuración privada están disponibles.'),

  ('Trigger y dispatcher activos',
    exists(
      select 1 from pg_trigger
      where tgname='tr_queue_auditoria_erp_receipt'
        and tgrelid='erp_supply.warehouse_receipts'::regclass
        and not tgisinternal and tgenabled<>'D'
    )
    and to_regprocedure('erp_supply.dispatch_auditoria_erp_pending()') is not null,
    'La sincronización no depende exclusivamente del navegador.'),

  ('Privilegios server-only correctos',
    not has_function_privilege('anon','public.erp_x_auditoria_erp_payload(uuid)','EXECUTE')
    and not has_function_privilege('authenticated','public.erp_x_auditoria_erp_payload(uuid)','EXECUTE')
    and has_function_privilege('service_role','public.erp_x_auditoria_erp_payload(uuid)','EXECUTE')
    and not has_function_privilege('anon','public.erp_x_auditoria_erp_target_config()','EXECUTE')
    and not has_function_privilege('authenticated','public.erp_x_auditoria_erp_target_config()','EXECUTE')
    and has_function_privilege('service_role','public.erp_x_auditoria_erp_target_config()','EXECUTE'),
    'Payload detallado y secretos de destino permanecen service_role-only.'),

  ('Cola operativa saludable',
    not exists(
      select 1 from erp_supply.auditoria_erp_outbox
      where status='FAILED'
         or (status='PENDING' and created_at<now()-interval '5 minutes')
         or (status='SYNCING' and coalesce(last_attempt_at,updated_at,created_at)<now()-interval '10 minutes')
         or (status<>'SYNCED' and attempts>=10)
    ),
    'No hay eventos fallidos, vencidos, atascados ni agotados.')
) v(check_name,ok,detail)
order by check_name
$function$;

revoke all on function public.erp_x_auditoria_erp_contract_check() from public,anon,authenticated;
grant execute on function public.erp_x_auditoria_erp_contract_check() to service_role;
