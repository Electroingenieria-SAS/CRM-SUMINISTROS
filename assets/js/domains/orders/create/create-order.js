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

export function openCreateOrder(){
const types=state.catalogs.orderTypes||[],payments=state.catalogs.paymentConditions||[],routes=state.catalogs.deliveryRoutes||[];
const departments=colombianDepartments();
const departmentOptions=`<option value="">Selecciona el departamento</option>${departments.map(item=>`<option value="${fmt.escape(item.code)}">${fmt.escape(item.name)}</option>`).join("")}`;
const assistant=wizard({
    title:"Crear pedido",
    subtitle:"Registra el pedido, la dirección obligatoria y los materiales en tres pasos.",
    finishLabel:"Crear pedido",
    steps:[orderFormStep(types,payments,routes,departmentOptions),orderMaterialsStep(),orderConfirmationStep()],
    onFinish:finishCreateOrder
  });
bindRoutingConditions(assistant);
bindCustomerIntelligence(assistant);
const scheduleFreightEstimate=bindFreightPrediction(assistant);
bindOrderLocation(assistant,departments,scheduleFreightEstimate);
bindOrderMaterials(assistant,scheduleFreightEstimate);
}

export async function finishCreateOrder({root,data}){
      const items=collectSalesItems(root);
      const freightWeight=estimatedSalesWeight(root);
      const freightPrediction=freightPredictionSnapshot(root.__freightPrediction);
      const metadata={
        estimatedMaterialWeightKg:freightWeight.complete?freightWeight.weightKg:null,
        freightPredictionVersion:freightPrediction?.version||null,
        freightPredictionAtCreation:freightPrediction
      };
      const result=await api.createOrder({...data,metadata,requiresCut:items.some(item=>item.requiresCut),items});
      toast(`Pedido ${result.orderNumber} creado. Las cantidades quedaron reservadas lógicamente y el pedido fue enviado a ${fmt.step(result.currentStep)}.`,"success",7500);
      await loadOrders(1);setTimeout(()=>openOrder(result.orderId),180);
    }
