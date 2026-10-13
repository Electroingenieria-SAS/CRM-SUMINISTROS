import fs from 'node:fs';
import crypto from 'node:crypto';
import {coverageFor} from './envia-coverage.mjs';
const data=fs.readFileSync(new URL('../../data/freight/envia/source-dataset.json',import.meta.url));
const source=JSON.parse(data),checksum=crypto.createHash('sha256').update(data).digest('hex');
if(source.entries.length!==25||new Set(source.entries.map(r=>r.key)).size!==25)throw Error('25 reglas requeridas');
const literal=v=>"'"+String(v).replaceAll("'","''")+"'";
const header=`begin;
alter table erp_supply.freight_tariff_editions drop constraint if exists freight_tariff_editions_status_check;
alter table erp_supply.freight_tariff_editions add constraint freight_tariff_editions_status_check check(status in ('HISTORICAL_REFERENCE','ESTIMATED_REFERENCE'));
alter table erp_supply.freight_tariff_editions add column if not exists active boolean not null default true;
alter table erp_supply.freight_quotes drop constraint if exists freight_quotes_carrier_check;
alter table erp_supply.freight_quotes add constraint freight_quotes_carrier_check check(carrier in ('TCC','ENVIA'));
create table if not exists erp_supply.freight_tariff_rules (
 carrier text not null, dataset_version text not null references erp_supply.freight_tariff_editions(version),source_key text not null,
 department_key text not null,city_key text not null,coverage_scope text not null check(coverage_scope in ('CITY','DEPARTMENT')),
 priority integer not null,rate_per_kg_cop numeric(12,2) not null check(rate_per_kg_cop>0),min_base_cop integer not null check(min_base_cop>0),
 fixed_variable_cop integer not null check(fixed_variable_cop>=0),source_confidence text not null check(source_confidence in ('alta','media')),
 policy jsonb not null,source_data jsonb not null,active boolean not null default true,
 primary key(carrier,dataset_version,source_key)
);
create index if not exists freight_tariff_rules_lookup on erp_supply.freight_tariff_rules(carrier,dataset_version,department_key,city_key,priority desc) where active;
alter table erp_supply.freight_tariff_rules enable row level security;
revoke all on erp_supply.freight_tariff_rules from public,anon,authenticated;
create table if not exists erp_supply.freight_carrier_aliases (
 carrier_code text primary key, historical_code text not null,source_url text not null,verified_at date not null
);
alter table erp_supply.freight_carrier_aliases enable row level security;
revoke all on erp_supply.freight_carrier_aliases from public,anon,authenticated;
insert into erp_supply.freight_carrier_aliases values('ENVIA','COLVANES','https://envia.co/contacto','2026-10-13') on conflict do nothing;
insert into erp_supply.freight_tariff_editions(version,carrier,status,source_sha256,dataset_sha256,source_name,expected_rows)
 values('ENVIA_CLAUDE_2026_10_13_V1','ENVIA','ESTIMATED_REFERENCE',${literal(source.source.sha256)},${literal(checksum)},'Modelo Claude suministrado 2026-10-13',25) on conflict do nothing;
`;
const rows=source.entries.map(r=>{
 const c=coverageFor(r.key);
 return `insert into erp_supply.freight_tariff_rules(carrier,dataset_version,source_key,department_key,city_key,coverage_scope,priority,rate_per_kg_cop,min_base_cop,fixed_variable_cop,source_confidence,policy,source_data) values('ENVIA','ENVIA_CLAUDE_2026_10_13_V1',${literal(r.key)},${literal(c.departmentKey)},${literal(c.cityKey)},${literal(c.scope)},${c.priority},${r.rate_per_kg_cop},${r.min_base_cop},${r.fixed_variable_cop},${literal(r.source_confidence)},${literal(JSON.stringify(source.policy))}::jsonb,${literal(JSON.stringify(r))}::jsonb) on conflict do nothing;`;
}).join('\n');
const verify=`\ndo $$ begin
 if (select count(*) from erp_supply.freight_tariff_rules where dataset_version='ENVIA_CLAUDE_2026_10_13_V1')<>25 then raise exception 'ENVIA lote incompleto'; end if;
 if (select dataset_sha256 from erp_supply.freight_tariff_editions where version='ENVIA_CLAUDE_2026_10_13_V1')<>${literal(checksum)} then raise exception 'Checksum de edición incompatible'; end if;
end $$;\ncommit;\n`;
fs.writeFileSync(new URL('../../supabase/migrations/20261013220000_envia_reference_rules.sql',import.meta.url),header+rows+verify);
console.log(JSON.stringify({rows:25,checksum}));
