-- CRM Suministros V11.38.2
-- Responsable visible = persona que toma/ejecuta la etapa actual.
-- Vendedor visible = seller_profile_id original del pedido.
-- No crea tablas ni índices.
begin;

create or replace function erp_supply.sync_task_session_responsible()
returns trigger
language plpgsql
security definer
set search_path=erp_supply,public,auth,pg_catalog
as $$
declare
  v_task erp_supply.order_tasks%rowtype;
begin
  select *
  into v_task
  from erp_supply.order_tasks
  where id=new.task_id;

  if not found then
    return new;
  end if;

  update erp_supply.order_tasks
  set assigned_profile_id=new.profile_id,
      assigned_at=case
        when assigned_profile_id is distinct from new.profile_id then new.started_at
        else coalesce(assigned_at,new.started_at)
      end
  where id=new.task_id;

  update erp_supply.orders
  set current_assignee_id=new.profile_id,
      current_role_code=coalesce(v_task.assigned_role_code,current_role_code),
      updated_at=greatest(updated_at,new.started_at)
  where id=v_task.order_id
    and current_step_code=v_task.step_code
    and status not in('CLOSED','CANCELLED');

  return new;
end;
$$;

revoke all on function erp_supply.sync_task_session_responsible() from public,anon;

drop trigger if exists trg_task_session_responsible on erp_supply.task_sessions;
create trigger trg_task_session_responsible
after insert on erp_supply.task_sessions
for each row execute function erp_supply.sync_task_session_responsible();

create or replace function public.erp_x_list_orders(
  p_search text default null,
  p_step text default null,
  p_status text default null,
  p_order_type text default null,
  p_route text default null,
  p_assignment text default 'ALL',
  p_page integer default 1,
  p_page_size integer default 50,
  p_include_history boolean default true
)
returns jsonb
language plpgsql
stable
security definer
set search_path=erp_supply,public,auth,pg_catalog
as $$
declare
  v_org uuid:=erp_supply.current_org_id();
  v_profile uuid:=erp_supply.require_profile();
  v_page int:=greatest(coalesce(p_page,1),1);
  v_size int:=least(greatest(coalesce(p_page_size,50),1),250);
  v_total bigint;
  v_items jsonb;
begin
  with filtered as(
    select
      o.*,
      s.name step_name,
      s.sla_hours,
      at.assigned_profile_id effective_assignee_id,
      at.assigned_role_code effective_role_code,
      rp.display_name assignee_name,
      sp.display_name seller_name,
      erp_supply.business_seconds_between(v_org,o.updated_at,now()) age_business_seconds,
      pa.status arrival_status,
      o.metadata#>>'{exceptionState,label}' exception_label,
      (
        select count(*)
        from erp_supply.order_issues oi
        where oi.order_id=o.id and oi.blocking and oi.status='OPEN'
      ) open_issue_count
    from erp_supply.orders o
    join erp_supply.workflow_steps s on s.code=o.current_step_code
    left join lateral(
      select t.assigned_profile_id,t.assigned_role_code,t.status,t.sequence_no
      from erp_supply.order_tasks t
      where t.order_id=o.id
        and t.step_code=o.current_step_code
        and t.status in('QUEUED','ASSIGNED','IN_PROGRESS','WAITING','BLOCKED')
      order by t.sequence_no desc,t.created_at desc
      limit 1
    ) at on true
    left join erp_supply.profiles rp on rp.id=at.assigned_profile_id
    left join erp_supply.profiles sp on sp.id=o.seller_profile_id
    left join erp_supply.purchase_arrival_state pa on pa.order_id=o.id
    where o.organization_id=v_org
      and not o.is_test
      and erp_supply.can_view_order(o.id)
      and (p_include_history or not o.is_history)
      and (
        p_search is null or p_search=''
        or lower(o.order_number||' '||o.client_name||' '||coalesce(o.external_reference,'')) like '%'||lower(p_search)||'%'
      )
      and (p_step is null or p_step='' or o.current_step_code=p_step)
      and (p_status is null or p_status='' or o.status=p_status)
      and (p_order_type is null or p_order_type='' or o.order_type_code=p_order_type)
      and (p_route is null or p_route='' or o.delivery_route_code=p_route)
      and (
        upper(coalesce(p_assignment,'ALL'))='ALL'
        or (upper(p_assignment)='MINE' and at.assigned_profile_id=v_profile)
        or (upper(p_assignment)='UNASSIGNED' and at.assigned_profile_id is null)
      )
  )
  select count(*) into v_total from filtered;

  with filtered as(
    select
      o.*,
      s.name step_name,
      s.sla_hours,
      at.assigned_profile_id effective_assignee_id,
      at.assigned_role_code effective_role_code,
      rp.display_name assignee_name,
      sp.display_name seller_name,
      erp_supply.business_seconds_between(v_org,o.updated_at,now()) age_business_seconds,
      pa.status arrival_status,
      o.metadata#>>'{exceptionState,label}' exception_label,
      (
        select count(*)
        from erp_supply.order_issues oi
        where oi.order_id=o.id and oi.blocking and oi.status='OPEN'
      ) open_issue_count
    from erp_supply.orders o
    join erp_supply.workflow_steps s on s.code=o.current_step_code
    left join lateral(
      select t.assigned_profile_id,t.assigned_role_code,t.status,t.sequence_no
      from erp_supply.order_tasks t
      where t.order_id=o.id
        and t.step_code=o.current_step_code
        and t.status in('QUEUED','ASSIGNED','IN_PROGRESS','WAITING','BLOCKED')
      order by t.sequence_no desc,t.created_at desc
      limit 1
    ) at on true
    left join erp_supply.profiles rp on rp.id=at.assigned_profile_id
    left join erp_supply.profiles sp on sp.id=o.seller_profile_id
    left join erp_supply.purchase_arrival_state pa on pa.order_id=o.id
    where o.organization_id=v_org
      and not o.is_test
      and erp_supply.can_view_order(o.id)
      and (p_include_history or not o.is_history)
      and (
        p_search is null or p_search=''
        or lower(o.order_number||' '||o.client_name||' '||coalesce(o.external_reference,'')) like '%'||lower(p_search)||'%'
      )
      and (p_step is null or p_step='' or o.current_step_code=p_step)
      and (p_status is null or p_status='' or o.status=p_status)
      and (p_order_type is null or p_order_type='' or o.order_type_code=p_order_type)
      and (p_route is null or p_route='' or o.delivery_route_code=p_route)
      and (
        upper(coalesce(p_assignment,'ALL'))='ALL'
        or (upper(p_assignment)='MINE' and at.assigned_profile_id=v_profile)
        or (upper(p_assignment)='UNASSIGNED' and at.assigned_profile_id is null)
      )
    order by
      case o.priority when 'CRITICAL' then 1 when 'URGENT' then 2 when 'HIGH' then 3 when 'MEDIUM' then 4 else 5 end,
      o.updated_at desc
    offset (v_page-1)*v_size
    limit v_size
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',id,
    'orderNumber',order_number,
    'externalReference',external_reference,
    'orderType',order_type_code,
    'clientName',client_name,
    'paymentCondition',payment_condition_code,
    'route',delivery_route_code,
    'currentStep',current_step_code,
    'stepName',step_name,
    'status',status,
    'priority',priority,
    'requiresCut',requires_cut,
    'requiresPurchase',requires_purchase,
    'assigneeId',effective_assignee_id,
    'assigneeName',assignee_name,
    'roleCode',effective_role_code,
    'sellerId',seller_profile_id,
    'sellerName',seller_name,
    'ageBusinessSeconds',age_business_seconds,
    'slaExceeded',(sla_hours is not null and age_business_seconds>sla_hours*3600),
    'version',version,
    'isHistory',is_history,
    'createdAt',created_at,
    'updatedAt',updated_at,
    'fulfillmentStatus',metadata#>>'{fulfillment,status}',
    'partialLabel',coalesce((metadata#>>'{fulfillment,partialLabel}')::boolean,false),
    'pendingItemCount',coalesce(erp_supply.safe_integer(metadata#>>'{fulfillment,pendingItemCount}'),0),
    'pickingRoundCount',coalesce(erp_supply.safe_integer(metadata#>>'{fulfillment,roundCount}'),0),
    'exceptionLabel',exception_label,
    'openIssueCount',open_issue_count,
    'purchaseShadow',false,
    'arrivalStatus',arrival_status
  )),'[]'::jsonb)
  into v_items
  from filtered;

  return jsonb_build_object(
    'items',v_items,
    'pagination',jsonb_build_object(
      'page',v_page,
      'pageSize',v_size,
      'totalItems',v_total,
      'totalPages',ceil(v_total::numeric/v_size)::int
    ),
    'generatedAt',now(),
    'version','11.38.2'
  );
end;
$$;

revoke all on function public.erp_x_list_orders(text,text,text,text,text,text,integer,integer,boolean) from public,anon;
grant execute on function public.erp_x_list_orders(text,text,text,text,text,text,integer,integer,boolean) to authenticated;

create or replace function public.erp_x_get_order(p_order_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path=erp_supply,public,auth,pg_catalog
as $$
declare
  v_org uuid:=erp_supply.current_org_id();
  v_order erp_supply.orders%rowtype;
  v_seller_name text;
  v_responsible_name text;
  v_responsible_id uuid;
begin
  perform erp_supply.require_profile();

  select *
  into v_order
  from erp_supply.orders
  where id=p_order_id
    and organization_id=v_org
    and erp_supply.can_view_order(id);

  if not found then
    raise exception 'Pedido no encontrado';
  end if;

  select p.display_name
  into v_seller_name
  from erp_supply.profiles p
  where p.id=v_order.seller_profile_id;

  select t.assigned_profile_id,p.display_name
  into v_responsible_id,v_responsible_name
  from erp_supply.order_tasks t
  left join erp_supply.profiles p on p.id=t.assigned_profile_id
  where t.order_id=v_order.id
    and t.step_code=v_order.current_step_code
    and t.status in('QUEUED','ASSIGNED','IN_PROGRESS','WAITING','BLOCKED')
  order by t.sequence_no desc,t.created_at desc
  limit 1;

  return jsonb_build_object(
    'order',
      to_jsonb(v_order)||jsonb_build_object(
        'sellerName',v_seller_name,
        'currentResponsibleId',v_responsible_id,
        'currentResponsibleName',v_responsible_name
      ),
    'items',(
      select coalesce(jsonb_agg(to_jsonb(i) order by line_number),'[]'::jsonb)
      from erp_supply.order_items i
      where i.order_id=p_order_id
        and coalesce(i.metadata->>'receptionActive','true')<>'false'
    ),
    'tasks',(
      select coalesce(
        jsonb_agg(
          to_jsonb(t)||jsonb_build_object('assignedName',p.display_name)
          order by t.sequence_no
        ),
        '[]'::jsonb
      )
      from erp_supply.order_tasks t
      left join erp_supply.profiles p on p.id=t.assigned_profile_id
      where t.order_id=p_order_id
    ),
    'sessions',(
      select coalesce(jsonb_agg(
        to_jsonb(s)||jsonb_build_object('profileName',p.display_name)
        order by s.started_at
      ),'[]'::jsonb)
      from erp_supply.task_sessions s
      join erp_supply.order_tasks t on t.id=s.task_id
      left join erp_supply.profiles p on p.id=s.profile_id
      where t.order_id=p_order_id
    ),
    'checklist',(
      select coalesce(jsonb_agg(to_jsonb(c) order by c.sort_order),'[]'::jsonb)
      from erp_supply.task_checklist c
      join erp_supply.order_tasks t on t.id=c.task_id
      where t.order_id=p_order_id
    ),
    'events',(
      select coalesce(jsonb_agg(jsonb_build_object(
        'id',e.id,
        'eventType',e.event_type,
        'actionCode',e.action_code,
        'fromStep',e.from_step_code,
        'toStep',e.to_step_code,
        'fromStatus',e.from_status,
        'toStatus',e.to_status,
        'actorName',p.display_name,
        'actorRole',e.actor_role_code,
        'payload',e.payload,
        'createdAt',e.created_at
      ) order by e.created_at),'[]'::jsonb)
      from erp_supply.order_events e
      left join erp_supply.profiles p on p.id=e.actor_profile_id
      where e.order_id=p_order_id
    ),
    'comments',(
      select coalesce(jsonb_agg(jsonb_build_object(
        'id',c.id,'type',c.comment_type,'visibility',c.visibility,'body',c.body,
        'metadata',c.metadata,'author',p.display_name,'createdAt',c.created_at
      ) order by c.created_at),'[]'::jsonb)
      from erp_supply.order_comments c
      join erp_supply.profiles p on p.id=c.author_profile_id
      where c.order_id=p_order_id
    ),
    'approvals',(
      select coalesce(jsonb_agg(to_jsonb(a) order by a.created_at),'[]'::jsonb)
      from erp_supply.approval_requests a where a.order_id=p_order_id
    ),
    'files',(
      select coalesce(jsonb_agg(to_jsonb(f) order by f.created_at),'[]'::jsonb)
      from erp_supply.drive_files f where f.order_id=p_order_id
    ),
    'purchaseOrders',(
      select coalesce(jsonb_agg(to_jsonb(po) order by po.created_at),'[]'::jsonb)
      from erp_supply.purchase_orders po where po.order_id=p_order_id
    ),
    'financialValidations',(
      select coalesce(jsonb_agg(to_jsonb(fv) order by fv.created_at),'[]'::jsonb)
      from erp_supply.financial_validations fv where fv.order_id=p_order_id
    ),
    'receipts',(
      select coalesce(jsonb_agg(to_jsonb(r) order by r.created_at),'[]'::jsonb)
      from erp_supply.receipts r where r.order_id=p_order_id
    ),
    'cutJobs',(
      select coalesce(jsonb_agg(to_jsonb(c) order by c.created_at),'[]'::jsonb)
      from erp_supply.cut_jobs c where c.order_id=p_order_id
    ),
    'cutRequirements',(
      select coalesce(jsonb_agg(to_jsonb(r) order by i.line_number),'[]'::jsonb)
      from erp_supply.cut_requirements r
      join erp_supply.order_items i on i.id=r.order_item_id
      where r.order_id=p_order_id
    ),
    'cutBatches',(
      select coalesce(jsonb_agg(to_jsonb(b) order by b.executed_at),'[]'::jsonb)
      from erp_supply.cut_batches b
      where exists(
        select 1 from erp_supply.cut_requirements r
        where r.cut_batch_id=b.id and r.order_id=p_order_id
      )
    ),
    'invoices',(
      select coalesce(jsonb_agg(to_jsonb(i) order by i.created_at),'[]'::jsonb)
      from erp_supply.invoices i where i.order_id=p_order_id
    ),
    'deliveries',(
      select coalesce(jsonb_agg(to_jsonb(d) order by d.created_at),'[]'::jsonb)
      from erp_supply.deliveries d where d.order_id=p_order_id
    ),
    'deliveryMilestones',(
      select coalesce(jsonb_agg(jsonb_build_object(
        'id',m.id,'code',m.milestone_code,'occurredAt',m.occurred_at,
        'actorName',p.display_name,'metadata',m.metadata
      ) order by m.occurred_at),'[]'::jsonb)
      from erp_supply.delivery_milestones m
      left join erp_supply.profiles p on p.id=m.actor_profile_id
      where m.order_id=p_order_id
    ),
    'deliveryTimeTrace',(
      select jsonb_build_object(
        'dispatchBusinessSeconds',coalesce(sum(t.business_seconds) filter(where t.step_code in('CLIENT_POINT','CLIENT_PICKUP','LOCAL_DISPATCH','NATIONAL_DISPATCH')),0),
        'dispatchElapsedSeconds',coalesce(sum(t.raw_seconds) filter(where t.step_code in('CLIENT_POINT','CLIENT_PICKUP','LOCAL_DISPATCH','NATIONAL_DISPATCH')),0),
        'dispatchQueueBusinessSeconds',coalesce(sum(erp_supply.business_seconds_between(v_org,t.created_at,coalesce(t.started_at,t.completed_at,now()))) filter(where t.step_code in('CLIENT_POINT','CLIENT_PICKUP','LOCAL_DISPATCH','NATIONAL_DISPATCH')),0),
        'closureBusinessSeconds',coalesce(sum(t.business_seconds) filter(where t.step_code='CLOSURE'),0),
        'closureElapsedSeconds',coalesce(sum(t.raw_seconds) filter(where t.step_code='CLOSURE'),0),
        'closureQueueBusinessSeconds',coalesce(sum(erp_supply.business_seconds_between(v_org,t.created_at,coalesce(t.started_at,t.completed_at,now()))) filter(where t.step_code='CLOSURE'),0),
        'transitBusinessSeconds',coalesce((select erp_supply.business_seconds_between(v_org,d.dispatched_at,coalesce(d.delivered_at,now())) from erp_supply.deliveries d where d.order_id=p_order_id and d.dispatched_at is not null order by d.created_at desc limit 1),0),
        'transitElapsedSeconds',coalesce((select greatest(0,extract(epoch from(coalesce(d.delivered_at,now())-d.dispatched_at))::bigint) from erp_supply.deliveries d where d.order_id=p_order_id and d.dispatched_at is not null order by d.created_at desc limit 1),0),
        'productiveBusinessSeconds',coalesce(sum(t.business_seconds),0),
        'flowBusinessSeconds',erp_supply.business_seconds_between(v_org,v_order.created_at,coalesce(v_order.closed_at,now())),
        'totalElapsedSeconds',greatest(0,extract(epoch from(coalesce(v_order.closed_at,now())-v_order.created_at))::bigint),
        'deadBusinessSeconds',greatest(0,erp_supply.business_seconds_between(v_org,v_order.created_at,coalesce(v_order.closed_at,now()))-coalesce(sum(t.business_seconds),0)),
        'deadTimeSeconds',greatest(0,erp_supply.business_seconds_between(v_org,v_order.created_at,coalesce(v_order.closed_at,now()))-coalesce(sum(t.business_seconds),0))
      )
      from erp_supply.order_tasks t
      where t.order_id=p_order_id
    ),
    'pickingRounds',(
      select coalesce(jsonb_agg(to_jsonb(r) order by r.round_no),'[]'::jsonb)
      from erp_supply.picking_rounds r where r.order_id=p_order_id
    ),
    'pickingRoundItems',(
      select coalesce(jsonb_agg(to_jsonb(ri) order by r.round_no,i.line_number),'[]'::jsonb)
      from erp_supply.picking_round_items ri
      join erp_supply.picking_rounds r on r.id=ri.picking_round_id
      join erp_supply.order_items i on i.id=ri.order_item_id
      where r.order_id=p_order_id
    ),
    'actions',public.erp_x_get_actions(p_order_id),
    'version','11.38.2'
  );
end;
$$;

revoke all on function public.erp_x_get_order(uuid) from public,anon;
grant execute on function public.erp_x_get_order(uuid) to authenticated;

comment on function erp_supply.sync_task_session_responsible()
is 'V11.38.2: sincroniza responsable efectivo del paso con el usuario que inicia/reanuda una sesión real de trabajo.';

comment on function public.erp_x_list_orders(text,text,text,text,text,text,integer,integer,boolean)
is 'V11.38.2: lista pedidos con responsable derivado de la tarea activa y vendedor original del pedido.';

comment on function public.erp_x_get_order(uuid)
is 'V11.38.2: detalle enriquecido con responsable actual, vendedor y nombres de asignación/sesión.';

notify pgrst,'reload schema';
commit;
