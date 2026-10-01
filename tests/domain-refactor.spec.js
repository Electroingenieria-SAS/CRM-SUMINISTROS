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

test('Receiving keeps ownership permissions and the PDF draft when going back',async({page})=>{
  await page.goto('/');
  await expect(page.getByRole('heading',{name:'Ingresa a CRM Suministros'})).toBeVisible();
  await page.evaluate(async()=>{
    const {renderOrderReception}=await import('/assets/js/domains/receiving/index.js');
    const root=document.createElement('main');root.id='domain-fixture';document.body.append(root);
    const order={id:'receiving-fixture',order_number:'PVC-FIXTURE',client_name:'Cliente sintético',order_type_code:'PVC',current_step_code:'RECEPCION_PEDIDO',version:1};
    renderOrderReception(root,{order,items:[],files:[],tasks:[{id:'task-fixture',status:'QUEUED'}],actions:{actions:[]}});
    window.__receivingFixture={order,items:[],files:[],tasks:[{id:'task-fixture',status:'IN_PROGRESS'}],actions:{actions:[{code:'COMPLETE'}]}};
  });
  await expect(page.locator('[data-take-order]')).toBeDisabled();
  await page.evaluate(async()=>{
    const {renderOrderReception}=await import('/assets/js/domains/receiving/index.js');
    renderOrderReception(document.querySelector('#domain-fixture'),window.__receivingFixture);
  });
  await page.locator('[data-info-assign]').click();
  await expect(page.locator('[data-local-pdf]')).toBeAttached();
  await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('erp:recepcion-pedido:v10.6:receiving-fixture')).stage)).toBe('PDF');
  await page.locator('[data-back-review]').click();
  await expect(page.locator('[data-info-assign]')).toBeVisible();
});

test('Picking resumes a found line with its saved physical origin',async({page})=>{
  await page.goto('/');
  await expect(page.getByRole('heading',{name:'Ingresa a CRM Suministros'})).toBeVisible();
  await page.evaluate(async()=>{
    const {api}=await import('/assets/js/services/api.js');
    api.pickingPrecheck=async()=>({items:[]});
    api.pickingOriginPlan=async()=>({required:1,unit:'UND',candidates:[{lotId:'lot-fixture',location:'Bodega',available:1}],suggestedPlan:[{lotId:'lot-fixture',quantity:1}]});
    localStorage.setItem('erp:alistamiento:v10.8:task-fixture',JSON.stringify({'item-fixture':{result:'FOUND',origins:[{lotId:'lot-fixture',quantity:1}]}}));
    const root=document.createElement('main');root.id='domain-fixture';document.body.append(root);
    const {renderPickingFlow}=await import('/assets/js/domains/picking/index.js');
    renderPickingFlow(root,{order:{id:'picking-fixture',order_number:'PVC-FIXTURE',client_name:'Cliente sintético',order_type_code:'PVC',current_step_code:'ALISTAMIENTO',version:1},items:[{id:'item-fixture',description:'Material sintético',reference:'MAT-1',quantity:1,unit:'UND',requires_cut:false}],tasks:[{id:'task-fixture',status:'IN_PROGRESS'}],actions:{actions:[{code:'COMPLETE'}]},cutRequirements:[]});
  });
  await expect(page.locator('[data-picking-item]')).toHaveCount(1);
  await expect(page.locator('[data-picking-send]')).toBeEnabled();
  await expect(page.locator('[data-origin-total]')).toContainText('Origen completo');
});
