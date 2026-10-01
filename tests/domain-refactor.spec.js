import {test,expect} from '@playwright/test';

test('Orders keeps its list and three-step creation assistant',async({page})=>{
  await page.goto('/');
  await expect(page.getByRole('heading',{name:'Ingresa a CRM Suministros'})).toBeVisible();
  await page.evaluate(async()=>{
    const {api}=await import('/assets/js/services/api.js');
    const {state}=await import('/assets/js/core/state.js');
    state.modules=[{code:'orders',canRead:true,canCreate:true}];
    state.catalogs={steps:[{code:'CORTE',name:'Corte'}],orderTypes:[{code:'PVC',name:'PVC'}],paymentConditions:[{code:'CREDIT',name:'Crédito'}],deliveryRoutes:[{code:'NATIONAL_DISPATCH',name:'Despacho nacional'}]};
    api.listOrders=async()=>({items:[{id:'fixture-order',orderNumber:'PVC-FIXTURE',clientName:'Cliente sintético',orderType:'PVC',currentStep:'CORTE',stepName:'Corte',status:'IN_PROGRESS',sellerName:'Vendedor sintético'}],pagination:{page:1,pageSize:50,total:1,totalPages:1}});
    const root=document.createElement('main');root.id='domain-fixture';document.body.append(root);
    const {renderOrders}=await import('/assets/js/domains/orders/index.js');
    await renderOrders(root);
  });
  await expect(page.locator('#domain-fixture')).toContainText('Vendedor sintético');
  await page.locator('#create-order').click();
  await expect(page.locator('[data-wizard-panel]')).toHaveCount(3);
  await expect(page.locator('[data-sales-material]')).toHaveCount(1);
});

test('Workforce refresh fetches the current day again',async({page})=>{
  await page.goto('/');
  await expect(page.getByRole('heading',{name:'Ingresa a CRM Suministros'})).toBeVisible();
  await page.evaluate(async()=>{
    const {api}=await import('/assets/js/services/api.js');
    window.__fixtureDayCalls=0;
    api.workMyDay=async()=>{window.__fixtureDayCalls++;return {summary:{completed:7},catalog:[],today:[],history:[]};};
    const root=document.createElement('main');root.id='domain-fixture';document.body.append(root);
    const {renderWorkforce}=await import('/assets/js/domains/workforce/index.js');
    await renderWorkforce(root);
  });
  await page.locator('[data-work-refresh]').click();
  await expect.poll(()=>page.evaluate(()=>window.__fixtureDayCalls)).toBe(2);
});
