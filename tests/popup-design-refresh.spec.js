import {test,expect} from "@playwright/test";

async function mountReception(page){
  await page.evaluate(async()=>{
    const [{baseShell},{takeStage},{mountOrderCancellationAction}]=await Promise.all([
      import("/assets/js/domains/receiving/order/ui/reception-shell.js"),
      import("/assets/js/domains/receiving/order/stages/take.js"),
      import("/assets/js/modules/order-cancellation.js")
    ]);
    const order={
      id:"popup-layout-fixture",order_number:"PEDIDO VISUAL 0001",
      client_name:"Cliente de prueba",order_type_code:"PVE",
      payment_condition_code:"CREDIT",delivery_route_code:"LOCAL_DISPATCH",
      current_step_code:"RECEPCION_PEDIDO",status:"OPEN"
    };
    const data={order,files:[],assigneeLabel:"Coordinación logística"};
    const host=document.querySelector("#modal-root");
    host.innerHTML=baseShell(data,takeStage(data),{stage:"TAKE"});
    mountOrderCancellationAction(host,data);
    await import("/assets/js/modules/popup-ux-v1190.js");
    const {installSupportFlow}=await import("/assets/js/modules/support-flow.js");
    installSupportFlow();
  });
  await expect(page.locator(".reception-process-modal.popup-ux-v1190")).toBeVisible();
}

test("Recepción presenta acciones intactas, inicio compacto y orden correcto",async({page})=>{
  await page.goto("/");
  await mountReception(page);
  const dialog=page.locator("#modal-root .reception-process-modal");
  const footer=dialog.locator(".parallel-work-actions");
  const actions=await footer.locator("button").evaluateAll(nodes=>nodes.map(n=>n.hasAttribute("data-take-another")?"other":n.hasAttribute("data-request-order-cancellation")?"cancel":n.hasAttribute("data-reception-next")?"next":"unknown"));
  expect(actions).toEqual(["other","cancel","next"]);
  await expect(dialog.locator("[data-take-order]")).toBeVisible();
  await expect(dialog.locator("[data-support-action='NOTE']")).toBeVisible();
  await expect(dialog.locator("[data-support-action='NOVELTY']")).toBeVisible();
  await expect(dialog.locator("[data-support-action='REPORT']")).toBeVisible();
  await expect(dialog.locator("[data-support-action='APPROVAL']")).toBeVisible();
  await page.setViewportSize({width:1440,height:900});
  const takeHeight=await dialog.locator(".reception-take-card").evaluate(node=>node.getBoundingClientRect().height);
  expect(takeHeight).toBeLessThan(195);
  const modalWidth=await dialog.evaluate(node=>node.getBoundingClientRect().width);
  expect(modalWidth).toBeGreaterThan(900);
  await footer.locator("[data-request-order-cancellation]").click();
  await expect(page.locator("[data-modal-task-panel]")).toBeVisible();
  await expect(page.locator("[name='cancellationNote']")).toBeVisible();
  await page.locator("[data-task-panel-close]").click();
  await expect(page.locator("[data-modal-task-panel]")).toHaveCount(0);
  await expect(dialog.locator("[data-take-order]")).toBeVisible();
});

test("A 390px conserva modal, scroll, acciones y tamaños táctiles",async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto("/");
  await mountReception(page);
  const info=await page.locator("#modal-root .reception-process-modal").evaluate(node=>{
    const rect=node.getBoundingClientRect();
    const foot=node.querySelector(".modal-foot").getBoundingClientRect();
    const btn=node.querySelector("[data-take-order]").getBoundingClientRect();
    return {left:rect.left,right:rect.right,top:rect.top,bottom:rect.bottom,
      viewport:document.documentElement.clientWidth,
      scrollable:node.querySelector(".modal-body").scrollHeight>=node.querySelector(".modal-body").clientHeight,
      footVisible:foot.bottom<=window.innerHeight+2,
      buttonHeight:btn.height};
  });
  expect(info.left).toBeGreaterThanOrEqual(-2);
  expect(info.right).toBeLessThanOrEqual(info.viewport+2);
  expect(info.top).toBeGreaterThanOrEqual(-2);
  expect(info.bottom).toBeLessThanOrEqual(846);
  expect(info.footVisible).toBe(true);
  expect(info.scrollable).toBe(true);
  expect(info.buttonHeight).toBeGreaterThanOrEqual(44);
  for(const selector of ["[data-take-another]","[data-reception-next]","[data-request-order-cancellation]"])
    await expect(page.locator("#modal-root "+selector)).toHaveCount(1);
});

test("Dialog estándar mantiene las acciones accesibles con el diseño actualizado",async({page})=>{
  await page.goto("/");
  await page.evaluate(async()=>{
    const {modal}=await import("/assets/js/core/ui/index.js");
    window.__popupSaved=0;
    modal({title:"Prueba de estilo corporativo",
      body:'<div class="field"><label for="popup-fixture">Observación</label><input class="control" id="popup-fixture" required></div>',
      confirmLabel:"Guardar cambios",onConfirm:async()=>{window.__popupSaved+=1;}});
  });
  const dialog=page.getByRole("dialog",{name:"Prueba de estilo corporativo"});
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveClass(/popup-ux-v1190/);
  await dialog.locator("#popup-fixture").fill("Ejemplo");
  await dialog.getByRole("button",{name:"Guardar cambios"}).click();
  await expect(dialog).toHaveCount(0);
  expect(await page.evaluate(()=>window.__popupSaved)).toBe(1);
});
