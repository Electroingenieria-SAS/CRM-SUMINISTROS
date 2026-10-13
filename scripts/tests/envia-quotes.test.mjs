import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const source=JSON.parse(fs.readFileSync(new URL('../../data/freight/envia/source-dataset.json',import.meta.url)));
const fixtures=JSON.parse(fs.readFileSync(new URL('../../data/freight/envia/verified-fixtures.json',import.meta.url)));
test('25 reglas y 33 fixtures, Caquetá half-up conserva discrepancia',async()=>{
 const {calculateEnviaReference}=await import('../../assets/js/domains/freight-quotes/envia-reference.js');
 assert.equal(source.entries.length,25);assert.equal(new Set(source.entries.map(r=>r.key)).size,25);assert.equal(fixtures.cases.length,33);
 for(const c of fixtures.cases){
  const rule=source.entries.find(r=>r.key===c.destination_matrix_key);
  const r=calculateEnviaReference(rule,[{weightKg:c.real_weight_kg,quantity:1}],source.policy);
  assert.equal(r.baseCop,c.correct_base_cop_half_up,c.id);assert.equal(r.totalCop,c.correct_total_cop_half_up,c.id);assert.equal(r.variableCop,c.correct_variable_cop,c.id);
  assert.equal(r.official,false);assert.equal(r.provisionalDimensions,true);
 }
 const ca=fixtures.cases.find(c=>c.id==='ENVIA_SOURCE_17');assert.equal(ca.correct_total_cop_half_up,51267);assert.equal(ca.source_expected_total_cop,51266);
});
test('cobertura: Tunja prioritaria, departamentos explícitos y capitales restringidas',async()=>{
 const {resolveEnviaRule}=await import('../freight/envia-coverage.mjs');
 const pick=(dep,city)=>resolveEnviaRule(source.entries,dep,city)?.key;
 assert.equal(pick('Boyacá','Tunja'),'Boyacá (Tunja)');assert.equal(pick('Boyacá','Duitama'),'Boyacá (general)');
 assert.equal(pick('Valle del Cauca','Tuluá'),'Valle del Cauca (Cali)');assert.equal(pick('Caquetá','San Vicente del Caguán'),'Caquetá (Florencia)');
 assert.equal(pick('Córdoba','Montería'),'Córdoba (Montería)');assert.equal(pick('Córdoba','Sahagún'),undefined);
 assert.equal(pick('Tolima','Ibagué'),'Tolima (Ibagué)');assert.equal(pick('Tolima','Espinal'),undefined);
 assert.equal(pick('Nariño','Ipiales'),undefined);assert.equal(pick('Cundinamarca','Soacha'),undefined);
 assert.equal(pick('Risaralda','Pereira'),'Risaralda');assert.equal(pick('Quindío','Armenia'),'Quindío');
});
test('dimensiones, redondeos, margen, varios bultos, extrapolación y entradas inválidas',async()=>{
 const {calculateEnviaReference}=await import('../../assets/js/domains/freight-quotes/envia-reference.js');
 const valley=source.entries.find(r=>r.key==='Valle del Cauca (Cali)');
 let r=calculateEnviaReference(valley,[{weightKg:'38.001',quantity:1}],source.policy);assert.equal(r.billableKg,39);assert.equal(r.baseCop,15464);assert.equal(r.marginPct,10);
 r=calculateEnviaReference(valley,[{weightKg:20,lengthM:.5,widthM:.4,heightM:.3,quantity:1}],source.policy);assert.equal(r.volumeWeightKg,12);assert.equal(r.billableKg,20);assert.equal(r.totalCop,23900);assert.equal(r.marginPct,5);
 r=calculateEnviaReference(valley,[{weightKg:1,volumeM3:.06,quantity:1}],source.policy);assert.equal(r.billableKg,12);
 r=calculateEnviaReference(valley,[{weightKg:101,quantity:1}],source.policy);assert.ok(r.warnings.includes('EXTRAPOLATED_OVER_100_KG'));
 assert.equal(calculateEnviaReference(valley,[{weightKg:10,quantity:2}],source.policy).status,'PENDING_PACKAGING_RULE');
 assert.equal(calculateEnviaReference(valley,[{weightKg:10},{weightKg:10}],source.policy).totalCop,undefined);
 for(const weight of [0,-1,NaN,'abc',null])assert.throws(()=>calculateEnviaReference(valley,[{weightKg:weight}],source.policy));
 assert.throws(()=>calculateEnviaReference(valley,[{weightKg:10,lengthM:-.5,widthM:-.4,heightM:.3}],source.policy));
 assert.equal(calculateEnviaReference(valley,[{weightKg:10,lengthM:.5}],source.policy).status,'REQUIRES_INFORMATION');
});
test('replay cronológico conserva las APIs multitransportadora después del catálogo TCC',()=>{
 const dir=new URL('../../supabase/migrations/',import.meta.url);
 const files=fs.readdirSync(dir).filter(f=>f.endsWith('.sql')).sort();
 const latest=signature=>files.filter(f=>fs.readFileSync(new URL(f,dir),'utf8').includes(signature)).at(-1);
 const calculate=latest('create or replace function public.erp_x_freight_quote_calculate(');
 assert.match(fs.readFileSync(new URL(calculate,dir),'utf8'),/envia_reference_calculate/);
 const rules=files.find(f=>f.endsWith('_envia_reference_rules.sql'));
 assert.ok(rules>files.find(f=>f.endsWith('_freight_quotes_catalog.sql')));
 const save=latest('create or replace function public.erp_x_freight_quote_save(');
 assert.match(fs.readFileSync(new URL(save,dir),'utf8'),/ENVIA/);
});
