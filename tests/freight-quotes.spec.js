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


test('historial animado: detalle accesible, Escape, duplicación y vínculo con confirmación',async({page})=>{
 await mountQuotes(page);
 await page.evaluate(async()=>{
  const {api}=await import('/assets/js/services/api.js');
  api.freightQuoteLink=async(id,orderNumber)=>{window.__linkedQuote={id,orderNumber};};
 });
 await page.getByLabel('Nombre del material').fill('Tubería industrial');
 await page.getByLabel('Origen efectivo').selectOption('CALI');
 await page.getByLabel('Departamento',{exact:true}).selectOption('VALLE DEL CAUCA');
 await page.getByLabel('Municipio / localidad y centro operativo').selectOption('TCC_TEST');
 await page.getByLabel('Peso del material (kg)').fill('20');
 await page.getByRole('button',{name:'Guardar borrador',exact:true}).click();
 const view=page.locator('[data-quote-view]').first();
 await view.click();
 const detail=page.getByRole('dialog',{name:'Detalle de la cotización'});
 await expect(detail).toBeVisible();
 await expect(detail).toContainText('Tubería industrial');
 await page.keyboard.press('Escape');
 await expect(detail).toBeHidden();
 await expect(view).toBeFocused();
 await page.locator('[data-quote-link]').first().click();
 const linking=page.getByRole('dialog',{name:'Vincular cotización a pedido'});
 await expect(linking).toBeVisible();
 await linking.getByLabel('Número de pedido').fill('PED-OPER-99');
 await linking.getByRole('button',{name:'Confirmar vínculo'}).click();
 await expect(linking).toBeHidden();
 expect(await page.evaluate(()=>window.__linkedQuote?.orderNumber)).toBe('PED-OPER-99');
 expect(await page.evaluate(()=>window.__orderWrites)).toBe(0);
});

test('Motion reducido y Floating UI: precio real visible, tooltip accesible y limpieza',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});
 await mountQuotes(page);
 await page.evaluate(async()=>{
  const {quoteResultHtml}=await import('/assets/js/domains/freight-quotes/quote-view.js');
  const mk=carrier=>({carrier,origin:'CALI',destination:'TULUA',tariffVersion:'2024',
    measurementScenarios:{weight:{status:'REQUIRES_INFORMATION',measuredMaterials:0,totalMaterials:1,complete:false},
      volume:{status:'REQUIRES_INFORMATION',measuredMaterials:0,totalMaterials:1,complete:false}},
    reference:{status:'UNAVAILABLE'},commercialEstimate:{available:true,source:carrier==='TCC'?'TCC_REAL_GUIDE_MODEL':'ENVIA_REFERENCE',
      totalCop:carrier==='TCC'?60000:50000,rangeLowCop:44000,rangeHighCop:77000,statisticalRange:true}});
  document.querySelector('[data-quote-result]').innerHTML=quoteResultHtml({carrier:'TCC',comparison:[mk('TCC'),mk('ENVIA')]});
 });
 const range=page.locator('[data-carrier-price="TCC"] strong').first();
 await expect(range).toContainText('44.000');
 const help=page.getByRole('button',{name:'¿Qué significa precio estimado?'}).first();
 await help.focus();
 await expect(page.getByRole('tooltip')).toBeVisible();
 await page.keyboard.press('Escape');
 await expect(page.getByRole('tooltip')).toHaveCount(0);
 expect(await page.evaluate(async()=>{const m=await import('/assets/js/shared/motion/motion-tokens.js');return m.shouldReduceMotion();})).toBe(true);
});


test('cotizador premium: municipio único, empresa principal y valor declarado visibles',async({page})=>{
 await mountQuotes(page);
 const destination=page.getByRole('combobox',{name:'Buscar municipio o centro operativo'});
 await expect(destination).toHaveCount(1);
 await expect(page.locator('.freight-destination-field .control')).toHaveCount(1);
 await expect(page.getByText('Opciones adicionales')).toHaveCount(0);
 await page.getByLabel('Departamento',{exact:true}).selectOption('VALLE DEL CAUCA');
 await destination.fill('tulua');
 await expect(page.getByRole('listbox')).toBeVisible();
 await page.locator('[data-destination-options] [role="option"]').first().click();
 await expect(page.locator('[data-destination-options]')).toBeHidden();
 await expect(page.locator('[name=destinationKey]')).toHaveValue('TCC_TEST');
 await page.locator('[data-carrier-choice="ENVIA"]').click();
 await expect(page.locator('[data-carrier-choice="ENVIA"]')).toHaveAttribute('aria-pressed','true');
 await expect(page.locator('[name=carrier]')).toHaveValue('ENVIA');
 await page.getByLabel('Valor declarado (COP)').fill('125000');
 await page.getByLabel('Origen efectivo').selectOption('CALI');
 await page.getByLabel('Nombre del material').fill('Tablero eléctrico');
 await page.getByLabel('Peso del material (kg)').fill('20');
 await page.getByRole('button',{name:'Calcular',exact:true}).click();
 await expect(page.locator('[data-carrier-reference="ENVIA"]')).toBeVisible();
 await expect(page.locator('[data-carrier-reference="TCC"]')).toBeVisible();
 expect(await page.evaluate(()=>window.__orderWrites)).toBe(0);
});


test('visual premium: hero compacto, precios TCC/ENVÍA e historial responsive',async({page},testInfo)=>{
 await mountQuotes(page);
 const header=page.locator('.freight-premium-head');
 await expect(header).toBeVisible();
 await expect(page.locator('.freight-hero-logos')).toContainText('TCC');
 await expect(page.locator('.freight-hero-logos')).toContainText('ENVÍA');
 await page.evaluate(async()=>{
  const {api}=await import('/assets/js/services/api.js');
  const original=api.freightQuoteCalculate;
  api.freightQuoteCalculate=async data=>{
   const result=await original(data);
   const comparison=result.comparison.map((card,i)=>({...card,commercialEstimate:{
     available:true,statisticalRange:true,source:i===0?'TCC_REAL_GUIDE_MODEL':'ENVIA_REFERENCE',
     totalCop:i===0?92000:75000,rangeLowCop:i===0?82000:68000,rangeHighCop:i===0?105000:89000,
     baseCop:i===0?70000:60000,variableCop:i===0?22000:15000
   }}));
   return {...comparison.find(x=>x.carrier===data.carrier),comparison};
  };
 });
 await page.getByLabel('Nombre del material').fill('Equipo comercial');
 await page.getByLabel('Origen efectivo').selectOption('CALI');
 await page.getByLabel('Departamento',{exact:true}).selectOption('VALLE DEL CAUCA');
 await page.getByLabel('Municipio / localidad y centro operativo').selectOption('TCC_TEST');
 await page.getByLabel('Peso del material (kg)').fill('20');
 await page.getByRole('button',{name:'Calcular',exact:true}).click();
 await expect(page.locator('[data-offer-carrier="TCC"] .freight-price-hero')).toContainText('82.000');
 await expect(page.locator('[data-offer-carrier="ENVIA"] .freight-price-hero')).toContainText('68.000');
 for(const width of [375,768,1024,1440]){
  await page.setViewportSize({width,height:900});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width+1);
  await page.screenshot({path:testInfo.outputPath('premium-v3-'+width+'.png'),fullPage:true});
 }
 await page.getByRole('tab',{name:/Historial/}).click();
 await expect(page.locator('.freight-history-metric')).toHaveCount(3);
});

test('503 del catálogo: reintentar lecturas sin mutar pedidos ni cotizaciones',async({page})=>{
 await mountQuotes(page);
 await page.evaluate(async()=>{
  const {api}=await import('/assets/js/services/api.js');
  api.freightQuoteCatalog=async department=>{
   if(department){
    if(window.__serviceHealthy)return {destinations:[{key:'TCC_TEST',name:'TULUA (VALLE DEL CAUCA)',center:'CALI'}]};
    const error=new Error('Supabase está temporalmente ocupado.');error.status=503;throw error;
   }
   return {origins:['CALI','TULUA'],modelOrigin:'TULUA',departments:['VALLE DEL CAUCA']};
  };
 });
 await page.getByLabel('Departamento',{exact:true}).selectOption('VALLE DEL CAUCA');
 await expect(page.locator('[data-freight-service-banner]')).toBeVisible();
 await page.evaluate(()=>{window.__serviceHealthy=true;});
 await page.locator('[data-freight-retry]').click();
 await expect(page.locator('[data-freight-service-banner]')).toBeHidden();
 await expect(page.getByLabel('Municipio / localidad y centro operativo')).toBeEnabled();
 expect(await page.evaluate(()=>window.__orderWrites)).toBe(0);
});


test('TCC y ENVÍA seleccionadas conservan contraste blanco sobre su botón oscuro',async({page})=>{
 await mountQuotes(page);
 await page.evaluate(async()=>{
  const {api}=await import('/assets/js/services/api.js');
  const previous=api.freightQuoteCalculate;
  api.freightQuoteCalculate=async input=>{
   const result=await previous(input);
   const comparison=result.comparison.map((card,i)=>({
    ...card,commercialEstimate:{available:true,totalCop:i?60000:70000,
     rangeLowCop:i?56000:66000,rangeHighCop:i?68000:78000,
     source:i?'ENVIA_REFERENCE':'TCC_REAL_GUIDE_MODEL',statisticalRange:true}
   }));
   return {...comparison.find(x=>x.carrier===input.carrier),comparison};
  };
 });
 await page.getByLabel('Nombre del material').fill('Cable comercial');
 await page.getByLabel('Origen efectivo').selectOption('CALI');
 await page.getByLabel('Departamento',{exact:true}).selectOption('VALLE DEL CAUCA');
 await page.getByLabel('Municipio / localidad y centro operativo').selectOption('TCC_TEST');
 await page.getByLabel('Peso del material (kg)').fill('20');
 await page.getByRole('button',{name:'Calcular',exact:true}).click();
 const tcc=page.locator('[data-quote-select-carrier="TCC"]');
 const envia=page.locator('[data-quote-select-carrier="ENVIA"]');
 await expect(tcc).toHaveAttribute('aria-pressed','true');
 await expect(tcc).toHaveCSS('color','rgb(255, 255, 255)');
 await envia.click();
 await expect(envia).toHaveAttribute('aria-pressed','true');
 await expect(envia).toHaveCSS('color','rgb(255, 255, 255)');
 await expect(tcc).toHaveAttribute('aria-pressed','false');
 expect(await page.evaluate(()=>window.__orderWrites)).toBe(0);
});

test('Gestión rápida mantiene cerrar a la derecha de Cotización de fletes en PC y móvil',async({page})=>{
 await mountQuotes(page);
 await page.evaluate(async()=>{
  const root=document.createElement('div');root.id='modal-root';
  root.innerHTML='<div class="modal-overlay simple-process-overlay"><section class="modal popup-ux-v1190 simple-process-modal wide"><header class="modal-head simple-process-head"><div><span class="wizard-kicker">Gestión rápida</span><h3>PVC PRUEBA</h3><p>CLIENTE DE PRUEBA · Cerrado</p></div><button type="button" class="icon-btn" data-close aria-label="Cerrar">×</button></header></section></div>';
  document.body.append(root);
  const {mountFreightQuoteOrderEntry}=await import('/assets/js/domains/freight-quotes/quote-order-entry.js');
  mountFreightQuoteOrderEntry(root,{order:{id:'order-test-1'}});
 });
 const header=page.locator('#modal-root .order-freight-action-head');
 const action=header.locator('[data-order-freight-quote]');
 const close=header.locator(':scope > [data-close]');
 await expect(action).toHaveCount(1);
 await expect(close).toHaveCount(1);
 expect(await header.locator(':scope > *').evaluateAll(nodes=>nodes.map(n=>n.hasAttribute('data-close')?'close':n.hasAttribute('data-order-freight-quote')?'freight':'title'))).toEqual(['title','freight','close']);
 for(const width of [1280,375]){
  await page.setViewportSize({width,height:800});
  const geometry=await page.evaluate(()=>{
   const head=document.querySelector('#modal-root .order-freight-action-head');
   const c=head.querySelector('[data-close]').getBoundingClientRect();
   const a=head.querySelector('[data-order-freight-quote]').getBoundingClientRect();
   const h=head.getBoundingClientRect();
   return {actionRight:a.right,actionTop:a.top,closeLeft:c.left,closeTop:c.top,headerRight:h.right,actionLeft:a.left,headerLeft:h.left};
  });
  expect(geometry.closeLeft).toBeGreaterThan(geometry.headerLeft+40);
  expect(geometry.closeLeft).toBeLessThanOrEqual(geometry.headerRight);
  if(width===1280){
   expect(geometry.closeLeft).toBeGreaterThanOrEqual(geometry.actionRight-1);
   expect(Math.abs(geometry.closeTop-geometry.actionTop)).toBeLessThan(6);
  }else{
   expect(geometry.actionTop).toBeGreaterThan(geometry.closeTop);
   expect(geometry.actionLeft).toBeGreaterThanOrEqual(geometry.headerLeft-1);
  }
 }
});


test('cotizador local: ruta Tuluá, peso, auxiliar y desvío sin contaminar TCC/ENVÍA',async({page})=>{
 await mountQuotes(page);
 await page.evaluate(async()=>{
  const {api}=await import('/assets/js/services/api.js');
  const original=api.freightQuoteCalculate;
  api.freightQuoteCalculate=async payload=>{
   if(payload.carrier!=='LOCAL')return original(payload);
   const {calculateLocalDispatch}=await import('/assets/js/domains/logistics/local-dispatch/tariffs.js');
   const weight=payload.materials.reduce((a,b)=>a+Number(b.weightKg||0),0);
   const calc=calculateLocalDispatch(payload.localDestinationCode,weight,payload.localUnloadingCost,payload.localDiversionCost);
   const item={carrier:'LOCAL',origin:'TULUA',destination:payload.localDestinationCode,
    localExtras:{unloadingCop:payload.localUnloadingCost,diversionCop:payload.localDiversionCost,reason:payload.localExtraReason},
    reference:{status:'LOCAL_TARIFF_REFERENCE',baseCop:calc.tariffBase,extraKg:calc.extraKg,
     extraPerKgCop:calc.tariff?.extraPerKg||0},
    commercialEstimate:{available:calc.available,totalCop:calc.total,rangeLowCop:calc.total,rangeHighCop:calc.total}};
   return {...item,comparison:[item]};
  };
 });
 await page.locator('button[data-quote-scope="LOCAL"]').click();
 await expect(page.locator('button[data-quote-scope="LOCAL"]')).toHaveAttribute('aria-pressed','true');
 await expect(page.locator('[data-carrier-choice="LOCAL"]')).toHaveAttribute('aria-pressed','true');
 await expect(page.locator('[data-local-controls]')).toBeVisible();
 await expect(page.locator('[data-national-route]').first()).toBeHidden();
 await expect(page.getByLabel('Origen efectivo')).toHaveValue('TULUA');
 const zone=page.locator('[data-local-controls] [data-local-route-category]');
 await expect(zone).toHaveValue('');
 await expect(page.locator('[data-local-controls] [data-local-route-trigger]')).toBeDisabled();
 await zone.selectOption('TULUA_CERCANAS');
 await expect(page.locator('[data-local-controls] [data-local-route-trigger]')).toBeEnabled();
 await expect(page.locator('[data-local-controls] .local-route-native option[value="ARMENIA"]')).toHaveCount(0);
 await page.locator('[data-local-controls] [data-local-route-trigger]').click();
 await expect(page.locator('[data-local-controls] [data-local-route-menu]')).toBeVisible();
 await page.locator('[data-local-controls] [data-local-route-query]').fill('San Pedro');
 await page.locator('[data-local-controls] [data-local-route-choice="SAN PEDRO"]').click();
 await expect(page.getByLabel('Destino de transporte local')).toHaveValue('SAN PEDRO');
 await page.getByLabel('Nombre del material').fill('Tableros');
 await page.getByLabel('Peso del material (kg)').fill('1010');
 await page.getByLabel('Auxiliar / descargue (COP)').fill('30000');
 await page.getByLabel('Desvío o subruta urgente (COP)').fill('15000');
 await page.getByLabel('Motivo del costo extraordinario').fill('Ayudante y subruta urgente');
 await page.getByRole('button',{name:'Calcular',exact:true}).click();
 await expect(page.locator('[data-carrier-reference="LOCAL"]')).toContainText('105.470');
 await expect(page.locator('[data-carrier-reference="TCC"]')).toHaveCount(0);
 await expect(page.locator('[data-carrier-reference="ENVIA"]')).toHaveCount(0);
 await expect(page.getByRole('button',{name:'Guardar cotización',exact:true})).toBeEnabled();
 await page.getByRole('button',{name:'Guardar cotización',exact:true}).click();
 await expect(page.locator('[data-quote-history]')).toContainText('CF-1');
 await expect.poll(()=>page.evaluate(()=>window.__quoteFixtures.length)).toBe(1);
 expect(await page.evaluate(()=>window.__quoteFixtures[0].input.carrier)).toBe('LOCAL');
 expect(await page.evaluate(()=>window.__quoteFixtures[0].input.localDestinationCode)).toBe('SAN PEDRO');
 expect(await page.evaluate(()=>window.__orderWrites)).toBe(0);
 await page.getByRole('tab',{name:/Historial/}).click();
 await expect(page.locator('[data-history-carrier] option[value=LOCAL]')).toHaveCount(1);
});


test('selector de modalidad distingue local y nacional sin perder TCC ni ENVÍA',async({page})=>{
 await mountQuotes(page);
 await expect(page.locator('button[data-quote-scope="NATIONAL"]')).toHaveAttribute('aria-pressed','true');
 await expect(page.locator('[data-national-route]').first()).toBeVisible();
 await page.locator('[data-carrier-choice="ENVIA"]').click();
 await page.locator('button[data-quote-scope="LOCAL"]').click();
 await expect(page.locator('[data-local-controls]')).toBeVisible();
 await expect(page.locator('[data-carrier-choice="TCC"]')).toBeHidden();
 await expect(page.locator('[data-carrier-choice="ENVIA"]')).toBeHidden();
 await expect(page.locator('[data-national-route]').first()).toBeHidden();
 await expect(page.locator('[data-carrier-choice="LOCAL"]')).toHaveAttribute('aria-pressed','true');
 await page.locator('button[data-quote-scope="NATIONAL"]').click();
 await expect(page.locator('[data-local-controls]')).toBeHidden();
 await expect(page.locator('[data-carrier-choice="LOCAL"]')).toBeHidden();
 await expect(page.locator('[data-carrier-choice="ENVIA"]')).toHaveAttribute('aria-pressed','true');
});


test('categoría restringe destinos y limpia rutas anteriores al cambiar de zona',async({page})=>{
 await mountQuotes(page);
 await page.locator('button[data-quote-scope="LOCAL"]').click();
 const zone=page.locator('[data-local-controls] [data-local-route-category]');
 const picker=page.locator('[data-local-controls] [data-local-route-trigger]');
 const destination=page.getByLabel('Destino de transporte local');
 await zone.selectOption('NORTE_VALLE_IBARRA');
 await picker.click();
 await expect(page.locator('[data-local-controls] [data-local-route-choice="ARMENIA"]')).toBeVisible();
 await expect(page.locator('[data-local-controls] [data-local-route-choice="SAN PEDRO"]')).toHaveCount(0);
 await page.locator('[data-local-controls] [data-local-route-choice="ARMENIA"]').click();
 await expect(destination).toHaveValue('ARMENIA');
 await zone.selectOption('SUR_VALLE_IBARRA');
 await expect(destination).toHaveValue('');
 await expect(page.locator('[data-local-controls] .local-route-native option[value="ARMENIA"]')).toHaveCount(0);
 await expect(page.locator('[data-local-controls] [data-local-route-selected]')).toContainText('Busca y selecciona');
 await zone.selectOption('TULUA_CERCANAS');
 await picker.click();
 await expect(page.locator('[data-local-controls] [data-local-route-choice="SAN PEDRO"]')).toBeVisible();
});


test('historial premium aplica botones azules con texto blanco sin alterar controles ni estados',async({page},testInfo)=>{
 await mountQuotes(page);
 const link=page.locator('head link[rel="stylesheet"][href*="quote-action-system.css"]');
 await expect(link).toHaveCount(1);
 await expect(link).toHaveAttribute('href',/v=20261016-2/);
 const sheet=await link.evaluate(el=>({last:el===document.querySelector('head link[rel="stylesheet"]:last-of-type'),loaded:!!el.sheet}));
 expect(sheet).toEqual({last:true,loaded:true});
 await page.getByRole('tab',{name:/Historial/}).click();
 await page.evaluate(async()=>{
  const {quoteHistoryHtml}=await import('/assets/js/domains/freight-quotes/quote-history-view.js');
  document.querySelector('[data-quote-history]').innerHTML=quoteHistoryHtml([{
   id:'visual-history',folio:23,created_at:'2026-10-15T13:00:00Z',
   carrier:'ENVIA',status:'CALCULATED',order_number:'PRUEBA NUMERO 001',
   actual_cost_cop:null,snapshot:{origin:'TULUA',destination:'CALI (VALLE DEL CAUCA)',
    commercialEstimate:{available:true,totalCop:27286}}
  }]);
 });
 const selectors=['[data-view-tab="quote"]','[data-view-tab="history"]',
  '[data-history-clear]','[data-history-export]','[data-quote-view]',
  '[data-quote-duplicate]','[data-quote-link]','[data-history-prev]','[data-history-next]'];
 for(const selector of selectors){
  const button=page.locator(selector).first();
  await expect(button).toBeVisible();
  const colors=await button.evaluate(node=>{
   const style=getComputedStyle(node);
   return {background:style.backgroundColor,color:style.color};
  });
  expect(colors.color,selector).toBe('rgb(255, 255, 255)');
  expect(colors.background,selector).not.toBe('rgba(0, 0, 0, 0)');
 }
 await expect(page.locator('[data-view-tab="history"]')).toHaveAttribute('aria-selected','true');
 await expect(page.locator('.freight-history-status')).toContainText('Calculada');
 await expect(page.locator('.freight-history-kicker')).toHaveText('GESTIÓN DE FLETES · HISTORIAL');
 const primaryMetric=await page.locator('.freight-history-metric').first().evaluate(el=>getComputedStyle(el).backgroundImage);
 expect(primaryMetric).toContain('linear-gradient');
 for(const width of [1440,390]){
  await page.setViewportSize({width,height:850});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width+1);
  await page.screenshot({path:testInfo.outputPath('freight-blue-history-'+width+'.png'),fullPage:true});
 }
 await page.locator('[data-history-search]').fill('Prueba');
 await page.locator('[data-history-clear]').click();
 await expect(page.locator('[data-history-search]')).toHaveValue('');
 await page.getByRole('tab',{name:'Nueva cotización'}).click();
 await expect(page.locator('[data-quote-workspace]')).toBeVisible();
});
