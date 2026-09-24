-- CRM Suministros V11.37.0
-- Snapshot operacional compacto para PACO.
-- Sin tablas ni índices nuevos: agrega únicamente un RPC de lectura acotado.
begin;

create or replace function public.erp_x_paco_snapshot()
returns jsonb
language plpgsql
stable
security definer
set search_path=erp_supply,public,auth,pg_catalog
as $paco_snapshot$
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
            array_agg(distinct pr.role_code order by pr.role_code) roles,
            ae.title_snapshot "activeTitle",
            ae.started_at "activeStartedAt",
            ae.status "activeStatus",
            case
              when ae.started_at is not null
                then greatest(0,erp_supply.business_seconds_between(v_org,ae.started_at,now()))
              else 0
            end "activeBusinessSeconds",
            le.ended_at "lastEndedAt",
            case
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
          join erp_supply.profile_roles pr on pr.profile_id=p.id
          left join lateral(
            select e.title_snapshot,e.started_at,e.status
            from erp_supply.work_executions e
            where e.organization_id=v_org
              and e.profile_id=p.id
              and e.status in('IN_PROGRESS','PAUSED')
            order by e.started_at desc
            limit 1
          ) ae on true
          left join lateral(
            select e.ended_at
            from erp_supply.work_executions e
            where e.organization_id=v_org
              and e.profile_id=p.id
              and e.ended_at is not null
              and e.ended_at>=current_date::timestamp-interval '1 day'
            order by e.ended_at desc
            limit 1
          ) le on true
          where p.organization_id=v_org
            and p.active
            and pr.role_code in('aux_logistica','auxiliar_corte')
          group by p.id,p.display_name,ae.title_snapshot,ae.started_at,ae.status,le.ended_at
        ) x
      ) end
    ),

    'executions',(
      select coalesce(jsonb_agg(to_jsonb(x) order by x."startedAt" desc),'[]'::jsonb)
      from(
        select
          e.id,
          e.profile_id "profileId",
          p.display_name "profileName",
          e.title_snapshot title,
          e.status,
          e.started_at "startedAt",
          e.ended_at "endedAt",
          coalesce(e.active_seconds,0) "activeSeconds"
        from erp_supply.work_executions e
        join erp_supply.profiles p on p.id=e.profile_id
        where e.organization_id=v_org
          and e.started_at>=current_date::timestamp-interval '1 day'
          and (
            e.profile_id=v_actor
            or v_manager
          )
        order by e.started_at desc
        limit 100
      ) x
    ),

    'version','11.37.0'
  );
end;
$paco_snapshot$;

revoke all on function public.erp_x_paco_snapshot() from public,anon;
grant execute on function public.erp_x_paco_snapshot() to authenticated;

comment on function public.erp_x_paco_snapshot()
is 'V11.37.0: snapshot operacional mínimo para PACO; pedidos visibles, auxiliares y ejecuciones recientes sin metadata pesada.';

notify pgrst,'reload schema';
commit;
