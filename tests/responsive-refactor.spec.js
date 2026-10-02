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
