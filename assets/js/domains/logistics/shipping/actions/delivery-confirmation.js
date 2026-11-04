import { api } from "../../../../services/api.js";
import { fmt } from "../../../../core/format.js";
import { modal, toast } from "../../../../core/ui.js";
import { canReportNoDelivery, canConfirmDeliverySatisfaction } from "../permissions/shipping-permissions.js";
import { estimateShipmentDistance } from "./shipping-distance.js";

export function openNoDeliveryReport(order,{onSaved}={}){
  if(!canReportNoDelivery())return toast("Solo Ventas o Superadministración pueden registrar una no entrega.","error",7000);
  modal({title:"Reportar no entrega a Logística",confirmLabel:"Enviar reporte",size:"wide",body:`<div class="shipping-dialog-intro danger"><strong>${fmt.escape(order.orderNumber||order.order_number||"Pedido")}</strong><p>Se generará un Reporte bloqueante para Logística. El pedido no continuará hasta que Logística lo solucione y cierre.</p></div><div class="field"><label>Motivo de no entrega *</label><textarea class="control" name="reason" required autofocus placeholder="Explica por qué el cliente no recibió el pedido"></textarea></div><div class="field"><label>Acción solicitada</label><select class="control" name="requestedAction"><option value="CONTACT_CLIENT">Contactar al cliente</option><option value="REPROGRAM">Reprogramar entrega</option><option value="RETURN">Retornar mercancía</option><option value="REVIEW">Revisar con Logística</option></select></div>`,onConfirm:async dialog=>{const reason=dialog.querySelector('[name="reason"]').value.trim(),requestedAction=dialog.querySelector('[name="requestedAction"]').value;await api.reportShippingNoDelivery(order.id,{reason,requestedAction});toast("Reporte de no entrega enviado a Logística.","success",6500);onSaved?.();}});
}

export function openSatisfactionConfirmation(order,{onSaved}={}){
  if(!canConfirmDeliverySatisfaction())return toast("No tienes permiso para confirmar la satisfacción de entrega.","error",7000);
  let distancePromise;
  const view=modal({
    title:"Entregado con satisfacción",
    confirmLabel:"Confirmar entrega satisfactoria",
    size:"wide",
    body:`<div class="shipping-dialog-intro"><strong>${fmt.escape(order.orderNumber||order.order_number||"Pedido")}</strong><p>Esta confirmación registra la satisfacción del cliente, separada de la entrega logística. El sistema consulta automáticamente la distancia vial estimada; no es necesario ingresar kilómetros.</p></div>
      <div class="form-grid">
        <div class="field"><label>Recibido por</label><input class="control" name="receivedBy" value="${fmt.escape(order.receivedBy||"")}" placeholder="Nombre de quien recibió"></div>
        <div class="field" aria-live="polite"><label>Distancia estimada automáticamente</label><div class="control" data-shipping-distance-estimate>Calculando ruta vial...</div><small>Estimación por carretera entre municipios, no lectura de odómetro/GPS. Datos geográficos © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap contributors</a>.</small></div>
        <div class="field full"><label>Observación</label><textarea class="control" name="note" maxlength="500" placeholder="Observación breve sobre la entrega o la confirmación del cliente"></textarea></div>
      </div>`,
    onConfirm:async dialog=>{
      // El kilometraje nunca se captura ni se edita en el formulario.
      const estimate=await distancePromise;
      const receivedBy=dialog.querySelector('[name="receivedBy"]').value.trim();
      const note=dialog.querySelector('[name="note"]').value.trim();
      const distanceKm=estimate?.distanceKm??null;
      const distanceSource=estimate?.distanceSource??null;
      const result=await api.confirmShippingSatisfaction(order.id,{distanceKm,distanceSource,receivedBy,note});
      const savedKm=result?.metrics?.distanceKm;
      toast(savedKm!=null&&Number.isFinite(Number(savedKm))?`Entrega confirmada con satisfacción · ${new Intl.NumberFormat("es-CO",{maximumFractionDigits:1}).format(Number(savedKm))} km ${distanceSource==="ROUTE_ESTIMATE"?"estimados automáticamente":"registrados"}.`:"Entrega confirmada con satisfacción. Distancia vial pendiente de cálculo.","success",7000);
      onSaved?.(result);
    }
  });
  const status=view.root.querySelector("[data-shipping-distance-estimate]");
  distancePromise=estimateShipmentDistance(order.id).then(result=>{
    if(result?.distanceKm!=null&&Number.isFinite(Number(result.distanceKm))&&Number(result.distanceKm)>0){
      status.textContent=`${new Intl.NumberFormat("es-CO",{maximumFractionDigits:1}).format(Number(result.distanceKm))} km · ${result.estimated?"estimación vial automática": "distancia ya registrada"}`;
    }else{
      status.textContent=result?.notApplicable?"No aplica para entrega en punto o recogida.":result?.reason||"No fue posible calcular la distancia vial para esta ruta.";
    }
    return result;
  }).catch(error=>{
    console.warn("[CRM SHIPPING] Distancia vial automática no disponible",error);
    status.textContent="Distancia pendiente: el servicio de rutas o el municipio no están disponibles.";
    return null;
  });
}
