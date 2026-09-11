-- V11.28.0 · Puente desacoplado CRM Suministros -> AuditoriaERP
-- La recepción sigue siendo transaccionalmente independiente del sistema de auditoría.
-- Si la integración externa falla, la novedad permanece en una outbox para reintento.

create table if not exists erp_supply.auditoria_erp_outbox (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  event_key text not null unique,
  receipt_id uuid not null references erp_supply.warehouse_receipts(id) on delete cascade,
  status text not null default 'PENDING' check (status in ('PENDING','SYNCING','SYNCED','FAILED')),
  attempts integer not null default 0 check (attempts >= 0),
  target_audit_id text,
  last_error text,
  last_attempt_at timestamptz,
  synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_auditoria_erp_outbox_pending_v1128
  on erp_supply.auditoria_erp_outbox(status, created_at)
  where status in ('PENDING','FAILED');

create index if not exists idx_auditoria_erp_outbox_receipt_v1128
  on erp_supply.auditoria_erp_outbox(receipt_id);

alter table erp_supply.auditoria_erp_outbox enable row level security;
revoke all on table erp_supply.auditoria_erp_outbox from anon, authenticated;

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
      organization_id,event_key,receipt_id,status,updated_at
    ) values(
      new.organization_id,
      'CRM_WAREHOUSE_RECEIPT:' || new.id::text,
      new.id,
      'PENDING',
      now()
    )
    on conflict(event_key) do update set
      status='PENDING',
      last_error=null,
      updated_at=now();
  end if;
  return new;
end;
$$;

revoke all on function erp_supply.queue_auditoria_erp_receipt() from public, anon, authenticated;

drop trigger if exists tr_queue_auditoria_erp_receipt on erp_supply.warehouse_receipts;
create trigger tr_queue_auditoria_erp_receipt
after insert or update of status,novelty_type,novelty_severity,novelty_note,information_captured,verification_note
on erp_supply.warehouse_receipts
for each row execute function erp_supply.queue_auditoria_erp_receipt();

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
      and status in ('PENDING','FAILED')
      and attempts < 10
    order by created_at
    limit greatest(1,least(coalesce(p_limit,20),50))
  ) q;

  return v_result;
end;
$$;

revoke all on function public.erp_x_auditoria_erp_pending(integer) from public, anon;
grant execute on function public.erp_x_auditoria_erp_pending(integer) to authenticated, service_role;

create or replace function public.erp_x_auditoria_erp_payload(p_receipt_id uuid)
returns jsonb
language sql
security definer
stable
set search_path = erp_supply, public, pg_catalog
as $$
with receipt as (
  select wr.*,p.display_name as received_by_name,o.order_number as linked_pve_number
  from erp_supply.warehouse_receipts wr
  left join erp_supply.profiles p on p.id=wr.received_by
  left join erp_supply.orders o on o.id=wr.linked_pve_id
  where wr.id=p_receipt_id
), line_stats as (
  select l.receipt_id,
         count(*)::integer as line_count,
         coalesce(sum(l.received_quantity),0) as total_received,
         coalesce(sum(l.accepted_quantity),0) as total_accepted,
         coalesce(sum(l.rejected_quantity),0) as total_rejected,
         coalesce(jsonb_agg(jsonb_build_object(
           'reference',l.reference,
           'description',l.description,
           'received',l.received_quantity,
           'accepted',l.accepted_quantity,
           'rejected',l.rejected_quantity,
           'unit',l.unit,
           'location',l.location,
           'lot',l.lot_number,
           'qualityStatus',l.quality_status
         ) order by l.created_at),'[]'::jsonb) as lines
  from erp_supply.warehouse_receipt_lines l
  where l.receipt_id=p_receipt_id
  group by l.receipt_id
)
select case when r.id is null then null else jsonb_build_object(
  'eventKey','CRM_WAREHOUSE_RECEIPT:'||r.id::text,
  'source','CRM_SUMINISTROS',
  'receiptId',r.id,
  'receiptNumber',r.receipt_number,
  'receiptType',r.receipt_type,
  'status',r.status,
  'noveltyType',r.novelty_type,
  'noveltySeverity',r.novelty_severity,
  'noveltyNote',r.novelty_note,
  'informationCaptured',r.information_captured,
  'verificationNote',r.verification_note,
  'generalNote',r.metadata->>'generalNote',
  'purchaseOrderNumber',r.purchase_order_number,
  'supplierName',r.supplier_name,
  'supplierDocument',r.supplier_document,
  'invoiceNumber',r.invoice_number,
  'warehouseCode',r.warehouse_code,
  'defaultLocation',r.default_location,
  'linkedPveId',r.linked_pve_id,
  'linkedPveNumber',r.linked_pve_number,
  'receivedBy',coalesce(r.received_by_name,'Recepción CRM'),
  'receivedAt',r.received_at,
  'verifiedAt',r.verified_at,
  'lineCount',coalesce(s.line_count,0),
  'totalReceived',coalesce(s.total_received,0),
  'totalAccepted',coalesce(s.total_accepted,0),
  'totalRejected',coalesce(s.total_rejected,0),
  'lines',coalesce(s.lines,'[]'::jsonb)
) end
from receipt r
left join line_stats s on s.receipt_id=r.id;
$$;

revoke all on function public.erp_x_auditoria_erp_payload(uuid) from public, anon, authenticated;
grant execute on function public.erp_x_auditoria_erp_payload(uuid) to service_role;

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

  update erp_supply.auditoria_erp_outbox
  set status=v_status,
      attempts=case when v_status in ('SYNCING','FAILED','SYNCED') then attempts+1 else attempts end,
      target_audit_id=coalesce(p_target_audit_id,target_audit_id),
      last_error=case when v_status='FAILED' then left(coalesce(p_error,'Error no especificado'),2000) else null end,
      last_attempt_at=case when v_status in ('SYNCING','FAILED','SYNCED') then now() else last_attempt_at end,
      synced_at=case when v_status='SYNCED' then now() else synced_at end,
      updated_at=now()
  where event_key=p_event_key;

  return found;
end;
$$;

revoke all on function public.erp_x_auditoria_erp_mark(text,text,text,text) from public, anon, authenticated;
grant execute on function public.erp_x_auditoria_erp_mark(text,text,text,text) to service_role;

create or replace function public.erp_x_auditoria_erp_metrics(p_from date default null,p_to date default null)
returns jsonb
language sql
security definer
stable
set search_path = erp_supply, public, pg_catalog
as $$
with bounds as (
  select coalesce(p_from,current_date-29) as date_from,
         coalesce(p_to,current_date) as date_to
), receipts_scope as (
  select wr.*
  from erp_supply.warehouse_receipts wr,bounds b
  where wr.received_at >= b.date_from::timestamptz
    and wr.received_at < (b.date_to+1)::timestamptz
), line_totals as (
  select l.receipt_id,
         coalesce(sum(l.received_quantity),0) total_received,
         coalesce(sum(l.accepted_quantity),0) total_accepted,
         coalesce(sum(l.rejected_quantity),0) total_rejected
  from erp_supply.warehouse_receipt_lines l
  join receipts_scope r on r.id=l.receipt_id
  group by l.receipt_id
), by_type as (
  select coalesce(novelty_type,'SIN_NOVEDAD') label,count(*)::integer value
  from receipts_scope group by 1 order by 2 desc
), by_severity as (
  select coalesce(novelty_severity,'SIN_NOVEDAD') label,count(*)::integer value
  from receipts_scope group by 1 order by 2 desc
), daily as (
  select received_at::date as metric_date,
         count(*)::integer as receipts,
         count(*) filter(where novelty_type is not null or novelty_note is not null or status in('PARTIAL','NONCONFORMING'))::integer as novelties,
         coalesce(sum(lt.total_rejected),0) as rejected
  from receipts_scope r
  left join line_totals lt on lt.receipt_id=r.id
  group by received_at::date order by received_at::date
)
select jsonb_build_object(
  'range',jsonb_build_object('from',b.date_from,'to',b.date_to),
  'kpis',jsonb_build_object(
    'receipts',count(r.id),
    'novelties',count(r.id) filter(where r.novelty_type is not null or r.novelty_note is not null or r.status in('PARTIAL','NONCONFORMING')),
    'noveltyRate',case when count(r.id)=0 then 0 else round((100.0*count(r.id) filter(where r.novelty_type is not null or r.novelty_note is not null or r.status in('PARTIAL','NONCONFORMING'))/count(r.id))::numeric,2) end,
    'acceptedQuantity',coalesce(sum(lt.total_accepted),0),
    'rejectedQuantity',coalesce(sum(lt.total_rejected),0)
  ),
  'noveltyTypes',(select coalesce(jsonb_agg(jsonb_build_object('label',label,'value',value)),'[]'::jsonb) from by_type),
  'severities',(select coalesce(jsonb_agg(jsonb_build_object('label',label,'value',value)),'[]'::jsonb) from by_severity),
  'trend',(select coalesce(jsonb_agg(jsonb_build_object('date',metric_date,'receipts',receipts,'novelties',novelties,'rejected',rejected) order by metric_date),'[]'::jsonb) from daily),
  'generatedAt',now()
)
from bounds b
left join receipts_scope r on true
left join line_totals lt on lt.receipt_id=r.id
group by b.date_from,b.date_to;
$$;

revoke all on function public.erp_x_auditoria_erp_metrics(date,date) from public, anon, authenticated;
grant execute on function public.erp_x_auditoria_erp_metrics(date,date) to service_role;
