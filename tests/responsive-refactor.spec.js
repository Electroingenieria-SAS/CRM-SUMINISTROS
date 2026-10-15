import {test,expect} from '@playwright/test';

async function expectHorizontalBounds(page){
  const bounds=await page.evaluate(()=>({
    viewport:document.documentElement.clientWidth,
    content:Math.max(document.documentElement.scrollWidth,document.body.scrollWidth)
  }));
  expect(bounds.content).toBeLessThanOrEqual(bounds.viewport+1);
}

test('shell and dialogs retain horizontal bounds, labels and keyboard focus',async({page})=>{
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto('/');
  await expect(page.getByRole('heading',{name:'Ingresa a CRM Suministros'})).toBeVisible();
  const original=page.viewportSize();
  for(const viewport of [original,{width:1024,height:768},{width:844,height:390}]){
    await page.setViewportSize(viewport);
    await expectHorizontalBounds(page);
  }
  await page.setViewportSize(original);
  await page.getByLabel('Correo corporativo').focus();
  await page.evaluate(async()=>{
    const {modal}=await import('/assets/js/core/ui/index.js');
    modal({title:'Comprobación de teclado',body:'<div class="field"><label for="fixture-note">Nota de prueba</label><input class="control" id="fixture-note" autofocus></div>',confirmLabel:'Guardar',onConfirm:async()=>{}});
  });
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByLabel('Nota de prueba')).toBeFocused();
  await expectHorizontalBounds(page);
  const confirm=page.getByRole('button',{name:'Guardar',exact:true});
  const close=page.getByRole('button',{name:'Cerrar ventana',exact:true});
  await confirm.focus();
  await page.keyboard.press('Tab');
  await expect(close).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(confirm).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByLabel('Correo corporativo')).toBeFocused();
});


test('despacho local mantiene controles alineados en filas iguales y sin desbordes',async({page})=>{
 await page.goto('/');
 await page.evaluate(async()=>{
  const {renderLocalDispatchStage}=await import('/assets/js/domains/logistics/local-dispatch/local-dispatch-stage.js');
  const host=document.createElement('div');host.id='local-alignment-fixture';document.body.append(host);
  renderLocalDispatchStage(host,{
   order:{id:'layout-test',order_number:'PRUEBA NÚMERO 001',client_name:'PRUEBA',delivery_route_code:'LOCAL_DISPATCH',current_step_code:'LOCAL_DISPATCH',client_city:'SAN PEDRO',metadata:{clientDepartment:'VALLE DEL CAUCA',clientCity:'SAN PEDRO',clientAddress:'PRUEBA'}},
   invoices:[{invoice_number:'FACTURA-1',package_weight_kg:20}],deliveries:[],tasks:[],actions:{}
  },{});
 });
 const modal=page.locator('.shipping-core-v11107.local-dispatch-modal-aligned');
 await expect(modal).toBeVisible();
 const fields=['tripDate','invoiceNumber','branch','weightKg','vehiclePlate','driverName'];
 for(const name of fields)await expect(modal.locator('[name="'+name+'"]')).toHaveCount(1);
 for(const width of [1440,1024,430]){
  await page.setViewportSize({width,height:900});
  const boxes=await modal.locator('.local-dispatch-field-row').evaluateAll(rows=>rows.map(row=>
   [...row.querySelectorAll('.control')].map(control=>{
    const {x,y,width,height}=control.getBoundingClientRect();return {x,y,width,height};
   })));
  expect(boxes).toHaveLength(2);
  expect(boxes[0]).toHaveLength(3);
  expect(boxes[1]).toHaveLength(3);
  for(const row of boxes)for(const field of row)expect(field.width).toBeGreaterThan(0);
  if(width>=1024){
   for(const row of boxes){
    expect(Math.max(...row.map(field=>field.y))-Math.min(...row.map(field=>field.y))).toBeLessThan(2);
    expect(Math.max(...row.map(field=>field.height))-Math.min(...row.map(field=>field.height))).toBeLessThan(2);
   }
   for(let i=0;i<3;i++)expect(Math.abs(boxes[0][i].x-boxes[1][i].x)).toBeLessThan(2);
  }else{
   expect(boxes[0][0].x).toBeCloseTo(boxes[0][1].x,0);
   expect(boxes[0][1].y).toBeGreaterThan(boxes[0][0].y);
   expect(boxes[1][0].y).toBeGreaterThan(boxes[0][2].y);
  }
  const overflow=await modal.evaluate(node=>node.scrollWidth-node.clientWidth);
  expect(overflow).toBeLessThanOrEqual(2);
 }
});


test('cotizador local se abre en drawer, conserva tarifa y devuelve foco al despacho',async({page})=>{
 await page.goto('/');
 await page.evaluate(async()=>{
  const {renderLocalDispatchStage}=await import('/assets/js/domains/logistics/local-dispatch/local-dispatch-stage.js');
  const host=document.createElement('div');host.id='local-drawer-fixture';document.body.append(host);
  renderLocalDispatchStage(host,{
   order:{id:'drawer-test',order_number:'PRUEBA LOCAL',client_name:'PRUEBA',delivery_route_code:'LOCAL_DISPATCH',current_step_code:'LOCAL_DISPATCH',client_city:'SAN PEDRO',metadata:{clientDepartment:'VALLE DEL CAUCA',clientCity:'SAN PEDRO',clientAddress:'PRUEBA'}},
   invoices:[{invoice_number:'FV-PRUEBA',package_weight_kg:20}],deliveries:[],tasks:[],actions:{}
  },{});
 });
 const modal=page.locator('#local-drawer-fixture .local-dispatch-modal-aligned');
 const trigger=modal.locator('[data-local-quote-toggle]');
 const drawer=modal.locator('[data-local-quote-panel]');
 const overlay=modal.locator('[data-local-quote-overlay]');
 await expect(modal.locator('.shipping-core-summary-v11107')).toHaveCount(0);
 await expect(modal.locator('.local-dispatch-quote-entry')).toHaveCount(0);
 await expect(trigger).toBeVisible();
 await expect(overlay).toBeHidden();
 await expect(modal.locator('[name="weightKg"]')).toHaveValue('20');
 await trigger.click();
 await expect(drawer).toBeVisible();
 await expect(trigger).toHaveAttribute('aria-expanded','true');
 await expect(modal.locator('.shipping-process-body')).toHaveAttribute('inert','');
 await expect(drawer.locator('[data-local-route-category]')).toHaveValue('TULUA_CERCANAS');
 await expect(drawer.locator('[name="cityDestination"]')).toHaveValue('SAN PEDRO');
 const price=drawer.locator('[data-trip-total]');
 await expect(price).not.toHaveText('$0');
 await drawer.locator('[data-local-extra-toggle]').click();
 await drawer.locator('[name="unloadingCost"]').fill('12000');
 await expect(modal.locator('[data-local-quote-price]')).toContainText('$');
 await drawer.locator('[data-local-route-category]').selectOption('NORTE_VALLE_IBARRA');
 await expect(drawer.locator('[name="cityDestination"]')).toHaveValue('');
 await expect(modal.locator('[data-save-local-dispatch]')).toBeDisabled();
 await page.keyboard.press('Escape');
 await expect(overlay).toBeHidden();
 await expect(trigger).toBeFocused();
 await expect(modal.locator('.shipping-process-body')).not.toHaveAttribute('inert','');
 for(const width of [1440,1024,430]){
  await page.setViewportSize({width,height:840});
  await trigger.click();
  const bounds=await drawer.boundingBox();
  expect(bounds.width).toBeLessThanOrEqual(width);
  expect(bounds.x).toBeGreaterThanOrEqual(0);
  await drawer.locator('[data-local-quote-dismiss]').first().click();
  await expect(overlay).toBeHidden();
 }
});
