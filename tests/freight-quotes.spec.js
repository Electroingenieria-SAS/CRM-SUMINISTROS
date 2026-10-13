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
   const common={origin:p.origin,destination:'TULUA (VALLE DEL CAUCA)',center:'CALI',prediction:{available:false}};
   const tcc={...common,carrier:'TCC',tariffVersion:'TRADICIONALES_2023_2024',warning:'Referencia histórica. No es tarifa vigente.',rateCopKg:953,reference:p.origin==='CALI'?calculateTccReference(953,p.packages,p.declaredValue):{status:'UNAVAILABLE',reason:'ORIGIN_ROUTE_UNAVAILABLE'}};
   const envia={...common,carrier:'ENVIA',tariffVersion:source.dataset_id,warning:'Estimación interna, origen y divisor no confirmados.',reference:calculateEnviaReference(source.entries.find(r=>r.key==='Valle del Cauca (Cali)'),p.packages,source.policy)};
   return {...(p.carrier==='ENVIA'?envia:tcc),comparison:[tcc,envia]};
  };
  api.freightQuoteSave=async input=>{const q={id:String(window.__quoteFixtures.length+1),folio:window.__quoteFixtures.length+1,created_at:new Date().toISOString(),status:input.status,carrier:input.carrier,input,snapshot:await api.freightQuoteCalculate(input)};window.__quoteFixtures.unshift(q);return q;};
  api.freightQuoteList=async()=>({items:window.__quoteFixtures,total:window.__quoteFixtures.length});
  api.materialSearch=async()=>[];
  document.body.innerHTML='<main id="quote-fixture" style="padding:16px"></main>';
  const {renderFreightQuotes}=await import('/assets/js/modules/freight-quotes.js');
  await renderFreightQuotes(document.querySelector('main'));
 },source);
}
test('cotizador independiente: calcular, invalidar, guardar y duplicar, sin mutar pedidos',async({page},testInfo)=>{
 await mountQuotes(page);
 await page.getByRole('button',{name:'Eliminar material',exact:true}).click();
 await page.getByRole('button',{name:'Material manual',exact:true}).click();
 await page.getByLabel('Descripción manual').fill('Cable de prueba');
 await page.getByLabel('Origen efectivo').selectOption('CALI');
 await page.getByLabel('Departamento',{exact:true}).selectOption('VALLE DEL CAUCA');
 await page.getByLabel('Municipio / localidad y centro operativo').selectOption('TCC_TEST');
 await page.getByLabel('Valor declarado (COP)').fill('100000');
 await page.getByLabel('Peso real por bulto (kg)').fill('20');
 await page.getByLabel('Largo (m)',{exact:true}).fill('0.5');
 await page.getByLabel('Ancho (m)',{exact:true}).fill('0.4');
 await page.getByLabel('Alto (m)',{exact:true}).fill('0.3');
 await page.getByRole('button',{name:'Calcular',exact:true}).click();
 await expect(page.getByRole('heading',{name:/Subtotal de referencia/})).toContainText('22.872');
 await expect(page.getByRole('button',{name:'Guardar cotización',exact:true})).toBeEnabled();
 for(const width of [375,768,1024,1440]){
  await page.setViewportSize({width,height:900});
  const bounds=await page.evaluate(()=>({viewport:document.documentElement.clientWidth,content:document.documentElement.scrollWidth}));
  expect(bounds.content).toBeLessThanOrEqual(bounds.viewport+1);
  await page.screenshot({path:testInfo.outputPath(`freight-${width}.png`),fullPage:true});
 }
 await page.getByLabel('Peso real por bulto (kg)').fill('21');
 await expect(page.getByRole('button',{name:'Guardar cotización',exact:true})).toBeDisabled();
 await page.getByRole('button',{name:'Calcular',exact:true}).click();
 await page.getByRole('button',{name:'Guardar cotización',exact:true}).click();
 await expect(page.locator('[data-quote-history]')).toContainText('CF-1');
 await page.getByRole('button',{name:'Duplicar',exact:true}).click();
 await expect(page.getByRole('button',{name:'Guardar cotización',exact:true})).toBeDisabled();
 await expect(page.getByLabel('Peso real por bulto (kg)')).toHaveValue('21');
 expect(await page.evaluate(()=>window.__orderWrites)).toBe(0);
});

test('ENVÍA comparte formulario, persiste estrategia y conserva varios bultos pendientes',async({page},testInfo)=>{
 await mountQuotes(page);
 await page.getByRole('button',{name:'Eliminar material',exact:true}).click();
 await page.getByRole('button',{name:'Material manual',exact:true}).click();
 await page.getByLabel('Descripción manual').fill('Material ENVÍA');
 await page.getByLabel('Origen efectivo').selectOption('TULUA');
 await page.getByLabel('Departamento',{exact:true}).selectOption('VALLE DEL CAUCA');
 await page.getByLabel('Municipio / localidad y centro operativo').selectOption('TCC_TEST');
 await page.getByLabel('Transportadora',{exact:true}).selectOption('ENVIA');
 await page.getByLabel('Peso real por bulto (kg)').fill('38.001');
 await page.getByRole('button',{name:'Calcular',exact:true}).click();
 await expect(page.getByRole('heading',{name:/Estimado ENVÍA:/})).toContainText('24.114');
 await expect(page.locator('[data-carrier-reference="TCC"]')).toContainText('no existe esta ruta/origen');
 await expect(page.locator('[data-carrier-reference="ENVIA"]')).toContainText('provisional');
 for(const width of [375,768,1024,1440]){
  await page.setViewportSize({width,height:900});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width+1);
  await page.screenshot({path:testInfo.outputPath(`envia-${width}.png`),fullPage:true});
 }
 await page.getByRole('button',{name:'Guardar cotización',exact:true}).click();
 await expect(page.locator('[data-quote-history]')).toContainText('ENVÍA');
 await page.getByRole('button',{name:'Ver',exact:true}).click();
 await expect(page.getByRole('heading',{name:/Estimado ENVÍA:/})).toBeVisible();
 await page.getByRole('button',{name:'Duplicar',exact:true}).click();
 await expect(page.getByLabel('Transportadora',{exact:true})).toHaveValue('ENVIA');
 await page.getByLabel('Cantidad de bultos').fill('2');
 await page.getByRole('button',{name:'Calcular',exact:true}).click();
 await expect(page.locator('[data-carrier-reference="ENVIA"]')).toContainText('varios bultos pendiente');
 await expect(page.getByRole('button',{name:'Guardar cotización',exact:true})).toBeDisabled();
 await page.getByRole('button',{name:'Guardar borrador',exact:true}).click();
 expect(await page.evaluate(()=>window.__quoteFixtures[0].snapshot.reference.status)).toBe('PENDING_PACKAGING_RULE');
 expect(await page.evaluate(()=>window.__orderWrites)).toBe(0);
});
