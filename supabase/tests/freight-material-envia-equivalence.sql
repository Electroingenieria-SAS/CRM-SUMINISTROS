begin;
do $$declare rule record;w numeric;legacy jsonb;modern jsonb;threshold numeric;begin
 for rule in select * from erp_supply.freight_tariff_rules where carrier='ENVIA' loop
 threshold:=floor(rule.min_base_cop/rule.rate_per_kg_cop)+1;
 foreach w in array array[1::numeric,threshold-1,threshold,threshold+1,100,101] loop
 legacy:=erp_supply.envia_reference_calculate(rule.source_data,jsonb_build_array(jsonb_build_object('weightKg',w,'quantity',1)),rule.policy);
 modern:=erp_supply.freight_material_reference('ENVIA','WEIGHT',w,rule.rate_per_kg_cop,rule.policy||rule.source_data,null);
 if legacy->'baseCop'<>modern->'baseCop' or legacy->'totalCop'<>modern->'totalCop' or legacy->'marginPct'<>modern->'marginPct' or legacy->'rangeLowCop'<>modern->'rangeLowCop' or legacy->'rangeHighCop'<>modern->'rangeHighCop' then raise exception 'ENVIA changed % %',rule.source_key,w;end if;
 end loop;
 end loop;
end $$;
select 'PASS: material measurement adapter preserves ENVIA base, minimum, variable and ranges for all 25 rules at six weight boundaries' result;
rollback;
