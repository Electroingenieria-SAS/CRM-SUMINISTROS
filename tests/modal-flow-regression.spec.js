import {test,expect} from '@playwright/test';

test('un modal no cierra el flujo cuando la validación devuelve false',async({page})=>{
 await page.goto('/');
 await page.evaluate(()=>{
  window.__modalCalls=0;window.__modalMayClose=false;
  import('/assets/js/core/ui/index.js').then(({modal})=>{
    modal({title:'Prueba de continuidad',body:'<div class="field"><label for="test-note">Observación</label><input id="test-note" class="control"></div>',
      confirmLabel:'Guardar y continuar',
      onConfirm:async()=>{window.__modalCalls++;return window.__modalMayClose;}
    });
  });
 });
 const dialog=page.getByRole('dialog',{name:'Prueba de continuidad'});
 await expect(dialog).toBeVisible();
 await page.locator('#test-note').fill('Se conserva el formulario');
 await page.locator('#test-note').press('Enter');
 await expect.poll(()=>page.evaluate(()=>window.__modalCalls)).toBe(0);
 await dialog.getByRole('button',{name:'Guardar y continuar'}).click();
 await expect(dialog).toBeVisible();
 await expect(page.locator('#test-note')).toHaveValue('Se conserva el formulario');
 await expect(dialog.getByRole('button',{name:'Guardar y continuar'})).toBeEnabled();
 await page.evaluate(()=>{window.__modalMayClose=true;});
 await dialog.getByRole('button',{name:'Guardar y continuar'}).click();
 await expect(dialog).toHaveCount(0);
 await expect.poll(()=>page.evaluate(()=>window.__modalCalls)).toBe(2);
});

test('el asistente conserva el último paso si onFinish rechaza continuar',async({page})=>{
 await page.goto('/');
 await page.evaluate(async()=>{
  const {wizard}=await import('/assets/js/core/ui/index.js');
  window.__finishAttempts=0;window.__finishAllowed=false;
  wizard({title:'Asistente de flujo',steps:[
     {title:'Datos',content:'<div class="field"><label>Dato<input class="control" name="dato" required></label></div>'},
     {title:'Confirmar',content:'<p>Verifica antes de guardar</p>'}
    ],finishLabel:'Guardar y continuar',
    onFinish:async()=>{window.__finishAttempts++;return window.__finishAllowed;}
  });
 });
 const dialog=page.getByRole('dialog',{name:'Asistente de flujo'});
 await dialog.locator('input[name="dato"]').fill('Registro de prueba');
 await dialog.locator('[data-next]').click();
 await expect(dialog.locator('[data-wizard-panel="1"]')).toHaveClass(/active/);
 await dialog.locator('[data-next]').click();
 await expect(dialog).toBeVisible();
 await expect(dialog.locator('[data-next]')).toBeEnabled();
 await page.evaluate(()=>{window.__finishAllowed=true});
 await dialog.locator('[data-next]').click();
 await expect(dialog).toHaveCount(0);
 await expect.poll(()=>page.evaluate(()=>window.__finishAttempts)).toBe(2);
});

test('panel de tarea vuelve a habilitar confirmar si la acción retorna false',async({page})=>{
 await page.goto('/');
 await page.evaluate(async()=>{
  const {modal,taskPanel}=await import('/assets/js/core/ui/index.js');
  window.__panelAllowed=false;window.__panelAttempts=0;
  modal({title:'Proceso operacional',body:'<p>Pedido en proceso</p>',confirmLabel:''});
  taskPanel(document.querySelector('#modal-root'),{title:'Registrar novedad',
    body:'<div class="field"><label>Motivo<input class="control" name="reason" required></label></div>',
    confirmLabel:'Guardar novedad',
    onConfirm:async()=>{window.__panelAttempts++;return window.__panelAllowed;}
  });
 });
 const panel=page.locator('[data-modal-task-panel]');
 const confirm=panel.locator('[data-task-panel-confirm]');
 await panel.locator('[name="reason"]').fill('Novedad de prueba');
 await confirm.click();
 await expect(panel).toBeVisible();
 await expect(confirm).toBeEnabled();
 await page.evaluate(()=>window.__panelAllowed=true);
 await confirm.click();
 await expect(panel).toHaveCount(0);
 await expect(page.getByRole('dialog',{name:'Proceso operacional'})).toBeVisible();
 await expect.poll(()=>page.evaluate(()=>window.__panelAttempts)).toBe(2);
});

test('la validación muestra etiquetas como texto, sin ejecutar HTML de datos',async({page})=>{
 await page.goto('/');
 await page.evaluate(async()=>{
   const {modal}=await import('/assets/js/core/ui/index.js');
   window.__injected=false;
   modal({title:'Validación sin HTML',body:'<div class="field"><label for="untrusted-label">Etiqueta</label><input id="untrusted-label" class="control" required></div>',
    confirmLabel:'Continuar',onConfirm:async()=>{}});
   document.querySelector('label[for="untrusted-label"]').textContent='<img src=x onerror="window.__injected=true">';
 });
 await page.locator('#untrusted-label').evaluate(el=>el.reportValidity());
 const error=page.locator('.popup-validation-v1190');
 await expect(error).toBeVisible();
 await expect(error).toContainText('<img src=x onerror=');
 await expect(error.locator('img')).toHaveCount(0);
 expect(await page.evaluate(()=>window.__injected)).toBe(false);
});
