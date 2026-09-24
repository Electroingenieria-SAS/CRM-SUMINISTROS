-- CRM Suministros V11.38.0
-- Excluye perfiles con tratamiento especial de métricas agregadas.
-- No crea tablas ni índices.
begin;

create or replace function public.erp_x_work_occupation(
  p_from date,
  p_to date,
  p_profile_id uuid default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path=erp_supply,public,auth,pg_catalog
as $$
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
            and c.started_by=v_profile
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
$$;

revoke all on function public.erp_x_work_occupation(date,date,uuid) from public,anon;
grant execute on function public.erp_x_work_occupation(date,date,uuid) to authenticated;

comment on function public.erp_x_work_occupation(date,date,uuid)
is 'V11.38.0: ocupación unificada de procesos ERP y actividades; excluye perfiles con tratamiento especial de agregados y devuelve modo SPECIAL en consulta individual.';

notify pgrst,'reload schema';
commit;
