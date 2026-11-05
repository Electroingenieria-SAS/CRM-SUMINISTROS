-- Recepción: asignar por adelantado el tercer responsable polivalente de Corte.
-- Corte utiliza esta asignación y no solicita una segunda asignación para los pedidos nuevos.
-- Los pedidos históricos sin ayudante conservan el selector de contingencia en Corte.

CREATE OR REPLACE FUNCTION public.erp_x_confirm_order_reception_with_cut_pickup(p_order_id uuid,p_payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'erp_supply','public','auth','pg_catalog'
AS $function$
declare
 v_actor uuid:=erp_supply.require_profile();
 v_org uuid:=erp_supply.current_org_id();
 v_has_cuts boolean:=false;
 v_helper uuid;
 v_picking uuid;
 v_cutter uuid;
 v_helper_name text;
 v_result jsonb;
begin
 if jsonb_typeof(coalesce(p_payload->'lines','[]'::jsonb))<>'array' then
   raise exception 'La recepción debe tener una lista de materiales válida';
 end if;
 select exists(
   select 1 from jsonb_array_elements(coalesce(p_payload->'lines','[]'::jsonb)) l
   where coalesce(l->>'requiresCut','false')='true'
 ) into v_has_cuts;
 if v_has_cuts then
   v_helper:=erp_supply.safe_uuid(p_payload->>'cutPickupProfileId');
   v_picking:=erp_supply.safe_uuid(p_payload->>'pickingProfileId');
   v_cutter:=erp_supply.safe_uuid(p_payload->>'cutProfileId');
   if v_helper is null then
     raise exception 'Selecciona el auxiliar polivalente de alistamiento de Corte';
   end if;
   if v_helper=v_picking then
     raise exception 'El auxiliar de alistamiento general debe ser distinto del auxiliar que recoge desde Corte';
   end if;
   if v_helper=v_cutter then
     raise exception 'El auxiliar que corta debe ser distinto del auxiliar polivalente que apoya los carretos';
   end if;
   select p.display_name into v_helper_name
   from erp_supply.profiles p
   where p.id=v_helper and p.organization_id=v_org and p.active
     and exists(select 1 from erp_supply.profile_roles pr
       where pr.profile_id=p.id and pr.role_code='aux_logistica')
     and exists(select 1 from erp_supply.profile_roles pr
       where pr.profile_id=p.id and pr.role_code='auxiliar_corte');
   if not found then
     raise exception 'El auxiliar de alistamiento de Corte debe tener activos los roles Corte y Logística';
   end if;
 end if;

 -- La operación original conserva revisión de líneas, lotes, tareas, transición y eventos.
 v_result:=public.erp_x_confirm_order_reception(p_order_id,p_payload);
 if not v_has_cuts then return v_result; end if;

 -- Asignación única, sin alterar el responsable de alistamiento ni al operario de Corte.
 update erp_supply.orders o
 set metadata=jsonb_set(
      jsonb_set(
        coalesce(o.metadata,'{}'::jsonb),
        '{receptionAssignment,cutPickupProfileId}',to_jsonb(v_helper::text),true
      ),
      '{receptionAssignment,cutPickupProfileName}',to_jsonb(v_helper_name),true
    ),
    updated_at=now()
 where o.id=p_order_id and o.organization_id=v_org
   and o.metadata#>>'{receptionAssignment,cutProfileId}' is not null;

 -- Persistir además por requerimiento (trazabilidad y permisos de recogida).
 update erp_supply.cut_requirements r
 set metadata=coalesce(r.metadata,'{}'::jsonb)||jsonb_build_object(
   'cutPickupProfileId',v_helper::text,
   'cutPickupProfileName',v_helper_name,
   'cutPickupAssignmentSource','RECEPCION_PEDIDO',
   'cutPickupAssignedAt',now()
 ),updated_at=now()
 where r.order_id=p_order_id and r.organization_id=v_org
   and r.process_status<>'READY';

 insert into erp_supply.order_events(
   organization_id,order_id,event_type,action_code,from_step_code,to_step_code,
   actor_profile_id,actor_role_code,payload
 ) values(
   v_org,p_order_id,'DOMAIN_RECORD','CUT_PICKUP_ASSIGNED','RECEPCION_PEDIDO','ALISTAMIENTO',
   v_actor,(erp_supply.current_roles())[1],
   jsonb_build_object('cutPickupProfileId',v_helper,'cutPickupProfileName',v_helper_name)
 );
 return v_result||jsonb_build_object(
   'cutPickupProfileId',v_helper::text,'cutPickupProfileName',v_helper_name
 );
end;
$function$;

CREATE OR REPLACE FUNCTION public.erp_x_cutting_assigned_pickup(p_group_key text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO 'erp_supply','public','auth','pg_catalog'
AS $function$
declare
 v_actor uuid:=erp_supply.require_profile();
 v_org uuid:=erp_supply.current_org_id();
 v_override boolean:=erp_supply.has_role('super_admin') or erp_supply.has_role('jefe_logistica');
 v_total integer:=0;
 v_distinct integer:=0;
 v_helper uuid;
 v_helper_name text;
 v_busy boolean:=false;
 v_pool jsonb;
begin
 if not (erp_supply.can_access_module('cutting','read')
   or erp_supply.has_role('auxiliar_corte')
   or v_override) then
   raise exception 'No autorizado para consultar el apoyo de Corte' using errcode='42501';
 end if;
 if nullif(trim(p_group_key),'') is null then raise exception 'Referencia de Corte requerida'; end if;
 with scope as (
   select coalesce(erp_supply.safe_uuid(r.metadata->>'cutPickupProfileId'),
                   erp_supply.safe_uuid(o.metadata#>>'{receptionAssignment,cutPickupProfileId}')) helper_id
   from erp_supply.cut_requirements r
   join erp_supply.orders o on o.id=r.order_id
   where r.organization_id=v_org and o.organization_id=v_org and r.group_key=p_group_key
     and r.process_status<>'READY'
     and greatest(r.total_length-coalesce(r.length_completed,0),0)>0
     and o.status not in('CLOSED','CANCELLED')
     and not exists(select 1 from erp_supply.order_issues oi
       where oi.order_id=o.id and oi.blocking and oi.status='OPEN')
     and (v_override or r.assigned_profile_id is null or r.assigned_profile_id=v_actor)
 )
 select count(*)::integer,count(distinct helper_id)::integer,min(helper_id::text)::uuid
 into v_total,v_distinct,v_helper from scope;
 if v_total=0 then
   return jsonb_build_object('status','EMPTY','message','No hay materiales disponibles para iniciar esta referencia');
 end if;
 if v_distinct=0 then
   return jsonb_build_object('status','LEGACY','message','Corte anterior sin auxiliar polivalente registrado en Recepción');
 end if;
 if v_distinct>1 then
   return jsonb_build_object('status','CONFLICT','message','Los pedidos agrupados en esta referencia tienen auxiliares polivalentes diferentes. Se debe unificar su asignación antes de iniciar Corte');
 end if;
 if v_helper=v_actor then
   return jsonb_build_object('status','INVALID','message','El auxiliar que ejecuta Corte no puede apoyarse a sí mismo. Corrige los responsables');
 end if;
 select p.display_name into v_helper_name from erp_supply.profiles p
 where p.id=v_helper and p.organization_id=v_org and p.active
   and exists(select 1 from erp_supply.profile_roles pr where pr.profile_id=p.id and pr.role_code='aux_logistica')
   and exists(select 1 from erp_supply.profile_roles pr where pr.profile_id=p.id and pr.role_code='auxiliar_corte');
 if not found then
   return jsonb_build_object('status','INVALID','message','El auxiliar polivalente asignado ya no está activo o perdió alguno de sus dos roles');
 end if;
 v_pool:=public.erp_x_cutting_pickup_pool();
 select coalesce((item->>'busy')::boolean,true) into v_busy
 from jsonb_array_elements(v_pool) item where item->>'id'=v_helper::text;
 return jsonb_build_object('status','ASSIGNED','helperId',v_helper::text,
   'helperName',v_helper_name,'busy',coalesce(v_busy,true),
   'requirements',v_total);
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
 -- Un grupo de Corte nunca puede cambiar arbitrariamente el ayudante fijado en Recepción.
 if exists(
   select 1 from erp_supply.cut_requirements r
   join erp_supply.orders o on o.id=r.order_id and o.organization_id=v_org
   where r.organization_id=v_org and r.group_key=p_group_key
     and r.process_status<>'READY'
     and greatest(r.total_length-coalesce(r.length_completed,0),0)>0
     and o.status not in('CLOSED','CANCELLED')
     and coalesce(r.metadata->>'cutPickupProfileId',o.metadata#>>'{receptionAssignment,cutPickupProfileId}') is not null
     and coalesce(r.metadata->>'cutPickupProfileId',o.metadata#>>'{receptionAssignment,cutPickupProfileId}')<>p_helper_profile_id::text
 ) then
   raise exception 'Los cortes de esta referencia tienen un ayudante diferente asignado desde Recepción. No es posible sustituirlo al iniciar Corte.';
 end if;
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

-- Obligatoriedad servidor-side: nunca aceptar la confirmación anterior sin tercer responsable.
REVOKE EXECUTE ON FUNCTION public.erp_x_confirm_order_reception(uuid,jsonb) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.erp_x_confirm_order_reception_with_cut_pickup(uuid,jsonb) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.erp_x_cutting_assigned_pickup(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.erp_x_confirm_order_reception_with_cut_pickup(uuid,jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.erp_x_cutting_assigned_pickup(text) TO authenticated;
