import {test,expect} from '@playwright/test';

test('Drive accepts its nested cross-origin Apps Script callback',async({page})=>{
  const sandbox='https://n-bxf2muk7rmihub4iuwdqznurqcm6ax6w26p5jdy-0lu-script.googleusercontent.com';
  const endpoint='https://script.google.com/macros/s/AKfycbwjl1JCfE0eV92P6DCn6h8jIVIBlSwLOQj8U7Mz1_7YW2Xan8DPI5tpWJuiG7znSCSs/exec';
  await page.route(endpoint,route=>route.fulfill({contentType:'text/html',body:`<iframe src="${sandbox}/bridge-sandbox"></iframe>`}));
  await page.route(`${sandbox}/bridge-sandbox`,route=>route.fulfill({contentType:'text/html',body:`<iframe src="${sandbox}/bridge-callback"></iframe>`}));
  await page.route(`${sandbox}/bridge-callback`,route=>route.fulfill({contentType:'text/html',body:`<script>window.top.postMessage({source:'ERP_EI_DRIVE_BRIDGE',requestId:'browser-bridge-fixture',ok:true,file:{id:'fixture'}},${JSON.stringify(new URL(page.url()).origin)});</script>`}));
  await page.goto('/');
  await expect(page.getByRole('heading',{name:'Ingresa a CRM Suministros'})).toBeVisible();
  await page.evaluate(async()=>{
    const {postToBridge}=await import('/assets/js/integrations/drive/bridge/post-message-request.js');
    window.__bridgeOutcome='pending';
    postToBridge({requestId:'browser-bridge-fixture',action:'UPLOAD'}).then(
      data=>{window.__bridgeOutcome=data.file.id},
      error=>{window.__bridgeOutcome=error.message}
    );
  });
  await expect.poll(()=>page.evaluate(()=>window.__bridgeOutcome)).toBe('fixture');
  await expect(page.locator('iframe[name="erp_drive_browser-bridge-fixture"]')).toHaveCount(0);
});

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

test('Receiving assignee requires a real profile identity',async({page})=>{
  await page.goto('/');
  await expect(page.getByRole('heading',{name:'Ingresa a CRM Suministros'})).toBeVisible();
  const result=await page.evaluate(async()=>{
    const {assigneeName}=await import('/assets/js/domains/receiving/order/actions/start-reception.js');
    const {state}=await import('/assets/js/core/state.js');
    const originalProfile=state.profile;
    const data=task=>({order:{current_role_code:'RECEPCION_PEDIDO'},tasks:[task]});
    try{
      state.profile=null;
      const nullProfile=assigneeName(data({status:'QUEUED',assigned_name:'Sin perfil'}));
      state.profile={id:'profile-current',name:'Usuario actual'};
      const missingTaskOwner=assigneeName(data({status:'QUEUED',assigned_name:'Sin vínculo'}));
      const otherUser=assigneeName(data({status:'QUEUED',assigned_profile_id:'profile-other',assigned_name:'Otro usuario'}));
      const currentUser=assigneeName(data({status:'QUEUED',assigned_profile_id:'profile-current',assigned_name:'Nombre legado'}));
      return {nullProfile,missingTaskOwner,otherUser,currentUser};
    }finally{
      state.profile=originalProfile;
    }
  });
  expect(result).toEqual({
    nullProfile:'Sin perfil',
    missingTaskOwner:'Sin vínculo',
    otherUser:'Otro usuario',
    currentUser:'Usuario actual'
  });
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
