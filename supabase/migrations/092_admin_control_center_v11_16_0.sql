-- CRM Suministros V11.16.0
-- Centro de Control Administrativo: lectura consolidada, configuracion segura y auditoria.

create or replace function public.erp_x_admin_control_center()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_profile uuid;
  v_org uuid;
  v_can_admin boolean;
begin
  v_profile := erp_supply.require_profile();
  v_org := erp_supply.current_org_id();
  if not erp_supply.can_access_module('admin','read') then
    raise exception 'No tienes permiso para consultar Administración' using errcode='42501';
  end if;
  v_can_admin := erp_supply.can_access_module('admin','admin');

  return jsonb_build_object(
    'generatedAt', now(),
    'capabilities', jsonb_build_object('canAdmin',v_can_admin,'profileId',v_profile),
    'organization', (
      select jsonb_build_object('id',o.id,'code',o.code,'name',o.name,'timezone',o.timezone,'active',o.active,'settings',coalesce(o.settings,'{}'::jsonb))
      from erp_supply.organizations o where o.id=v_org
    ),
    'counts', jsonb_build_object(
      'profiles',(select count(*) from erp_supply.profiles p where p.organization_id=v_org),
      'activeProfiles',(select count(*) from erp_supply.profiles p where p.organization_id=v_org and p.active),
      'roles',(select count(*) from erp_supply.roles r where r.active),
      'modules',(select count(*) from erp_supply.modules m where m.active),
      'steps',(select count(*) from erp_supply.workflow_steps s where s.active),
      'holidays',(select count(*) from erp_supply.holidays h where h.organization_id=v_org),
      'activities',(select count(*) from erp_supply.work_activity_catalog a where a.organization_id=v_org and a.active),
      'openOrders',(select count(*) from erp_supply.orders o where o.organization_id=v_org and o.status not in ('CLOSED','CANCELLED')),
      'openIssues',(select count(*) from erp_supply.order_issues i join erp_supply.orders o on o.id=i.order_id where o.organization_id=v_org and i.status not in ('RESOLVED','CLOSED'))
    ),
    'modules',(
      select coalesce(jsonb_agg(jsonb_build_object(
        'code',m.code,'name',m.name,'description',m.description,'icon',m.icon,'sortOrder',m.sort_order,'active',m.active
      ) order by m.sort_order,m.code),'[]'::jsonb) from erp_supply.modules m
    ),
    'roles',(
      select coalesce(jsonb_agg(jsonb_build_object(
        'code',r.code,'name',r.name,'description',r.description,'systemRole',r.system_role,'active',r.active,
        'userCount',(select count(*) from erp_supply.profile_roles pr join erp_supply.profiles p on p.id=pr.profile_id where pr.role_code=r.code and p.organization_id=v_org and p.active)
      ) order by r.name,r.code),'[]'::jsonb) from erp_supply.roles r
    ),
    'permissions',(
      select coalesce(jsonb_agg(jsonb_build_object(
        'roleCode',p.role_code,'moduleCode',p.module_code,'canRead',p.can_read,'canCreate',p.can_create,'canUpdate',p.can_update,'canApprove',p.can_approve,'canAdmin',p.can_admin
      ) order by p.role_code,p.module_code),'[]'::jsonb) from erp_supply.role_module_permissions p
    ),
    'workflow',jsonb_build_object(
      'steps',(
        select coalesce(jsonb_agg(jsonb_build_object(
          'code',s.code,'name',s.name,'moduleCode',s.module_code,'queueCode',s.queue_code,'slaHours',s.sla_hours,'sortOrder',s.sort_order,'terminal',s.terminal,'active',s.active,'metadata',coalesce(s.metadata,'{}'::jsonb),
          'openTasks',(select count(*) from erp_supply.order_tasks t join erp_supply.orders o on o.id=t.order_id where o.organization_id=v_org and t.step_code=s.code and t.status in ('QUEUED','ASSIGNED','IN_PROGRESS','WAITING','BLOCKED'))
        ) order by s.sort_order,s.code),'[]'::jsonb) from erp_supply.workflow_steps s
      ),
      'stepRoles',(
        select coalesce(jsonb_agg(jsonb_build_object(
          'stepCode',sr.step_code,'roleCode',sr.role_code,'canView',sr.can_view,'canClaim',sr.can_claim,'canAssign',sr.can_assign,'canStart',sr.can_start,'canComplete',sr.can_complete,'canBlock',sr.can_block,'canOverride',sr.can_override
        ) order by sr.step_code,sr.role_code),'[]'::jsonb) from erp_supply.step_roles sr
      )
    ),
    'calendar',jsonb_build_object(
      'calendars',(
        select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'code',c.code,'name',c.name,'timezone',c.timezone,'active',c.active) order by c.code),'[]'::jsonb)
        from erp_supply.work_calendars c where c.organization_id=v_org
      ),
      'segments',(
        select coalesce(jsonb_agg(jsonb_build_object('id',s.id,'calendarId',s.calendar_id,'weekday',s.iso_weekday,'startTime',s.start_time,'endTime',s.end_time) order by s.iso_weekday,s.start_time),'[]'::jsonb)
        from erp_supply.work_calendar_segments s join erp_supply.work_calendars c on c.id=s.calendar_id where c.organization_id=v_org
      ),
      'holidays',(
        select coalesce(jsonb_agg(jsonb_build_object('id',h.id,'date',h.holiday_date,'name',h.name,'source',h.source) order by h.holiday_date),'[]'::jsonb)
        from erp_supply.holidays h where h.organization_id=v_org
      )
    ),
    'catalogs',jsonb_build_object(
      'orderTypes',(
        select coalesce(jsonb_agg(jsonb_build_object('code',x.code,'name',x.name,'description',x.description,'requiresPurchaseDefault',x.requires_purchase_default,'active',x.active,'sortOrder',x.sort_order) order by x.sort_order,x.code),'[]'::jsonb) from erp_supply.order_types x
      ),
      'paymentConditions',(
        select coalesce(jsonb_agg(jsonb_build_object('code',x.code,'name',x.name,'requiresCartera',x.requires_cartera,'requiresCaja',x.requires_caja,'active',x.active,'sortOrder',x.sort_order) order by x.sort_order,x.code),'[]'::jsonb) from erp_supply.payment_conditions x
      ),
      'deliveryRoutes',(
        select coalesce(jsonb_agg(jsonb_build_object('code',x.code,'name',x.name,'routeGroup',x.route_group,'active',x.active,'sortOrder',x.sort_order) order by x.sort_order,x.code),'[]'::jsonb) from erp_supply.delivery_routes x
      ),
      'checklists',(
        select coalesce(jsonb_agg(jsonb_build_object('stepCode',x.step_code,'itemCode',x.item_code,'label',x.label,'required',x.required,'sortOrder',x.sort_order,'active',x.active) order by x.step_code,x.sort_order,x.item_code),'[]'::jsonb) from erp_supply.checklist_templates x
      ),
      'workActivities',(
        select coalesce(jsonb_agg(jsonb_build_object('id',x.id,'code',x.code,'name',x.name,'description',x.description,'group',x.activity_group,'kind',x.activity_kind,'standardMinutes',x.standard_minutes,'evidencePolicy',x.evidence_policy,'acceptanceRequired',x.acceptance_required,'teamAllowed',x.team_allowed,'allowedRoles',coalesce(to_jsonb(x.allowed_roles),'[]'::jsonb),'active',x.active,'sortOrder',x.sort_order,'origin',x.catalog_origin) order by x.sort_order,x.name),'[]'::jsonb)
        from erp_supply.work_activity_catalog x where x.organization_id=v_org
      )
    ),
    'rules',jsonb_build_object(
      'exceptionSla',(
        select coalesce(jsonb_agg(jsonb_build_object('id',x.id,'objectType',x.object_type,'subtype',x.subtype,'warningSeconds',x.warning_seconds,'escalation1Seconds',x.escalation_1_seconds,'escalation2Seconds',x.escalation_2_seconds,'escalationRole1',x.escalation_role_1,'escalationRole2',x.escalation_role_2,'active',x.active,'metadata',coalesce(x.metadata,'{}'::jsonb)) order by x.object_type,x.subtype),'[]'::jsonb) from erp_supply.exception_sla_rules x where x.organization_id=v_org
      ),
      'routing',(
        select coalesce(jsonb_agg(jsonb_build_object('id',x.id,'stepCode',x.step_code,'routeCode',x.route_code,'orderTypeCode',x.order_type_code,'assignedRoleCode',x.assigned_role_code,'assignedProfileId',x.assigned_profile_id,'assignedProfileName',p.display_name,'priority',x.priority,'active',x.active,'metadata',coalesce(x.metadata,'{}'::jsonb)) order by x.priority,x.step_code),'[]'::jsonb)
        from erp_supply.routing_rules x left join erp_supply.profiles p on p.id=x.assigned_profile_id where x.organization_id=v_org
      )
    ),
    'documentSequences',(
      select coalesce(jsonb_agg(jsonb_build_object('documentCode',x.document_code,'year',x.document_year,'lastValue',x.last_value,'updatedAt',x.updated_at) order by x.document_year desc,x.document_code),'[]'::jsonb) from erp_supply.document_sequences x where x.organization_id=v_org
    ),
    'health',(
      select coalesce(jsonb_agg(jsonb_build_object('section',h.section,'checkName',h.check_name,'ok',h.ok,'detail',h.detail) order by h.section,h.check_name),'[]'::jsonb) from public.erp_x_health_check() h
    ),
    'audit',(
      select coalesce(jsonb_agg(jsonb_build_object('id',a.id,'action',a.action,'entityType',a.entity_type,'entityId',a.entity_id,'actor',p.display_name,'createdAt',a.created_at,'metadata',coalesce(a.metadata,'{}'::jsonb)) order by a.created_at desc),'[]'::jsonb)
      from (
        select * from erp_supply.system_audit a where a.organization_id=v_org and (a.entity_type like 'ADMIN_%' or a.action like 'ADMIN_%') order by a.created_at desc limit 100
      ) a left join erp_supply.profiles p on p.id=a.actor_profile_id
    )
  );
end;
$$;

create or replace function public.erp_x_admin_config_mutate(p_domain text,p_action text,p_payload jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile uuid;
  v_org uuid;
  v_domain text:=upper(coalesce(trim(p_domain),''));
  v_action text:=upper(coalesce(trim(p_action),'UPSERT'));
  v_before jsonb;
  v_after jsonb;
  v_entity text;
  v_id text;
  v_uuid uuid;
  v_code text;
  v_day smallint;
  v_current bigint;
begin
  v_profile:=erp_supply.require_profile();
  v_org:=erp_supply.current_org_id();
  if not erp_supply.can_access_module('admin','admin') then
    raise exception 'Solo Super Admin puede modificar la configuración' using errcode='42501';
  end if;
  if p_payload is null then p_payload:='{}'::jsonb; end if;

  if v_domain='ORGANIZATION' then
    select to_jsonb(o) into v_before from erp_supply.organizations o where o.id=v_org;
    if nullif(p_payload->>'timezone','') is not null and not exists(select 1 from pg_catalog.pg_timezone_names where name=p_payload->>'timezone') then raise exception 'Zona horaria no válida'; end if;
    update erp_supply.organizations o set name=coalesce(nullif(trim(p_payload->>'name'),''),o.name),timezone=coalesce(nullif(trim(p_payload->>'timezone'),''),o.timezone),updated_at=now() where o.id=v_org;
    select to_jsonb(o) into v_after from erp_supply.organizations o where o.id=v_org;v_entity:='ADMIN_ORGANIZATION';v_id=v_org::text;

  elsif v_domain='MODULE' then
    v_code:=p_payload->>'code';select to_jsonb(m) into v_before from erp_supply.modules m where m.code=v_code;if v_before is null then raise exception 'Módulo no encontrado'; end if;
    if v_code in ('admin','dashboard') and coalesce((p_payload->>'active')::boolean,true)=false then raise exception 'No se puede desactivar un módulo estructural'; end if;
    update erp_supply.modules m set name=coalesce(nullif(trim(p_payload->>'name'),''),m.name),description=case when p_payload ? 'description' then nullif(trim(p_payload->>'description'),'') else m.description end,sort_order=coalesce((p_payload->>'sortOrder')::integer,m.sort_order),active=coalesce((p_payload->>'active')::boolean,m.active) where m.code=v_code;
    select to_jsonb(m) into v_after from erp_supply.modules m where m.code=v_code;v_entity:='ADMIN_MODULE';v_id=v_code;

  elsif v_domain='ROLE' then
    v_code:=lower(trim(p_payload->>'code'));if v_code !~ '^[a-z][a-z0-9_]{2,40}$' then raise exception 'Código de rol inválido'; end if;
    select to_jsonb(r) into v_before from erp_supply.roles r where r.code=v_code;
    if v_before is null then insert into erp_supply.roles(code,name,description,system_role,active) values(v_code,coalesce(nullif(trim(p_payload->>'name'),''),v_code),nullif(trim(p_payload->>'description'),''),false,coalesce((p_payload->>'active')::boolean,true));
    else if v_code='super_admin' and coalesce((p_payload->>'active')::boolean,true)=false then raise exception 'No se puede desactivar el rol Super Admin'; end if;update erp_supply.roles r set name=coalesce(nullif(trim(p_payload->>'name'),''),r.name),description=case when p_payload ? 'description' then nullif(trim(p_payload->>'description'),'') else r.description end,active=coalesce((p_payload->>'active')::boolean,r.active) where r.code=v_code;end if;
    select to_jsonb(r) into v_after from erp_supply.roles r where r.code=v_code;v_entity:='ADMIN_ROLE';v_id=v_code;

  elsif v_domain='PERMISSION' then
    v_code:=p_payload->>'roleCode';v_id:=p_payload->>'moduleCode';if not exists(select 1 from erp_supply.roles r where r.code=v_code) or not exists(select 1 from erp_supply.modules m where m.code=v_id) then raise exception 'Rol o módulo no encontrado'; end if;
    select to_jsonb(x) into v_before from erp_supply.role_module_permissions x where x.role_code=v_code and x.module_code=v_id;
    if v_code='super_admin' and v_id='admin' then p_payload:=p_payload||jsonb_build_object('canRead',true,'canCreate',true,'canUpdate',true,'canApprove',true,'canAdmin',true);end if;
    insert into erp_supply.role_module_permissions(role_code,module_code,can_read,can_create,can_update,can_approve,can_admin) values(v_code,v_id,coalesce((p_payload->>'canRead')::boolean,false),coalesce((p_payload->>'canCreate')::boolean,false),coalesce((p_payload->>'canUpdate')::boolean,false),coalesce((p_payload->>'canApprove')::boolean,false),coalesce((p_payload->>'canAdmin')::boolean,false)) on conflict(role_code,module_code) do update set can_read=excluded.can_read,can_create=excluded.can_create,can_update=excluded.can_update,can_approve=excluded.can_approve,can_admin=excluded.can_admin;
    select to_jsonb(x) into v_after from erp_supply.role_module_permissions x where x.role_code=v_code and x.module_code=v_id;v_entity:='ADMIN_PERMISSION';v_id=v_code||':'||v_id;

  elsif v_domain='WORKFLOW_STEP' then
    v_code:=p_payload->>'code';select to_jsonb(s) into v_before from erp_supply.workflow_steps s where s.code=v_code;if v_before is null then raise exception 'Etapa no encontrada'; end if;if v_code='CLOSED' and coalesce((p_payload->>'active')::boolean,true)=false then raise exception 'No se puede desactivar CLOSED'; end if;
    update erp_supply.workflow_steps s set name=coalesce(nullif(trim(p_payload->>'name'),''),s.name),module_code=coalesce(nullif(trim(p_payload->>'moduleCode'),''),s.module_code),sla_hours=case when p_payload ? 'slaHours' and nullif(p_payload->>'slaHours','') is null then null when p_payload ? 'slaHours' then greatest(0,(p_payload->>'slaHours')::numeric) else s.sla_hours end,sort_order=coalesce((p_payload->>'sortOrder')::integer,s.sort_order),active=coalesce((p_payload->>'active')::boolean,s.active) where s.code=v_code;
    select to_jsonb(s) into v_after from erp_supply.workflow_steps s where s.code=v_code;v_entity:='ADMIN_WORKFLOW_STEP';v_id=v_code;

  elsif v_domain='STEP_ROLE' then
    v_code:=p_payload->>'stepCode';v_id:=p_payload->>'roleCode';if not exists(select 1 from erp_supply.workflow_steps s where s.code=v_code) or not exists(select 1 from erp_supply.roles r where r.code=v_id) then raise exception 'Etapa o rol no encontrado'; end if;
    select to_jsonb(x) into v_before from erp_supply.step_roles x where x.step_code=v_code and x.role_code=v_id;
    insert into erp_supply.step_roles(step_code,role_code,can_view,can_claim,can_assign,can_start,can_complete,can_block,can_override) values(v_code,v_id,coalesce((p_payload->>'canView')::boolean,false),coalesce((p_payload->>'canClaim')::boolean,false),coalesce((p_payload->>'canAssign')::boolean,false),coalesce((p_payload->>'canStart')::boolean,false),coalesce((p_payload->>'canComplete')::boolean,false),coalesce((p_payload->>'canBlock')::boolean,false),coalesce((p_payload->>'canOverride')::boolean,false)) on conflict(step_code,role_code) do update set can_view=excluded.can_view,can_claim=excluded.can_claim,can_assign=excluded.can_assign,can_start=excluded.can_start,can_complete=excluded.can_complete,can_block=excluded.can_block,can_override=excluded.can_override;
    select to_jsonb(x) into v_after from erp_supply.step_roles x where x.step_code=v_code and x.role_code=v_id;v_entity:='ADMIN_STEP_ROLE';v_id=v_code||':'||v_id;

  elsif v_domain='CALENDAR_DAY' then
    v_uuid:=(p_payload->>'calendarId')::uuid;v_day:=(p_payload->>'weekday')::smallint;if v_day<1 or v_day>7 then raise exception 'Día inválido'; end if;if not exists(select 1 from erp_supply.work_calendars c where c.id=v_uuid and c.organization_id=v_org) then raise exception 'Calendario no encontrado'; end if;
    select coalesce(jsonb_agg(to_jsonb(s) order by s.start_time),'[]'::jsonb) into v_before from erp_supply.work_calendar_segments s where s.calendar_id=v_uuid and s.iso_weekday=v_day;delete from erp_supply.work_calendar_segments s where s.calendar_id=v_uuid and s.iso_weekday=v_day;
    insert into erp_supply.work_calendar_segments(calendar_id,iso_weekday,start_time,end_time) select v_uuid,v_day,(x->>'startTime')::time,(x->>'endTime')::time from jsonb_array_elements(coalesce(p_payload->'segments','[]'::jsonb)) x where nullif(x->>'startTime','') is not null and nullif(x->>'endTime','') is not null;
    if exists(select 1 from erp_supply.work_calendar_segments s where s.calendar_id=v_uuid and s.iso_weekday=v_day and s.start_time>=s.end_time) then raise exception 'Cada segmento debe finalizar después de iniciar'; end if;
    if exists(select 1 from erp_supply.work_calendar_segments a join erp_supply.work_calendar_segments b on a.calendar_id=b.calendar_id and a.iso_weekday=b.iso_weekday and a.id<b.id and a.start_time<b.end_time and b.start_time<a.end_time where a.calendar_id=v_uuid and a.iso_weekday=v_day) then raise exception 'Los segmentos del día no pueden superponerse'; end if;
    select coalesce(jsonb_agg(to_jsonb(s) order by s.start_time),'[]'::jsonb) into v_after from erp_supply.work_calendar_segments s where s.calendar_id=v_uuid and s.iso_weekday=v_day;v_entity:='ADMIN_CALENDAR_DAY';v_id=v_uuid::text||':'||v_day::text;

  elsif v_domain='HOLIDAY' then
    if v_action='DELETE' then v_uuid:=(p_payload->>'id')::uuid;select to_jsonb(h) into v_before from erp_supply.holidays h where h.id=v_uuid and h.organization_id=v_org;delete from erp_supply.holidays h where h.id=v_uuid and h.organization_id=v_org;v_after:=null;v_id=v_uuid::text;
    else if nullif(p_payload->>'id','') is not null then v_uuid:=(p_payload->>'id')::uuid;else select h.id into v_uuid from erp_supply.holidays h where h.organization_id=v_org and h.holiday_date=(p_payload->>'date')::date limit 1;end if;if v_uuid is not null then select to_jsonb(h) into v_before from erp_supply.holidays h where h.id=v_uuid and h.organization_id=v_org;update erp_supply.holidays h set holiday_date=(p_payload->>'date')::date,name=coalesce(nullif(trim(p_payload->>'name'),''),h.name),source=coalesce(nullif(trim(p_payload->>'source'),''),h.source) where h.id=v_uuid and h.organization_id=v_org;else insert into erp_supply.holidays(organization_id,holiday_date,name,source) values(v_org,(p_payload->>'date')::date,coalesce(nullif(trim(p_payload->>'name'),''),'Festivo'),coalesce(nullif(trim(p_payload->>'source'),''),'ADMIN')) returning id into v_uuid;end if;select to_jsonb(h) into v_after from erp_supply.holidays h where h.id=v_uuid;v_id=v_uuid::text;end if;v_entity:='ADMIN_HOLIDAY';

  elsif v_domain in ('ORDER_TYPE','PAYMENT_CONDITION','DELIVERY_ROUTE') then
    v_code:=p_payload->>'code';
    if v_domain='ORDER_TYPE' then select to_jsonb(x) into v_before from erp_supply.order_types x where x.code=v_code;if v_before is null then raise exception 'Tipo de pedido no encontrado'; end if;update erp_supply.order_types x set name=coalesce(nullif(trim(p_payload->>'name'),''),x.name),description=case when p_payload ? 'description' then nullif(trim(p_payload->>'description'),'') else x.description end,requires_purchase_default=coalesce((p_payload->>'requiresPurchaseDefault')::boolean,x.requires_purchase_default),active=coalesce((p_payload->>'active')::boolean,x.active),sort_order=coalesce((p_payload->>'sortOrder')::integer,x.sort_order) where x.code=v_code;select to_jsonb(x) into v_after from erp_supply.order_types x where x.code=v_code;
    elsif v_domain='PAYMENT_CONDITION' then select to_jsonb(x) into v_before from erp_supply.payment_conditions x where x.code=v_code;if v_before is null then raise exception 'Condición de pago no encontrada'; end if;update erp_supply.payment_conditions x set name=coalesce(nullif(trim(p_payload->>'name'),''),x.name),requires_cartera=coalesce((p_payload->>'requiresCartera')::boolean,x.requires_cartera),requires_caja=coalesce((p_payload->>'requiresCaja')::boolean,x.requires_caja),active=coalesce((p_payload->>'active')::boolean,x.active),sort_order=coalesce((p_payload->>'sortOrder')::integer,x.sort_order) where x.code=v_code;select to_jsonb(x) into v_after from erp_supply.payment_conditions x where x.code=v_code;
    else select to_jsonb(x) into v_before from erp_supply.delivery_routes x where x.code=v_code;if v_before is null then raise exception 'Ruta no encontrada'; end if;update erp_supply.delivery_routes x set name=coalesce(nullif(trim(p_payload->>'name'),''),x.name),route_group=coalesce(nullif(trim(p_payload->>'routeGroup'),''),x.route_group),active=coalesce((p_payload->>'active')::boolean,x.active),sort_order=coalesce((p_payload->>'sortOrder')::integer,x.sort_order) where x.code=v_code;select to_jsonb(x) into v_after from erp_supply.delivery_routes x where x.code=v_code;end if;
    v_entity:='ADMIN_'||v_domain;v_id=v_code;

  elsif v_domain='CHECKLIST' then
    v_code:=p_payload->>'stepCode';v_id:=p_payload->>'itemCode';if v_action='DELETE' then select to_jsonb(x) into v_before from erp_supply.checklist_templates x where x.step_code=v_code and x.item_code=v_id;delete from erp_supply.checklist_templates x where x.step_code=v_code and x.item_code=v_id;v_after:=null;else select to_jsonb(x) into v_before from erp_supply.checklist_templates x where x.step_code=v_code and x.item_code=v_id;insert into erp_supply.checklist_templates(step_code,item_code,label,required,sort_order,active) values(v_code,v_id,coalesce(nullif(trim(p_payload->>'label'),''),v_id),coalesce((p_payload->>'required')::boolean,true),coalesce((p_payload->>'sortOrder')::integer,100),coalesce((p_payload->>'active')::boolean,true)) on conflict(step_code,item_code) do update set label=excluded.label,required=excluded.required,sort_order=excluded.sort_order,active=excluded.active;select to_jsonb(x) into v_after from erp_supply.checklist_templates x where x.step_code=v_code and x.item_code=v_id;end if;v_entity:='ADMIN_CHECKLIST';v_id=v_code||':'||v_id;

  elsif v_domain='EXCEPTION_SLA' then
    if v_action='DELETE' then v_uuid:=(p_payload->>'id')::uuid;select to_jsonb(x) into v_before from erp_supply.exception_sla_rules x where x.id=v_uuid and x.organization_id=v_org;delete from erp_supply.exception_sla_rules x where x.id=v_uuid and x.organization_id=v_org;v_after:=null;
    else if nullif(p_payload->>'id','') is not null then v_uuid:=(p_payload->>'id')::uuid;end if;if v_uuid is null then insert into erp_supply.exception_sla_rules(organization_id,object_type,subtype,warning_seconds,escalation_1_seconds,escalation_2_seconds,escalation_role_1,escalation_role_2,active,metadata) values(v_org,p_payload->>'objectType',p_payload->>'subtype',coalesce((p_payload->>'warningSeconds')::integer,0),coalesce((p_payload->>'escalation1Seconds')::integer,0),coalesce((p_payload->>'escalation2Seconds')::integer,0),nullif(p_payload->>'escalationRole1',''),nullif(p_payload->>'escalationRole2',''),coalesce((p_payload->>'active')::boolean,true),coalesce(p_payload->'metadata','{}'::jsonb)) returning id into v_uuid;else select to_jsonb(x) into v_before from erp_supply.exception_sla_rules x where x.id=v_uuid and x.organization_id=v_org;update erp_supply.exception_sla_rules x set object_type=coalesce(nullif(p_payload->>'objectType',''),x.object_type),subtype=coalesce(nullif(p_payload->>'subtype',''),x.subtype),warning_seconds=coalesce((p_payload->>'warningSeconds')::integer,x.warning_seconds),escalation_1_seconds=coalesce((p_payload->>'escalation1Seconds')::integer,x.escalation_1_seconds),escalation_2_seconds=coalesce((p_payload->>'escalation2Seconds')::integer,x.escalation_2_seconds),escalation_role_1=case when p_payload ? 'escalationRole1' then nullif(p_payload->>'escalationRole1','') else x.escalation_role_1 end,escalation_role_2=case when p_payload ? 'escalationRole2' then nullif(p_payload->>'escalationRole2','') else x.escalation_role_2 end,active=coalesce((p_payload->>'active')::boolean,x.active),metadata=coalesce(p_payload->'metadata',x.metadata),updated_at=now() where x.id=v_uuid and x.organization_id=v_org;end if;select to_jsonb(x) into v_after from erp_supply.exception_sla_rules x where x.id=v_uuid;end if;v_entity:='ADMIN_EXCEPTION_SLA';v_id=v_uuid::text;

  elsif v_domain='ROUTING_RULE' then
    if v_action='DELETE' then v_uuid:=(p_payload->>'id')::uuid;select to_jsonb(x) into v_before from erp_supply.routing_rules x where x.id=v_uuid and x.organization_id=v_org;delete from erp_supply.routing_rules x where x.id=v_uuid and x.organization_id=v_org;v_after:=null;
    else if nullif(p_payload->>'id','') is not null then v_uuid:=(p_payload->>'id')::uuid;end if;if v_uuid is null then insert into erp_supply.routing_rules(organization_id,step_code,route_code,order_type_code,assigned_role_code,assigned_profile_id,priority,active,metadata) values(v_org,nullif(p_payload->>'stepCode',''),nullif(p_payload->>'routeCode',''),nullif(p_payload->>'orderTypeCode',''),nullif(p_payload->>'assignedRoleCode',''),nullif(p_payload->>'assignedProfileId','')::uuid,coalesce((p_payload->>'priority')::integer,100),coalesce((p_payload->>'active')::boolean,true),coalesce(p_payload->'metadata','{}'::jsonb)) returning id into v_uuid;else select to_jsonb(x) into v_before from erp_supply.routing_rules x where x.id=v_uuid and x.organization_id=v_org;update erp_supply.routing_rules x set step_code=case when p_payload ? 'stepCode' then nullif(p_payload->>'stepCode','') else x.step_code end,route_code=case when p_payload ? 'routeCode' then nullif(p_payload->>'routeCode','') else x.route_code end,order_type_code=case when p_payload ? 'orderTypeCode' then nullif(p_payload->>'orderTypeCode','') else x.order_type_code end,assigned_role_code=case when p_payload ? 'assignedRoleCode' then nullif(p_payload->>'assignedRoleCode','') else x.assigned_role_code end,assigned_profile_id=case when p_payload ? 'assignedProfileId' then nullif(p_payload->>'assignedProfileId','')::uuid else x.assigned_profile_id end,priority=coalesce((p_payload->>'priority')::integer,x.priority),active=coalesce((p_payload->>'active')::boolean,x.active),metadata=coalesce(p_payload->'metadata',x.metadata) where x.id=v_uuid and x.organization_id=v_org;end if;select to_jsonb(x) into v_after from erp_supply.routing_rules x where x.id=v_uuid;end if;v_entity:='ADMIN_ROUTING_RULE';v_id=v_uuid::text;

  elsif v_domain='WORK_ACTIVITY' then
    if nullif(p_payload->>'id','') is not null then v_uuid:=(p_payload->>'id')::uuid;end if;if v_uuid is null then insert into erp_supply.work_activity_catalog(organization_id,code,name,description,activity_group,activity_kind,standard_minutes,evidence_policy,acceptance_required,team_allowed,allowed_roles,active,sort_order,metadata,catalog_origin,created_by) values(v_org,upper(trim(p_payload->>'code')),p_payload->>'name',nullif(p_payload->>'description',''),coalesce(nullif(p_payload->>'group',''),'GENERAL'),coalesce(nullif(p_payload->>'kind',''),'OPERATIVE'),coalesce((p_payload->>'standardMinutes')::integer,0),coalesce(nullif(p_payload->>'evidencePolicy',''),'OPTIONAL'),coalesce((p_payload->>'acceptanceRequired')::boolean,false),coalesce((p_payload->>'teamAllowed')::boolean,false),coalesce(array(select jsonb_array_elements_text(coalesce(p_payload->'allowedRoles','[]'::jsonb))),array[]::text[]),coalesce((p_payload->>'active')::boolean,true),coalesce((p_payload->>'sortOrder')::integer,100),coalesce(p_payload->'metadata','{}'::jsonb),'ADMIN',v_profile) returning id into v_uuid;else select to_jsonb(x) into v_before from erp_supply.work_activity_catalog x where x.id=v_uuid and x.organization_id=v_org;update erp_supply.work_activity_catalog x set name=coalesce(nullif(p_payload->>'name',''),x.name),description=case when p_payload ? 'description' then nullif(p_payload->>'description','') else x.description end,activity_group=coalesce(nullif(p_payload->>'group',''),x.activity_group),activity_kind=coalesce(nullif(p_payload->>'kind',''),x.activity_kind),standard_minutes=coalesce((p_payload->>'standardMinutes')::integer,x.standard_minutes),evidence_policy=coalesce(nullif(p_payload->>'evidencePolicy',''),x.evidence_policy),acceptance_required=coalesce((p_payload->>'acceptanceRequired')::boolean,x.acceptance_required),team_allowed=coalesce((p_payload->>'teamAllowed')::boolean,x.team_allowed),allowed_roles=case when p_payload ? 'allowedRoles' then array(select jsonb_array_elements_text(coalesce(p_payload->'allowedRoles','[]'::jsonb))) else x.allowed_roles end,active=coalesce((p_payload->>'active')::boolean,x.active),sort_order=coalesce((p_payload->>'sortOrder')::integer,x.sort_order),metadata=coalesce(p_payload->'metadata',x.metadata),updated_at=now() where x.id=v_uuid and x.organization_id=v_org;end if;select to_jsonb(x) into v_after from erp_supply.work_activity_catalog x where x.id=v_uuid;v_entity:='ADMIN_WORK_ACTIVITY';v_id=v_uuid::text;

  elsif v_domain='DOCUMENT_SEQUENCE' then
    v_code:=p_payload->>'documentCode';select x.last_value into v_current from erp_supply.document_sequences x where x.organization_id=v_org and x.document_code=v_code and x.document_year=(p_payload->>'year')::integer;if v_current is null then raise exception 'Secuencia no encontrada'; end if;if (p_payload->>'lastValue')::bigint < v_current then raise exception 'Por integridad, la secuencia solo puede avanzar'; end if;select to_jsonb(x) into v_before from erp_supply.document_sequences x where x.organization_id=v_org and x.document_code=v_code and x.document_year=(p_payload->>'year')::integer;update erp_supply.document_sequences x set last_value=(p_payload->>'lastValue')::bigint,updated_at=now() where x.organization_id=v_org and x.document_code=v_code and x.document_year=(p_payload->>'year')::integer;select to_jsonb(x) into v_after from erp_supply.document_sequences x where x.organization_id=v_org and x.document_code=v_code and x.document_year=(p_payload->>'year')::integer;v_entity:='ADMIN_DOCUMENT_SEQUENCE';v_id=v_code||':'||(p_payload->>'year');
  else raise exception 'Dominio administrativo no soportado: %',v_domain;
  end if;

  insert into erp_supply.system_audit(organization_id,actor_profile_id,action,entity_type,entity_id,before_data,after_data,metadata) values(v_org,v_profile,'ADMIN_'||v_action,v_entity,v_id,v_before,v_after,jsonb_build_object('domain',v_domain,'source','ADMIN_CENTER_V11_16_0'));
  return jsonb_build_object('success',true,'domain',v_domain,'action',v_action,'entityType',v_entity,'entityId',v_id,'row',v_after);
end;
$$;

revoke all on function public.erp_x_admin_control_center() from public,anon;
revoke all on function public.erp_x_admin_config_mutate(text,text,jsonb) from public,anon;
grant execute on function public.erp_x_admin_control_center() to authenticated;
grant execute on function public.erp_x_admin_config_mutate(text,text,jsonb) to authenticated;
