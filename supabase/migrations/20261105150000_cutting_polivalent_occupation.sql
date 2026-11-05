-- Asignación independiente del auxiliar polivalente: Corte y posterior recogida.
-- Alistamiento general y el operador de Corte conservan sus responsables.

CREATE OR REPLACE FUNCTION public.erp_x_cutting_pickup_pool()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO 'erp_supply','public','auth','pg_catalog'
AS $function$
declare v_actor uuid:=erp_supply.require_profile();v_org uuid:=erp_supply.current_org_id();
begin
 if not (erp_supply.can_access_module('cutting','read') or erp_supply.has_role('auxiliar_corte')
   or erp_supply.has_role('super_admin') or erp_supply.has_role('jefe_logistica')) then
   raise exception 'No autorizado para seleccionar el apoyo de Corte' using errcode='42501';
 end if;
 return coalesce((
  select jsonb_agg(jsonb_build_object('id',p.id,'name',p.display_name,'busy',
    exists(select 1 from erp_supply.cut_executions c where c.organization_id=v_org
      and c.status in('IN_PROGRESS','PAUSED','WAITING_EVIDENCE')
      and (c.started_by=p.id or c.metadata->>'cutPickupProfileId'=p.id::text))
    or exists(select 1 from erp_supply.work_executions e where e.organization_id=v_org
      and e.profile_id=p.id and e.status in('IN_PROGRESS','PAUSED'))
    or exists(select 1 from erp_supply.task_sessions s
      join erp_supply.order_tasks t on t.id=s.task_id
      join erp_supply.orders o on o.id=t.order_id
      where o.organization_id=v_org and s.profile_id=p.id and s.ended_at is null)
  ) order by p.display_name)
  from erp_supply.profiles p
  where p.organization_id=v_org and p.active and p.id<>v_actor
    and exists(select 1 from erp_supply.profile_roles r where r.profile_id=p.id and r.role_code='aux_logistica')
    and exists(select 1 from erp_supply.profile_roles r where r.profile_id=p.id and r.role_code='auxiliar_corte')
 ),'[]'::jsonb);
end;
$function$;

CREATE OR REPLACE FUNCTION public.erp_x_cutting_start_with_helper(p_group_key text,p_helper_profile_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'erp_supply','public','auth','pg_catalog'
AS $function$
declare
 v_actor uuid:=erp_supply.require_profile();
 v_org uuid:=erp_supply.current_org_id();
 v_helper erp_supply.profiles%rowtype;
 v_existing uuid;
 v_result jsonb;
 v_exec uuid;
begin
 if p_helper_profile_id is null or p_helper_profile_id=v_actor then
   raise exception 'Selecciona un auxiliar polivalente diferente del auxiliar de Corte';
 end if;
 if not (erp_supply.can_access_module('cutting','update') or erp_supply.has_role('auxiliar_corte')
   or erp_supply.has_role('jefe_logistica') or erp_supply.has_role('super_admin')) then
   raise exception 'No autorizado para iniciar Corte' using errcode='42501';
 end if;
 select * into v_helper from erp_supply.profiles p
 where p.id=p_helper_profile_id and p.organization_id=v_org and p.active
   and exists(select 1 from erp_supply.profile_roles r where r.profile_id=p.id and r.role_code='aux_logistica')
   and exists(select 1 from erp_supply.profile_roles r where r.profile_id=p.id and r.role_code='auxiliar_corte')
 for update;
 if not found then raise exception 'El apoyo de Corte debe tener los dos roles Auxiliar de Corte y Auxiliar de Logística'; end if;
 v_existing:=erp_supply.active_cut_execution_id(v_org,p_group_key);
 if v_existing is not null then raise exception 'Esta referencia ya tiene Corte iniciado. Continúa la ejecución existente.'; end if;
 if exists(select 1 from erp_supply.cut_executions c where c.organization_id=v_org
   and c.status in('IN_PROGRESS','PAUSED','WAITING_EVIDENCE')
   and (c.started_by=v_helper.id or c.metadata->>'cutPickupProfileId'=v_helper.id::text))
   or exists(select 1 from erp_supply.work_executions e where e.organization_id=v_org
     and e.profile_id=v_helper.id and e.status in('IN_PROGRESS','PAUSED'))
   or exists(select 1 from erp_supply.task_sessions s
     join erp_supply.order_tasks t on t.id=s.task_id
     join erp_supply.orders o on o.id=t.order_id
     where o.organization_id=v_org and s.profile_id=v_helper.id and s.ended_at is null)
 then raise exception 'El auxiliar polivalente está ocupado. Selecciona otro disponible.'; end if;
 v_result:=public.erp_x_cutting_start(p_group_key);
 v_exec:=erp_supply.safe_uuid(v_result#>>'{execution,id}');
 if v_exec is null then raise exception 'No se pudo registrar el inicio de Corte'; end if;
 update erp_supply.cut_executions c
 set metadata=coalesce(c.metadata,'{}'::jsonb)||jsonb_build_object(
   'cutPickupProfileId',v_helper.id::text,
   'cutPickupProfileName',v_helper.display_name,
   'cutPickupAssignedBy',v_actor::text,'cutPickupAssignedAt',now()
 ),updated_at=now()
 where c.id=v_exec and c.organization_id=v_org and c.started_by=v_actor;
 if not found then raise exception 'No puedes reasignar una ejecución iniciada por otro auxiliar' using errcode='42501'; end if;
 update erp_supply.cut_requirements r
 set metadata=coalesce(r.metadata,'{}'::jsonb)||jsonb_build_object(
   'cutPickupProfileId',v_helper.id::text,'cutPickupProfileName',v_helper.display_name,
   'cutPickupExecutionId',v_exec::text
 ),updated_at=now()
 where exists(select 1 from erp_supply.cut_execution_requirements cer
   where cer.execution_id=v_exec and cer.cut_requirement_id=r.id);
 return public.erp_x_cutting_execution(v_exec);
end;
$function$;

CREATE OR REPLACE FUNCTION erp_supply.work_source_business_seconds(p_profile_id uuid, p_start timestamp with time zone, p_end timestamp with time zone, p_source text)
 RETURNS bigint
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'erp_supply', 'public', 'auth', 'pg_catalog'
AS $function$
  with profile_ctx as(
    select p.organization_id from erp_supply.profiles p where p.id=p_profile_id
  ),
  entries as(
    select s.started_at start_at,least(coalesce(s.ended_at,now()),p_end) end_at
    from erp_supply.task_sessions s
    join erp_supply.order_tasks t on t.id=s.task_id join erp_supply.orders o on o.id=t.order_id
    join profile_ctx pc on pc.organization_id=o.organization_id
    where upper(p_source)='ERP' and s.profile_id=p_profile_id and s.started_at<p_end and coalesce(s.ended_at,now())>p_start
    union all
    select c.started_at,least(coalesce(c.completed_at,now()),p_end)
    from erp_supply.cut_executions c join profile_ctx pc on pc.organization_id=c.organization_id
    where upper(p_source)='ERP' and (c.started_by=p_profile_id or c.metadata->>'cutPickupProfileId'=p_profile_id::text) and c.status<>'CANCELLED' and c.started_at<p_end and coalesce(c.completed_at,now())>p_start
    union all
    select e.started_at,least(coalesce(e.ended_at,now()),p_end)
    from erp_supply.work_executions e join profile_ctx pc on pc.organization_id=e.organization_id
    where upper(p_source)='ACTIVITY' and e.profile_id=p_profile_id and e.status<>'CANCELLED' and e.started_at<p_end and coalesce(e.ended_at,now())>p_start
  ),
  clipped as(
    select tstzrange(greatest(start_at,p_start),least(end_at,p_end),'[)') r from entries
    where greatest(start_at,p_start)<least(end_at,p_end)
  ),
  merged as(select unnest(range_agg(r)) r from clipped)
  select coalesce(sum(erp_supply.business_seconds_between((select organization_id from profile_ctx),lower(r),upper(r))),0) from merged
$function$;

CREATE OR REPLACE FUNCTION erp_supply.work_classified_business_seconds(p_profile_id uuid, p_start timestamp with time zone, p_end timestamp with time zone)
 RETURNS bigint
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'erp_supply', 'public', 'auth', 'pg_catalog'
AS $function$
  with profile_ctx as(select p.organization_id from erp_supply.profiles p where p.id=p_profile_id),
  entries as(
    select s.started_at start_at,least(coalesce(s.ended_at,now()),p_end) end_at
    from erp_supply.task_sessions s join erp_supply.order_tasks t on t.id=s.task_id join erp_supply.orders o on o.id=t.order_id
    join profile_ctx pc on pc.organization_id=o.organization_id
    where s.profile_id=p_profile_id and s.started_at<p_end and coalesce(s.ended_at,now())>p_start
    union all
    select c.started_at,least(coalesce(c.completed_at,now()),p_end)
    from erp_supply.cut_executions c join profile_ctx pc on pc.organization_id=c.organization_id
    where (c.started_by=p_profile_id or c.metadata->>'cutPickupProfileId'=p_profile_id::text) and c.status<>'CANCELLED' and c.started_at<p_end and coalesce(c.completed_at,now())>p_start
    union all
    select e.started_at,least(coalesce(e.ended_at,now()),p_end)
    from erp_supply.work_executions e join profile_ctx pc on pc.organization_id=e.organization_id
    where e.profile_id=p_profile_id and e.status<>'CANCELLED' and e.started_at<p_end and coalesce(e.ended_at,now())>p_start
  ),
  clipped as(select tstzrange(greatest(start_at,p_start),least(end_at,p_end),'[)') r from entries where greatest(start_at,p_start)<least(end_at,p_end)),
  merged as(select unnest(range_agg(r)) r from clipped)
  select coalesce(sum(erp_supply.business_seconds_between((select organization_id from profile_ctx),lower(r),upper(r))),0) from merged
$function$;

CREATE OR REPLACE FUNCTION public.erp_x_paco_snapshot()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'erp_supply', 'public', 'auth', 'pg_catalog'
AS $function$
declare
  v_actor uuid:=erp_supply.require_profile();
  v_org uuid:=erp_supply.current_org_id();
  v_roles text[]:=erp_supply.current_roles();
  v_manager boolean:=v_roles && array[
    'super_admin','gerencia','jefe_logistica','lider_logistica','coordinador_logistico'
  ]::text[];
begin
  return jsonb_build_object(
    'serverTime',now(),
    'managerScope',v_manager,

    'orders',(
      select coalesce(jsonb_agg(to_jsonb(x) order by x."ageBusinessSeconds" desc),'[]'::jsonb)
      from(
        select
          o.id,
          o.order_number "orderNumber",
          o.current_step_code "currentStep",
          s.name "stepName",
          o.status,
          p.display_name "assigneeName",
          greatest(0,erp_supply.business_seconds_between(v_org,o.updated_at,now())) "ageBusinessSeconds",
          (s.sla_hours is not null and erp_supply.business_seconds_between(v_org,o.updated_at,now())>s.sla_hours*3600) "slaExceeded",
          o.updated_at "updatedAt"
        from erp_supply.orders o
        join erp_supply.workflow_steps s on s.code=o.current_step_code
        left join erp_supply.profiles p on p.id=o.current_assignee_id
        where o.organization_id=v_org
          and not o.is_test
          and erp_supply.can_view_order(o.id)
          and (
            o.status not in('CLOSED','CANCELLED')
            or o.updated_at>=now()-interval '4 hours'
          )
        order by o.updated_at desc
        limit 120
      ) x
    ),

    'team',(
      case when not v_manager then '[]'::jsonb else (
        select coalesce(jsonb_agg(to_jsonb(x) order by x.name),'[]'::jsonb)
        from(
          select
            p.id,
            p.display_name name,
            array(select distinct pr.role_code from erp_supply.profile_roles pr where pr.profile_id=p.id order by pr.role_code) roles,
            erp_supply.workforce_special_treatment(p.id) "specialTreatment",
            case when erp_supply.workforce_special_treatment(p.id) then 'Tratamiento especial' else ae.title end "activeTitle",
            case when erp_supply.workforce_special_treatment(p.id) then null else ae.started_at end "activeStartedAt",
            case when erp_supply.workforce_special_treatment(p.id) then 'SPECIAL' else ae.status end "activeStatus",
            case when erp_supply.workforce_special_treatment(p.id) then 'SPECIAL' else ae.source end "activeSource",
            case
              when erp_supply.workforce_special_treatment(p.id) then 0
              when ae.started_at is not null
                then greatest(0,erp_supply.business_seconds_between(v_org,ae.started_at,now()))
              else 0
            end "activeBusinessSeconds",
            case when erp_supply.workforce_special_treatment(p.id) then null else le.ended_at end "lastEndedAt",
            case
              when erp_supply.workforce_special_treatment(p.id) then 0
              when ae.started_at is not null then 0
              else greatest(
                0,
                erp_supply.business_seconds_between(
                  v_org,
                  coalesce(
                    le.ended_at,
                    ((current_date::text||' 07:00:00')::timestamp at time zone
                      coalesce((select timezone from erp_supply.organizations where id=v_org),'America/Bogota'))
                  ),
                  now()
                )
              )
            end "idleBusinessSeconds"
          from erp_supply.profiles p
          left join lateral(
            select z.title,z.started_at,z.status,z.source
            from(
              select e.title_snapshot title,e.started_at,e.status,'ACTIVITY'::text source
              from erp_supply.work_executions e
              where e.organization_id=v_org
                and e.profile_id=p.id
                and e.status in('IN_PROGRESS','PAUSED')

              union all

              select
                'Pedido '||o.order_number||' · '||ws.name,
                s.started_at,
                'IN_PROGRESS'::text,
                'ORDER_TASK'::text
              from erp_supply.task_sessions s
              join erp_supply.order_tasks t on t.id=s.task_id
              join erp_supply.orders o on o.id=t.order_id
              join erp_supply.workflow_steps ws on ws.code=t.step_code
              where o.organization_id=v_org
                and not coalesce(o.is_test,false)
                and s.profile_id=p.id
                and s.ended_at is null

              union all

              select
                'Corte · '||coalesce(nullif(c.reference,''),nullif(c.sku,''),'Referencia'),
                c.started_at,
                case when c.status='PAUSED' then 'PAUSED' else 'IN_PROGRESS' end,
                'CUT_EXECUTION'::text
              from erp_supply.cut_executions c
              where c.organization_id=v_org
                and (c.started_by=p.id or c.metadata->>'cutPickupProfileId'=p.id::text)
                and c.completed_at is null
                and c.status not in('CANCELLED','COMPLETED')
            ) z
            order by z.started_at desc
            limit 1
          ) ae on not erp_supply.workforce_special_treatment(p.id)
          left join lateral(
            select max(z.ended_at) ended_at
            from(
              select e.ended_at
              from erp_supply.work_executions e
              where e.organization_id=v_org
                and e.profile_id=p.id
                and e.ended_at is not null
                and e.ended_at>=current_date::timestamp-interval '1 day'

              union all

              select s.ended_at
              from erp_supply.task_sessions s
              join erp_supply.order_tasks t on t.id=s.task_id
              join erp_supply.orders o on o.id=t.order_id
              where o.organization_id=v_org
                and s.profile_id=p.id
                and s.ended_at is not null
                and s.ended_at>=current_date::timestamp-interval '1 day'

              union all

              select c.completed_at
              from erp_supply.cut_executions c
              where c.organization_id=v_org
                and (c.started_by=p.id or c.metadata->>'cutPickupProfileId'=p.id::text)
                and c.completed_at is not null
                and c.completed_at>=current_date::timestamp-interval '1 day'
            ) z
          ) le on not erp_supply.workforce_special_treatment(p.id)
          where p.organization_id=v_org
            and p.active
            and exists(
              select 1
              from erp_supply.profile_roles pr
              where pr.profile_id=p.id
                and pr.role_code in('aux_logistica','auxiliar_corte')
            )
        ) x
      ) end
    ),

    'executions',(
      select coalesce(jsonb_agg(to_jsonb(x) order by x."startedAt" desc),'[]'::jsonb)
      from(
        select
          ('activity:'||e.id::text) id,
          e.profile_id "profileId",
          p.display_name "profileName",
          e.title_snapshot title,
          e.status,
          e.started_at "startedAt",
          e.ended_at "endedAt",
          coalesce(e.active_seconds,0) "activeSeconds",
          'ACTIVITY'::text source
        from erp_supply.work_executions e
        join erp_supply.profiles p on p.id=e.profile_id
        where e.organization_id=v_org
          and not erp_supply.workforce_special_treatment(e.profile_id)
          and e.started_at>=current_date::timestamp-interval '1 day'
          and (e.profile_id=v_actor or v_manager)

        union all

        select
          ('order-session:'||s.id::text) id,
          s.profile_id "profileId",
          p.display_name "profileName",
          'Pedido '||o.order_number||' · '||ws.name title,
          case when s.ended_at is null then 'IN_PROGRESS' else 'COMPLETED' end status,
          s.started_at "startedAt",
          s.ended_at "endedAt",
          case
            when s.ended_at is null then greatest(0,erp_supply.business_seconds_between(v_org,s.started_at,now()))
            else coalesce(s.business_seconds,0)
          end "activeSeconds",
          'ORDER_TASK'::text source
        from erp_supply.task_sessions s
        join erp_supply.order_tasks t on t.id=s.task_id
        join erp_supply.orders o on o.id=t.order_id
        join erp_supply.workflow_steps ws on ws.code=t.step_code
        join erp_supply.profiles p on p.id=s.profile_id
        where o.organization_id=v_org
          and not coalesce(o.is_test,false)
          and not erp_supply.workforce_special_treatment(s.profile_id)
          and s.started_at>=current_date::timestamp-interval '1 day'
          and (s.profile_id=v_actor or v_manager)
          and not (
            t.step_code='CORTE'
            and exists(
              select 1
              from erp_supply.cut_requirements cr
              join erp_supply.cut_execution_requirements cer on cer.cut_requirement_id=cr.id
              where cr.task_id=t.id
            )
          )

        union all

        select
          ('cut-execution:'||c.id::text) id,
          c.started_by "profileId",
          p.display_name "profileName",
          'Corte · '||coalesce(nullif(c.reference,''),nullif(c.sku,''),'Referencia') title,
          case
            when c.completed_at is not null or c.status='COMPLETED' then 'COMPLETED'
            when c.status='PAUSED' then 'PAUSED'
            else 'IN_PROGRESS'
          end status,
          c.started_at "startedAt",
          c.completed_at "endedAt",
          case
            when c.completed_at is null then greatest(0,erp_supply.business_seconds_between(v_org,c.started_at,now()))
            else greatest(0,erp_supply.business_seconds_between(v_org,c.started_at,c.completed_at))
          end "activeSeconds",
          'CUT_EXECUTION'::text source
        from erp_supply.cut_executions c
        join erp_supply.profiles p on p.id=c.started_by
        where c.organization_id=v_org
          and c.status<>'CANCELLED'
          and c.started_by is not null
          and not erp_supply.workforce_special_treatment(c.started_by)
          and c.started_at>=current_date::timestamp-interval '1 day'
          and (c.started_by=v_actor or v_manager)
        order by "startedAt" desc
        limit 160
      ) x
    ),

    'version','11.38.0'
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.erp_x_work_occupation(p_from date, p_to date, p_profile_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'erp_supply', 'public', 'auth', 'pg_catalog'
AS $function$
declare
  v_actor uuid:=erp_supply.require_profile();
  v_org uuid:=erp_supply.current_org_id();
  v_tz text:=coalesce((select timezone from erp_supply.organizations where id=v_org),'America/Bogota');
  v_from date:=coalesce(p_from,current_date);
  v_to date:=coalesce(p_to,v_from);
  v_start timestamptz:=(v_from::timestamp at time zone v_tz);
  v_end timestamptz:=((v_to+1)::timestamp at time zone v_tz);
  v_team_mode boolean:=p_profile_id is null and (
    erp_supply.has_role('super_admin')
    or erp_supply.has_role('auditoria')
    or erp_supply.has_role('jefe_logistica')
    or erp_supply.has_role('lider_logistica')
    or erp_supply.has_role('gerencia')
  );
  v_profile uuid:=coalesce(p_profile_id,v_actor);
  v_summary jsonb;
  v_team jsonb:='[]'::jsonb;
  v_sched bigint:=0;
  v_fixed bigint:=0;
  v_misc bigint:=0;
  v_total bigint:=0;
  v_overlap bigint:=0;
  v_unclassified bigint:=0;
begin
  if v_to<v_from or v_to-v_from>366 then
    raise exception 'Rango de ocupación inválido';
  end if;

  if v_team_mode then
    select
      coalesce(jsonb_agg(to_jsonb(x) order by x."occupationPct" desc,x.name),'[]'::jsonb),
      coalesce(sum(x."scheduledBusinessSeconds"),0),
      coalesce(sum(x."fixedProcessSeconds"),0),
      coalesce(sum(x."miscActivitySeconds"),0),
      coalesce(sum(x."classifiedSeconds"),0),
      coalesce(sum(x."overlapSeconds"),0),
      coalesce(sum(x."unclassifiedSeconds"),0)
    into v_team,v_sched,v_fixed,v_misc,v_total,v_overlap,v_unclassified
    from(
      select
        p.id,
        p.display_name name,
        array(
          select pr.role_code
          from erp_supply.profile_roles pr
          where pr.profile_id=p.id
          order by pr.role_code
        ) roles,
        (sm.metrics->>'scheduledBusinessSeconds')::bigint "scheduledBusinessSeconds",
        (sm.metrics->>'fixedProcessSeconds')::bigint "fixedProcessSeconds",
        (sm.metrics->>'miscActivitySeconds')::bigint "miscActivitySeconds",
        (sm.metrics->>'classifiedSeconds')::bigint "classifiedSeconds",
        (sm.metrics->>'overlapSeconds')::bigint "overlapSeconds",
        (sm.metrics->>'unclassifiedSeconds')::bigint "unclassifiedSeconds",
        (sm.metrics->>'occupationPct')::numeric "occupationPct",
        (sm.metrics->>'fixedPct')::numeric "fixedPct",
        (sm.metrics->>'miscPct')::numeric "miscPct"
      from erp_supply.profiles p
      cross join lateral (
        select erp_supply.work_profile_occupation_summary(p.id,v_start,v_end) metrics
      ) sm
      where p.organization_id=v_org
        and p.active
        and not erp_supply.workforce_special_treatment(p.id)
        and (
          erp_supply.has_role('auditoria')
          or erp_supply.has_role('super_admin')
          or erp_supply.can_manage_work_profile(p.id,'ACTIVITY')
          or erp_supply.can_manage_work_profile(p.id,'DELIVERABLE')
        )
    ) x;

    v_summary:=jsonb_build_object(
      'scheduledBusinessSeconds',v_sched,
      'fixedProcessSeconds',v_fixed,
      'miscActivitySeconds',v_misc,
      'classifiedSeconds',v_total,
      'overlapSeconds',v_overlap,
      'unclassifiedSeconds',v_unclassified,
      'occupationPct',case when v_sched=0 then 0 else round((100.0*v_total/v_sched)::numeric,1) end,
      'fixedPct',case when v_sched=0 then 0 else round((100.0*v_fixed/v_sched)::numeric,1) end,
      'miscPct',case when v_sched=0 then 0 else round((100.0*v_misc/v_sched)::numeric,1) end
    );

    return jsonb_build_object(
      'mode','TEAM',
      'from',v_from,
      'to',v_to,
      'summary',v_summary,
      'team',v_team,
      'fixedBreakdown','[]'::jsonb,
      'miscBreakdown','[]'::jsonb,
      'specialTreatmentExcluded',true,
      'version','11.38.0',
      'serverTime',now()
    );
  end if;

  if v_profile<>v_actor and not (
    erp_supply.has_role('super_admin')
    or erp_supply.has_role('auditoria')
    or erp_supply.can_manage_work_profile(v_profile,'ACTIVITY')
    or erp_supply.can_manage_work_profile(v_profile,'DELIVERABLE')
  ) then
    raise exception 'No autorizado para consultar esta ocupación' using errcode='42501';
  end if;

  if erp_supply.workforce_special_treatment(v_profile) then
    return jsonb_build_object(
      'mode','SPECIAL',
      'profileId',v_profile,
      'from',v_from,
      'to',v_to,
      'summary',jsonb_build_object(
        'specialTreatment',true,
        'specialTreatmentLabel','Tratamiento especial',
        'scheduledBusinessSeconds',0,
        'fixedProcessSeconds',0,
        'miscActivitySeconds',0,
        'classifiedSeconds',0,
        'overlapSeconds',0,
        'unclassifiedSeconds',0,
        'occupationPct',0,
        'fixedPct',0,
        'miscPct',0
      ),
      'team','[]'::jsonb,
      'fixedBreakdown','[]'::jsonb,
      'miscBreakdown','[]'::jsonb,
      'version','11.38.0',
      'serverTime',now()
    );
  end if;

  v_summary:=erp_supply.work_profile_occupation_summary(v_profile,v_start,v_end);

  return jsonb_build_object(
    'mode','PERSON',
    'profileId',v_profile,
    'from',v_from,
    'to',v_to,
    'summary',v_summary,
    'team','[]'::jsonb,
    'fixedBreakdown',(
      select coalesce(jsonb_agg(to_jsonb(x) order by x.seconds desc),'[]'::jsonb)
      from(
        select label,sum(seconds)::bigint seconds
        from(
          select
            ws.name label,
            coalesce(sum(
              erp_supply.business_seconds_between(
                v_org,
                greatest(s.started_at,v_start),
                least(coalesce(s.ended_at,now()),v_end)
              )
            ),0)::bigint seconds
          from erp_supply.task_sessions s
          join erp_supply.order_tasks t on t.id=s.task_id
          join erp_supply.orders o on o.id=t.order_id
          join erp_supply.workflow_steps ws on ws.code=t.step_code
          where s.profile_id=v_profile
            and o.organization_id=v_org
            and s.started_at<v_end
            and coalesce(s.ended_at,now())>v_start
          group by ws.name

          union all

          select
            'Corte por referencia',
            coalesce(sum(
              erp_supply.business_seconds_between(
                v_org,
                greatest(c.started_at,v_start),
                least(coalesce(c.completed_at,now()),v_end)
              )
            ),0)::bigint
          from erp_supply.cut_executions c
          where c.organization_id=v_org
            and (c.started_by=v_profile or c.metadata->>'cutPickupProfileId'=v_profile::text)
            and c.status<>'CANCELLED'
            and c.started_at<v_end
            and coalesce(c.completed_at,now())>v_start
        ) q
        group by label
      ) x
    ),
    'miscBreakdown',(
      select coalesce(jsonb_agg(to_jsonb(x) order by x.seconds desc),'[]'::jsonb)
      from(
        select
          c.activity_group "group",
          sum(
            erp_supply.business_seconds_between(
              v_org,
              greatest(e.started_at,v_start),
              least(coalesce(e.ended_at,now()),v_end)
            )
          )::bigint seconds,
          count(*)::integer executions
        from erp_supply.work_executions e
        join erp_supply.work_activity_catalog c on c.id=e.catalog_id
        where e.organization_id=v_org
          and e.profile_id=v_profile
          and e.status<>'CANCELLED'
          and e.started_at<v_end
          and coalesce(e.ended_at,now())>v_start
        group by c.activity_group
      ) x
    ),
    'version','11.38.0',
    'serverTime',now()
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.erp_x_work_operational_detail(p_task_session_id uuid DEFAULT NULL::uuid, p_cut_execution_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'erp_supply', 'public', 'auth', 'pg_catalog'
AS $function$
declare
  v_actor uuid:=erp_supply.require_profile();
  v_org uuid:=erp_supply.current_org_id();
  v_roles text[]:=erp_supply.current_roles();
  v_can_team boolean:=v_roles && array['jefe_logistica','lider_logistica','coordinador_logistico','gerencia','super_admin','auditoria']::text[];
  v_profile uuid;
  v_order uuid;
begin
  if p_task_session_id is null and p_cut_execution_id is null then
    raise exception 'No se recibió el proceso operativo';
  end if;

  if p_task_session_id is not null then
    select s.profile_id,o.id
    into v_profile,v_order
    from erp_supply.task_sessions s
    join erp_supply.order_tasks t on t.id=s.task_id
    join erp_supply.orders o on o.id=t.order_id
    where s.id=p_task_session_id
      and o.organization_id=v_org;

    if not found then raise exception 'Proceso operativo no disponible'; end if;

    if erp_supply.workforce_special_treatment(v_profile) then
      raise exception 'Perfil con tratamiento especial' using errcode='42501';
    end if;

    if not (
      v_profile=v_actor
      or (
        v_can_team
        and (
          'super_admin'=any(v_roles)
          or 'gerencia'=any(v_roles)
          or 'auditoria'=any(v_roles)
          or erp_supply.can_manage_work_profile(v_profile,'ACTIVITY')
        )
      )
    ) then
      raise exception 'No autorizado para consultar este proceso' using errcode='42501';
    end if;

    return (
      select jsonb_build_object(
        'type','ORDER_PROCESS',
        'sourceType','ORDER_TASK',
        'id',s.id,
        'taskSessionId',s.id,
        'orderTaskId',t.id,
        'orderId',o.id,
        'orderNumber',o.order_number,
        'stepCode',t.step_code,
        'stepName',ws.name,
        'title','Pedido '||o.order_number||' · '||ws.name,
        'description',coalesce(s.note,t.result_detail),
        'profileId',p.id,
        'profileName',p.display_name,
        'status',case
          when s.ended_at is null then 'IN_PROGRESS'
          when t.status in('WAITING','BLOCKED') then 'PAUSED'
          else 'COMPLETED'
        end,
        'processStatus',t.status,
        'orderStatus',o.status,
        'currentStep',o.current_step_code,
        'startedAt',s.started_at,
        'endedAt',s.ended_at,
        'activeSeconds',case
          when s.ended_at is null then greatest(0,erp_supply.business_seconds_between(v_org,s.started_at,now()))
          else coalesce(s.business_seconds,erp_supply.business_seconds_between(v_org,s.started_at,s.ended_at))
        end,
        'rawSeconds',coalesce(s.raw_seconds,0),
        'evidence','[]'::jsonb,
        'events',(
          select coalesce(jsonb_agg(to_jsonb(z) order by z."createdAt" desc),'[]'::jsonb)
          from(
            select
              e.id,
              e.action_code "actionCode",
              e.event_type "eventType",
              e.from_status "fromStatus",
              e.to_status "toStatus",
              e.created_at "createdAt",
              e.payload->>'detail' detail
            from erp_supply.order_events e
            where e.task_id=t.id
            order by e.created_at desc
            limit 12
          ) z
        ),
        'version','11.38.0'
      )
      from erp_supply.task_sessions s
      join erp_supply.order_tasks t on t.id=s.task_id
      join erp_supply.orders o on o.id=t.order_id
      join erp_supply.workflow_steps ws on ws.code=t.step_code
      join erp_supply.profiles p on p.id=s.profile_id
      where s.id=p_task_session_id
    );
  end if;

  select c.started_by
  into v_profile
  from erp_supply.cut_executions c
  where c.id=p_cut_execution_id
    and c.organization_id=v_org;

  if not found then raise exception 'Ejecución de Corte no disponible'; end if;

  if erp_supply.workforce_special_treatment(v_profile) then
    raise exception 'Perfil con tratamiento especial' using errcode='42501';
  end if;

  if not (
    v_profile=v_actor
    or exists(select 1 from erp_supply.cut_executions cx where cx.id=p_cut_execution_id and cx.metadata->>'cutPickupProfileId'=v_actor::text)
    or (
      v_can_team
      and (
        'super_admin'=any(v_roles)
        or 'gerencia'=any(v_roles)
        or 'auditoria'=any(v_roles)
        or erp_supply.can_manage_work_profile(v_profile,'ACTIVITY')
      )
    )
  ) then
    raise exception 'No autorizado para consultar esta ejecución' using errcode='42501';
  end if;

  return (
    select jsonb_build_object(
      'type','ORDER_PROCESS',
      'sourceType','CUT_EXECUTION',
      'cutPickupProfileId',c.metadata->>'cutPickupProfileId',
      'cutPickupProfileName',c.metadata->>'cutPickupProfileName',
      'id',c.id,
      'cutExecutionId',c.id,
      'orderId',ord.order_id,
      'orderNumber',ord.order_numbers,
      'stepCode','CORTE',
      'stepName','Corte',
      'title',case
        when coalesce(ord.order_count,0)=1 then 'Pedido '||coalesce(ord.order_numbers,'—')||' · Corte'
        when coalesce(ord.order_count,0)>1 then 'Corte · '||coalesce(nullif(c.reference,''),nullif(c.sku,''),'Referencia')||' · '||ord.order_count||' pedidos'
        else 'Corte · '||coalesce(nullif(c.reference,''),nullif(c.sku,''),'Referencia')
      end,
      'description',c.description,
      'profileId',p.id,
      'profileName',p.display_name,
      'status',case
        when c.completed_at is not null or c.status='COMPLETED' then 'COMPLETED'
        when c.status='PAUSED' then 'PAUSED'
        else 'IN_PROGRESS'
      end,
      'processStatus',c.status,
      'orderStatus',c.status,
      'currentStep','CORTE',
      'startedAt',c.started_at,
      'endedAt',c.completed_at,
      'activeSeconds',case
        when c.completed_at is null then greatest(0,erp_supply.business_seconds_between(v_org,c.started_at,now()))
        else greatest(0,erp_supply.business_seconds_between(v_org,c.started_at,c.completed_at))
      end,
      'evidence','[]'::jsonb,
      'events','[]'::jsonb,
      'version','11.38.0'
    )
    from erp_supply.cut_executions c
    join erp_supply.profiles p on p.id=c.started_by
    left join lateral(
      select
        count(distinct cer.order_id)::integer order_count,
        case when count(distinct cer.order_id)=1 then min(cer.order_id::text)::uuid else null end order_id,
        string_agg(distinct o.order_number,', ' order by o.order_number) order_numbers
      from erp_supply.cut_execution_requirements cer
      join erp_supply.orders o on o.id=cer.order_id
      where cer.execution_id=c.id
    ) ord on true
    where c.id=p_cut_execution_id
  );
end;
$function$;

-- Evitar que clientes antiguos inicien Corte omitiendo el selector obligatorio.
REVOKE EXECUTE ON FUNCTION public.erp_x_cutting_start(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.erp_x_cutting_pickup_pool() FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.erp_x_cutting_start_with_helper(text,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.erp_x_cutting_pickup_pool() TO authenticated;
GRANT EXECUTE ON FUNCTION public.erp_x_cutting_start_with_helper(text,uuid) TO authenticated;
