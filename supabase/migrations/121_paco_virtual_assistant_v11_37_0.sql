-- CRM Suministros V11.37.0
-- PACO: snapshot operativo compacto para asistente virtual proactivo.
-- Principios:
--   * cero tablas nuevas;
--   * cero escrituras por polling;
--   * una sola llamada para condiciones y eventos relevantes;
--   * tiempos calculados sobre jornada laboral real;
--   * payload acotado y filtrado por sesión/rol.
begin;

create or replace function public.erp_x_paco_snapshot(
  p_since timestamptz default null,
  p_limit integer default 30
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
  v_roles text[]:=erp_supply.current_roles();
  v_now timestamptz:=now();
  v_since timestamptz:=greatest(
    coalesce(p_since,now()-interval '2 minutes'),
    now()-interval '30 minutes'
  );
  v_limit integer:=least(greatest(coalesce(p_limit,30),1),40);
  v_manager boolean:=v_roles && array[
    'super_admin','gerencia','jefe_logistica','lider_logistica','coordinador_logistico'
  ]::text[];
  v_idle_seconds bigint:=20*60;
begin
  return jsonb_build_object(
    'serverTime',v_now,
    'pollAfterSeconds',60,
    'alerts',(
      with
      queue_candidates as (
        select
          'ORDER_QUEUE_LONG'::text kind,
          concat(
            'ORDER_QUEUE_LONG:',t.id,':',
            least(3,greatest(1,floor(
              erp_supply.business_seconds_between(
                v_org,coalesce(t.assigned_at,t.created_at),v_now
              )::numeric
              / greatest(coalesce((s.sla_hours*3600)::numeric,3600),1)
            )::int))
          ) alert_key,
          least(3,greatest(1,floor(
            erp_supply.business_seconds_between(
              v_org,coalesce(t.assigned_at,t.created_at),v_now
            )::numeric
            / greatest(coalesce((s.sla_hours*3600)::numeric,3600),1)
          )::int)) severity,
          coalesce(t.assigned_at,t.created_at) occurred_at,
          o.id order_id,
          o.order_number,
          null::uuid profile_id,
          coalesce(ap.display_name,'') person_name,
          t.assigned_role_code role_code,
          t.step_code,
          null::text activity_title,
          erp_supply.business_seconds_between(
            v_org,coalesce(t.assigned_at,t.created_at),v_now
          )::bigint age_seconds,
          greatest(coalesce((s.sla_hours*3600)::bigint,3600),60)::bigint expected_seconds,
          null::text issue_title,
          null::text issue_detail,
          coalesce(s.module_code,'orders') module_code
        from erp_supply.order_tasks t
        join erp_supply.orders o on o.id=t.order_id
        join erp_supply.workflow_steps s on s.code=t.step_code
        left join erp_supply.profiles ap on ap.id=t.assigned_profile_id
        where o.organization_id=v_org
          and not coalesce(o.is_test,false)
          and not coalesce(o.is_history,false)
          and o.status not in('CLOSED','CANCELLED')
          and t.status in('QUEUED','ASSIGNED')
          and erp_supply.can_view_order(o.id)
          and erp_supply.business_seconds_between(
            v_org,coalesce(t.assigned_at,t.created_at),v_now
          )>=greatest(coalesce((s.sla_hours*3600)::bigint,3600),60)
      ),
      auxiliary_profiles as (
        select
          p.id,
          p.display_name,
          case
            when bool_or(pr.role_code='auxiliar_corte') then 'auxiliar_corte'
            else 'aux_logistica'
          end role_code
        from erp_supply.profiles p
        join erp_supply.profile_roles pr on pr.profile_id=p.id
        where p.organization_id=v_org
          and p.active
          and not p.is_system
          and pr.role_code in('aux_logistica','auxiliar_corte')
          and (p.id=v_actor or v_manager)
        group by p.id,p.display_name
      ),
      auxiliary_last_touch as (
        select
          p.id,
          p.display_name,
          p.role_code,
          lt.last_touch
        from auxiliary_profiles p
        left join lateral(
          select max(x.ended_at) last_touch
          from(
            select e.ended_at
            from erp_supply.work_executions e
            where e.organization_id=v_org
              and e.profile_id=p.id
              and e.ended_at is not null
              and e.ended_at>=date_trunc('day',v_now)
            union all
            select ts.ended_at
            from erp_supply.task_sessions ts
            join erp_supply.order_tasks ot on ot.id=ts.task_id
            join erp_supply.orders oo on oo.id=ot.order_id
            where oo.organization_id=v_org
              and ts.profile_id=p.id
              and ts.ended_at is not null
              and ts.ended_at>=date_trunc('day',v_now)
          ) x
        ) lt on true
        where lt.last_touch is not null
          and not exists(
            select 1
            from erp_supply.work_executions e
            where e.organization_id=v_org
              and e.profile_id=p.id
              and e.status in('IN_PROGRESS','PAUSED')
          )
          and not exists(
            select 1
            from erp_supply.task_sessions ts
            join erp_supply.order_tasks ot on ot.id=ts.task_id
            join erp_supply.orders oo on oo.id=ot.order_id
            where oo.organization_id=v_org
              and ts.profile_id=p.id
              and ts.ended_at is null
          )
      ),
      idle_candidates as (
        select
          'AUX_IDLE'::text kind,
          concat(
            'AUX_IDLE:',p.id,':',
            least(3,greatest(1,floor(
              erp_supply.business_seconds_between(v_org,p.last_touch,v_now)::numeric
              / v_idle_seconds
            )::int))
          ) alert_key,
          least(3,greatest(1,floor(
            erp_supply.business_seconds_between(v_org,p.last_touch,v_now)::numeric
            / v_idle_seconds
          )::int)) severity,
          p.last_touch occurred_at,
          null::uuid order_id,
          null::text order_number,
          p.id profile_id,
          p.display_name person_name,
          p.role_code,
          null::text step_code,
          null::text activity_title,
          erp_supply.business_seconds_between(v_org,p.last_touch,v_now)::bigint age_seconds,
          v_idle_seconds expected_seconds,
          null::text issue_title,
          null::text issue_detail,
          'workforce'::text module_code
        from auxiliary_last_touch p
        where erp_supply.business_seconds_between(v_org,p.last_touch,v_now)>=v_idle_seconds
      ),
      active_activity as (
        select
          e.id,
          e.profile_id,
          p.display_name person_name,
          case
            when exists(
              select 1 from erp_supply.profile_roles pr
              where pr.profile_id=p.id and pr.role_code='auxiliar_corte'
            ) then 'auxiliar_corte'
            else 'aux_logistica'
          end role_code,
          e.title_snapshot,
          e.started_at,
          greatest(
            0,
            erp_supply.business_seconds_between(v_org,e.started_at,v_now)
            - coalesce(paused.business_seconds,0)
          )::bigint active_business_seconds,
          greatest(
            coalesce(a.estimated_minutes,c.standard_minutes,60)::bigint*60+900,
            round(coalesce(a.estimated_minutes,c.standard_minutes,60)::numeric*60*1.25)::bigint
          ) threshold_seconds
        from erp_supply.work_executions e
        join erp_supply.profiles p on p.id=e.profile_id
        join erp_supply.work_activity_catalog c on c.id=e.catalog_id
        left join erp_supply.work_assignments a on a.id=e.assignment_id
        left join lateral(
          select coalesce(sum(
            erp_supply.business_seconds_between(
              v_org,
              wp.started_at,
              least(coalesce(wp.ended_at,v_now),v_now)
            )
          ),0)::bigint business_seconds
          from erp_supply.work_execution_pauses wp
          where wp.execution_id=e.id
        ) paused on true
        where e.organization_id=v_org
          and e.status='IN_PROGRESS'
          and (
            e.profile_id=v_actor
            or (
              v_manager
              and exists(
                select 1
                from erp_supply.profile_roles pr
                where pr.profile_id=e.profile_id
                  and pr.role_code in('aux_logistica','auxiliar_corte')
              )
            )
          )
      ),
      activity_long_candidates as (
        select
          'ACTIVITY_LONG'::text kind,
          concat(
            'ACTIVITY_LONG:',a.id,':',
            least(3,greatest(1,floor(
              a.active_business_seconds::numeric/greatest(a.threshold_seconds,1)
            )::int))
          ) alert_key,
          least(3,greatest(1,floor(
            a.active_business_seconds::numeric/greatest(a.threshold_seconds,1)
          )::int)) severity,
          a.started_at occurred_at,
          null::uuid order_id,
          null::text order_number,
          a.profile_id,
          a.person_name,
          a.role_code,
          null::text step_code,
          a.title_snapshot activity_title,
          a.active_business_seconds age_seconds,
          a.threshold_seconds expected_seconds,
          null::text issue_title,
          null::text issue_detail,
          'workforce'::text module_code
        from active_activity a
        where a.active_business_seconds>=a.threshold_seconds
      ),
      completed_activity_candidates as (
        select
          'ACTIVITY_DONE'::text kind,
          concat('ACTIVITY_DONE:',e.id) alert_key,
          1 severity,
          e.ended_at occurred_at,
          null::uuid order_id,
          null::text order_number,
          e.profile_id,
          p.display_name person_name,
          coalesce((
            select case
              when bool_or(pr.role_code='auxiliar_corte') then 'auxiliar_corte'
              when bool_or(pr.role_code='aux_logistica') then 'aux_logistica'
              else null
            end
            from erp_supply.profile_roles pr
            where pr.profile_id=e.profile_id
          ),'') role_code,
          null::text step_code,
          e.title_snapshot activity_title,
          greatest(0,coalesce(e.active_seconds,0))::bigint age_seconds,
          null::bigint expected_seconds,
          null::text issue_title,
          null::text issue_detail,
          'workforce'::text module_code
        from erp_supply.work_executions e
        join erp_supply.profiles p on p.id=e.profile_id
        where e.organization_id=v_org
          and e.status='COMPLETED'
          and e.ended_at>=v_since
          and (
            e.profile_id=v_actor
            or (
              v_manager
              and exists(
                select 1
                from erp_supply.profile_roles pr
                where pr.profile_id=e.profile_id
                  and pr.role_code in('aux_logistica','auxiliar_corte')
              )
            )
          )
      ),
      dispatch_candidates as (
        select
          'ORDER_DISPATCHED'::text kind,
          concat('ORDER_DISPATCHED:',d.id,':',extract(epoch from d.dispatched_at)::bigint) alert_key,
          1 severity,
          d.dispatched_at occurred_at,
          o.id order_id,
          o.order_number,
          null::uuid profile_id,
          null::text person_name,
          null::text role_code,
          o.current_step_code step_code,
          null::text activity_title,
          null::bigint age_seconds,
          null::bigint expected_seconds,
          null::text issue_title,
          null::text issue_detail,
          'shipping'::text module_code
        from erp_supply.deliveries d
        join erp_supply.orders o on o.id=d.order_id
        where o.organization_id=v_org
          and not coalesce(o.is_test,false)
          and d.dispatched_at is not null
          and d.dispatched_at>=v_since
          and erp_supply.can_view_order(o.id)
      ),
      issue_candidates as (
        select
          'ORDER_ISSUE'::text kind,
          concat('ORDER_ISSUE:',i.id) alert_key,
          case when i.blocking then 3 when i.issue_type='REPORT' then 2 else 1 end severity,
          i.created_at occurred_at,
          o.id order_id,
          o.order_number,
          null::uuid profile_id,
          cp.display_name person_name,
          i.target_role_code role_code,
          o.current_step_code step_code,
          null::text activity_title,
          null::bigint age_seconds,
          null::bigint expected_seconds,
          i.title issue_title,
          left(i.detail,220) issue_detail,
          'approvals'::text module_code
        from erp_supply.order_issues i
        join erp_supply.orders o on o.id=i.order_id
        left join erp_supply.profiles cp on cp.id=i.created_by
        where i.organization_id=v_org
          and i.status='OPEN'
          and i.issue_type in('NOVELTY','REPORT')
          and i.created_at>=v_since
          and not coalesce(o.is_test,false)
          and erp_supply.can_view_order(o.id)
      ),
      alerts as (
        select * from queue_candidates
        union all select * from idle_candidates
        union all select * from activity_long_candidates
        union all select * from completed_activity_candidates
        union all select * from dispatch_candidates
        union all select * from issue_candidates
      ),
      ranked as (
        select *
        from alerts
        order by severity desc,occurred_at desc
        limit v_limit
      )
      select coalesce(
        jsonb_agg(
          jsonb_strip_nulls(jsonb_build_object(
            'kind',kind,
            'key',alert_key,
            'severity',severity,
            'occurredAt',occurred_at,
            'orderId',order_id,
            'orderNumber',order_number,
            'profileId',profile_id,
            'personName',nullif(person_name,''),
            'roleCode',nullif(role_code,''),
            'stepCode',step_code,
            'activityTitle',activity_title,
            'ageSeconds',age_seconds,
            'expectedSeconds',expected_seconds,
            'issueTitle',issue_title,
            'issueDetail',issue_detail,
            'module',module_code
          ))
          order by severity desc,occurred_at desc
        ),
        '[]'::jsonb
      )
      from ranked
    ),
    'version','11.37.0'
  );
end;
$$;

revoke all on function public.erp_x_paco_snapshot(timestamptz,integer) from public,anon;
grant execute on function public.erp_x_paco_snapshot(timestamptz,integer) to authenticated;

comment on function public.erp_x_paco_snapshot(timestamptz,integer)
is 'V11.37.0: snapshot compacto, sin escrituras, para alertas PACO de colas, auxiliares, actividades, despachos y novedades.';

notify pgrst,'reload schema';
commit;
