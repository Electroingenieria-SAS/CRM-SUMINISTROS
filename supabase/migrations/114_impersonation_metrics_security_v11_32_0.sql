-- CRM SUMINISTROS V11.32.0
-- Hardening de impersonación administrativa y autorización de métricas AuditoriaERP.
-- Cambio aditivo: no altera el flujo operacional de pedidos/inventario.

create table if not exists erp_supply.admin_impersonation_sessions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references erp_supply.organizations(id) on delete cascade,
  actor_profile_id uuid not null references erp_supply.profiles(id) on delete restrict,
  target_profile_id uuid not null references erp_supply.profiles(id) on delete restrict,
  target_auth_user_id uuid not null,
  reason text not null,
  source_origin text,
  started_at timestamptz not null default now(),
  last_seen_at timestamptz,
  expires_at timestamptz not null default (now() + interval '60 minutes'),
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  check (char_length(reason) between 5 and 500),
  check (expires_at > started_at)
);

create index if not exists idx_admin_impersonation_target_active_v11320
  on erp_supply.admin_impersonation_sessions(target_auth_user_id, expires_at)
  where ended_at is null;

create index if not exists idx_admin_impersonation_actor_started_v11320
  on erp_supply.admin_impersonation_sessions(actor_profile_id, started_at desc);

alter table erp_supply.admin_impersonation_sessions enable row level security;
revoke all on table erp_supply.admin_impersonation_sessions from public, anon, authenticated;

create or replace function public.erp_x_admin_impersonation_start(
  p_target_profile_id uuid,
  p_target_auth_user_id uuid,
  p_reason text,
  p_source_origin text default null
)
returns jsonb
language plpgsql
security definer
set search_path = 'erp_supply','public','auth','pg_catalog'
as $function$
declare
  v_actor uuid:=erp_supply.require_profile();
  v_org uuid:=erp_supply.current_org_id();
  v_reason text:=trim(coalesce(p_reason,''));
  v_session erp_supply.admin_impersonation_sessions%rowtype;
begin
  if not erp_supply.has_role('super_admin') then
    raise exception 'Solo Super Admin puede iniciar una sesión de verificación' using errcode='42501';
  end if;
  if p_target_profile_id is null or p_target_auth_user_id is null then
    raise exception 'Perfil e identidad Auth objetivo son requeridos';
  end if;
  if p_target_profile_id=v_actor then
    raise exception 'No necesitas impersonar tu propio perfil';
  end if;
  if char_length(v_reason)<5 or char_length(v_reason)>500 then
    raise exception 'El motivo debe tener entre 5 y 500 caracteres';
  end if;
  if not exists(
    select 1
    from erp_supply.profiles p
    where p.id=p_target_profile_id
      and p.organization_id=v_org
      and p.active
      and p.auth_user_id=p_target_auth_user_id
  ) then
    raise exception 'El perfil objetivo no está activo o su identidad Auth no coincide';
  end if;
  if exists(
    select 1
    from erp_supply.profile_roles pr
    where pr.profile_id=p_target_profile_id
      and pr.role_code='super_admin'
  ) then
    raise exception 'No se permite impersonar otro perfil Super Admin' using errcode='42501';
  end if;

  update erp_supply.admin_impersonation_sessions
  set ended_at=coalesce(ended_at,now())
  where actor_profile_id=v_actor
    and target_profile_id=p_target_profile_id
    and ended_at is null;

  insert into erp_supply.admin_impersonation_sessions(
    organization_id,actor_profile_id,target_profile_id,target_auth_user_id,
    reason,source_origin,expires_at
  ) values(
    v_org,v_actor,p_target_profile_id,p_target_auth_user_id,
    v_reason,nullif(left(trim(coalesce(p_source_origin,'')),500),''),
    now()+interval '60 minutes'
  )
  returning * into v_session;

  insert into erp_supply.system_audit(
    organization_id,actor_profile_id,action,entity_type,entity_id,metadata
  ) values(
    v_org,v_actor,'AUTH_IMPERSONATION_STARTED','AUTH_USER',p_target_profile_id::text,
    jsonb_build_object(
      'version','11.32.0',
      'source','SUPER_ADMIN_CONSOLE',
      'impersonationSessionId',v_session.id,
      'targetAuthUserId',p_target_auth_user_id,
      'reason',v_reason,
      'sourceOrigin',v_session.source_origin,
      'expiresAt',v_session.expires_at
    )
  );

  return jsonb_build_object(
    'sessionId',v_session.id,
    'expiresAt',v_session.expires_at
  );
end;
$function$;

revoke all on function public.erp_x_admin_impersonation_start(uuid,uuid,text,text) from public,anon;
grant execute on function public.erp_x_admin_impersonation_start(uuid,uuid,text,text) to authenticated,service_role;

create or replace function erp_supply.request_impersonation_session_id()
returns uuid
language plpgsql
stable
security definer
set search_path = 'erp_supply','auth','pg_catalog'
as $function$
declare
  v_headers jsonb;
  v_value text;
  v_session_id uuid;
  v_auth_user uuid:=auth.uid();
begin
  if v_auth_user is null then return null; end if;
  begin
    v_headers:=coalesce(nullif(current_setting('request.headers',true),''),'{}')::jsonb;
    v_value:=nullif(trim(v_headers->>'x-erp-impersonation-session'),'');
    if v_value is null then return null; end if;
    v_session_id:=v_value::uuid;
  exception when others then
    return null;
  end;

  if exists(
    select 1
    from erp_supply.admin_impersonation_sessions s
    where s.id=v_session_id
      and s.target_auth_user_id=v_auth_user
      and s.ended_at is null
      and s.expires_at>now()
  ) then
    return v_session_id;
  end if;
  return null;
end;
$function$;

revoke all on function erp_supply.request_impersonation_session_id() from public,anon,authenticated;

create or replace function erp_supply.enrich_system_audit_impersonation()
returns trigger
language plpgsql
security definer
set search_path = 'erp_supply','auth','pg_catalog'
as $function$
declare
  v_session_id uuid;
  v_session erp_supply.admin_impersonation_sessions%rowtype;
begin
  v_session_id:=erp_supply.request_impersonation_session_id();
  if v_session_id is null then return new; end if;

  select * into v_session
  from erp_supply.admin_impersonation_sessions
  where id=v_session_id
    and target_auth_user_id=auth.uid()
    and ended_at is null
    and expires_at>now();

  if not found then return new; end if;

  new.metadata:=coalesce(new.metadata,'{}'::jsonb)||jsonb_build_object(
    'impersonation',true,
    'impersonationSessionId',v_session.id,
    'originalActorProfileId',v_session.actor_profile_id,
    'effectiveActorProfileId',v_session.target_profile_id,
    'impersonationReason',v_session.reason,
    'impersonationStartedAt',v_session.started_at,
    'impersonationExpiresAt',v_session.expires_at,
    'traceVersion','11.32.0'
  );

  update erp_supply.admin_impersonation_sessions
  set last_seen_at=now()
  where id=v_session.id;

  return new;
end;
$function$;

revoke all on function erp_supply.enrich_system_audit_impersonation() from public,anon,authenticated;

drop trigger if exists tr_system_audit_impersonation_trace on erp_supply.system_audit;
create trigger tr_system_audit_impersonation_trace
before insert on erp_supply.system_audit
for each row execute function erp_supply.enrich_system_audit_impersonation();

create or replace function public.erp_x_admin_impersonation_end(p_session_id uuid)
returns boolean
language plpgsql
security definer
set search_path = 'erp_supply','public','auth','pg_catalog'
as $function$
declare
  v_profile uuid:=erp_supply.require_profile();
  v_org uuid:=erp_supply.current_org_id();
  v_actor uuid;
  v_target uuid;
  v_changed boolean:=false;
begin
  select actor_profile_id,target_profile_id
  into v_actor,v_target
  from erp_supply.admin_impersonation_sessions
  where id=p_session_id
    and organization_id=v_org
  for update;

  if not found then return false; end if;
  if v_profile<>v_target and not erp_supply.has_role('super_admin') then
    raise exception 'No autorizado para cerrar esta sesión de verificación' using errcode='42501';
  end if;

  update erp_supply.admin_impersonation_sessions
  set ended_at=coalesce(ended_at,now()),last_seen_at=coalesce(last_seen_at,now())
  where id=p_session_id
    and ended_at is null;
  v_changed:=found;

  if v_changed then
    insert into erp_supply.system_audit(
      organization_id,actor_profile_id,action,entity_type,entity_id,metadata
    ) values(
      v_org,v_profile,'AUTH_IMPERSONATION_ENDED','AUTH_USER',v_target::text,
      jsonb_build_object(
        'version','11.32.0',
        'source','IMPERSONATION_SESSION',
        'impersonationSessionId',p_session_id,
        'originalActorProfileId',v_actor,
        'effectiveActorProfileId',v_target
      )
    );
  end if;

  return v_changed;
end;
$function$;

revoke all on function public.erp_x_admin_impersonation_end(uuid) from public,anon;
grant execute on function public.erp_x_admin_impersonation_end(uuid) to authenticated,service_role;

create or replace function public.erp_x_auditoria_erp_metrics_authorize()
returns boolean
language plpgsql
stable
security definer
set search_path = 'erp_supply','public','auth','pg_catalog'
as $function$
begin
  perform erp_supply.require_profile();
  return (
    erp_supply.has_role('super_admin')
    or erp_supply.can_access_module('reports','read')
    or erp_supply.can_access_module('audit','read')
  );
end;
$function$;

revoke all on function public.erp_x_auditoria_erp_metrics_authorize() from public,anon;
grant execute on function public.erp_x_auditoria_erp_metrics_authorize() to authenticated,service_role;

create or replace function public.erp_x_auditoria_erp_metrics_user(
  p_from date default null,
  p_to date default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = 'erp_supply','public','auth','pg_catalog'
as $function$
declare
  v_org uuid:=erp_supply.current_org_id();
  v_result jsonb;
begin
  perform erp_supply.require_profile();
  if not (
    erp_supply.has_role('super_admin')
    or erp_supply.can_access_module('reports','read')
    or erp_supply.can_access_module('audit','read')
  ) then
    raise exception 'No autorizado para consultar métricas de integración' using errcode='42501';
  end if;
  if p_from is not null and p_to is not null and (p_to<p_from or (p_to-p_from)>366) then
    raise exception 'Rango de fechas inválido';
  end if;

  with bounds as (
    select coalesce(p_from,current_date-29) as date_from,
           coalesce(p_to,current_date) as date_to
  ), receipts_scope as (
    select wr.*
    from erp_supply.warehouse_receipts wr,bounds b
    where wr.organization_id=v_org
      and wr.received_at >= b.date_from::timestamptz
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
  into v_result
  from bounds b
  left join receipts_scope r on true
  left join line_totals lt on lt.receipt_id=r.id
  group by b.date_from,b.date_to;

  return v_result;
end;
$function$;

revoke all on function public.erp_x_auditoria_erp_metrics_user(date,date) from public,anon;
grant execute on function public.erp_x_auditoria_erp_metrics_user(date,date) to authenticated,service_role;

notify pgrst, 'reload schema';
