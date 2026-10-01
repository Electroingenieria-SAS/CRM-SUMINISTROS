import { api } from "../../../../services/api.js";
import { fmt } from "../../../../core/format.js";
import { modal, toast } from "../../../../core/ui.js";
import { canReportNoDelivery, canConfirmDeliverySatisfaction } from "../permissions/shipping-permissions.js";

export function openNoDeliveryReport(order,{onSaved}={}){
  if(!canReportNoDelivery())return toast("Solo Ventas o Superadministración pueden registrar una no entrega.","error",7000);
  modal({title:"Reportar no entrega a Logística",confirmLabel:"Enviar reporte",size:"wide",body:`<div class="shipping-dialog-intro danger"><strong>${fmt.escape(order.orderNumber||order.order_number||"Pedido")}</strong><p>Se generará un Reporte bloqueante para Logística. El pedido no continuará hasta que Logística lo solucione y cierre.</p></div><div class="field"><label>Motivo de no entrega *</label><textarea class="control" name="reason" required autofocus placeholder="Explica por qué el cliente no recibió el pedido"></textarea></div><div class="field"><label>Acción solicitada</label><select class="control" name="requestedAction"><option value="CONTACT_CLIENT">Contactar al cliente</option><option value="REPROGRAM">Reprogramar entrega</option><option value="RETURN">Retornar mercancía</option><option value="REVIEW">Revisar con Logística</option></select></div>`,onConfirm:async dialog=>{const reason=dialog.querySelector('[name="reason"]').value.trim(),requestedAction=dialog.querySelector('[name="requestedAction"]').value;await api.reportShippingNoDelivery(order.id,{reason,requestedAction});toast("Reporte de no entrega enviado a Logística.","success",6500);onSaved?.();}});
}

export function openSatisfactionConfirmation(order,{onSaved}={}){
  if(!canConfirmDeliverySatisfaction())return toast("No tienes permiso para confirmar la satisfacción de entrega.","error",7000);
  const route=String(order.route||order.delivery_route_code||"").toUpperCase();
  const distanceRequired=route==="LOCAL_DISPATCH"||route==="NATIONAL_DISPATCH";
  const distanceHint=distanceRequired?"Obligatoria para despachos locales y nacionales. Registra la distancia real reportada por la operación o transportadora.":"Opcional para entrega en punto o retiro del cliente.";
  modal({
    title:"Entregado con satisfacción",
    confirmLabel:"Confirmar entrega satisfactoria",
    size:"wide",
    body:`<div class="shipping-dialog-intro"><strong>${fmt.escape(order.orderNumber||order.order_number||"Pedido")}</strong><p>Esta confirmación no reemplaza la entrega logística: registra la validación posterior del cliente y permite medir por separado tránsito, distancia y tiempo hasta satisfacción.</p></div>
      <div class="form-grid">
        <div class="field"><label>Recibido por</label><input class="control" name="receivedBy" value="${fmt.escape(order.receivedBy||"")}" placeholder="Nombre de quien recibió"></div>
        <div class="field"><label>Distancia recorrida (km) ${distanceRequired?"*":""}</label><input class="control" name="distanceKm" type="number" min="0" max="100000" step="0.1" value="${fmt.escape(order.distanceKm??"")}" ${distanceRequired?"required":""}><small>${fmt.escape(distanceHint)}</small></div>
        <div class="field"><label>Fuente de la distancia</label><select class="control" name="distanceSource"><option value="">Seleccionar…</option><option value="CARRIER_REPORTED">Reportada por transportadora</option><option value="ODOMETER_GPS">Odómetro / GPS</option><option value="ROUTE_ESTIMATE">Ruta estimada</option><option value="CLIENT_CONFIRMED">Confirmada con cliente</option><option value="OTHER">Otra fuente verificable</option></select></div>
        <div class="field full"><label>Observación</label><textarea class="control" name="note" maxlength="500" placeholder="Observación breve sobre la entrega o la confirmación del cliente"></textarea></div>
      </div>`,
    onConfirm:async dialog=>{
      const rawDistance=dialog.querySelector('[name="distanceKm"]').value.trim();
      const distanceKm=rawDistance===""?null:Number(rawDistance);
      const distanceSource=dialog.querySelector('[name="distanceSource"]').value;
      const receivedBy=dialog.querySelector('[name="receivedBy"]').value.trim();
      const note=dialog.querySelector('[name="note"]').value.trim();
      if(distanceRequired&&(!Number.isFinite(distanceKm)||distanceKm<=0))throw new Error("Registra la distancia recorrida para este despacho.");
      if(distanceKm!==null&&(!Number.isFinite(distanceKm)||distanceKm<0))throw new Error("La distancia recorrida no es válida.");
      if(distanceKm!==null&&!distanceSource)throw new Error("Selecciona la fuente de la distancia recorrida.");
      const result=await api.confirmShippingSatisfaction(order.id,{distanceKm,distanceSource,receivedBy,note});
      const km=Number(result?.metrics?.distanceKm);
      toast(Number.isFinite(km)?`Entrega confirmada con satisfacción · ${new Intl.NumberFormat("es-CO",{maximumFractionDigits:1}).format(km)} km registrados.`:"Entrega confirmada con satisfacción.","success",7000);
      onSaved?.(result);
    }
  });
}
