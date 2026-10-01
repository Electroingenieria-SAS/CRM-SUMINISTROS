import { initialRouteLabel } from "./order-routing.js";

export function bindRoutingConditions(assistant){
const typeControl=assistant.root.querySelector('[name="orderType"]');
const syncRoutingConditions=()=>{
    const type=typeControl?.value;
    const arrears=assistant.root.querySelector('[data-credit-arrears]');
    const cashHold=assistant.root.querySelector('[data-cash-hold]');
    const arrearsInput=assistant.root.querySelector('[name="hasCreditArrears"]');
    const cashInput=assistant.root.querySelector('[name="heldByCashier"]');
    const isCreditType=["PVC","PVP"].includes(type);
    const isPvn=type==="PVN";
    if(arrears)arrears.hidden=!isCreditType;
    if(cashHold)cashHold.hidden=!isPvn;
    if(!isCreditType&&arrearsInput)arrearsInput.checked=false;
    if(!isPvn&&cashInput)cashInput.checked=false;
    const direct=assistant.root.querySelector('[data-direct-reception]');
    const purchaseInput=assistant.root.querySelector('[name="requiresPurchase"]');
    const routing=initialRouteLabel({orderType:type,hasCreditArrears:Boolean(arrearsInput?.checked),heldByCashier:Boolean(cashInput?.checked),requiresPurchase:Boolean(purchaseInput?.checked)});
    if(direct){direct.querySelector("strong").textContent=`Ruta inicial: ${routing}`;direct.querySelector("small").textContent=routing==="Recepción de pedidos"?"El pedido no pasará por Cartera ni Caja.":"Esta condición excepcional define la primera cola del pedido.";}
  };
typeControl?.addEventListener("change",syncRoutingConditions);
assistant.root.querySelector('[name="hasCreditArrears"]')?.addEventListener("change",syncRoutingConditions);
assistant.root.querySelector('[name="heldByCashier"]')?.addEventListener("change",syncRoutingConditions);
assistant.root.querySelector('[name="requiresPurchase"]')?.addEventListener("change",syncRoutingConditions);
syncRoutingConditions();
}
