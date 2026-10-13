begin;
-- Authenticate only inside this rolled-back fixture session.
do $$ declare actor uuid;begin
 select p.auth_user_id into actor from erp_supply.profiles p join erp_supply.profile_roles r on r.profile_id=p.id where p.active and r.role_code='super_admin' and p.auth_user_id is not null limit 1;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated')::text,true);perform set_config('request.jwt.claim.sub',actor::text,true);
end $$;
set local role authenticated;
do $$
declare key text; payload jsonb; r jsonb; q jsonb; history jsonb; before_quotes bigint; recordhash text; city text; expected text;
begin
 key:=(select value->>'key' from jsonb_array_elements(public.erp_x_freight_quote_catalog('CAQUETA')->'destinations') where value->>'name'='FLORENCIA (CAQUETA)' limit 1);
 if key is null then raise exception 'Falta destino fixture';end if;
 payload:=jsonb_build_object('origin','TULUA','carrier','ENVIA','destinationKey',key,'declaredValue',0,'status','CALCULATED','materials','[{"manual":true,"description":"Fixture ENVÍA","quantity":1,"unit":"UND"}]'::jsonb,'packages','[{"weightKg":22,"quantity":1}]'::jsonb);
 r:=public.erp_x_freight_quote_calculate(payload);
 if (r#>>'{reference,totalCop}')::numeric<>51267 or r#>>'{reference,ruleKey}'<>'Caquetá (Florencia)' then raise exception 'Caquetá RPC incorrecto %',r;end if;
 if jsonb_array_length(r->'comparison')<>2 or r#>>'{comparison,0,carrier}'<>'TCC' or r#>>'{comparison,1,carrier}'<>'ENVIA' then raise exception 'Comparativa incorrecta';end if;
 if r#>>'{comparison,0,reference,reason}'<>'ORIGIN_ROUTE_UNAVAILABLE' then raise exception 'Tuluá inventado para TCC';end if;
 before_quotes:=(public.erp_x_freight_quote_list()->>'total')::bigint;
 q:=public.erp_x_freight_quote_save(payload);
 if q->>'carrier'<>'ENVIA' or q->>'order_id' is not null or (q#>>'{snapshot,reference,totalCop}')::numeric<>51267 then raise exception 'Persistencia ENVÍA incorrecta';end if;
 history:=public.erp_x_freight_quote_list();if (history->>'total')::bigint<>before_quotes+1 then raise exception 'Historial falló';end if;
 perform public.erp_x_freight_quote_save(payload);
 r:=public.erp_x_freight_quote_calculate(payload||'{"packages":[{"weightKg":22,"quantity":2}]}');
 if r#>>'{reference,status}'<>'PENDING_PACKAGING_RULE' or r#>'{reference,totalCop}' is not null then raise exception 'Múltiples bultos indebidamente liquidados';end if;
 perform public.erp_x_freight_quote_save(payload||'{"status":"DRAFT","packages":[{"weightKg":22,"quantity":2}]}');
 begin perform public.erp_x_freight_quote_save(payload||'{"packages":[{"weightKg":22,"quantity":2}]}');raise exception 'Múltiples bultos calculados';exception when raise_exception then if sqlerrm='Múltiples bultos calculados' then raise;end if;end;
 key:=(select value->>'key' from jsonb_array_elements(public.erp_x_freight_quote_catalog('VALLE DEL CAUCA')->'destinations') where value->>'name'='TULUA (VALLE DEL CAUCA)' limit 1);
 r:=public.erp_x_freight_quote_calculate(payload||jsonb_build_object('origin','CALI','carrier','TCC','destinationKey',key,'declaredValue',100000,'packages','[{"weightKg":20,"lengthM":0.5,"widthM":0.4,"heightM":0.3,"quantity":1}]'::jsonb));
 if (r#>>'{reference,subtotalCop}')::numeric<>22872 or (r#>>'{comparison,1,reference,totalCop}')::numeric<>23900 then raise exception 'Regresión TCC o suma de proveedores';end if;
 key:=(select value->>'key' from jsonb_array_elements(public.erp_x_freight_quote_catalog('BOYACA')->'destinations') where value->>'name'='TUNJA (BOYACA)' limit 1);
 r:=public.erp_x_freight_quote_calculate(payload||jsonb_build_object('destinationKey',key));
 if r#>>'{reference,ruleKey}'<>'Boyacá (Tunja)' then raise exception 'Prioridad Tunja incorrecta';end if;
 key:=(select value->>'key' from jsonb_array_elements(public.erp_x_freight_quote_catalog('BOYACA')->'destinations') where value->>'name'='DUITAMA (BOYACA)' limit 1);
 r:=public.erp_x_freight_quote_calculate(payload||jsonb_build_object('destinationKey',key));
 if r#>>'{reference,ruleKey}'<>'Boyacá (general)' then raise exception 'Boyacá general incorrecto';end if;
 key:=(select value->>'key' from jsonb_array_elements(public.erp_x_freight_quote_catalog('CORDOBA')->'destinations') where value->>'name'='SAHAGUN (CORDOBA)' limit 1);
 r:=public.erp_x_freight_quote_calculate(payload||jsonb_build_object('destinationKey',key));
 if r#>>'{reference,reason}'<>'ROUTE_UNDOCUMENTED' then raise exception 'Cobertura inventada Córdoba';end if;
end $$;
reset role;
select 'PASS: real ENVIA RPC, 2-carrier snapshots, save/history/duplicate, packaging restriction, TCC fixture, Tunja/department and uncovered city' result;
rollback;
