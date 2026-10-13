import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {measurementCardHtml} from '../../assets/js/domains/freight-quotes/measurement-view.js';
import {quoteResultHtml} from '../../assets/js/domains/freight-quotes/quote-view.js';
import {buildShippingGuidePayload} from '../../assets/js/domains/logistics/shipping/guide/payload.js';
import {quoteCanSaveCalculated} from '../../assets/js/domains/freight-quotes/carrier-adapters.js';

const migration=fs.readFileSync(new URL('../../supabase/migrations/20261013233000_freight_carrier_market_overlay.sql',import.meta.url),'utf8');
const guideMigration=fs.readFileSync(new URL('../../supabase/migrations/20261013233100_freight_guide_carrier_measurements.sql',import.meta.url),'utf8');
const auditMigration=fs.readFileSync(new URL('../../supabase/migrations/20261013233200_freight_quote_same_carrier_audit.sql',import.meta.url),'utf8');

test('TCC conserva referencia documental y diferencia actualización IPC documentada',()=>{
 assert.match(migration,/1\.051::numeric\*1\.0574::numeric/);
 assert.match(migration,/TCC_2024_IPC_2026/);
 assert.match(migration,/TCC_REAL_GUIDE_MODEL/);
 assert.match(migration,/No Tuluá\/Cali equivalence/);
 assert.match(migration,/return erp_supply\.freight_quote_legacy_calculate\(p_payload\)/);
});
test('solo registros reales de la misma empresa contribuyen a la calibración',()=>{
 assert.match(migration,/d\.carrier_cost>0 and d\.carrier_cost_currency='COP'/);
 assert.match(migration,/o\.is_test is distinct from true/);
 assert.match(migration,/d\.carrier_invoice_number/);
 assert.match(migration,/freightWeightKg/);
 assert.match(migration,/n>=3/);
 assert.match(migration,/p_carrier='ENVIA'/);
 assert.match(migration,/in \('ENVIA','COLVANES'\)/);
 assert.match(migration,/RECENCY_WEIGHTED_IQR_180D/);
 assert.match(auditMigration,/when q\.carrier='ENVIA'/);
 assert.match(auditMigration,/carrier_cost_currency='COP'/);
});
test('guía TCC exige metadatos confirmados antes de registrar aprendizaje',()=>{
 assert.throws(()=>buildShippingGuidePayload({trackingNumber:'XYZ',carrier:'TCC',carrierInvoiceNumber:'1',carrierCost:'23000',carrierCostCurrency:'COP'}),/origen y peso/);
 const tcc=buildShippingGuidePayload({trackingNumber:'XYZ',carrier:'TCC',carrierInvoiceNumber:'1',carrierCost:'23000',carrierCostCurrency:'COP',freightOrigin:'TULUA',freightWeightKg:'20',freightVolumeM3:'0.06'});
 const envia=buildShippingGuidePayload({trackingNumber:'ENV-123',carrier:'ENVÍA',carrierInvoiceNumber:'F2',carrierCost:'28000',carrierCostCurrency:'COP',freightOrigin:'TULUA',freightWeightKg:'20'});
 assert.equal(tcc.freightOrigin,'TULUA');
 assert.equal(tcc.freightWeightKg,20);
 assert.equal(tcc.freightVolumeM3,0.06);
 assert.equal(envia.freightWeightKg,20);
 assert.match(guideMigration,/'freightOrigin',v_freight_origin/);
 assert.match(guideMigration,/'freightWeightKg',v_freight_weight/);
});
test('tarjeta comercial destaca rango y conserva trazabilidad y precios por fuente',()=>{
 const ref={status:'HISTORICAL_REFERENCE',amount:20,billableKg:20,baseCop:19060,handlingCop:0,subtotalCop:19060,complete:true,measuredMaterials:1,totalMaterials:1};
 const html=measurementCardHtml({carrier:'TCC',origin:'CALI',destination:'TULUA',tariffVersion:'TRADICIONALES_2023_2024',selectedBasis:'WEIGHT',cheapestCommercial:true,measurementScenarios:{weight:ref,volume:{status:'REQUIRES_INFORMATION'}},commercialEstimate:{available:true,source:'TCC_2024_IPC_2026',totalCop:21182,rangeLowCop:19000,rangeHighCop:27000,baseCop:21182,variableCop:0,reference2024Cop:19060,statisticalRange:true,guideCalibration:{samples:0,applied:false}}});
 assert.match(html,/RANGO ESTIMADO DEL FLETE/);
 assert.match(html,/Menor estimación orientativa/);
 assert.match(html,/Flete base estimado/);
 assert.match(html,/IPC DANE/);
 assert.match(html,/Estimación con tarifas TCC actualizadas a 2026/);
 assert.match(html,/Valor estimado, no tarifa oficial/);
 for(const lengthy of [/Guías nuevas estrictamente comparables/,/dispersión histórica/,/Sin recalibración automática/,/IPC compuesto:/, /Rango heurístico/])
   assert.doesNotMatch(html,lengthy,'Eliminar detalles técnicos de la tarjeta principal');
 assert.match(html,/Consultar referencia original/);
});
test('solo se permite guardar estimado de la transportadora elegida',()=>{
 assert.equal(quoteCanSaveCalculated({carrier:'TCC',commercialEstimate:{available:false},prediction:{available:true}}),false);
 assert.equal(quoteCanSaveCalculated({carrier:'ENVIA',commercialEstimate:{available:true}}),true);
});

test('TCC y ENVÍA muestran la fuente breve, sin guías o notas técnicas visibles',()=>{
 const fixture=(carrier,source)=>measurementCardHtml({
  carrier,origin:'TULUA',destination:'BOGOTA',tariffVersion:'HISTORICO',
  measurementScenarios:{
   weight:{status:'UNAVAILABLE',measuredMaterials:0,totalMaterials:1,complete:false},
   volume:{status:'UNAVAILABLE',measuredMaterials:0,totalMaterials:1,complete:false}
  },
  commercialEstimate:{available:true,source,totalCop:65000,rangeLowCop:55000,rangeHighCop:75000,statisticalRange:true,guideCalibration:{samples:0,applied:false}}
 });
 const tcc=fixture('TCC','TCC_REAL_GUIDE_MODEL'),envia=fixture('ENVIA','ENVIA_REFERENCE');
 assert.match(tcc,/Estimación con historial de TCC/);
 assert.match(envia,/Estimación con referencias de ENVÍA/);
 for(const html of [tcc,envia]){
  assert.match(html,/Valor estimado, no tarifa oficial/);
  assert.doesNotMatch(html,/Guías nuevas estrictamente comparables|Intervalo derivado de la dispersión histórica|Sin recalibración automática|Reglas internas ENVÍA/);
 }
});
test('no se renderiza el panel histórico duplicado, pero se conserva la cotización comparativa',()=>{
 const result={comparison:[
  {carrier:'TCC',origin:'TULUA',destination:'BOGOTA',reference:{status:'UNAVAILABLE'},tariffVersion:'TCC',warning:'',commercialEstimate:{available:true,totalCop:65000}},
  {carrier:'ENVIA',origin:'TULUA',destination:'BOGOTA',reference:{status:'UNAVAILABLE'},tariffVersion:'ENVIA',warning:'',commercialEstimate:{available:true,totalCop:61000}}
 ],prediction:{available:true,carriers:[{carrier:'TCC',estimateMid:62000},{carrier:'COLVANES',estimateMid:61000}]}};
 const html=quoteResultHtml(result);
 assert.match(html,/freight-comparison-grid/);
 assert.match(html,/data-carrier-reference="TCC"/);
 assert.match(html,/data-carrier-reference="ENVIA"/);
 assert.doesNotMatch(html,/freight-historical-details|Ver indicador estadístico histórico por transportadora|sales-freight-carriers-v1140/);
});
