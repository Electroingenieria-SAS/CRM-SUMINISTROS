import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {quoteView,quoteResultHtml,quoteHistoryHtml} from '../../assets/js/domains/freight-quotes/quote-view.js';
import {measurementCardHtml} from '../../assets/js/domains/freight-quotes/measurement-view.js';

test('UI guiada: accesible, tres acciones, selectores contractuales intactos',()=>{
 const html=quoteView();
 for(const marker of ['¿A dónde enviaremos?','¿Qué vamos a enviar?','Compara los fletes','name="origin"','name="department"','name="destinationKey"','name="carrier"','name="declaredValue"','data-destination-search','data-material-count','data-material-weight','data-material-volume','data-history-search','data-history-carrier','data-save-quote','data-save-draft','data-quote-materials','data-quote-history'])assert.ok(html.includes(marker),marker);
 assert.doesNotMatch(html,/Ver indicador estadístico histórico por transportadora|Bultos y medidas/);
 assert.match(html,/aria-live="polite"/);
});
test('resultado comercial sigue incluyendo ambas transportadoras y no reintroduce histórico duplicado',()=>{
 const fixture=carrier=>({carrier,origin:'TULUA',destination:'BOGOTA',commercialEstimate:{available:true,source:carrier==='TCC'?'TCC_REAL_GUIDE_MODEL':'ENVIA_REFERENCE',totalCop:carrier==='TCC'?85000:79000,rangeLowCop:70000,rangeHighCop:110000,statisticalRange:true},
  measurementScenarios:{weight:{status:'UNAVAILABLE',complete:false,measuredMaterials:0,totalMaterials:1},volume:{status:'UNAVAILABLE',complete:false,measuredMaterials:0,totalMaterials:1}},reference:{status:'UNAVAILABLE'}});
 const html=quoteResultHtml({comparison:[fixture('TCC'),fixture('ENVIA')],prediction:{available:true}});
 assert.match(html,/Compara tus opciones/);
 assert.match(html,/data-carrier-reference="TCC"/);
 assert.match(html,/data-carrier-reference="ENVIA"/);
 assert.match(html,/Menor estimación orientativa/);
 assert.doesNotMatch(html,/Ver indicador estadístico histórico por transportadora|freight-historical-details/);
});
test('historial: cotizaciones claras, filtro vacío y escapes seguros',()=>{
 const q={id:'1',folio:8,status:'CALCULATED',carrier:'TCC',created_at:'2026-10-13T12:00:00.000Z',
  snapshot:{origin:'TULUA',destination:'BOGOTA',reference:{status:'UNAVAILABLE'},commercialEstimate:{available:true,totalCop:62000}},
  actual_cost_cop:67000,order_number:'<svg onload=alert(1)>'};
 const html=quoteHistoryHtml([q]);
 assert.match(html,/CF-8/);
 assert.match(html,/Estimado/);
 assert.match(html,/Valor cobrado/);
 assert.match(html,/Desviación/);
 assert.match(html,/data-quote-duplicate/);
 assert.doesNotMatch(html,/<svg/);
 assert.match(quoteHistoryHtml([],{filtered:true}),/Sin resultados para estos filtros/);
 assert.match(quoteHistoryHtml([]),/Aún no hay cotizaciones guardadas/);
});
test('materiales: botones duplicar/eliminar preservan el contrato de peso y volumen',()=>{
 const code=fs.readFileSync(new URL('../../assets/js/domains/freight-quotes/quote-lines.js',import.meta.url),'utf8');
 for(const token of ['data-material-name','data-measure-value','data-mode','data-duplicate-line','data-remove-line','data-material-number','row.readMaterial','weightKg','volumeM3','host.dispatchEvent'])assert.ok(code.includes(token),token);
 const css=fs.readFileSync(new URL('../../assets/css/modules/freight/quotes.css',import.meta.url),'utf8');
 for(const token of ['.freight-route-grid','.freight-material-summary','.freight-action-bar','.freight-history-tools','.freight-price-hero','prefers-reduced-motion','position:sticky'])assert.ok(css.includes(token),token);
});
