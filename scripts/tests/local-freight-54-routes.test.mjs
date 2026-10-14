import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {LOCAL_DISPATCH_TARIFFS,calculateLocalDispatch,LOCAL_DISPATCH_TARIFF_VERSION} from '../../assets/js/domains/logistics/local-dispatch/tariffs.js';
import {quoteView,quoteResultHtml} from '../../assets/js/domains/freight-quotes/quote-view.js';
import {quoteCanSaveCalculated} from '../../assets/js/domains/freight-quotes/carrier-adapters.js';

const root=new URL('../../',import.meta.url);
const text=p=>fs.readFileSync(new URL(p,root),'utf8');
test('CSV = 54 únicas, JS y SQL con importes idénticos',()=>{
 const [header,...lines]=text('data/freight/local/ibarra-routes.csv').trim().split(/\r?\n/);
 assert.equal(lines.length,54);
 assert.match(header,/valor_flete_base_cop/);
 const sql=text('supabase/migrations/20261014160100_local_freight_ibarra_54_routes.sql');
 assert.equal(LOCAL_DISPATCH_TARIFFS.length,54);
 assert.equal(new Set(LOCAL_DISPATCH_TARIFFS.map(x=>x.code)).size,54);
 for(const line of lines){
  const [category,code,baseFrom,baseUntil,base,extraFrom,extraUntil,extra]=line.split(',');
  const row=LOCAL_DISPATCH_TARIFFS.find(x=>x.code===code);
  assert.ok(row,'Falta '+code);
  assert.equal(row.category,category);
  assert.equal(row.base,Number(base));
  assert.equal(row.extraPerKg,Number(extra));
  assert.equal(row.limitKg,1000);
  assert.equal(row.maxKg,2500);
  assert.deepEqual([baseFrom,baseUntil,extraFrom,extraUntil],['0','1000','1001','2500']);
  assert.ok(sql.includes("'"+code.replaceAll("'","''")+"'"),'SQL missing '+code);
  assert.match(sql,new RegExp("\\b"+base+"\\b"));
 }
 assert.equal(LOCAL_DISPATCH_TARIFF_VERSION,'LUIS_IBARRA_CSV_2026_10_14');
});
test('boundary weights: exact base + next chargeable kilo; zero is not a quote',()=>{
 const urban=w=>calculateLocalDispatch('URBANO',w);
 assert.equal(urban(1000).total,30000);
 assert.equal(urban(1000.1).total,30047);
 assert.equal(urban(1001).total,30047);
 assert.equal(urban(2500).total,100500);
 assert.equal(urban(2500.01).available,false);
 assert.equal(urban(0).available,false);
 assert.equal(calculateLocalDispatch('CALI',1000).total,600000);
 assert.equal(calculateLocalDispatch('SAN PEDRO',1010,30000,15000).total,105470);
 assert.equal(calculateLocalDispatch('RUTA FICTICIA',1000).available,false);
 assert.equal(calculateLocalDispatch('URBANO',20,-1,0).available,false);
});
test('third carrier has its own route, source, recargos, save and history controls',()=>{
 const html=quoteView();
 for(const mark of ['data-carrier-choice="LOCAL"','name="localDestinationCode"','name="localUnloadingCost"',
  'name="localDiversionCost"','name="localExtraReason"','data-local-controls','value="LOCAL">Transporte local'])
 assert.ok(html.includes(mark),mark);
 const result={carrier:'LOCAL',comparison:[{carrier:'LOCAL',origin:'TULUA',destination:'URBANO',
  reference:{status:'LOCAL_TARIFF_REFERENCE',baseCop:30000,extraKg:2,extraPerKgCop:47},
  localExtras:{unloadingCop:10000,diversionCop:0,reason:'Ayudante en el cargue'},
  commercialEstimate:{available:true,totalCop:40094,rangeLowCop:40094,rangeHighCop:40094}}]};
 const card=quoteResultHtml(result,{selectedCarrier:'LOCAL'});
 assert.match(card,/40.094/);
 assert.match(card,/10.000/);
 assert.match(card,/LOCAL/);
 assert.equal(quoteCanSaveCalculated(result.comparison[0]),true);
});
test('no overwrite TCC/ENVIA data, local save bound to server and cost changes remain audited',()=>{
 const one=text('supabase/migrations/20261014160100_local_freight_ibarra_54_routes.sql');
 const two=text('supabase/migrations/20261014160200_local_dispatch_quoted_weights.sql');
 const stage=text('assets/js/domains/logistics/local-dispatch/local-dispatch-stage.js');
 const audit=text('assets/js/domains/logistics/local-dispatch/cost-adjustments.js');
 assert.match(one,/if p_payload->>'carrier'='LOCAL'/);
 assert.match(one,/erp_supply\.freight_quote_market_overlay/);
 assert.match(one,/carrier in \('TCC','ENVIA','LOCAL'\)/);
 assert.match(one,/source_version='LUIS_IBARRA_CSV_2026_10_14'/);
 assert.match(two,/max_weight_kg/);
 assert.match(two,/v_tariff\.source_version/);
 assert.match(two,/tariffVersion/);
 assert.match(stage,/calculateLocalDispatch/);
 assert.match(stage,/data-local-matrix-warning/);
 assert.match(audit,/AYUDANTE/);
 assert.match(audit,/DESVIO/);
 assert.match(audit,/Justificación del cambio/);
});
