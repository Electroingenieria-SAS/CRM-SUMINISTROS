import fs from 'node:fs';
const fixtures=JSON.parse(fs.readFileSync(new URL('../../data/freight/envia/verified-fixtures.json',import.meta.url)));
const quoted=v=>"'"+JSON.stringify(v).replaceAll("'","''")+"'";
const sql=`begin;
do $$
declare c jsonb; r erp_supply.freight_tariff_rules%rowtype; result jsonb; n integer:=0;
begin
 for c in select value from jsonb_array_elements(${quoted(fixtures.cases)}::jsonb) loop
  select * into strict r from erp_supply.freight_tariff_rules where carrier='ENVIA' and dataset_version='ENVIA_CLAUDE_2026_10_13_V1' and source_key=c->>'destination_matrix_key';
  result:=erp_supply.envia_reference_calculate(r.source_data,jsonb_build_array(jsonb_build_object('weightKg',c->'real_weight_kg','quantity',1)),r.policy);
  if (result->>'baseCop')::numeric<>(c->>'correct_base_cop_half_up')::numeric or (result->>'totalCop')::numeric<>(c->>'correct_total_cop_half_up')::numeric then raise exception 'Fixture % falló %',c->>'id',result;end if;
  if (result->>'thresholdKg')::integer<>(r.source_data->>'threshold_kg_derived')::integer then raise exception 'Umbral incorrecto';end if;
  n:=n+1;
 end loop;
 if n<>33 then raise exception 'Fixtures incompletos';end if;
end $$;
select 'PASS: ENVIA 33/33 exact decimal fixtures, corrected Caquetá and derived thresholds' result;
rollback;\n`;
fs.writeFileSync(new URL('../../supabase/tests/envia-33-fixtures.sql',import.meta.url),sql);
