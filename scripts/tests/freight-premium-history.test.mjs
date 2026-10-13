import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {quoteView,quoteResultHtml,quoteHistoryHtml} from '../../assets/js/domains/freight-quotes/quote-view.js';
import {filterHistoryItems,historySummary,historyCsv} from '../../assets/js/domains/freight-quotes/quote-history-view.js';

const entries=[
 {id:'a',folio:15,created_at:'2026-10-11T15:00:00Z',status:'CALCULATED',carrier:'TCC',
  snapshot:{origin:'TULUA',destination:'BOGOTA',commercialEstimate:{available:true,totalCop:94000}},actual_cost_cop:101000,order_number:'P-9'},
 {id:'b',folio:16,created_at:'2026-10-13T15:00:00Z',status:'DRAFT',carrier:'ENVIA',
  snapshot:{origin:'CALI',destination:'PEREIRA',commercialEstimate:{available:false}},actual_cost_cop:null,order_number:null},
 {id:'c',folio:17,created_at:'2026-10-12T15:00:00Z',status:'CALCULATED',carrier:'ENVIA',
  snapshot:{origin:'TULUA',destination:'ARMENIA',commercialEstimate:{available:true,totalCop:55000}},actual_cost_cop:52000,order_number:null}
];

test('vista comercial separa nueva cotización e historial, conservando contratos del formulario',()=>{
 const html=quoteView();
 for(const id of ['data-quote-workspace','data-history-workspace','data-view-tab="history"','data-history-status','data-history-sort','data-history-export','data-history-clear','data-history-overview','data-history-tab-count','data-history-search','data-history-carrier','data-save-draft','data-save-quote']){
  if(id==='data-history-overview')continue;
  assert.ok(html.includes(id),id);
 }
 assert.match(html,/aria-selected="true"/);
 assert.match(html,/Cotización de fletes/);
});
test('filtros y orden son estables, se limitan a elementos recibidos',()=>{
 assert.deepEqual(filterHistoryItems(entries,{carrier:'ENVIA'}).map(x=>x.folio),[16,17]);
 assert.deepEqual(filterHistoryItems(entries,{status:'CALCULATED',sort:'highest'}).map(x=>x.folio),[15,17]);
 assert.deepEqual(filterHistoryItems(entries,{sort:'lowest'}).map(x=>x.folio),[17,15,16]);
 assert.deepEqual(filterHistoryItems(entries,{search:'PEREIRA'}).map(x=>x.folio),[16]);
 assert.deepEqual(filterHistoryItems(entries,{search:'tulua'}).map(x=>x.folio),[17,15]);
 const summary=historySummary(entries);
 assert.deepEqual(summary,{count:3,priced:2,withActual:2});
});
test('historial representa estimado, real, diferencia, pedido y acciones',()=>{
 const html=quoteHistoryHtml(entries);
 for(const mark of ['freight-history-table','CF-15','94.000','101.000','7.000','P-9','data-quote-view','data-quote-duplicate','data-quote-link','Borrador','Calculada'])assert.match(html,new RegExp(mark));
 assert.match(quoteHistoryHtml([],{}),/Tu historial comienza aquí/);
 assert.match(quoteHistoryHtml([],{filtered:true}),/Sin resultados para estos filtros/);
});
test('CSV de página filtra fórmulas y conserva encabezados sin datos sensibles',()=>{
 const csv=historyCsv([...entries,{...entries[0],id:'evil',folio:'=2+2',snapshot:{...entries[0].snapshot,destination:'@SUM(2;3)'}}]);
 assert.match(csv,/Folio;|Folio"/);
 assert.match(csv,/'=2\+2/);
 assert.match(csv,/'@SUM/);
 assert.match(csv,/TCC/);
 assert.match(csv,/Estimado COP/);
});
test('se muestran controles para elegir la empresa, sin indicador histórico redundante',()=>{
 const cards=['TCC','ENVIA'].map((carrier,i)=>({
  carrier,origin:'TULUA',destination:'BOGOTA',
  commercialEstimate:{available:true,totalCop:65000+i*5000,rangeLowCop:53000,rangeHighCop:80000,statisticalRange:true,source:carrier==='TCC'?'TCC_REAL_GUIDE_MODEL':'ENVIA_REFERENCE'},
  measurementScenarios:{weight:{status:'UNAVAILABLE',complete:false,measuredMaterials:0,totalMaterials:1},volume:{status:'UNAVAILABLE',complete:false,measuredMaterials:0,totalMaterials:1}},
  reference:{status:'UNAVAILABLE'},tariffVersion:'2024'
 }));
 const html=quoteResultHtml({carrier:'TCC',comparison:cards});
 assert.match(html,/data-quote-select-carrier="TCC"/);
 assert.match(html,/data-quote-select-carrier="ENVIA"/);
 assert.match(html,/Seleccionada/);
 assert.match(html,/Menor estimación orientativa/);
 assert.doesNotMatch(html,/Ver indicador estadístico histórico por transportadora/);
 const readonly=quoteResultHtml({carrier:'TCC',comparison:cards},{selectable:false});
 assert.doesNotMatch(readonly,/data-quote-select-carrier/);
});
test('estilos móviles y controles reales, sin afectar matemáticas',()=>{
 const css=fs.readFileSync(new URL('../../assets/css/modules/freight/quotes.css',import.meta.url),'utf8')+fs.readFileSync(new URL('../../assets/css/modules/freight/quotes-enterprise.css',import.meta.url),'utf8');
 for(const mark of ['.freight-view-nav','.freight-history-table','.freight-history-overview','.freight-offer-select','@media(max-width:760px)','prefers-reduced-motion','[hidden]'])assert.ok(css.includes(mark));
 const controller=fs.readFileSync(new URL('../../assets/js/domains/freight-quotes/quote-controller.js',import.meta.url),'utf8');
 assert.match(controller,/setWorkspace\('history'\)/);
 assert.match(controller,/setWorkspace\('quote'\)/);
 assert.match(controller,/historyCsv\(visibleHistory\)/);
 assert.match(controller,/quoteCanSaveCalculated\(selected\)/);
});
