import {test,expect} from "@playwright/test";

function requireAuthenticatedTestConfig(){
  const missing=[
    ["ERP_TEST_EMAIL",process.env.ERP_TEST_EMAIL],
    ["ERP_TEST_PASSWORD",process.env.ERP_TEST_PASSWORD]
  ].filter(([,value])=>!String(value||"").trim()).map(([name])=>name);
  expect(missing,"El release gate autenticado requiere credenciales QA configuradas como secrets.").toEqual([]);
}

async function login(page){
  requireAuthenticatedTestConfig();
  await page.goto("/");
  await page.getByLabel("Correo corporativo").fill(process.env.ERP_TEST_EMAIL);
  await page.getByLabel("Contraseña").fill(process.env.ERP_TEST_PASSWORD);
  await page.getByRole("button",{name:/Ingresar a CRM Suministros/}).click();
  await expect(page.getByRole("heading",{name:"Centro de operaciones"})).toBeVisible({timeout:30000});
}

test("login shell renders",async({page})=>{
  const pageErrors=[];
  page.on("pageerror",error=>pageErrors.push(error.message));
  await page.goto("/");
  await expect(page.getByRole("heading",{name:"Ingresa a CRM Suministros"})).toBeVisible();
  await expect(page.getByLabel("Correo corporativo")).toBeVisible();
  await expect(page.getByLabel("Contraseña")).toBeVisible();
  expect(pageErrors).toEqual([]);
});

test("shared HTML boundary sanitizes executable markup",async({page})=>{
  await page.goto("/");
  const result=await page.evaluate(async()=>{
    const {sanitizeHtml}=await import("/assets/js/core/ui.js");
    const dirty='<img src="x" onerror="window.__xss=1"><a href="javascript:alert(1)">X</a><iframe srcdoc="<script>alert(1)<\\/script>"></iframe><strong data-safe="1">Seguro</strong>';
    return sanitizeHtml(dirty);
  });
  expect(result).not.toMatch(/onerror|javascript:|iframe|srcdoc|<script|<style|<link|background:url/i);
  expect(result).toContain('data-safe="1"');
  expect(result).toContain("Seguro");
});

test("authenticated shell, critical modules and native API",async({page})=>{
  const pageErrors=[];
  const consoleErrors=[];
  const failedRequests=[];
  page.on("pageerror",error=>pageErrors.push(error.message));
  page.on("console",msg=>{if(msg.type()==="error")consoleErrors.push(msg.text())});
  page.on("response",response=>{
    const url=response.url();
    if(response.status()>=500&&(url.startsWith(page.url().split("/").slice(0,3).join("/"))||/supabase\.co/.test(url))){
      failedRequests.push(`${response.status()} ${url}`);
    }
  });

  await login(page);

  const modules=[
    ["Pedidos","Pedidos"],
    ["Recepción","Recepción"],
    ["Inventario","Inventario"],
    ["Jornada y actividades","Jornada y actividades"],
    ["Excepciones y aprobaciones","Excepciones y aprobaciones"],
    ["Flujo y tiempos","Flujo y tiempos"],
    ["Analítica y reportes","Analítica y reportes"],
    ["Administración","Administración de CRM Suministros"]
  ];

  for(const [button,heading] of modules){
    const nav=page.getByRole("button",{name:button,exact:true});
    await expect(nav,`El usuario QA debe tener acceso al módulo ${button}.`).toBeVisible({timeout:30000});
    await nav.click();
    await expect(page.getByRole("heading",{name:heading,exact:false}).first()).toBeVisible({timeout:30000});
  }

  expect(pageErrors,"No debe haber excepciones JavaScript no capturadas.").toEqual([]);
  expect(failedRequests,"Ninguna navegación crítica debe generar respuestas 5xx.").toEqual([]);
  expect(consoleErrors.filter(x=>/firebase|firestore|DocumentRef|QueryRef|snapshot\.forEach|supabase-compat/i.test(x))).toEqual([]);
});
