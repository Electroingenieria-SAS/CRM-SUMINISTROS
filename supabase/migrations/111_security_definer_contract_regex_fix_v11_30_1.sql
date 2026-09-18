-- CRM SUMINISTROS V11.30.1
-- Ajuste del detector SECURITY DEFINER.
-- Corrige únicamente el patrón de detección de auth.uid() del health contract 110.

create or replace function public.erp_x_security_definer_contract_check()
returns table(check_name text,ok boolean,detail text)
language sql
stable security definer
set search_path to 'pg_catalog','public'
as $function$
with defs as (
  select
    p.oid,
    p.proname,
    has_function_privilege('anon',p.oid,'EXECUTE') as anon_exec,
    has_function_privilege('authenticated',p.oid,'EXECUTE') as auth_exec,
    pg_get_functiondef(p.oid) as def
  from pg_proc p
  join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.prosecdef
),
unexpected as (
  select proname
  from defs
  where auth_exec
    and def !~* 'require_profile|current_profile_id|auth[.]uid[(][)]|has_permission|has_role|authorize|service_role'
    and proname not in (
      'erp_can_read_case',
      'erp_case_id_visible',
      'erp_current_exact_role',
      'erp_current_firebase_uid',
      'erp_x_admin_save_profile',
      'erp_x_create_physical_receipt',
      'erp_x_resolve_cut_requirement'
    )
),
wrappers as (
  select
    coalesce((select def from defs where proname='erp_can_read_case' limit 1),'') like '%erp_current_exact_role%' as case_guard,
    coalesce((select def from defs where proname='erp_case_id_visible' limit 1),'') like '%erp_can_read_case%' as case_visible_guard,
    coalesce((select def from defs where proname='erp_current_exact_role' limit 1),'') like '%erp_current_role%' as exact_role_guard,
    coalesce((select def from defs where proname='erp_current_firebase_uid' limit 1),'') like '%erp_current_user_key%' as firebase_guard,
    coalesce((select def from defs where proname='erp_x_admin_save_profile' limit 1),'') like '%erp_x_admin_profile_upsert%' as admin_guard,
    coalesce((select def from defs where proname='erp_x_create_physical_receipt' limit 1),'') like '%erp_x_goods_receipt_create%' as receipt_guard,
    coalesce((select def from defs where proname='erp_x_resolve_cut_requirement' limit 1),'') like '%resolve_cut_requirement_core%' as cut_guard
)
select * from (values
  (
    'SECURITY DEFINER sin acceso anónimo',
    not exists(select 1 from defs where anon_exec),
    format('%s funciones SECURITY DEFINER públicas; ninguna debe ser ejecutable por anon.',(select count(*) from defs))
  ),
  (
    'Funciones autenticadas con guarda o wrapper auditado',
    not exists(select 1 from unexpected),
    case
      when exists(select 1 from unexpected)
        then 'Existen funciones autenticadas sin patrón de guarda ni wrapper aprobado.'
      else format('%s funciones SECURITY DEFINER ejecutables por authenticated permanecen dentro del contrato auditado.',(select count(*) from defs where auth_exec))
    end
  ),
  (
    'Wrappers históricos conservan delegación segura',
    (select case_guard and case_visible_guard and exact_role_guard and firebase_guard and admin_guard and receipt_guard and cut_guard from wrappers),
    'Los siete wrappers/helpers auditados siguen delegando en identidad o núcleos autorizados.'
  )
) v(check_name,ok,detail)
order by check_name
$function$;

revoke all on function public.erp_x_security_definer_contract_check() from public,anon,authenticated;
grant execute on function public.erp_x_security_definer_contract_check() to service_role;
