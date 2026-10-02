-- READ-ONLY POSTFLIGHT FOR V11.43.1
-- No DDL/DML. Execute only against the intended production database.

select version, name
from supabase_migrations.schema_migrations
where version = '20261001205000';

select
  p.oid::regprocedure::text as signature,
  pg_get_userbyid(p.proowner) as owner,
  p.prosecdef as security_definer,
  p.proconfig as proconfig,
  md5(pg_get_functiondef(p.oid)) as function_md5
from pg_proc p
join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public'
  and p.proname='erp_x_shipping_save_guide';

select grantee, privilege_type
from information_schema.routine_privileges
where routine_schema='public'
  and routine_name='erp_x_shipping_save_guide'
order by grantee, privilege_type;

select column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema='erp_supply'
  and table_name='deliveries'
  and column_name in (
    'carrier','tracking_number','carrier_invoice_number','carrier_cost',
    'carrier_cost_currency','carrier_cost_recorded_by','carrier_cost_recorded_at','metadata'
  )
order by ordinal_position;

select
  count(*) as total_deliveries,
  count(*) filter (where coalesce(status,'') <> 'CANCELLED') as active_deliveries,
  count(*) filter (where coalesce(status,'') <> 'CANCELLED' and nullif(trim(coalesce(carrier,'')),'') is null) as active_carrier_blank,
  count(*) filter (where coalesce(status,'') <> 'CANCELLED' and nullif(trim(coalesce(tracking_number,'')),'') is null) as active_tracking_blank,
  count(*) filter (where coalesce(status,'') <> 'CANCELLED' and nullif(trim(coalesce(carrier_invoice_number,'')),'') is null) as active_invoice_blank,
  count(*) filter (where coalesce(status,'') <> 'CANCELLED' and carrier_cost is null) as active_cost_null,
  count(*) filter (where carrier_cost is not null and carrier_cost <= 0) as nonpositive_cost,
  count(*) filter (where carrier_cost_currency <> 'COP') as non_cop
from erp_supply.deliveries;

select count(*) filter (where event_type='SHIPPING_GUIDE') as shipping_guide_events
from erp_supply.order_events;

select count(*) filter (where milestone_code='GUIDE_ADDED') as guide_added_milestones
from erp_supply.delivery_milestones;
