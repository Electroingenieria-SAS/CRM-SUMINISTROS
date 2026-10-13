import {test} from 'node:test';
import assert from 'node:assert/strict';
import {quoteView} from '../../assets/js/domains/freight-quotes/quote-view.js';
test('formulario centrado en material, sin bultos ni dimensiones',()=>{
 const html=quoteView();assert.doesNotMatch(html,/Bultos y medidas|data-quote-packages|data-add-package/);assert.match(html,/Peso.*Volumen/);
});
test('mismo material conserva peso y volumen al alternar modalidad',async()=>{
 const {measurementSummary}=await import('../../assets/js/domains/freight-quotes/material-measurements.js');
 assert.deepEqual(measurementSummary([{description:'Cable',weightKg:20,volumeM3:.06}]),{count:1,weightKg:20,volumeM3:.06,weightCount:1,volumeCount:1});
 const r=measurementSummary([{weightKg:10},{volumeM3:.2}]);assert.equal(r.weightCount,1);assert.equal(r.volumeCount,1);assert.equal(r.count,2);
 assert.throws(()=>measurementSummary([{weightKg:-2}]));
});
test('cada escenario ENVÍA conserva el aviso sobre pesos extrapolados',async()=>{
 const {measurementCardHtml}=await import('../../assets/js/domains/freight-quotes/measurement-view.js');
 const ref={status:'ESTIMATED_REFERENCE',amount:101,billableKg:101,totalCop:48700,baseCop:40050,variableCop:8650,complete:true,measuredMaterials:1,totalMaterials:1,warnings:['EXTRAPOLATED_OVER_100_KG']};
 assert.match(measurementCardHtml({carrier:'ENVIA',selectedBasis:'WEIGHT',measurementScenarios:{weight:ref,volume:{status:'REQUIRES_INFORMATION'}}}),/extrapolada/i);
});
