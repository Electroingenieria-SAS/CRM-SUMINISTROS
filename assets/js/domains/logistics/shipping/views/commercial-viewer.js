import { statusBadge } from "../../../../core/format.js";
import { latestDelivery } from "../shared/shipping-status.js";
import { canReportNoDelivery, canConfirmDeliverySatisfaction } from "../permissions/shipping-permissions.js";
import { destination } from "../routes/shipping-routes.js";
import { shell } from "../ui/shipping-shell.js";
import { openNoDeliveryReport, openSatisfactionConfirmation } from "../actions/delivery-confirmation.js";
import { dispatchRecap, shippingSummary } from "../ui/delivery-summary.js";

export function renderCommercialViewer(host,data,{refreshLists}={}){
  const delivery=latestDelivery(data),place=destination(delivery,data.order),hasException=Boolean(data.order?.metadata?.deliveryExceptionOpen)||delivery?.status==="NOT_DELIVERED";
  const delivered=Boolean(delivery?.delivered_at)||delivery?.status==="DELIVERED";
  const satisfied=Boolean(delivery?.satisfaction_confirmed_at)||delivery?.satisfaction_status==="SATISFIED";
  const noDeliveryAction=canReportNoDelivery()&&!hasException&&delivery?.dispatched_at&&!delivered?'<button class="btn btn-danger btn-large" data-commercial-no-delivery>Reportar no entrega</button>':"";
  const satisfactionAction=canConfirmDeliverySatisfaction()&&!hasException&&delivered&&!satisfied?'<button class="btn btn-success btn-large" data-commercial-satisfied>Entregado con satisfacción</button>':satisfied?'<span class="sent-order-alert success">Entrega confirmada con satisfacción</span>':"";
  const exceptionAction=hasException?'<span class="sent-order-alert">Novedad de no entrega registrada</span>':"";
  shell(host,data,`<section class="shipping-commercial-view"><header><div><span>Seguimiento comercial</span><h4>Pedido enviado</h4><p>Consulta guía, recorrido, entrega y confirmación posterior del cliente.</p></div>${statusBadge(delivery?.status||data.order.status)}</header>${dispatchRecap(delivery,place)}<div class="commercial-shipping-actions">${exceptionAction||`${noDeliveryAction}${satisfactionAction}`}</div><details class="simple-details" open><summary>Ver trazabilidad, distancia y tiempos</summary>${shippingSummary(data)}</details></section>`,{showFooter:false});
  host.querySelector("[data-commercial-no-delivery]")?.addEventListener("click",()=>openNoDeliveryReport({id:data.order.id,orderNumber:data.order.order_number},{onSaved:()=>{host.replaceChildren();refreshLists?.();}}));
  host.querySelector("[data-commercial-satisfied]")?.addEventListener("click",()=>openSatisfactionConfirmation({id:data.order.id,orderNumber:data.order.order_number,route:data.order.delivery_route_code,distanceKm:delivery?.distance_km,receivedBy:delivery?.received_by},{onSaved:()=>{host.replaceChildren();refreshLists?.();}}));
}
