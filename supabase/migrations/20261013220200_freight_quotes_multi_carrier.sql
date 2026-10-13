begin;
create or replace function erp_supply.freight_quote_tcc_snapshot(p_payload jsonb) returns jsonb
language plpgsql stable security definer set search_path=erp_supply,public,auth,pg_catalog as $$
declare r erp_supply.freight_tariff_rows%rowtype; dest erp_supply.freight_tariff_rows%rowtype; policy erp_supply.freight_quote_policies%rowtype; reference jsonb; prediction jsonb; w numeric; origin text; model_origin text; p jsonb; qty numeric; weight numeric; total_weight numeric:=0; complete_weight boolean:=true;
begin
 perform erp_supply.require_freight_quote_access();
 if octet_length(p_payload::text)>100000 then raise exception 'Cotización demasiado grande'; end if;
 if coalesce(p_payload->>'carrier','TCC')<>'TCC' then raise exception 'Transportadora sin contrato aportado'; end if;
 if jsonb_typeof(p_payload->'packages') is distinct from 'array' or jsonb_array_length(p_payload->'packages')>100 then raise exception 'Bultos inválidos' using errcode='22023'; end if;
 for p in select value from jsonb_array_elements(p_payload->'packages') loop
  qty:=coalesce(nullif(p->>'quantity','')::numeric,1);weight:=nullif(p->>'weightKg','')::numeric;
  if qty<1 or qty<>trunc(qty) or qty>10000 or qty::text in ('NaN','Infinity','-Infinity') then raise exception 'Cantidad de bultos inválida' using errcode='22023'; end if;
  if weight is null then complete_weight:=false;
  elsif weight<=0 or weight>1000000 or weight::text in ('NaN','Infinity','-Infinity') then raise exception 'Peso inválido' using errcode='22023';
  else total_weight:=total_weight+weight*qty; end if;
 end loop;
 origin:=p_payload->>'origin';
 if nullif(origin,'') is null then raise exception 'Origen requerido'; end if;
 select * into dest from erp_supply.freight_tariff_rows where left(tcc_row_id,8)=p_payload->>'destinationKey' order by tcc_row_id limit 1;
 if not found then raise exception 'Destino documental no existe'; end if;
 select * into r from erp_supply.freight_tariff_rows where left(tcc_row_id,8)=p_payload->>'destinationKey' and origin_city=origin;
 select * into policy from erp_supply.freight_quote_policies where version='TCC_WEB_REFERENCE_1';
 reference:=erp_supply.tcc_reference_calculate(r.paq_rate_cop_kg_reference,p_payload->'packages',nullif(p_payload->>'declaredValue','')::numeric,policy.rules);
 if r.tcc_row_id is null then reference:=jsonb_build_object('status','UNAVAILABLE','reason','ORIGIN_ROUTE_UNAVAILABLE','official',false); end if;
 w:=case when complete_weight and jsonb_array_length(p_payload->'packages')>0 then total_weight else null end;
 select origin_city into model_origin from erp_supply.freight_prediction_models where organization_id=erp_supply.current_org_id() and active order by updated_at desc limit 1;
 if origin=model_origin and w>0 then
  prediction:=public.erp_x_freight_predictions(dest.destination_departamento_pdf,regexp_replace(dest.destination_pdf,'\s*\([^)]*\)\s*$',''),w);
 else prediction:=jsonb_build_object('available',false,'reason','MODEL_ORIGIN_OR_WEIGHT_UNAVAILABLE'); end if;
 return jsonb_build_object('carrier','TCC','origin',origin,'destination',dest.destination_pdf,'department',dest.destination_departamento_pdf,'center',dest.tcc_co,'tariffVersion','TRADICIONALES_2023_2024','policyVersion',policy.version,'sourceSha256',dest.source_data->>'source_sha256','rowId',r.tcc_row_id,'rateCopKg',r.paq_rate_cop_kg_reference,'reference',reference,'prediction',prediction,'calculatedAt',now(),'warning','Referencia histórica 2023–2024. No es tarifa vigente ni total oficial. IVA, mínimos y adicionales sin confirmar.');
end $$;
revoke all on function erp_supply.freight_quote_tcc_snapshot(jsonb) from public,anon,authenticated;
create or replace function public.erp_x_freight_quote_calculate(p_payload jsonb) returns jsonb
language plpgsql stable security definer set search_path=erp_supply,public,auth,pg_catalog as $$
declare tcc jsonb; envia jsonb; selected jsonb; r erp_supply.freight_tariff_rules%rowtype; dep text; city text; carrier text; dim numeric; p jsonb;
begin
 perform erp_supply.require_freight_quote_access();
 carrier:=coalesce(p_payload->>'carrier','TCC');if carrier not in ('TCC','ENVIA') then raise exception 'Transportadora no soportada' using errcode='22023';end if;
 tcc:=erp_supply.freight_quote_tcc_snapshot(p_payload||'{"carrier":"TCC"}');
 for p in select value from jsonb_array_elements(p_payload->'packages') loop
  for dim in select nullif(p->>key,'')::numeric from unnest(array['lengthM','widthM','heightM','volumeM3']) key loop
   if dim is not null and (dim<=0 or dim>100000 or dim::text in ('NaN','Infinity','-Infinity')) then raise exception 'Dimensión inválida' using errcode='22023';end if;
  end loop;
 end loop;
 dep:=erp_supply.envia_territory_key(tcc->>'department');city:=erp_supply.envia_territory_key(regexp_replace(tcc->>'destination','\s*\([^)]*\)\s*$',''));
 -- TCC's literal PDF places Bogotá under Cundinamarca. Resolve only the exact city for ENVÍA; retain the original TCC identity.
 if city in ('BOGOTA','BOGOTA DC') and dep in ('CUNDINAMARCA','BOGOTA DC','BOGOTA') then dep:='BOGOTA DC';city:='BOGOTA';end if;
 select rules.* into r from erp_supply.freight_tariff_rules rules join erp_supply.freight_tariff_editions edition on edition.version=rules.dataset_version
 where rules.carrier='ENVIA' and rules.dataset_version='ENVIA_CLAUDE_2026_10_13_V1' and rules.active and edition.active
 and rules.department_key=dep and (rules.coverage_scope='DEPARTMENT' or rules.city_key=city) order by rules.priority desc,rules.source_key limit 1;
 envia:=jsonb_build_object('carrier','ENVIA','origin',tcc->'origin','destination',tcc->'destination','department',tcc->'department','center',tcc->'center','tariffVersion','ENVIA_CLAUDE_2026_10_13_V1','policyVersion','ENVIA_CLAUDE_2026_10_13_V1','sourceSha256','31eabc1726a15bd3a148b9655d1a8a4d90d7447b9bae150fab311295c3c036d5','sourceKey',r.source_key,'originScope','UNCONFIRMED','reference',erp_supply.envia_reference_calculate(r.source_data,p_payload->'packages',r.policy),'calculatedAt',tcc->'calculatedAt','warning','Estimación interna ENVÍA aportada por Claude. No es tarifa contractual vigente. Origen no confirmado por la fuente; divisor 5000 supuesto. Rango heurístico, sin probabilidad estadística calibrada.');
 selected:=case when carrier='ENVIA' then envia else tcc end;
 return selected||jsonb_build_object('comparison',jsonb_build_array(tcc,envia),'prediction',tcc->'prediction','carrierAliases',jsonb_build_object('COLVANES','ENVÍA'));
end $$;

create or replace function public.erp_x_freight_quote_save(p_payload jsonb) returns jsonb
language plpgsql security definer set search_path=erp_supply,public,auth,pg_catalog as $$
declare actor uuid; org uuid:=erp_supply.current_org_id(); snapshot jsonb; q erp_supply.freight_quotes%rowtype; orderid uuid; carrier text; possible boolean;
begin
 actor:=erp_supply.require_freight_quote_access('create');snapshot:=public.erp_x_freight_quote_calculate(p_payload);orderid:=nullif(p_payload->>'orderId','')::uuid;carrier:=snapshot->>'carrier';
 if orderid is not null and not exists(select 1 from erp_supply.orders where id=orderid and organization_id=org and erp_supply.can_view_order(id)) then raise exception 'Pedido no autorizado' using errcode='42501';end if;
 if coalesce(p_payload->>'status','') not in ('DRAFT','CALCULATED') then raise exception 'Estado inválido' using errcode='22023';end if;
 possible:=case when carrier='ENVIA' then snapshot#>>'{reference,status}'='ESTIMATED_REFERENCE' else snapshot#>>'{reference,status}'='HISTORICAL_REFERENCE' or coalesce((snapshot#>>'{prediction,available}')::boolean,false) end;
 if p_payload->>'status'='CALCULATED' and not coalesce(possible,false) then raise exception 'Sin liquidación disponible: guarda un borrador';end if;
 if jsonb_typeof(p_payload->'materials') is distinct from 'array' or jsonb_array_length(p_payload->'materials')>100 then raise exception 'Materiales inválidos' using errcode='22023';end if;
 insert into erp_supply.freight_quotes(organization_id,created_by,order_id,status,carrier,tariff_version,policy_version,input,snapshot)
 values(org,actor,orderid,p_payload->>'status',carrier,snapshot->>'tariffVersion',snapshot->>'policyVersion',p_payload,snapshot) returning * into q;
 return to_jsonb(q);
end $$;
revoke all on function public.erp_x_freight_quote_calculate(jsonb),public.erp_x_freight_quote_save(jsonb) from public,anon;
grant execute on function public.erp_x_freight_quote_calculate(jsonb),public.erp_x_freight_quote_save(jsonb) to authenticated;
commit;
