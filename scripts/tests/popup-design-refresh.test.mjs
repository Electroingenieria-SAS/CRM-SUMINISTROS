import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { baseShell } from "../../assets/js/domains/receiving/order/ui/reception-shell.js";
import { takeStage } from "../../assets/js/domains/receiving/order/stages/take.js";
const read=path=>fs.readFileSync(new URL("../../"+path,import.meta.url),"utf8");

const order={
  id:"example-order",order_number:"PED-UI-2026",client_name:"Cliente de prueba",
  order_type_code:"PVE",payment_condition_code:"CREDIT",
  delivery_route_code:"LOCAL_DISPATCH",current_step_code:"RECEPCION_PEDIDO"
};
const sample={order,files:[],assigneeLabel:"Coordinación logística"};

test("La recepción conserva botones y contratos del proceso en todos los estados",()=>{
  for(const stage of ["TAKE","REVIEW","PDF","EDIT","ASSIGN","STATUS"]){
    const body=stage==="TAKE"?takeStage(sample):'<article>Estado visual de prueba</article>';
    const html=baseShell(sample,body,{stage});
    for(const marker of ["data-close","data-take-another","data-reception-next","data-order-id","reception-process-modal"]){
      assert.ok(html.includes(marker),stage+": "+marker);
    }
    assert.equal(html.includes("data-take-order"),stage==="TAKE");
    assert.equal(html.includes("data-reception-next disabled"),stage==="STATUS");
  }
});

test("El rediseño se carga al final del paquete de operaciones",()=>{
  const operations=read("assets/css/operations.css");
  const parts=[
    "assets/css/components/enterprise-modal-foundation-v11471.css",
    "assets/css/components/enterprise-modal-workflows-v11471.css",
    "assets/css/components/enterprise-modal-responsive-v11471.css"
  ];
  for(const path of parts){
    assert.ok(read(path).trim().split("\n").length<=300,"Cada módulo visual debe respetar la arquitectura");
  }
  const css=parts.map(read).join("\n");
  const composition=read("assets/css/components/enterprise-modal-refresh-v11471.css");
  for(const filename of parts.map(path=>path.split("/").at(-1)))assert.ok(composition.includes(filename));
  const directive='@import "components/enterprise-modal-refresh-v11471.css";';
  assert.ok(operations.includes(directive));
  assert.equal(operations.trim().endsWith(directive),true);
  assert.match(css,/#modal-root \.modal\.popup-ux-v1190/);
  assert.match(css,/\.reception-take-card\.reception-take/);
  assert.match(css,/min-height:124px/);
  assert.match(css,/@media \(max-width:760px\)/);
  assert.match(css,/@media \(max-width:430px\)/);
  assert.match(css,/:focus-visible/);
  assert.match(css,/prefers-reduced-motion:reduce/);
});

test("El cambio visual conserva acciones de soporte y orden real de la cancelación",()=>{
  const support=read("assets/js/modules/support-flow.js");
  for(const action of ["NOTE","NOVELTY","REPORT","APPROVAL"]){
    assert.ok(support.includes('data-support-action="'+action+'"'));
  }
  const cancellation=read("assets/js/modules/order-cancellation.js");
  assert.match(cancellation,/container\.insertBefore\(button,nextStep\)/);
  assert.match(cancellation,/container\.append\(button\)/);
  assert.match(cancellation,/data-request-order-cancellation/);
  assert.match(cancellation,/api\.requestOrderCancellation/);
});

test("La política de modales no cambia por el rediseño",()=>{
  const [dialog,policy,enhancer]=[
    read("assets/js/core/ui/dialog.js"),
    read("assets/js/modules/popup-explicit-action-policy.js"),
    read("assets/js/modules/popup-ux-v1190.js")
  ];
  assert.match(dialog,/outcome!==false&&dialog\.isConnected/);
  assert.match(policy,/dataset\.enterConfirms!=="true"/);
  assert.match(enhancer,/bindValidation\(modal\)/);
  assert.match(enhancer,/bindIntentionalConfirmation\(modal\)/);
});
