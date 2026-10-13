begin;
do $$declare actor uuid;begin
 select p.auth_user_id into actor from erp_supply.profiles p join erp_supply.profile_roles r on r.profile_id=p.id where p.active and r.role_code='super_admin' and p.auth_user_id is not null limit 1;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated')::text,true);perform set_config('request.jwt.claim.sub',actor::text,true);
end $$;
set local role authenticated;
do $$declare key text;p jsonb;r jsonb;q jsonb;begin
 key:=(select value->>'key' from jsonb_array_elements(public.erp_x_freight_quote_catalog('VALLE DEL CAUCA')->'destinations') where value->>'name'='TULUA (VALLE DEL CAUCA)' limit 1);
 p:=jsonb_build_object('measurementVersion',2,'carrier','TCC','origin','CALI','destinationKey',key,'department','VALLE DEL CAUCA','declaredValue',100000,'status','CALCULATED','materials','[{"description":"Cable","measurementMode":"WEIGHT","weightKg":20,"volumeM3":0.06}]'::jsonb);
 r:=public.erp_x_freight_quote_calculate(p);
 if r->>'selectedBasis'<>'VOLUME' or (r#>>'{measurementScenarios,weight,subtotalCop}')::numeric<>19060 or (r#>>'{measurementScenarios,volume,subtotalCop}')::numeric<>22872 then raise exception 'Dos bases TCC incorrectas %',r;end if;
 if (r#>>'{comparison,1,measurementScenarios,weight,totalCop}')::numeric<>23900 or (r#>>'{comparison,1,measurementScenarios,volume,totalCop}')::numeric<>23900 then raise exception 'Regresión ENVIA';end if;
 r:=public.erp_x_freight_quote_calculate(p||'{"materials":[{"description":"Pesado","measurementMode":"VOLUME","weightKg":60,"volumeM3":0.175}]}'::jsonb);
 if (r#>>'{reference,subtotalCop}')::numeric<>70210 then raise exception 'Recargo TCC cruzado omitido';end if;
 r:=public.erp_x_freight_quote_calculate(p);
 q:=public.erp_x_freight_quote_save(p);if q#>>'{snapshot,selectedBasis}'<>'VOLUME' or q->>'order_id' is not null then raise exception 'Snapshot incorrecto';end if;
 r:=public.erp_x_freight_quote_calculate(p||'{"materials":[{"description":"Cable","measurementMode":"WEIGHT","weightKg":20}]}'::jsonb);
 if r->>'selectedBasis'<>'WEIGHT' or r#>>'{measurementScenarios,volume,status}'<>'REQUIRES_INFORMATION' then raise exception 'Se inventó volumen';end if;
 r:=public.erp_x_freight_quote_calculate(p||'{"materials":[{"description":"Cable","measurementMode":"VOLUME","volumeM3":0.06}]}'::jsonb);
 if r->>'selectedBasis'<>'VOLUME' then raise exception 'Solo volumen no funciona';end if;
 r:=public.erp_x_freight_quote_calculate(p||'{"materials":[{"description":"A","measurementMode":"WEIGHT","weightKg":20},{"description":"B","measurementMode":"VOLUME","volumeM3":0.06}]}'::jsonb);
 if r#>>'{reference,status}'<>'REQUIRES_INFORMATION' or (r#>>'{measurementScenarios,weight,measuredMaterials}')::int<>1 then raise exception 'Se omitió material mixto';end if;
 begin perform public.erp_x_freight_quote_calculate(p||'{"materials":[{"description":"Cable","weightKg":-1}]}'::jsonb);raise exception 'NEGATIVE_ACCEPTED';exception when others then if sqlerrm='NEGATIVE_ACCEPTED' then raise;end if;end;
end $$;
reset role;
select 'PASS: two measured bases, maximum selection, weight-only, volume-only, partial mixed data, persistence, negative rejection' result;
rollback;
