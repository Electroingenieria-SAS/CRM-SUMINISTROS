import { api } from "../../../services/api.js";
import { state } from "../../../core/state.js";
import { fmt } from "../../../core/format.js";
import { wizard, toast } from "../../../core/ui.js";
import { colombianDepartments } from "../../../services/location.js";
import { loadOrders } from "../list/load-orders.js";
import { estimatedSalesWeight } from "../freight/material-weight.js";
import { freightPredictionSnapshot, bindFreightPrediction } from "../freight/freight-prediction.js";
import { collectSalesItems } from "./validation.js";
import { openOrder } from "../detail/order-detail.js";
import { orderFormStep, orderMaterialsStep, orderConfirmationStep } from "./order-form.js";
import { bindRoutingConditions } from "./routing-controls.js";
import { bindCustomerIntelligence } from "./customer-intelligence.js";
import { bindOrderLocation } from "./delivery-location.js";
import { bindOrderMaterials } from "./materials.js";
import { orderTypeOptions } from "../shared/order-formatters.js";
import { openClientExtraDecision, readClientExtraValues } from "./client-extra-dialog.js";
import { icon } from "../../../core/icons.js";


function decorateCreateOrderAssistant(root){
  const modal=root?.querySelector?.(".wizard-modal");
  if(!modal)return;
  modal.classList.add("create-order-v1191");
  const subtitle=modal.querySelector(".wizard-head p");
  if(subtitle)subtitle.textContent="Crea el pedido paso a paso. El CRM conserva automáticamente la ruta, la trazabilidad y los datos que ya conoce.";
  const first=modal.querySelector('[data-wizard-panel="0"] .wizard-step-intro');
  if(first&&!first.querySelector(".create-order-step-mark-v1191")){
    const mark=document.createElement("div");
    mark.className="create-order-step-mark-v1191";
    mark.innerHTML=`<span>${icon("orders")}</span><div><strong>Registra solo lo esencial</strong><small>Los datos adicionales del cliente son opcionales y se preguntarán al continuar.</small></div>`;
    first.after(mark);
  }
}

export function openCreateOrder(){
const types=orderTypeOptions(state.catalogs.orderTypes||[]),payments=state.catalogs.paymentConditions||[],routes=state.catalogs.deliveryRoutes||[];
const departments=colombianDepartments();
const departmentOptions=`<option value="">Selecciona el departamento</option>${departments.map(item=>`<option value="${fmt.escape(item.code)}">${fmt.escape(item.name)}</option>`).join("")}`;
const assistant=wizard({
    title:"Crear pedido",
    subtitle:"Registra el pedido, la dirección obligatoria y los materiales en tres pasos.",
    finishLabel:"Crear pedido",
    steps:[
      {
        ...orderFormStep(types,payments,routes,departmentOptions),
        async validate(context){
          const valid=await orderFormStep(types,payments,routes,departmentOptions).validate(context);
          if(valid===false)return false;
          return openClientExtraDecision(context);
        }
      },
      orderMaterialsStep(),
      orderConfirmationStep()
    ],
    onFinish:finishCreateOrder
  });
decorateCreateOrderAssistant(assistant.root);
bindRoutingConditions(assistant);
bindCustomerIntelligence(assistant);
const scheduleFreightEstimate=bindFreightPrediction(assistant);
bindOrderLocation(assistant,departments,scheduleFreightEstimate);
bindOrderMaterials(assistant,scheduleFreightEstimate);
}

export async function finishCreateOrder({root,form,data}){
      const items=collectSalesItems(root);
      const freightWeight=estimatedSalesWeight(root);
      const freightPrediction=freightPredictionSnapshot(root.__freightPrediction);
      const metadata={
        estimatedMaterialWeightKg:freightWeight.complete?freightWeight.weightKg:null,
        freightPredictionVersion:freightPrediction?.version||null,
        freightPredictionAtCreation:freightPrediction
      };
      const result=await api.createOrder({...data,...readClientExtraValues(form),metadata,requiresCut:items.some(item=>item.requiresCut),items});
      toast(`Pedido ${result.orderNumber} creado. Las cantidades quedaron reservadas lógicamente y el pedido fue enviado a ${fmt.step(result.currentStep)}.`,"success",7500);
      await loadOrders(1);setTimeout(()=>openOrder(result.orderId),180);
    }
