import assert from "node:assert/strict";
import fs from "node:fs";

const orders=fs.readFileSync(new URL("../assets/js/modules/orders.js",import.meta.url),"utf8");

assert.equal(
  orders.includes('${orderStageBadge(order)}'),
  true,
  "La columna Estado debe renderizar la etapa actual del pedido."
);

assert.equal(
  orders.includes('${statusBadge(order.status)}'),
  false,
  "La lista de pedidos no debe volver a mostrar el estado técnico genérico."
);

for(const token of [
  'function orderStageBadge(order={})',
  'status==="CLOSED"||step==="CLOSED"',
  '>Cerrado</span>',
  'status==="CANCELLED"',
  '>Cancelado</span>',
  'order.stepName||order.currentStep||order.current_step_code',
  '"badge-blue"'
]){
  assert.equal(orders.includes(token),true,`Falta contrato visual de etapa: ${token}`);
}

console.log("Order stage status V11.38.1 tests: OK");
