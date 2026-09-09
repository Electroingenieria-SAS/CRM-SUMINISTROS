-- V11.23.0 · Reconstrucción canónica de Inventario
-- Principio: el auxiliar cuenta; el sistema compara; control decide.
-- Un reporte de conteo no altera existencias hasta que un perfil autorizado lo aprueba.

create table if not exists erp_supply.inventory_count_reports (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references erp_supply.organizations(id) on delete cascade,
  inventory_item_id uuid not null references erp_supply.inventory_items(id) on delete restrict,
  material_master_id uuid not null references erp_supply.material_master(id) on delete restrict,
  report_code text not null unique,
  count_mode text not null check (count_mode in ('CYCLIC','EXPRESS','METERAGE')),
  plan_type text not null default 'PLANNED' check (plan_type in ('PLANNED','EXPRESS','RECOUNT')),
  scheduled_date date not null,
  status text not null default 'SUBMITTED' check (status in ('SUBMITTED','APPLIED','RECOUNT_REQUIRED','REJECTED','CANCELLED')),
  submitted_by uuid not null references erp_supply.profiles(id) on delete restrict,
  submitted_at timestamptz not null default now(),
  observations jsonb not null default '[]'::jsonb,
  system_snapshot jsonb not null default '[]'::jsonb,
  comparison jsonb not null default '{}'::jsonb,
  has_difference boolean not null default false,
  exact_lots integer not null default 0,
  difference_lots integer not null default 0,
  absolute_difference numeric not null default 0,
  estimated_value_impact numeric not null default 0,
  reviewed_by uuid references erp_supply.profiles(id) on delete restrict,
  reviewed_at timestamptz,
  review_decision text check (review_decision is null or review_decision in ('APPROVE','RECOUNT','REJECT')),
  review_note text,
  applied_at timestamptz,
  recount_of uuid references erp_supply.inventory_count_reports(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (jsonb_typeof(observations)='array'),
  check (jsonb_typeof(system_snapshot)='array'),
  check (jsonb_typeof(comparison)='object')
);

alter table erp_supply.inventory_count_reports enable row level security;
revoke all on table erp_supply.inventory_count_reports from public, anon, authenticated;
create index if not exists idx_inventory_count_reports_org_status_date on erp_supply.inventory_count_reports(organization_id,status,scheduled_date desc,submitted_at desc);
create index if not exists idx_inventory_count_reports_org_item on erp_supply.inventory_count_reports(organization_id,inventory_item_id,submitted_at desc);
create index if not exists idx_inventory_count_reports_submitter on erp_supply.inventory_count_reports(organization_id,submitted_by,submitted_at desc);
create unique index if not exists uq_inventory_count_reports_pending_item on erp_supply.inventory_count_reports(organization_id,inventory_item_id) where status='SUBMITTED';

insert into erp_supply.role_module_permissions(role_code,module_code,can_read,can_create,can_update,can_approve,can_admin)
values
  ('aux_logistica','inventory',true,true,false,false,false),
  ('jefe_logistica','inventory',true,false,false,true,false),
  ('lider_logistica','inventory',true,false,false,true,false),
  ('coordinador_logistico','inventory',true,false,false,true,false),
  ('auditoria','inventory',true,false,false,false,false)
on conflict (role_code,module_code) do update set
  can_read=excluded.can_read,can_create=excluded.can_create,can_update=excluded.can_update,can_approve=excluded.can_approve,can_admin=excluded.can_admin;

create or replace function erp_supply.inventory_count_is_controller()
returns boolean language sql stable security invoker set search_path=''
as $$
  select erp_supply.has_role('super_admin') or erp_supply.has_role('gerencia') or erp_supply.has_role('jefe_logistica') or erp_supply.has_role('lider_logistica') or erp_supply.has_role('coordinador_logistico') or erp_supply.has_role('auditoria');
$$;

create or replace function erp_supply.inventory_count_can_approve()
returns boolean language sql stable security invoker set search_path=''
as $$
  select erp_supply.can_access_module('inventory','approve') and (erp_supply.has_role('super_admin') or erp_supply.has_role('gerencia') or erp_supply.has_role('jefe_logistica') or erp_supply.has_role('lider_logistica') or erp_supply.has_role('coordinador_logistico'));
$$;

create or replace function erp_supply.inventory_count_is_blind_operator()
returns boolean language sql stable security invoker set search_path=''
as $$ select erp_supply.has_role('aux_logistica') and not erp_supply.inventory_count_is_controller(); $$;

revoke all on function erp_supply.inventory_count_is_controller() from public,anon;
revoke all on function erp_supply.inventory_count_can_approve() from public,anon;
revoke all on function erp_supply.inventory_count_is_blind_operator() from public,anon;
grant execute on function erp_supply.inventory_count_is_controller() to authenticated;
grant execute on function erp_supply.inventory_count_can_approve() to authenticated;
grant execute on function erp_supply.inventory_count_is_blind_operator() to authenticated;

create or replace function public.erp_x_inventory_count_search(p_query text default null, p_limit integer default 20)
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare v_org uuid:=erp_supply.current_org_id();v_q text:=erp_supply.material_norm(p_query);v_limit integer:=least(greatest(coalesce(p_limit,20),1),50);
begin
  perform erp_supply.require_profile();
  if not erp_supply.can_access_module('inventory','read') and not erp_supply.has_role('super_admin') then raise exception 'No autorizado para consultar referencias de conteo' using errcode='42501'; end if;
  if v_q='' then return '[]'::jsonb; end if;
  return (select coalesce(jsonb_agg(to_jsonb(x) order by x.reference),'[]'::jsonb) from (
    select i.id "itemId",m.reference,m.exact_name description,m.unit,i.item_type "itemType",count(l.id)::integer "lotCount",
      coalesce(array_remove(array_agg(distinct nullif(trim(l.warehouse_code),'')),null),'{}'::text[]) warehouses,
      exists(select 1 from erp_supply.inventory_count_reports r where r.organization_id=v_org and r.inventory_item_id=i.id and r.status='SUBMITTED') "pendingReview"
    from erp_supply.inventory_items i join erp_supply.material_master m on m.id=i.material_master_id and m.active left join erp_supply.inventory_lots l on l.inventory_item_id=i.id and l.source_active
    where i.organization_id=v_org and i.active and erp_supply.material_norm(concat_ws(' ',m.reference,m.exact_name,i.sku,i.barcode,m.attributes::text)) like '%'||v_q||'%'
    group by i.id,m.id order by case when erp_supply.material_norm(m.reference)=v_q then 0 else 1 end,m.reference limit v_limit
  )x);
end;$$;
revoke all on function public.erp_x_inventory_count_search(text,integer) from public,anon;
grant execute on function public.erp_x_inventory_count_search(text,integer) to authenticated;

create or replace function public.erp_x_inventory_count_resolve(p_code text)
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare v_org uuid:=erp_supply.current_org_id();v_raw text:=btrim(coalesce(p_code,''));v_code text;v_item_id uuid;
begin
  perform erp_supply.require_profile();
  if not erp_supply.can_access_module('inventory','read') and not erp_supply.has_role('super_admin') then raise exception 'No autorizado para identificar inventario de conteo' using errcode='42501'; end if;
  if v_raw='' then raise exception 'Código vacío'; end if;
  v_code:=v_raw;
  if v_raw ~* '[?&]scan=' then v_code:=regexp_replace(v_raw,'^.*[?&]scan=([^&#]+).*$','\1','i'); end if;
  v_code:=replace(replace(replace(v_code,'%2D','-'),'%2d','-'),'%20',' ');v_code:=btrim(v_code);
  select i.id into v_item_id from erp_supply.inventory_lots l join erp_supply.inventory_items i on i.id=l.inventory_item_id and i.organization_id=v_org and i.active where l.source_active and (upper(l.scan_code)=upper(v_code) or l.id::text=v_code) limit 1;
  if v_item_id is null then
    select i.id into v_item_id from erp_supply.inventory_items i join erp_supply.material_master m on m.id=i.material_master_id and m.active where i.organization_id=v_org and i.active and (upper(m.reference)=upper(v_code) or upper(coalesce(i.sku,''))=upper(v_code) or upper(coalesce(i.barcode,''))=upper(v_code)) order by m.reference limit 1;
  end if;
  if v_item_id is null then raise exception 'Referencia o código de inventario no encontrado'; end if;
  return (select jsonb_build_object(
    'item',jsonb_build_object('itemId',i.id,'materialMasterId',m.id,'reference',m.reference,'description',m.exact_name,'unit',m.unit,'itemType',i.item_type),
    'lots',coalesce((select jsonb_agg(jsonb_build_object('lotId',l.id,'lotNumber',l.lot_number,'serialNumber',l.serial_number,'warehouseCode',l.warehouse_code,'location',l.location,'locationName',l.source_location_name,'variantLabel',mv.variant_label,'scanCode',l.scan_code) order by l.warehouse_code,l.location,l.lot_number,l.id) from erp_supply.inventory_lots l left join erp_supply.material_variants mv on mv.id=l.material_variant_id where l.inventory_item_id=i.id and l.source_active),'[]'::jsonb),
    'pendingReview',exists(select 1 from erp_supply.inventory_count_reports r where r.organization_id=v_org and r.inventory_item_id=i.id and r.status='SUBMITTED'))
    from erp_supply.inventory_items i join erp_supply.material_master m on m.id=i.material_master_id where i.id=v_item_id);
end;$$;
revoke all on function public.erp_x_inventory_count_resolve(text) from public,anon;
grant execute on function public.erp_x_inventory_count_resolve(text) to authenticated;

create or replace function public.erp_x_inventory_count_submit(p_payload jsonb)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare
  v_actor uuid:=erp_supply.require_profile();v_org uuid:=erp_supply.current_org_id();v_tz text:='America/Bogota';v_now timestamptz:=now();v_day date;
  v_item erp_supply.inventory_items%rowtype;v_master erp_supply.material_master%rowtype;v_counts jsonb:=coalesce(p_payload->'counts','[]'::jsonb);
  v_mode text:=upper(trim(coalesce(p_payload->>'mode','CYCLIC')));v_plan_type text:=upper(trim(coalesce(p_payload->>'planType','PLANNED')));v_note text:=left(trim(coalesce(p_payload->>'note','')),240);v_recount_of uuid:=erp_supply.safe_uuid(p_payload->>'recountOf');
  v_id uuid:=gen_random_uuid();v_code text;v_expected integer;v_submitted integer;v_lot erp_supply.inventory_lots%rowtype;v_counted numeric;v_previous numeric;v_source numeric;v_delta numeric;v_unit_cost numeric;
  v_snapshot jsonb:='[]'::jsonb;v_comparison_rows jsonb:='[]'::jsonb;v_exact integer:=0;v_diff integer:=0;v_abs numeric:=0;v_value numeric:=0;v_commitment_conflict boolean:=false;
begin
  if not erp_supply.can_access_module('inventory','create') and not erp_supply.has_role('super_admin') then raise exception 'No autorizado para enviar conteos de inventario' using errcode='42501'; end if;
  if v_mode not in('CYCLIC','EXPRESS','METERAGE') then raise exception 'Tipo de conteo inválido'; end if;
  if v_plan_type not in('PLANNED','EXPRESS','RECOUNT') then raise exception 'Origen de conteo inválido'; end if;
  if jsonb_typeof(v_counts)<>'array' or jsonb_array_length(v_counts)=0 then raise exception 'Debes registrar todos los lotes de la referencia'; end if;
  select coalesce(o.timezone,'America/Bogota') into v_tz from erp_supply.organizations o where o.id=v_org;
  v_day:=coalesce(nullif(p_payload->>'scheduledDate','')::date,(v_now at time zone v_tz)::date);
  if v_day<>((v_now at time zone v_tz)::date) and not erp_supply.has_role('super_admin') then raise exception 'El conteo debe enviarse en la jornada actual'; end if;
  select * into v_item from erp_supply.inventory_items where id=erp_supply.safe_uuid(p_payload->>'itemId') and organization_id=v_org and active;
  if not found or v_item.material_master_id is null then raise exception 'Material oficial no disponible'; end if;
  select * into v_master from erp_supply.material_master where id=v_item.material_master_id and organization_id=v_org and active;
  if not found then raise exception 'Maestro Siesa no disponible'; end if;
  if v_mode='METERAGE' and v_item.item_type<>'CUTTABLE' then raise exception 'El metraje solo aplica a referencias de cable o material cortable'; end if;
  if v_item.item_type='CUTTABLE' and v_mode='CYCLIC' then v_mode:='METERAGE'; end if;
  if exists(select 1 from erp_supply.inventory_count_reports r where r.organization_id=v_org and r.inventory_item_id=v_item.id and r.status='SUBMITTED') then raise exception 'Esta referencia ya tiene un reporte pendiente de revisión'; end if;
  if v_plan_type='RECOUNT' and (v_recount_of is null or not exists(select 1 from erp_supply.inventory_count_reports r where r.id=v_recount_of and r.organization_id=v_org and r.inventory_item_id=v_item.id and r.status='RECOUNT_REQUIRED')) then raise exception 'El reconteo no corresponde a un reporte abierto'; end if;
  select count(*)::integer into v_expected from erp_supply.inventory_lots l where l.inventory_item_id=v_item.id and l.source_active;v_submitted:=jsonb_array_length(v_counts);
  if v_expected=0 then raise exception 'La referencia no tiene lotes activos'; end if;
  if v_submitted<>v_expected then raise exception 'Debes contabilizar los % lotes activos de la referencia',v_expected; end if;
  if (select count(distinct erp_supply.safe_uuid(x->>'lotId')) from jsonb_array_elements(v_counts)x)<>v_expected then raise exception 'No puedes omitir ni repetir lotes'; end if;
  if exists(select 1 from jsonb_array_elements(v_counts)x where erp_supply.safe_uuid(x->>'lotId') is null or erp_supply.safe_numeric(x->>'countedPhysical') is null or erp_supply.safe_numeric(x->>'countedPhysical')<0) then raise exception 'Hay cantidades de conteo inválidas'; end if;
  for v_lot in select * from erp_supply.inventory_lots l where l.inventory_item_id=v_item.id and l.source_active order by l.id loop
    select erp_supply.safe_numeric(x->>'countedPhysical') into v_counted from jsonb_array_elements(v_counts)x where erp_supply.safe_uuid(x->>'lotId')=v_lot.id limit 1;
    if v_counted is null then raise exception 'Falta el conteo de uno de los lotes activos'; end if;
    v_previous:=coalesce(v_lot.quantity_available,0)+coalesce(v_lot.quantity_reserved,0)+coalesce(v_lot.quantity_blocked,0);v_source:=coalesce(erp_supply.safe_numeric(v_lot.metadata->>'physicalExistence'),v_previous);v_delta:=v_counted-v_previous;v_unit_cost:=coalesce(erp_supply.safe_numeric(v_lot.metadata->>'lastCostUnit'),erp_supply.safe_numeric(v_lot.metadata->>'averageCostUnit'),0);
    if abs(v_delta)<=0.0000001 then v_exact:=v_exact+1;else v_diff:=v_diff+1;end if;v_abs:=v_abs+abs(v_delta);v_value:=v_value+abs(v_delta*v_unit_cost);
    if v_counted<coalesce(v_lot.quantity_reserved,0)+coalesce(v_lot.quantity_blocked,0) then v_commitment_conflict:=true;end if;
    v_snapshot:=v_snapshot||jsonb_build_array(jsonb_build_object('lotId',v_lot.id,'available',v_lot.quantity_available,'reserved',v_lot.quantity_reserved,'blocked',v_lot.quantity_blocked,'operationalPhysical',v_previous,'sourcePhysical',v_source,'unitCost',v_unit_cost,'capturedAt',v_now));
    v_comparison_rows:=v_comparison_rows||jsonb_build_array(jsonb_build_object('lotId',v_lot.id,'countedPhysical',v_counted,'systemPhysical',v_previous,'sourcePhysical',v_source,'delta',v_delta,'absoluteDelta',abs(v_delta),'unitCost',v_unit_cost,'estimatedImpact',abs(v_delta*v_unit_cost),'commitmentConflict',v_counted<coalesce(v_lot.quantity_reserved,0)+coalesce(v_lot.quantity_blocked,0)));
  end loop;
  v_code:='INV-'||to_char(v_now at time zone v_tz,'YYYYMMDD')||'-'||upper(substr(replace(v_id::text,'-',''),1,6));
  insert into erp_supply.inventory_count_reports(id,organization_id,inventory_item_id,material_master_id,report_code,count_mode,plan_type,scheduled_date,status,submitted_by,submitted_at,observations,system_snapshot,comparison,has_difference,exact_lots,difference_lots,absolute_difference,estimated_value_impact,recount_of,metadata)
  values(v_id,v_org,v_item.id,v_master.id,v_code,v_mode,v_plan_type,v_day,'SUBMITTED',v_actor,v_now,v_counts,v_snapshot,jsonb_build_object('rows',v_comparison_rows,'commitmentConflict',v_commitment_conflict,'reference',v_master.reference,'description',v_master.exact_name,'unit',v_master.unit,'itemType',v_item.item_type),v_diff>0,v_exact,v_diff,v_abs,v_value,v_recount_of,jsonb_build_object('note',v_note,'engineVersion','11.23.0','blindCount',true));
  if v_recount_of is not null then update erp_supply.inventory_count_reports set metadata=metadata||jsonb_build_object('recountSubmittedAs',v_id),updated_at=v_now where id=v_recount_of;end if;
  insert into erp_supply.system_audit(organization_id,actor_profile_id,action,entity_type,entity_id,before_data,after_data,metadata) values(v_org,v_actor,'INVENTORY_COUNT_SUBMITTED','INVENTORY_COUNT_REPORT',v_id::text,null,jsonb_build_object('status','SUBMITTED','reportCode',v_code,'itemId',v_item.id),jsonb_build_object('mode',v_mode,'planType',v_plan_type,'blindCount',true,'version','11.23.0'));
  return jsonb_build_object('success',true,'reportId',v_id,'reportCode',v_code,'reference',v_master.reference,'status','SUBMITTED','submittedAt',v_now,'message','Conteo enviado a revisión');
end;$$;
revoke all on function public.erp_x_inventory_count_submit(jsonb) from public,anon;
grant execute on function public.erp_x_inventory_count_submit(jsonb) to authenticated;

create or replace function public.erp_x_inventory_count_reports(p_status text default null,p_page integer default 1,p_page_size integer default 50)
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare v_actor uuid:=erp_supply.require_profile();v_org uuid:=erp_supply.current_org_id();v_controller boolean:=erp_supply.inventory_count_is_controller();v_status text:=upper(trim(coalesce(p_status,'')));v_page integer:=greatest(coalesce(p_page,1),1);v_size integer:=least(greatest(coalesce(p_page_size,50),1),100);v_total bigint;
begin
  if not erp_supply.can_access_module('inventory','read') and not erp_supply.has_role('super_admin') then raise exception 'No autorizado para consultar reportes de inventario' using errcode='42501';end if;
  if v_status='PENDING' then v_status:='SUBMITTED';end if;if v_status not in('','ALL','SUBMITTED','APPLIED','RECOUNT_REQUIRED','REJECTED','CANCELLED') then v_status:='';end if;
  select count(*) into v_total from erp_supply.inventory_count_reports r where r.organization_id=v_org and (v_controller or r.submitted_by=v_actor) and (v_status in('','ALL') or r.status=v_status);
  return jsonb_build_object('items',coalesce((select jsonb_agg(row_data order by submitted_at desc,id desc) from (
    select r.id,r.submitted_at,r.report_code,case when v_controller then jsonb_build_object('id',r.id,'reportCode',r.report_code,'status',r.status,'mode',r.count_mode,'planType',r.plan_type,'scheduledDate',r.scheduled_date,'submittedAt',r.submitted_at,'submittedBy',p.display_name,'submittedByEmail',p.email,'itemId',i.id,'reference',m.reference,'description',m.exact_name,'unit',m.unit,'itemType',i.item_type,'observations',r.observations,'systemSnapshot',r.system_snapshot,'comparison',r.comparison,'hasDifference',r.has_difference,'exactLots',r.exact_lots,'differenceLots',r.difference_lots,'absoluteDifference',r.absolute_difference,'estimatedValueImpact',r.estimated_value_impact,'reviewDecision',r.review_decision,'reviewNote',r.review_note,'reviewedAt',r.reviewed_at,'reviewedBy',rp.display_name,'appliedAt',r.applied_at,'recountOf',r.recount_of,'metadata',r.metadata)
    else jsonb_build_object('id',r.id,'reportCode',r.report_code,'status',r.status,'mode',r.count_mode,'planType',r.plan_type,'scheduledDate',r.scheduled_date,'submittedAt',r.submitted_at,'reference',m.reference,'description',m.exact_name,'unit',m.unit,'itemType',i.item_type,'reviewDecision',r.review_decision,'reviewNote',case when r.status in('RECOUNT_REQUIRED','REJECTED') then r.review_note else null end,'reviewedAt',r.reviewed_at,'recountOf',r.recount_of) end row_data
    from erp_supply.inventory_count_reports r join erp_supply.inventory_items i on i.id=r.inventory_item_id join erp_supply.material_master m on m.id=r.material_master_id join erp_supply.profiles p on p.id=r.submitted_by left join erp_supply.profiles rp on rp.id=r.reviewed_by
    where r.organization_id=v_org and (v_controller or r.submitted_by=v_actor) and (v_status in('','ALL') or r.status=v_status) order by r.submitted_at desc,r.id desc offset (v_page-1)*v_size limit v_size
  )q),'[]'::jsonb),'pagination',jsonb_build_object('page',v_page,'pageSize',v_size,'totalItems',v_total,'totalPages',case when v_total=0 then 0 else ceil(v_total::numeric/v_size)::integer end),'access',jsonb_build_object('controller',v_controller,'canApprove',erp_supply.inventory_count_can_approve()),'version','11.23.0');
end;$$;
revoke all on function public.erp_x_inventory_count_reports(text,integer,integer) from public,anon;
grant execute on function public.erp_x_inventory_count_reports(text,integer,integer) to authenticated;

create or replace function public.erp_x_inventory_count_review(p_report_id uuid,p_decision text,p_reason text)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_actor uuid:=erp_supply.require_profile();v_org uuid:=erp_supply.current_org_id();v_req erp_supply.inventory_count_reports%rowtype;v_decision text:=upper(trim(coalesce(p_decision,'')));v_reason text:=left(trim(coalesce(p_reason,'')),300);v_now timestamptz:=now();v_lot erp_supply.inventory_lots%rowtype;v_counted numeric;v_target_available numeric;v_delta numeric;v_type text;v_snapshot jsonb;v_stale boolean:=false;v_conflict boolean:=false;v_active_lots integer;
begin
  if not erp_supply.inventory_count_can_approve() then raise exception 'No autorizado para decidir conteos de inventario' using errcode='42501';end if;if v_decision not in('APPROVE','RECOUNT','REJECT') then raise exception 'Decisión inválida';end if;if v_reason='' then raise exception 'Registra el motivo de la decisión';end if;
  select * into v_req from erp_supply.inventory_count_reports where id=p_report_id and organization_id=v_org for update;if not found then raise exception 'Reporte de inventario no encontrado';end if;if v_req.status<>'SUBMITTED' then raise exception 'El reporte ya fue revisado';end if;
  if v_decision='RECOUNT' then update erp_supply.inventory_count_reports set status='RECOUNT_REQUIRED',review_decision='RECOUNT',review_note=v_reason,reviewed_by=v_actor,reviewed_at=v_now,updated_at=v_now where id=v_req.id;insert into erp_supply.system_audit(organization_id,actor_profile_id,action,entity_type,entity_id,before_data,after_data,metadata) values(v_org,v_actor,'INVENTORY_COUNT_RECOUNT','INVENTORY_COUNT_REPORT',v_req.id::text,jsonb_build_object('status','SUBMITTED'),jsonb_build_object('status','RECOUNT_REQUIRED'),jsonb_build_object('reason',v_reason,'version','11.23.0'));return jsonb_build_object('success',true,'reportId',v_req.id,'status','RECOUNT_REQUIRED','message','Reconteo solicitado');end if;
  if v_decision='REJECT' then update erp_supply.inventory_count_reports set status='REJECTED',review_decision='REJECT',review_note=v_reason,reviewed_by=v_actor,reviewed_at=v_now,updated_at=v_now where id=v_req.id;insert into erp_supply.system_audit(organization_id,actor_profile_id,action,entity_type,entity_id,before_data,after_data,metadata) values(v_org,v_actor,'INVENTORY_COUNT_REJECTED','INVENTORY_COUNT_REPORT',v_req.id::text,jsonb_build_object('status','SUBMITTED'),jsonb_build_object('status','REJECTED'),jsonb_build_object('reason',v_reason,'version','11.23.0'));return jsonb_build_object('success',true,'reportId',v_req.id,'status','REJECTED','message','Reporte rechazado sin afectar inventario');end if;
  select count(*)::integer into v_active_lots from erp_supply.inventory_lots l where l.inventory_item_id=v_req.inventory_item_id and l.source_active;if v_active_lots<>jsonb_array_length(v_req.system_snapshot) then v_stale:=true;end if;
  if not v_stale then select exists(select 1 from jsonb_array_elements(v_req.system_snapshot)s left join erp_supply.inventory_lots l on l.id=erp_supply.safe_uuid(s->>'lotId') and l.inventory_item_id=v_req.inventory_item_id and l.source_active where l.id is null or abs(coalesce(l.quantity_available,0)-coalesce(erp_supply.safe_numeric(s->>'available'),0))>0.0000001 or abs(coalesce(l.quantity_reserved,0)-coalesce(erp_supply.safe_numeric(s->>'reserved'),0))>0.0000001 or abs(coalesce(l.quantity_blocked,0)-coalesce(erp_supply.safe_numeric(s->>'blocked'),0))>0.0000001) into v_stale;end if;
  select exists(select 1 from jsonb_array_elements(v_req.observations)o join erp_supply.inventory_lots l on l.id=erp_supply.safe_uuid(o->>'lotId') and l.inventory_item_id=v_req.inventory_item_id and l.source_active where erp_supply.safe_numeric(o->>'countedPhysical')<coalesce(l.quantity_reserved,0)+coalesce(l.quantity_blocked,0)) into v_conflict;
  if v_stale or v_conflict then update erp_supply.inventory_count_reports set status='RECOUNT_REQUIRED',review_decision='RECOUNT',review_note=case when v_stale then 'El stock cambió después del conteo. Se requiere un nuevo conteo antes de aplicar.' else 'El conteo físico quedó por debajo de cantidades reservadas o bloqueadas. Se requiere reconteo.' end,reviewed_by=v_actor,reviewed_at=v_now,updated_at=v_now,metadata=metadata||jsonb_build_object('approvalBlockedReason',case when v_stale then 'STALE_STOCK' else 'COMMITMENT_CONFLICT' end) where id=v_req.id;return jsonb_build_object('success',false,'reportId',v_req.id,'status','RECOUNT_REQUIRED','reason',case when v_stale then 'STALE_STOCK' else 'COMMITMENT_CONFLICT' end,'message','El reporte no puede aplicarse sin reconteo');end if;
  for v_lot in select * from erp_supply.inventory_lots l where l.inventory_item_id=v_req.inventory_item_id and l.source_active order by l.id for update loop
    select erp_supply.safe_numeric(o->>'countedPhysical') into v_counted from jsonb_array_elements(v_req.observations)o where erp_supply.safe_uuid(o->>'lotId')=v_lot.id limit 1;if v_counted is null then raise exception 'El reporte no contiene todos los lotes activos';end if;
    v_target_available:=v_counted-coalesce(v_lot.quantity_reserved,0)-coalesce(v_lot.quantity_blocked,0);if v_target_available<0 then raise exception 'El conteo no puede aplicarse por compromisos vigentes';end if;v_delta:=v_target_available-coalesce(v_lot.quantity_available,0);v_type:=case when abs(v_delta)<=0.0000001 then 'COUNT_EXACT' when v_delta>0 then 'ADJUSTMENT_IN' else 'ADJUSTMENT_OUT' end;
    update erp_supply.inventory_lots set quantity_available=v_target_available,metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object('lastApprovedInventoryCountAt',v_now,'lastApprovedInventoryCountBy',v_actor,'lastApprovedInventoryCountReport',v_req.id,'lastApprovedPhysical',v_counted) where id=v_lot.id;
    select s into v_snapshot from jsonb_array_elements(v_req.system_snapshot)s where erp_supply.safe_uuid(s->>'lotId')=v_lot.id limit 1;
    insert into erp_supply.inventory_movements(organization_id,inventory_item_id,lot_id,order_id,movement_type,quantity,unit,from_location,to_location,actor_profile_id,reference,metadata,created_at)
    select v_org,v_req.inventory_item_id,v_lot.id,null,v_type,abs(v_delta),m.unit,v_lot.location,v_lot.location,v_actor,'CONTEO APROBADO · '||v_req.report_code,jsonb_build_object('source','INVENTORY_COUNT_APPROVED','reportId',v_req.id,'reportCode',v_req.report_code,'countMode',v_req.count_mode,'planType',v_req.plan_type,'scheduledDate',v_req.scheduled_date,'submittedBy',v_req.submitted_by,'approvedBy',v_actor,'blindCount',true,'countedPhysical',v_counted,'previousOperationalPhysical',erp_supply.safe_numeric(v_snapshot->>'operationalPhysical'),'delta',v_delta,'result',case when abs(v_delta)<=0.0000001 then 'EXACT' else 'DIFFERENCE' end,'engineVersion','11.23.0'),v_now from erp_supply.material_master m where m.id=v_req.material_master_id;
  end loop;
  update erp_supply.inventory_count_reports set status='APPLIED',review_decision='APPROVE',review_note=v_reason,reviewed_by=v_actor,reviewed_at=v_now,applied_at=v_now,updated_at=v_now where id=v_req.id;
  if v_req.recount_of is not null then update erp_supply.inventory_count_reports set status='CANCELLED',updated_at=v_now,metadata=metadata||jsonb_build_object('resolvedByRecount',v_req.id,'resolvedAt',v_now) where id=v_req.recount_of and status='RECOUNT_REQUIRED';end if;
  insert into erp_supply.system_audit(organization_id,actor_profile_id,action,entity_type,entity_id,before_data,after_data,metadata) values(v_org,v_actor,'INVENTORY_COUNT_APPLIED','INVENTORY_COUNT_REPORT',v_req.id::text,jsonb_build_object('status','SUBMITTED'),jsonb_build_object('status','APPLIED'),jsonb_build_object('reason',v_reason,'mode',v_req.count_mode,'differenceLots',v_req.difference_lots,'valueImpact',v_req.estimated_value_impact,'version','11.23.0'));
  return jsonb_build_object('success',true,'reportId',v_req.id,'reportCode',v_req.report_code,'status','APPLIED','differenceLots',v_req.difference_lots,'message','Conteo aprobado y aplicado al inventario');
end;$$;
revoke all on function public.erp_x_inventory_count_review(uuid,text,text) from public,anon;
grant execute on function public.erp_x_inventory_count_review(uuid,text,text) to authenticated;

create or replace function public.erp_x_inventory_count_plan(p_day date default null)
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare v_org uuid:=erp_supply.current_org_id();v_tz text:='America/Bogota';v_day date;v_year_start date;v_year_end date;v_workdays integer:=1;v_controller boolean:=erp_supply.inventory_count_is_controller();v_vsm jsonb:=null;
begin
  perform erp_supply.require_profile();if not erp_supply.can_access_module('inventory','read') and not erp_supply.has_role('super_admin') then raise exception 'No autorizado para consultar el plan de inventario' using errcode='42501';end if;
  select coalesce(o.timezone,'America/Bogota') into v_tz from erp_supply.organizations o where o.id=v_org;v_day:=coalesce(p_day,(now() at time zone v_tz)::date);v_year_start:=date_trunc('year',v_day)::date;v_year_end:=(date_trunc('year',v_day)+interval '1 year - 1 day')::date;
  select greatest(count(*)::integer,1) into v_workdays from generate_series(v_day,v_year_end,'1 day'::interval)d where extract(isodow from d)::integer between 1 and 5;
  if v_controller and erp_supply.can_access_module('vsm','read') then begin v_vsm:=public.erp_x_vsm(greatest(v_year_start,v_day-29),v_day);exception when others then v_vsm:=null;end;end if;
  return (with lot_agg as(
    select i.id item_id,i.material_master_id,m.reference,m.exact_name description,m.unit,i.item_type,count(l.id)::integer lot_count,
      coalesce(sum(coalesce(erp_supply.safe_numeric(l.metadata->>'physicalExistence'),l.quantity_available+l.quantity_reserved+l.quantity_blocked)),0)::numeric source_physical,
      coalesce(sum(l.quantity_available+l.quantity_reserved+l.quantity_blocked),0)::numeric operational_physical,coalesce(sum(l.quantity_available),0)::numeric available,coalesce(sum(l.quantity_reserved),0)::numeric committed,coalesce(sum(l.quantity_blocked),0)::numeric blocked,
      coalesce(sum(coalesce(erp_supply.safe_numeric(l.metadata->>'lastCostTotal'),erp_supply.safe_numeric(l.metadata->>'averageCostTotal'),coalesce(erp_supply.safe_numeric(l.metadata->>'physicalExistence'),0)*coalesce(erp_supply.safe_numeric(l.metadata->>'lastCostUnit'),erp_supply.safe_numeric(l.metadata->>'averageCostUnit'),0))),0)::numeric inventory_value,
      coalesce(sum(coalesce(erp_supply.safe_numeric(l.metadata->>'averageConsumption'),0)),0)::numeric average_consumption,min(nullif(upper(trim(l.metadata->>'abcCost')),'')) abc_cost,min(nullif(upper(trim(l.metadata->>'abcTurns')),'')) abc_turns,
      coalesce(array_remove(array_agg(distinct nullif(trim(l.warehouse_code),'')),null),'{}'::text[]) warehouses,jsonb_agg(jsonb_build_object('id',l.id,'lotNumber',l.lot_number,'serialNumber',l.serial_number,'location',l.location,'warehouseCode',l.warehouse_code,'locationName',l.source_location_name,'variantLabel',mv.variant_label,'scanCode',l.scan_code) order by l.warehouse_code,l.location,l.lot_number,l.id) lots
    from erp_supply.inventory_items i join erp_supply.material_master m on m.id=i.material_master_id and m.active join erp_supply.inventory_lots l on l.inventory_item_id=i.id and l.source_active left join erp_supply.material_variants mv on mv.id=l.material_variant_id where i.organization_id=v_org and i.active group by i.id,m.id),
  movements as(select im.inventory_item_id item_id,count(*) filter(where im.created_at>=v_day::timestamp-interval '365 day' and coalesce(im.metadata->>'source','') not in('CYCLIC_COUNT','PHYSICAL_COUNT','INVENTORY_COUNT_APPROVED'))::integer events,coalesce(sum(im.quantity) filter(where im.created_at>=v_day::timestamp-interval '365 day' and im.movement_type in('ISSUE','ADJUSTMENT_OUT','SCRAP','TRANSFER_OUT') and coalesce(im.metadata->>'source','') not in('CYCLIC_COUNT','PHYSICAL_COUNT','INVENTORY_COUNT_APPROVED')),0)::numeric outgoing,coalesce(stddev_pop(im.quantity) filter(where im.created_at>=v_day::timestamp-interval '365 day' and coalesce(im.metadata->>'source','') not in('CYCLIC_COUNT','PHYSICAL_COUNT','INVENTORY_COUNT_APPROVED')),0)::numeric variability from erp_supply.inventory_movements im where im.organization_id=v_org group by im.inventory_item_id),
  demand as(select oi.material_master_id,count(distinct o.id)::integer orders,coalesce(sum(oi.quantity),0)::numeric qty from erp_supply.order_items oi join erp_supply.orders o on o.id=oi.order_id where o.organization_id=v_org and not o.is_test and o.status<>'CANCELLED' and oi.material_master_id is not null and o.created_at>=v_day::timestamp-interval '365 day' group by oi.material_master_id),
  count_history as(select r.inventory_item_id,count(*) filter(where r.status='APPLIED' and r.scheduled_date between v_year_start and v_day)::integer approved_year,max(r.applied_at) filter(where r.status='APPLIED') last_count_at,coalesce(sum(r.exact_lots) filter(where r.status='APPLIED' and r.scheduled_date between v_year_start and v_day),0)::integer exact_lots,coalesce(sum(r.difference_lots) filter(where r.status='APPLIED' and r.scheduled_date between v_year_start and v_day),0)::integer difference_lots,coalesce(sum(r.absolute_difference) filter(where r.status='APPLIED' and r.scheduled_date between v_year_start and v_day),0)::numeric abs_difference from erp_supply.inventory_count_reports r where r.organization_id=v_org group by r.inventory_item_id),
  base as(select l.*,coalesce(mv.events,0) movement_events,coalesce(mv.outgoing,0) outgoing_qty,coalesce(mv.variability,0) movement_variability,coalesce(d.orders,0) demand_orders,coalesce(d.qty,0) demand_qty,coalesce(ch.approved_year,0) approved_year,ch.last_count_at,coalesce(ch.exact_lots,0) exact_lots,coalesce(ch.difference_lots,0) difference_lots,coalesce(ch.abs_difference,0) abs_difference,abs(l.operational_physical-l.source_physical)::numeric stock_gap_abs,case coalesce(l.abc_cost,'') when 'A' then 100 when 'B' then 65 when 'C' then 30 else 10 end::numeric abc_cost_score,case coalesce(l.abc_turns,'') when 'A' then 100 when 'B' then 65 when 'C' then 30 else 10 end::numeric abc_turn_score,case when ch.last_count_at is null then 366 else greatest(0,v_day-(ch.last_count_at at time zone v_tz)::date) end::integer days_since_count from lot_agg l left join movements mv on mv.item_id=l.item_id left join demand d on d.material_master_id=l.material_master_id left join count_history ch on ch.inventory_item_id=l.item_id),
  normalized as(select b.*,percent_rank() over(order by b.inventory_value)::numeric*100 value_score,percent_rank() over(order by b.average_consumption)::numeric*100 consumption_score,percent_rank() over(order by(b.outgoing_qty+b.demand_qty))::numeric*100 activity_score,percent_rank() over(order by b.movement_variability)::numeric*100 variability_score,percent_rank() over(order by b.stock_gap_abs)::numeric*100 gap_score from base b),
  scored0 as(select n.*,round((n.abc_turn_score*.25+n.abc_cost_score*.22+n.value_score*.17+n.consumption_score*.12+n.activity_score*.10+n.gap_score*.08+n.variability_score*.04+least(n.days_since_count,366)::numeric/366*100*.02)::numeric,2) business_score from normalized n),
  scored as(select s.*,percent_rank() over(order by s.business_score)::numeric percentile,(((pg_catalog.hashtext(s.reference||'|'||v_day::text)::bigint+2147483648)%10000)::numeric/100) seeded_random from scored0 s),
  classified as(select s.*,case when percentile>=.95 then 'A+' when percentile>=.80 then 'A' when percentile>=.55 then 'B' when percentile>=.30 then 'C' when percentile>=.10 then 'D' else 'E' end pareto_band,round((seeded_random*.45+percentile*100*.40+least(days_since_count,366)::numeric/366*100*.15)::numeric,2) selection_rank from scored s),
  stats as(select count(*)::integer total_materials,count(*) filter(where approved_year>0)::integer counted_year,count(*) filter(where approved_year=0)::integer pending_year,coalesce(sum(exact_lots),0)::integer exact_lots,coalesce(sum(difference_lots),0)::integer difference_lots,count(*) filter(where stock_gap_abs>.0001)::integer gap_materials,count(*) filter(where blocked>0)::integer blocked_materials,round(coalesce(sum(inventory_value),0),2) inventory_value,coalesce(sum(movement_events),0)::integer movement_events,coalesce(sum(demand_orders),0)::integer demand_orders,count(*) filter(where abc_cost in('A','B','C') and abc_turns in('A','B','C'))::integer abc_covered from classified),
  targets as(select st.*,least(30,case when st.pending_year=0 then 0 else greatest(1,ceil(st.pending_year::numeric/v_workdays)::integer) end) target_today,case when st.exact_lots+st.difference_lots=0 then null else round(st.exact_lots::numeric/(st.exact_lots+st.difference_lots)*100,1) end exactness_pct from stats st),
  selected as(select c.* from classified c where c.approved_year=0 and not exists(select 1 from erp_supply.inventory_count_reports r where r.organization_id=v_org and r.inventory_item_id=c.item_id and r.status in('SUBMITTED','RECOUNT_REQUIRED')) order by c.selection_rank desc,c.reference limit(select target_today from targets)),
  bands as(select pareto_band,count(*)::integer materials,count(*) filter(where approved_year>0)::integer counted,count(*) filter(where approved_year=0)::integer pending,round(avg(business_score),1) avg_score from classified group by pareto_band)
  select jsonb_build_object('day',v_day,'engine',jsonb_build_object('version','11.23.0','mode','SIESA_CRM_ACCOUNTING','selection','deterministic_weighted_random','annualNoRepeat',true,'dailyCap',30,'workdaysRemaining',v_workdays),'summary',(select jsonb_build_object('totalMaterials',t.total_materials,'countedYear',t.counted_year,'pendingYear',t.pending_year,'coveragePct',case when t.total_materials=0 then 0 else round(t.counted_year::numeric/t.total_materials*100,1) end,'targetToday',t.target_today,'exactnessPct',t.exactness_pct,'exactEvents',t.exact_lots,'differenceEvents',t.difference_lots) from targets t),'plan',coalesce((select jsonb_agg(jsonb_build_object('itemId',s.item_id,'materialMasterId',s.material_master_id,'reference',s.reference,'description',s.description,'unit',s.unit,'itemType',s.item_type,'warehouses',to_jsonb(s.warehouses),'lotCount',s.lot_count,'lots',s.lots,'paretoBand',s.pareto_band,'businessScore',s.business_score,'selectionRank',s.selection_rank,'abcCost',s.abc_cost,'abcTurns',s.abc_turns,'lastCountAt',s.last_count_at,'daysSinceCount',s.days_since_count) order by s.selection_rank desc,s.reference) from selected s),'[]'::jsonb),'bands',coalesce((select jsonb_agg(jsonb_build_object('band',b.pareto_band,'materials',b.materials,'counted',b.counted,'pending',b.pending,'avgScore',b.avg_score) order by case b.pareto_band when 'A+' then 1 when 'A' then 2 when 'B' then 3 when 'C' then 4 when 'D' then 5 else 6 end) from bands b),'[]'::jsonb),'dataQuality',(select jsonb_build_object('siesaAbcCoveragePct',case when t.total_materials=0 then 0 else round(t.abc_covered::numeric/t.total_materials*100,1) end,'crmMovementEvents365',t.movement_events,'crmDemandOrders365',t.demand_orders,'baselineConfidence',case when t.total_materials>0 and t.abc_covered::numeric/t.total_materials>=.8 then 'HIGH' when t.abc_covered>0 then 'MEDIUM' else 'LOW' end,'adaptiveLearningStage',case when t.movement_events>=250 or t.demand_orders>=250 then 'MATURE' when t.movement_events>=50 or t.demand_orders>=50 then 'GROWING' else 'INITIAL' end) from targets t),'executive',case when v_controller then(select jsonb_build_object('inventoryValue',t.inventory_value,'gapMaterials',t.gap_materials,'blockedMaterials',t.blocked_materials,'stars',coalesce((select jsonb_agg(to_jsonb(x) order by x."businessScore" desc,x.reference) from(select c.reference,c.description,c.unit,c.pareto_band "paretoBand",c.business_score "businessScore",c.abc_cost "abcCost",c.abc_turns "abcTurns",c.source_physical "sourcePhysical",c.operational_physical "operationalPhysical",(c.operational_physical-c.source_physical) "stockGap",c.inventory_value "inventoryValue",to_jsonb(c.warehouses) warehouses from classified c order by c.business_score desc,c.reference limit 20)x),'[]'::jsonb),'stockGaps',coalesce((select jsonb_agg(to_jsonb(x) order by abs(x."stockGap") desc,x.reference) from(select c.reference,c.description,c.unit,c.source_physical "sourcePhysical",c.operational_physical "operationalPhysical",(c.operational_physical-c.source_physical) "stockGap",c.inventory_value "inventoryValue",to_jsonb(c.warehouses) warehouses from classified c where c.stock_gap_abs>.0001 order by c.stock_gap_abs desc,c.inventory_value desc limit 20)x),'[]'::jsonb),'vsm',case when v_vsm is null then null else jsonb_build_object('summary',v_vsm->'summary','range',v_vsm->'range') end) from targets t) else null end,'generatedAt',now()));
end;$$;
revoke all on function public.erp_x_inventory_count_plan(date) from public,anon;
grant execute on function public.erp_x_inventory_count_plan(date) to authenticated;

create or replace function public.erp_x_inventory_count_center(p_day date default null)
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare v_actor uuid:=erp_supply.require_profile();v_org uuid:=erp_supply.current_org_id();v_tz text:='America/Bogota';v_day date;v_controller boolean:=erp_supply.inventory_count_is_controller();v_operator boolean:=erp_supply.can_access_module('inventory','create') or erp_supply.has_role('super_admin');v_engine jsonb;v_queue jsonb:='[]'::jsonb;v_recent jsonb:='[]'::jsonb;v_recounts jsonb:='[]'::jsonb;v_planned jsonb:='[]'::jsonb;
begin
  if not erp_supply.can_access_module('inventory','read') and not erp_supply.has_role('super_admin') then raise exception 'No autorizado para abrir Inventario' using errcode='42501';end if;
  select coalesce(o.timezone,'America/Bogota') into v_tz from erp_supply.organizations o where o.id=v_org;v_day:=coalesce(p_day,(now() at time zone v_tz)::date);v_engine:=public.erp_x_inventory_count_plan(v_day);
  if v_operator then
    select coalesce(jsonb_agg(task order by submitted_at,reference),'[]'::jsonb) into v_recounts from(select r.submitted_at,m.reference,jsonb_build_object('itemId',i.id,'materialMasterId',m.id,'reference',m.reference,'description',m.exact_name,'unit',m.unit,'itemType',i.item_type,'warehouses',coalesce((select to_jsonb(array_remove(array_agg(distinct nullif(trim(l.warehouse_code),'')),null)) from erp_supply.inventory_lots l where l.inventory_item_id=i.id and l.source_active),'[]'::jsonb),'lotCount',(select count(*) from erp_supply.inventory_lots l where l.inventory_item_id=i.id and l.source_active),'lots',coalesce((select jsonb_agg(jsonb_build_object('id',l.id,'lotNumber',l.lot_number,'serialNumber',l.serial_number,'location',l.location,'warehouseCode',l.warehouse_code,'locationName',l.source_location_name,'variantLabel',mv.variant_label,'scanCode',l.scan_code) order by l.warehouse_code,l.location,l.lot_number,l.id) from erp_supply.inventory_lots l left join erp_supply.material_variants mv on mv.id=l.material_variant_id where l.inventory_item_id=i.id and l.source_active),'[]'::jsonb),'countMode',case when i.item_type='CUTTABLE' then 'METERAGE' else r.count_mode end,'planType','RECOUNT','recountOf',r.id,'priorityLabel','Reconteo solicitado') task from erp_supply.inventory_count_reports r join erp_supply.inventory_items i on i.id=r.inventory_item_id and i.active join erp_supply.material_master m on m.id=r.material_master_id and m.active where r.organization_id=v_org and r.status='RECOUNT_REQUIRED' and r.submitted_by=v_actor)q;
    select coalesce(jsonb_agg(task order by selection_rank desc,reference),'[]'::jsonb) into v_planned from(select x->>'reference' reference,coalesce(erp_supply.safe_numeric(x->>'selectionRank'),0) selection_rank,(x-'businessScore'-'selectionRank'-'abcCost'-'abcTurns'-'lastExit'-'lastConsumption'-'lastCountAt'-'daysSinceCount'-'recountRequired'-'paretoBand')||jsonb_build_object('countMode',case when x->>'itemType'='CUTTABLE' then 'METERAGE' else 'CYCLIC' end,'planType','PLANNED','priorityLabel',case when x->>'itemType'='CUTTABLE' then 'Metraje programado' else 'Conteo programado' end) task from jsonb_array_elements(coalesce(v_engine->'plan','[]'::jsonb))x where not exists(select 1 from erp_supply.inventory_count_reports r where r.organization_id=v_org and r.inventory_item_id=erp_supply.safe_uuid(x->>'itemId') and r.status in('SUBMITTED','RECOUNT_REQUIRED')))q;v_queue:=v_recounts||v_planned;
    select coalesce(jsonb_agg(row_data order by submitted_at desc),'[]'::jsonb) into v_recent from(select r.submitted_at,jsonb_build_object('id',r.id,'reportCode',r.report_code,'reference',m.reference,'description',m.exact_name,'mode',r.count_mode,'status',r.status,'submittedAt',r.submitted_at,'reviewedAt',r.reviewed_at,'reviewNote',case when r.status in('RECOUNT_REQUIRED','REJECTED') then r.review_note else null end) row_data from erp_supply.inventory_count_reports r join erp_supply.material_master m on m.id=r.material_master_id where r.organization_id=v_org and r.submitted_by=v_actor order by r.submitted_at desc limit 8)q;
  end if;
  return jsonb_build_object('day',v_day,'access',jsonb_build_object('operator',v_operator,'controller',v_controller,'canApprove',erp_supply.inventory_count_can_approve()),'operator',case when v_operator then jsonb_build_object('queue',v_queue,'recent',v_recent,'progress',jsonb_build_object('remaining',jsonb_array_length(v_queue),'submittedToday',(select count(*) from erp_supply.inventory_count_reports r where r.organization_id=v_org and r.submitted_by=v_actor and r.scheduled_date=v_day and r.status in('SUBMITTED','APPLIED','RECOUNT_REQUIRED')),'waitingReview',(select count(*) from erp_supply.inventory_count_reports r where r.organization_id=v_org and r.submitted_by=v_actor and r.status='SUBMITTED'),'recountRequired',(select count(*) from erp_supply.inventory_count_reports r where r.organization_id=v_org and r.submitted_by=v_actor and r.status='RECOUNT_REQUIRED'))) else null end,'control',case when v_controller then jsonb_build_object('summary',v_engine->'summary','bands',v_engine->'bands','dataQuality',v_engine->'dataQuality','executive',v_engine->'executive','reports',jsonb_build_object('pending',(select count(*) from erp_supply.inventory_count_reports r where r.organization_id=v_org and r.status='SUBMITTED'),'recounts',(select count(*) from erp_supply.inventory_count_reports r where r.organization_id=v_org and r.status='RECOUNT_REQUIRED'),'appliedToday',(select count(*) from erp_supply.inventory_count_reports r where r.organization_id=v_org and r.status='APPLIED' and r.applied_at is not null and(r.applied_at at time zone v_tz)::date=v_day),'pendingValueImpact',(select coalesce(sum(r.estimated_value_impact),0) from erp_supply.inventory_count_reports r where r.organization_id=v_org and r.status='SUBMITTED'))) else null end,'engine',jsonb_build_object('version','11.23.0','priorityEngine',v_engine->'engine','principle','AUXILIAR_COUNTS_SYSTEM_COMPARES_CONTROL_DECIDES'),'generatedAt',now());
end;$$;
revoke all on function public.erp_x_inventory_count_center(date) from public,anon;
grant execute on function public.erp_x_inventory_count_center(date) to authenticated;

-- El conteo ciego también se impone a los RPC históricos de consulta rica.
do $$
declare rec record;v_def text;
begin
  for rec in select p.oid from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in('erp_x_inventory','erp_x_inventory_filtered','erp_x_inventory_lots','erp_x_inventory_movements','erp_x_inventory_scan_resolve') loop
    v_def:=pg_get_functiondef(rec.oid);
    if position('inventory_count_is_blind_operator' in v_def)=0 then
      v_def:=replace(v_def,'perform erp_supply.require_profile();','perform erp_supply.require_profile();'||E'\n  if erp_supply.inventory_count_is_blind_operator() then raise exception ''Vista de existencias restringida durante el conteo ciego'' using errcode=''42501''; end if;');
      execute v_def;
    end if;
  end loop;
end$$;

-- Retiro de contratos V11.22 que aplicaban conteo directamente.
drop function if exists public.erp_x_inventory_cycle_count(jsonb);
drop function if exists public.erp_x_inventory_cycle_control(date);
