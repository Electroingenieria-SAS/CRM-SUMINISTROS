import {test,expect} from "@playwright/test";

async function login(page){
  await page.goto("/");
  await page.getByLabel("Correo corporativo").fill(process.env.ERP_TEST_EMAIL);
  await page.getByLabel("Contraseña").fill(process.env.ERP_TEST_PASSWORD);
  await page.getByRole("button",{name:/Ingresar a CRM Suministros/}).click();
  await expect(page.getByRole("heading",{name:"Centro de operaciones"})).toBeVisible({timeout:30000});
}

test("login shell renders",async({page})=>{
  await page.goto("/");
  await expect(page.getByRole("heading",{name:"Ingresa a CRM Suministros"})).toBeVisible();
  await expect(page.getByLabel("Correo corporativo")).toBeVisible();
  await expect(page.getByLabel("Contraseña")).toBeVisible();
});

test("authenticated shell, modules and native API",async({page})=>{
  test.skip(!process.env.ERP_TEST_EMAIL||!process.env.ERP_TEST_PASSWORD,"Configure ERP_TEST_EMAIL and ERP_TEST_PASSWORD");
  const errors=[];
  page.on("console",msg=>{if(msg.type()==="error")errors.push(msg.text())});
  await login(page);

  const modules=[
    ["Pedidos","Pedidos"],
    ["Inventario","Inventario"],
    ["Jornada y actividades","Jornada y actividades"],
    ["Excepciones y aprobaciones","Excepciones y aprobaciones"],
    ["Flujo y tiempos","Flujo y tiempos"]
  ];
  for(const [button,text] of modules){
    await page.getByRole("button",{name:button}).click();
    await expect(page.getByText(text,{exact:false}).first()).toBeVisible({timeout:30000});
  }

  expect(errors.filter(x=>/firebase|firestore|DocumentRef|QueryRef|snapshot\.forEach|supabase-compat/i.test(x))).toEqual([]);
});
