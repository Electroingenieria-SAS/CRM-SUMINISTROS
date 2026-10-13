begin;
select set_config('request.jwt.claims',jsonb_build_object('sub',p.auth_user_id,'role','authenticated')::text,true),set_config('request.jwt.claim.sub',p.auth_user_id::text,true)
 from erp_supply.profiles p join erp_supply.profile_roles pr on pr.profile_id=p.id where p.active and p.auth_user_id is not null and pr.role_code='super_admin' limit 1;
set local role authenticated;
do $$
declare catalog jsonb; key text; payload jsonb; result jsonb;
begin
 catalog:=public.erp_x_freight_quote_catalog('VALLE DEL CAUCA');
 key:=(select value->>'key' from jsonb_array_elements(catalog->'destinations') where value->>'name'='CALI (VALLE DEL CAUCA)' limit 1);
 payload:=jsonb_build_object('origin','TULUA','destinationKey',key,'declaredValue',0,'materials','[]'::jsonb,'packages','[{"weightKg":20,"quantity":1},{"weightKg":null,"quantity":1}]'::jsonb);
 result:=public.erp_x_freight_quote_calculate(payload);
 if coalesce((result#>>'{prediction,available}')::boolean,false) then raise exception 'Incomplete weights incorrectly predicted'; end if;
 begin perform public.erp_x_freight_quote_calculate(payload||'{"packages":[{"weightKg":20,"quantity":0}]}');raise exception 'Invalid qty accepted';exception when invalid_parameter_value then null;end;
end $$;
reset role;
select 'PASS: incomplete and invalid packages cannot become predictions' result;
rollback;
