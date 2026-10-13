import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=p=>fs.readFileSync(new URL('../../'+p,import.meta.url),'utf8');
test('el pedido no cotiza ni persiste nuevas predicciones',()=>{
 for(const path of ['create-order.js','order-form.js','order-review.js','materials.js','delivery-location.js']){
  assert.doesNotMatch(read('assets/js/domains/orders/create/'+path),/bindFreightPrediction|freightPredictionAtCreation|Flete estimado|data-freight-estimate|scheduleFreightEstimate/);
 }
});
test('CSV íntegro, homónimos, NULL y checksum',async()=>{
 const {parseTariffs,validateTariffs}=await import('../freight/tcc-dataset.mjs');
 const rows=parseTariffs(read('data/freight/TCC_TARIFAS_INTEGRACION_VERIFICADAS.csv'));
 assert.deepEqual(validateTariffs(rows),{rows:30107,rates:30086,missing:21,origins:23,msj:30107});
 assert.equal(rows.find(r=>r.paq_rate_source_text==='2.563').paq_rate_cop_kg_reference,2563);
 assert.deepEqual(rows.filter(r=>r.origin_city==='CALI'&&r.destination_pdf==='SAN PABLO (BOLIVAR)').map(r=>r.paq_rate_cop_kg_reference).sort(),[2778,3614]);
 assert.equal(rows.filter(r=>r.origin_city==='TULUA').length,0);
 const invalid=structuredClone(rows);invalid[0].tcc_row_id=invalid[1].tcc_row_id;
 assert.throws(()=>validateTariffs(invalid));
});
test('fixture, límites, múltiples bultos y datos incompletos',async()=>{
 const {calculateTccReference}=await import('../../assets/js/domains/freight-quotes/tcc-reference.js');
 const p={weightKg:20,lengthM:.5,widthM:.4,heightM:.3,quantity:1};
 const result=calculateTccReference(953,[p],100000);
 assert.ok(Math.abs(result.subtotalCop-22872)<1e-8);
 assert.equal(result.official,false);
 assert.equal(calculateTccReference(953,[{weightKg:50,volumeM3:86/400,quantity:1}],199999).packages[0].surchargeCopKg,0);
 assert.equal(calculateTccReference(953,[{weightKg:50.01,volumeM3:.01,quantity:1}],200000).handlingCop,2000);
 assert.equal(calculateTccReference(953,[{weightKg:1,volumeM3:86.01/400,quantity:1}],0).packages[0].surchargeCopKg,50);
 assert.equal(calculateTccReference(953,[{...p,quantity:2}],100000).subtotalCop,result.subtotalCop*2);
 assert.equal(calculateTccReference(null,[p],0).reason,'RATE_UNAVAILABLE');
 assert.equal(calculateTccReference(953,[p],null).status,'REQUIRES_INFORMATION');
 assert.throws(()=>calculateTccReference(953,[{...p,weightKg:-1}],0));
 assert.throws(()=>calculateTccReference(953,[{...p,quantity:1.5}],0));
});
test('precarga documental exige desambiguación y conserva cantidades de cortes',async()=>{
 // The entry module imports browser router, so evaluate only its pure helpers.
 const code=read('assets/js/domains/freight-quotes/quote-order-entry.js').replace(/^import.*\n/gm,'').replaceAll('export ','');
 const {exactDocumentDestination,quoteOrderMaterials}=new Function(code+';return {exactDocumentDestination,quoteOrderMaterials}')();
 const rows=[{key:'1',name:'SAN PABLO (BOLIVAR)'},{key:'2',name:'SAN PABLO (BOLIVAR)'}];
 assert.equal(exactDocumentDestination(rows,'San Pablo'),'');
 assert.equal(exactDocumentDestination([{key:'3',name:'TULUA (VALLE DEL CAUCA)'}],'Tuluá'),'3');
 assert.equal(quoteOrderMaterials({items:[{quantity:2,metadata:{totalRequested:10}}]})[0].quantity,10);
});
