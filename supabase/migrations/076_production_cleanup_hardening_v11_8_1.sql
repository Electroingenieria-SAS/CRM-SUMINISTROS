-- CRM Suministros V11.8.1
-- Remediación final de auditoría: retira API legacy sin consumidores V11.8,
-- fija search_path explícito en helpers y añade índices FK selectivos para tablas operativas.

-- ---------------------------------------------------------------------------
-- 1. Retiro completo de endpoints legacy sustituidos por la familia erp_x_*
-- ---------------------------------------------------------------------------
-- La V11.8 no contiene consumidores de estos RPC. Se eliminan primero los
-- health-checks/ejecutores que dependen del contrato antiguo y después wrappers.

drop function if exists public.erp_v8_health_check();
drop function if exists public.erp_v8_health_check_legacy();

drop function if exists public.erp_v9_audit(text,integer,integer);
drop function if exists public.erp_v9_case_actions(text);
drop function if exists public.erp_v9_case_detail(text);
drop function if exists public.erp_v9_cases(text,text[],text,text,text,text,text,integer,integer);
drop function if exists public.erp_v9_catalog();
drop function if exists public.erp_v9_credit_list(text,text,integer,integer);
drop function if exists public.erp_v9_credit_save(text,jsonb);
drop function if exists public.erp_v9_credit_transition(text,text,jsonb);
drop function if exists public.erp_v9_dashboard();
drop function if exists public.erp_v9_domain_list(text,text,integer,integer);
drop function if exists public.erp_v9_execute(text,text,jsonb);
drop function if exists public.erp_v9_goods_list(text,text,integer,integer);
drop function if exists public.erp_v9_goods_save(text,text,jsonb);
drop function if exists public.erp_v9_health();
drop function if exists public.erp_v9_inventory_save(text,jsonb);
drop function if exists public.erp_v9_novelty_save(text,jsonb);
drop function if exists public.erp_v9_profiles();
drop function if exists public.erp_v9_session();
drop function if exists public.erp_v9_update_profile(text,jsonb);
drop function if exists public.erp_v9_vsm(text,integer,integer);
drop function if exists public.erp_v9_workflows(text,text,text,text,integer,integer);

-- API pública anterior a erp_x_*.
drop function if exists public.erp_execute_case_action_core(text,text,jsonb);
drop function if exists public.erp_execute_case_action(text,text,jsonb);
drop function if exists public.erp_get_case_actions(text);
drop function if exists public.erp_get_case_detail(text);
drop function if exists public.erp_get_dashboard_summary(integer);
drop function if exists public.erp_get_frontend_catalog();
drop function if exists public.erp_get_session_context();
drop function if exists public.erp_list_cases(text,text,text,text,text,text,text,integer,integer);
drop function if exists public.erp_list_workflow_requests(text,text,text,text,integer,integer);
drop function if exists public.erp_apply_operations(jsonb);
drop function if exists public.credit_transition(text,text,jsonb);
drop function if exists public.erp_scan_flow_health();

-- ---------------------------------------------------------------------------
-- 2. search_path explícito en helpers señalados por el linter
-- ---------------------------------------------------------------------------
alter function erp_supply.initial_step(text,text,boolean,boolean,boolean)
  set search_path = erp_supply, public, auth, pg_catalog;
alter function erp_supply.cut_group_key(text,text,text)
  set search_path = erp_supply, public, auth, pg_catalog;
alter function erp_supply.default_role_for_step(text,text)
  set search_path = erp_supply, public, auth, pg_catalog;
alter function erp_supply.material_norm(text)
  set search_path = erp_supply, public, auth, pg_catalog;
alter function erp_supply.material_unit(text)
  set search_path = erp_supply, public, auth, pg_catalog;
alter function erp_supply.try_boolean(text,boolean)
  set search_path = erp_supply, public, auth, pg_catalog;
alter function erp_supply.try_timestamptz(text,timestamptz)
  set search_path = erp_supply, public, auth, pg_catalog;
alter function erp_supply.order_item_required_quantity(erp_supply.order_items)
  set search_path = erp_supply, public, auth, pg_catalog;
alter function erp_supply.safe_integer(text)
  set search_path = erp_supply, public, auth, pg_catalog;
alter function erp_supply.safe_date(text)
  set search_path = erp_supply, public, auth, pg_catalog;
alter function erp_supply.safe_boolean(text,boolean)
  set search_path = erp_supply, public, auth, pg_catalog;
alter function erp_supply.safe_numeric(text)
  set search_path = erp_supply, public, auth, pg_catalog;
alter function erp_supply.safe_timestamptz(text)
  set search_path = erp_supply, public, auth, pg_catalog;
alter function erp_supply.safe_uuid(text)
  set search_path = erp_supply, public, auth, pg_catalog;

alter function public.erp_collection_write_allowed(text,text)
  set search_path = public, auth, pg_catalog;
alter function public.erp_collection_read_allowed(text,text)
  set search_path = public, auth, pg_catalog;
alter function public.erp_normalize_key(text)
  set search_path = public, auth, pg_catalog;
alter function public.erp_pending_cuts(jsonb)
  set search_path = public, auth, pg_catalog;
alter function public.erp_try_date(text)
  set search_path = public, auth, pg_catalog;
alter function public.erp_try_integer(text)
  set search_path = public, auth, pg_catalog;
alter function public.erp_try_numeric(text)
  set search_path = public, auth, pg_catalog;
alter function public.erp_try_time(text)
  set search_path = public, auth, pg_catalog;
alter function public.erp_try_timestamptz(text)
  set search_path = public, auth, pg_catalog;
alter function public.erp_jsonb_array(jsonb)
  set search_path = public, auth, pg_catalog;
alter function public.erp_jsonb_object(jsonb)
  set search_path = public, auth, pg_catalog;
alter function public.erp_jsonb_contains_text(jsonb,text)
  set search_path = public, auth, pg_catalog;
alter function public.erp_process_sla_hours(text)
  set search_path = public, auth, pg_catalog;
alter function public.erp_try_bigint(text)
  set search_path = public, auth, pg_catalog;
alter function public.erp_try_boolean(text,boolean)
  set search_path = public, auth, pg_catalog;

-- ---------------------------------------------------------------------------
-- 3. Índices selectivos sobre relaciones operativas que crecerán con el uso
-- ---------------------------------------------------------------------------
create index if not exists idx_order_tasks_assigned_profile_v1181
  on erp_supply.order_tasks(assigned_profile_id)
  where assigned_profile_id is not null;
create index if not exists idx_order_tasks_step_v1181
  on erp_supply.order_tasks(step_code);

create index if not exists idx_order_events_task_v1181
  on erp_supply.order_events(task_id)
  where task_id is not null;
create index if not exists idx_order_events_actor_v1181
  on erp_supply.order_events(actor_profile_id)
  where actor_profile_id is not null;

create index if not exists idx_delivery_milestones_delivery_v1181
  on erp_supply.delivery_milestones(delivery_id)
  where delivery_id is not null;
create index if not exists idx_delivery_milestones_task_v1181
  on erp_supply.delivery_milestones(task_id)
  where task_id is not null;

create index if not exists idx_order_comments_order_v1181
  on erp_supply.order_comments(order_id);

create index if not exists idx_inventory_movements_order_v1181
  on erp_supply.inventory_movements(order_id)
  where order_id is not null;

create index if not exists idx_cut_requirements_task_v1181
  on erp_supply.cut_requirements(task_id)
  where task_id is not null;
create index if not exists idx_cut_requirements_inventory_lot_v1181
  on erp_supply.cut_requirements(inventory_lot_id)
  where inventory_lot_id is not null;

create index if not exists idx_approval_requests_assigned_profile_v1181
  on erp_supply.approval_requests(assigned_profile_id)
  where assigned_profile_id is not null;
create index if not exists idx_approval_requests_requested_by_v1181
  on erp_supply.approval_requests(requested_by);
