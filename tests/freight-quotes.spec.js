import {test,expect} from '@playwright/test';
import fs from 'node:fs';
const source=JSON.parse(fs.readFileSync(new URL('../data/freight/envia/source-dataset.json',import.meta.url)));
async function mountQuotes(page){
 await page.goto('/');
 await page.evaluate(async source=>{
  const {api}=await import('/assets/js/services/api.js');
  const {state}=await import('/assets/js/core/state.js');
  const {calculateTccReference}=await import('/assets/js/domains/freight-quotes/tcc-reference.js');
  const {calculateEnviaReference}=await import('/assets/js/domains/freight-quotes/envia-reference.js');
  state.modules=[{code:'freight_quotes',canRead:true,canCreate:true,canUpdate:true}];
  window.__quoteFixtures=[];window.__orderWrites=0;
  api.createOrder=async()=>{window.__orderWrites++;throw Error('No debe crear pedidos');};
  api.freightQuoteCatalog=async()=>({origins:['CALI','TULUA'],modelOrigin:'TULUA',departments:['VALLE DEL CAUCA'],destinations:[{key:'TCC_TEST',name:'TULUA (VALLE DEL CAUCA)',center:'CALI'}]});
  api.freightQuoteCalculate=async p=>{
   const {measurementSummary}=await import('/assets/js/domains/freight-quotes/material-measurements.js');
   const summary=measurementSummary(p.materials),w=summary.weightKg,v=summary.volumeM3,n=summary.count;
   const comparison=['TCC','ENVIA'].map(carrier=>{
    const rule=source.entries.find(r=>r.key==='Valle del Cauca (Cali)');
    const scenario=(basis,amount,count)=>{
     const common={amount,complete:count===n,measuredMaterials:count,totalMaterials:n};
     if(!amount)return {...common,status:'REQUIRES_INFORMATION'};
     if(carrier==='TCC'&&p.origin!=='CALI')return {...common,status:'UNAVAILABLE',reason:'ORIGIN_ROUTE_UNAVAILABLE'};
     const pkg={quantity:1,weightKg:basis==='WEIGHT'?amount:amount*200,volumeM3:basis==='VOLUME'?amount:0.000000001};
     const r=carrier==='TCC'?calculateTccReference(953,[pkg],p.declaredValue??0):calculateEnviaReference(rule,[pkg],source.policy);
     return {...r,...common,conversionFactor:carrier==='TCC'?400:200,billableKg:carrier==='TCC'?r.packages[0].billableKg:r.billableKg};
    };
    const weight=scenario('WEIGHT',w,summary.weightCount),volume=scenario('VOLUME',v,summary.volumeCount);
    const selectedBasis=weight.complete&&volume.complete?(volume.billableKg>weight.billableKg?'VOLUME':'WEIGHT'):weight.complete?'WEIGHT':volume.complete?'VOLUME':null;
    return {carrier,origin:p.origin,destination:'TULUA (VALLE DEL CAUCA)',tariffVersion:carrier==='TCC'?'TRADICIONALES_2023_2024':source.dataset_id,warning:'Referencia interna, sin precio contractual confirmado.',measurementVersion:2,measurementSummary:summary,measurementScenarios:{weight,volume},selectedBasis,reference:selectedBasis==='WEIGHT'?weight:selectedBasis==='VOLUME'?volume:{status:'REQUIRES_INFORMATION'},prediction:{available:false}};
   });
   return {...comparison.find(r=>r.carrier===p.carrier),comparison};
  };
  api.freightQuoteSave=async input=>{const q={id:String(window.__quoteFixtures.length+1),folio:window.__quoteFixtures.length+1,created_at:new Date().toISOString(),status:input.status,carrier:input.carrier,input,snapshot:await api.freightQuoteCalculate(input)};window.__quoteFixtures.unshift(q);return q;};
  api.freightQuoteList=async()=>({items:window.__quoteFixtures,total:window.__quoteFixtures.length});
  window.__linkedQuotes=[];
  api.freightQuoteLink=async(id,orderNumber)=>{window.__linkedQuotes.push({id,orderNumber});};
  api.materialSearch=async()=>[];
  document.body.innerHTML='<main id="quote-fixture" style="padding:16px"></main>';
  const {renderFreightQuotes}=await import('/assets/js/modules/freight-quotes.js');
  await renderFreightQuotes(document.querySelector('main'));
 },source);
}
test('material con dos botones: conserva medidas, compara, guarda y duplica sin pedidos',async({page},testInfo)=>{
 await mountQuotes(page);
 await expect(page.getByText('Bultos y medidas',{exact:true})).toHaveCount(0);
 await page.getByLabel('Nombre del material').fill('Cable de prueba');
 await page.getByLabel('Origen efectivo').selectOption('CALI');
 await page.getByLabel('Departamento',{exact:true}).selectOption('VALLE DEL CAUCA');
 await page.getByLabel('Municipio / localidad y centro operativo').selectOption('TCC_TEST');
 await page.locator('.freight-route-extras summary').click();
 await page.getByLabel('Valor declarado (COP)').fill('100000');
 await page.getByLabel('Peso del material (kg)').fill('20');
 await page.getByRole('button',{name:'Volumen',exact:true}).click();
 await expect(page.getByLabel('Peso del material (kg)')).toHaveCount(0);
 await page.getByLabel('Volumen del material (m³)').fill('0.06');
 await page.getByRole('button',{name:'Peso',exact:true}).click();
 await expect(page.getByLabel('Peso del material (kg)')).toHaveValue('20');
 await page.getByRole('button',{name:'Calcular',exact:true}).click();
 const tcc=page.locator('[data-carrier-reference="TCC"]');
 await expect(tcc.locator('[data-measurement-basis="WEIGHT"]')).toContainText('19.060');
 await expect(tcc.locator('[data-measurement-basis="VOLUME"]')).toContainText('22.872');
 await expect(tcc).toContainText('mayor cobro: volumen');
 for(const width of [375,768,1024,1440]){
  await page.setViewportSize({width,height:900});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width+1);
  await page.screenshot({path:testInfo.outputPath(`materials-${width}.png`),fullPage:true});
 }
 await page.getByRole('button',{name:'Guardar cotización',exact:true}).click();
 await expect(page.locator('[data-quote-history]')).toContainText('CF-1');
 await page.getByRole('button',{name:'Duplicar',exact:true}).click();
 await expect(page.getByLabel('Peso del material (kg)')).toHaveValue('20');
 await page.getByRole('button',{name:'Volumen',exact:true}).click();
 await expect(page.getByLabel('Volumen del material (m³)')).toHaveValue('0.06');
 await page.getByLabel('Volumen del material (m³)').fill('0.07');
 await expect(page.getByRole('button',{name:'Guardar cotización',exact:true})).toBeDisabled();
 expect(await page.evaluate(()=>window.__orderWrites)).toBe(0);
});

test('ENVÍA por peso y volumen: faltantes visibles y materiales mixtos no omitidos',async({page})=>{
 await mountQuotes(page);
 await page.getByLabel('Nombre del material').fill('Material ENVÍA');
 await page.getByLabel('Origen efectivo').selectOption('TULUA');
 await page.getByLabel('Departamento',{exact:true}).selectOption('VALLE DEL CAUCA');
 await page.getByLabel('Municipio / localidad y centro operativo').selectOption('TCC_TEST');
 await page.locator('.freight-route-extras summary').click();
 await page.getByLabel('Transportadora',{exact:true}).selectOption('ENVIA');
 await page.getByLabel('Peso del material (kg)').fill('38.001');
 await page.getByRole('button',{name:'Calcular',exact:true}).click();
 await expect(page.locator('[data-carrier-reference="ENVIA"] [data-measurement-basis="WEIGHT"]')).toContainText('24.114');
 await expect(page.locator('[data-carrier-reference="ENVIA"] [data-measurement-basis="VOLUME"]')).toContainText('Ingresa esta medida');
 await page.getByRole('button',{name:'Guardar cotización',exact:true}).click();
 await page.getByRole('button',{name:'Duplicar',exact:true}).click();
 await expect(page.getByLabel('Transportadora',{exact:true})).toHaveValue('ENVIA');
 await page.getByRole('button',{name:'+ Agregar material',exact:true}).click();
 const second=page.locator('.freight-line').nth(1);
 await second.getByLabel('Nombre del material').fill('Tubería');
 await second.getByRole('button',{name:'Volumen',exact:true}).click();
 await second.getByLabel('Volumen del material (m³)').fill('0.2');
 await page.getByRole('button',{name:'Calcular',exact:true}).click();
 await expect(page.locator('[data-carrier-reference="ENVIA"]')).toContainText('Resultado parcial');
 await expect(page.getByRole('button',{name:'Guardar cotización',exact:true})).toBeDisabled();
 await page.getByRole('button',{name:'Guardar borrador',exact:true}).click();
 await expect(page.locator('[data-quote-history]')).toContainText('CF-2');
 expect(await page.evaluate(()=>window.__quoteFixtures[0].input.materials.length)).toBe(2);
 expect(await page.evaluate(()=>window.__orderWrites)).toBe(0);
});


test('cotizador renovado: buscar destino, resumen y duplicación de materiales, filtros y móvil',async({page},testInfo)=>{
 await mountQuotes(page);
 await expect(page.locator('[data-material-count]')).toHaveText('1');
 await page.getByLabel('Nombre del material').fill('Cable eléctrico');
 await page.getByLabel('Peso del material (kg)').fill('20');
 await expect(page.locator('[data-material-weight]')).toContainText('20');
 await page.getByRole('button',{name:'Duplicar material'}).click();
 await expect(page.locator('[data-material-count]')).toHaveText('2');
 await expect(page.locator('[data-material-weight]')).toContainText('40');
 await page.locator('.freight-line').nth(1).getByRole('button',{name:'Eliminar material'}).click();
 await expect(page.locator('[data-material-count]')).toHaveText('1');
 await page.getByLabel('Departamento',{exact:true}).selectOption('VALLE DEL CAUCA');
 const search=page.getByLabel('Buscar municipio o centro operativo');
 await search.fill('inexistente');
 await expect(page.getByLabel('Municipio / localidad y centro operativo')).toBeDisabled();
 await search.fill('tulua');
 await expect(page.getByLabel('Municipio / localidad y centro operativo')).toBeEnabled();
 await page.getByLabel('Municipio / localidad y centro operativo').selectOption('TCC_TEST');
 await page.getByLabel('Origen efectivo').selectOption('CALI');
 await page.getByRole('button',{name:'Calcular',exact:true}).click();
 await expect(page.locator('[data-carrier-reference="TCC"]')).toBeVisible();
 await expect(page.locator('[data-carrier-reference="ENVIA"]')).toBeVisible();
 await expect(page.getByText('Ver indicador estadístico histórico por transportadora')).toHaveCount(0);
 await page.getByRole('button',{name:'Guardar borrador',exact:true}).click();
 await expect(page.locator('[data-quote-history]')).toContainText('CF-1');
 await page.locator('[data-history-search]').fill('sin coincidencia');
 await expect(page.locator('[data-quote-history]')).toContainText('Sin resultados para estos filtros');
 await page.locator('[data-history-search]').fill('');
 await expect(page.locator('[data-quote-history]')).toContainText('CF-1');
 for(const width of [375,768,1024,1440]){
  await page.setViewportSize({width,height:900});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width+1);
  await page.screenshot({path:testInfo.outputPath('freight-renovated-'+width+'.png'),fullPage:true});
 }
 expect(await page.evaluate(()=>window.__orderWrites)).toBe(0);
});


test('Historial profesional: pestañas, filtros, tabla, exportación y acciones seguras',async({page},testInfo)=>{
 await mountQuotes(page);
 await page.getByRole('tab',{name:/Historial/}).click();
 await expect(page.locator('[data-history-workspace]')).toBeVisible();
 await expect(page.getByText('Tu historial comienza aquí')).toBeVisible();
 await page.getByRole('tab',{name:'Nueva cotización'}).click();
 await page.getByLabel('Nombre del material').fill('Cable eléctrico');
 await page.getByLabel('Origen efectivo').selectOption('CALI');
 await page.getByLabel('Departamento',{exact:true}).selectOption('VALLE DEL CAUCA');
 await page.getByLabel('Municipio / localidad y centro operativo').selectOption('TCC_TEST');
 await page.getByLabel('Peso del material (kg)').fill('20');
 await page.getByRole('button',{name:'Guardar borrador'}).click();
 await expect(page.locator('[data-history-workspace]')).toBeVisible();
 await expect(page.locator('[data-history-count]')).toHaveText('1');
 await expect(page.locator('.freight-history-table tbody tr')).toHaveCount(1);
 await page.locator('[data-history-status]').selectOption('CALCULATED');
 await expect(page.getByText('Sin resultados para estos filtros')).toBeVisible();
 await page.locator('[data-history-clear]').click();
 await expect(page.locator('.freight-history-table tbody tr')).toHaveCount(1);
 const downloadPromise=page.waitForEvent('download');
 await page.locator('[data-history-export]').click();
 const download=await downloadPromise;
 expect(download.suggestedFilename()).toMatch(/historial-fletes-pagina-/);
 await page.locator('[data-history-search]').fill('sin coincidencias');
 await expect(page.locator('[data-history-export]')).toBeDisabled();
 await page.locator('[data-history-clear]').click();
 for(const width of [375,768,1024,1440]){
  await page.setViewportSize({width,height:900});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width+1);
  await page.screenshot({path:testInfo.outputPath('history-premium-'+width+'.png'),fullPage:true});
 }
 await page.getByRole('button',{name:'Duplicar'}).click();
 await expect(page.locator('[data-quote-workspace]')).toBeVisible();
 await expect(page.getByLabel('Nombre del material')).toHaveValue('Cable eléctrico');
 expect(await page.evaluate(()=>window.__orderWrites)).toBe(0);
});

test('seleccionar la transportadora desde la tarjeta cambia únicamente la cotización guardada',async({page})=>{
 await mountQuotes(page);
 await page.evaluate(async()=>{
  const {api}=await import('/assets/js/services/api.js');
  const original=api.freightQuoteCalculate;
  api.freightQuoteCalculate=async payload=>{
   const comparison=await original(payload);
   const rows=comparison.comparison.map((card,index)=>({
    ...card,commercialEstimate:{available:true,totalCop:index?54000:67000,rangeLowCop:index?49000:59000,rangeHighCop:index?60000:74000,source:index?'ENVIA_REFERENCE':'TCC_REAL_GUIDE_MODEL',statisticalRange:true}
   }));
   return {...rows.find(card=>card.carrier===payload.carrier),comparison:rows};
  };
 });
 await page.getByLabel('Nombre del material').fill('Cable empresarial');
 await page.getByLabel('Origen efectivo').selectOption('CALI');
 await page.getByLabel('Departamento',{exact:true}).selectOption('VALLE DEL CAUCA');
 await page.getByLabel('Municipio / localidad y centro operativo').selectOption('TCC_TEST');
 await page.getByLabel('Peso del material (kg)').fill('20');
 await page.getByRole('button',{name:'Calcular',exact:true}).click();
 await page.locator('[data-quote-select-carrier="ENVIA"]').click();
 await expect(page.locator('[data-quote-select-carrier="ENVIA"]')).toHaveAttribute('aria-pressed','true');
 await expect(page.getByRole('button',{name:'Guardar cotización'})).toBeEnabled();
 await page.getByRole('button',{name:'Guardar cotización'}).click();
 await expect(page.locator('[data-history-workspace]')).toBeVisible();
 expect(await page.evaluate(()=>window.__quoteFixtures[0].input.carrier)).toBe('ENVIA');
 expect(await page.evaluate(()=>window.__orderWrites)).toBe(0);
});


test('historial animado: abrir panel, cerrar Escape, vincular con diálogo y preservar pedido',async({page})=>{
 await mountQuotes(page);
 await page.getByLabel('Nombre del material').fill('Tablero de control');
 await page.getByLabel('Origen efectivo').selectOption('CALI');
 await page.getByLabel('Departamento',{exact:true}).selectOption('VALLE DEL CAUCA');
 await page.getByLabel('Municipio / localidad y centro operativo').selectOption('TCC_TEST');
 await page.getByLabel('Peso del material (kg)').fill('25');
 await page.getByRole('button',{name:'Guardar borrador'}).click();
 const view=page.locator('[data-quote-view="1"]');
 await view.click();
 const dialog=page.getByRole('dialog',{name:'CF-1'});
 await expect(dialog).toBeVisible();
 await expect(dialog).toContainText('Tablero de control');
 await page.keyboard.press('Escape');
 await expect(dialog).toHaveCount(0);
 await expect(view).toBeFocused();
 await page.locator('[data-quote-link="1"]').click();
 const link=page.getByRole('dialog',{name:/Vincular pedido/});
 await expect(link).toBeVisible();
 await link.getByRole('button',{name:'Confirmar vínculo'}).click();
 await expect(link.getByLabel('Número de pedido')).toBeFocused();
 await link.getByLabel('Número de pedido').fill('PED-2026-17');
 await link.getByRole('button',{name:'Confirmar vínculo'}).click();
 await expect(link).toHaveCount(0);
 expect(await page.evaluate(()=>window.__linkedQuotes)).toEqual([{id:'1',orderNumber:'PED-2026-17'}]);
 expect(await page.evaluate(()=>window.__orderWrites)).toBe(0);
});

test('preferencias de movimiento reducido conservan tablas, materiales, cálculo y navegación',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});
 await mountQuotes(page);
 await page.getByLabel('Nombre del material').fill('Conductor');
 await page.getByLabel('Peso del material (kg)').fill('18');
 await page.getByRole('button',{name:'+ Agregar material'}).click();
 await expect(page.locator('[data-material-count]')).toHaveText('2');
 await page.getByRole('tab',{name:/Historial/}).click();
 await expect(page.locator('[data-history-workspace]')).toBeVisible();
 await page.getByRole('tab',{name:'Nueva cotización'}).click();
 await expect(page.locator('.freight-line')).toHaveCount(2);
 await expect(page.locator('.freight-line').first().getByLabel('Nombre del material')).toHaveValue('Conductor');
});

test('componente de detalles y acciones accesible en ocho tamaños de pantalla',async({page},testInfo)=>{
 await mountQuotes(page);
 await page.getByLabel('Nombre del material').fill('Material');
 await page.getByLabel('Peso del material (kg)').fill('10');
 await page.getByRole('button',{name:'Guardar borrador'}).click();
 await page.locator('[data-quote-view="1"]').click();
 for(const width of [360,390,430,768,1024,1280,1440,1920]){
  await page.setViewportSize({width,height:900});
  await expect(page.getByRole('dialog',{name:'CF-1'})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width+1);
 }
 await page.getByRole('dialog',{name:'CF-1'}).getByRole('button',{name:'Cerrar detalle'}).click();
 await expect(page.getByRole('dialog',{name:'CF-1'})).toHaveCount(0);
});
