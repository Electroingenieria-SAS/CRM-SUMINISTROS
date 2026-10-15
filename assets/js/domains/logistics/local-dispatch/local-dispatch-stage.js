import { api } from "../../../services/api.js";
import { fmt } from "../../../core/format.js";
import { toast } from "../../../core/ui.js";
import { shell, bindFooter } from "../shipping/ui/shipping-shell.js";
import { workflowHeader } from "../shipping/ui/workflow-header.js";
import { workspace } from "../shipping/ui/workspace.js";
import { latestDelivery } from "../shipping/shared/shipping-status.js";
import { destination } from "../shipping/routes/shipping-routes.js";
import { LOCAL_DISPATCH_BRANCHES,calculateLocalDispatch,currencyCOP,latestInvoiceDefaults,suggestedDestination,tariffFor } from "./tariffs.js";
import {bindLocalRoutePicker} from "./local-route-picker.js";
import {localQuoteDrawerHtml,bindLocalQuoteDrawer} from "./local-quote-drawer.js";

function bogotaDate(){
  return new Intl.DateTimeFormat("en-CA",{timeZone:"America/Bogota",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
}
function localTrip(delivery){return delivery?.metadata?.localDispatch||null}
function option(value,label,current){return `<option value="${fmt.escape(value)}" ${value===current?"selected":""}>${fmt.escape(label)}</option>`}
function initialValues(data){
  const delivery=latestDelivery(data),stored=localTrip(delivery)||{},invoice=latestInvoiceDefaults(data.invoices||[]);
  const city=stored.cityDestination||suggestedDestination(data.order.client_city||data.order.metadata?.clientCity)||"";
  return {
    date:stored.date||bogotaDate(),
    invoiceNumber:stored.invoiceNumber||invoice.invoiceNumber||"",
    branch:stored.branch||"D0604",
    city,
    weightKg:Number(stored.weightKg??invoice.weightKg??0)||0,
    unloadingCost:Number(stored.unloadingCost||0)||0,
    diversionCost:Number(stored.diversionCost||0)||0,
    vehiclePlate:stored.vehiclePlate||"",
    driverName:stored.driverName||"",
    observations:stored.observations||"",
    persisted:Boolean(stored.tripId)
  };
}
function formHtml(data,values,place){
  return `<div class="shipping-core-task-head-v11107"><div><span class="shipping-core-task-kicker-v11107">PASO 2 · DESPACHO LOCAL</span><h4>Cargue y liquidación</h4><p>Primero registra el viaje; abre el cotizador solo cuando necesites seleccionar la ruta o revisar recargos.</p></div><span class="shipping-core-step-badge-v11107">Paso 2 de 3</span></div>
    <section class="local-dispatch-route-strip" aria-label="Resumen de entrega y flete">
      <div class="local-dispatch-route-address"><small>DESTINO REGISTRADO POR VENTAS</small>
        <strong>${fmt.escape(place.municipality||"Municipio no registrado")}${place.department?", "+fmt.escape(place.department):""}</strong>
        <span>${fmt.escape(place.address||"Dirección no registrada")}</span></div>
      <div class="local-dispatch-route-quote"><small>FLETE LOCAL · ORIGEN TULUÁ</small>
        <strong data-local-quote-price>Por cotizar</strong><span data-local-quote-status>Selecciona la ruta desde el cotizador.</span></div>
    </section>
    <section class="local-dispatch-form-v1145" data-local-dispatch-form>
      <section class="local-dispatch-block-v1146">
        <header><div><small>DATOS DEL VIAJE</small><h5>Salida y vehículo</h5></div><span>Información operativa</span></header>
        <div class="local-dispatch-form-grid-v1145 local-dispatch-trip-grid">
          <div class="local-dispatch-field-row" data-trip-field-row="primary">
            <label><span>Fecha de salida *</span><input class="control" type="date" name="tripDate" value="${fmt.escape(values.date)}" required></label>
            <label><span>Factura *</span><input class="control" name="invoiceNumber" value="${fmt.escape(values.invoiceNumber)}" aria-describedby="local-dispatch-prefill-help" required></label>
            <label><span>Sucursal / asesor *</span><select class="control" name="branch" required>${LOCAL_DISPATCH_BRANCHES.map(code=>option(code,code,values.branch)).join("")}</select></label>
          </div>
          <div class="local-dispatch-field-row" data-trip-field-row="vehicle">
            <label><span>Peso total (kg) *</span><input class="control" type="number" min="0.001" step="0.001" name="weightKg" value="${values.weightKg||""}" aria-describedby="local-dispatch-prefill-help" required></label>
            <label><span>Placa del vehículo *</span><input class="control" name="vehiclePlate" maxlength="20" value="${fmt.escape(values.vehiclePlate)}" placeholder="Ej. ABC123" required></label>
            <label><span>Conductor *</span><input class="control" name="driverName" maxlength="120" value="${fmt.escape(values.driverName)}" placeholder="Nombre del conductor" required></label>
          </div>
          <p class="local-dispatch-prefill-help" id="local-dispatch-prefill-help"><span aria-hidden="true">✓</span> Factura y peso se precargan desde Facturación cuando están disponibles. Al cambiar el peso, el flete se recalcula automáticamente.</p>
          <label class="local-dispatch-wide-v1145 local-dispatch-observation-field"><span>Observaciones de salida</span><textarea class="control" name="observations" rows="2" maxlength="1000" placeholder="Información relevante del vehículo o del despacho">${fmt.escape(values.observations)}</textarea></label>
        </div>
      </section>
      <div class="local-dispatch-form-actions-v1145">
        <span data-local-save-state>${values.persisted?"Cargue guardado · puedes ajustar los datos mientras el pedido permanezca en esta etapa.":"Aún no se ha registrado el cargue."}</span>
        <button type="button" class="btn btn-primary" data-save-local-dispatch>Guardar cargue y liquidación</button>
      </div>
    </section>`;
}
function readPayload(root){
  const value=name=>root.querySelector(`[name="${name}"]`)?.value?.trim?.()||"";
  return {
    fecha:value("tripDate"),numeroFactura:value("invoiceNumber"),sucursal:value("branch"),ciudadDestino:value("cityDestination"),
    pesoKg:Number(value("weightKg")||0),vehiculoPlaca:value("vehiclePlate").toUpperCase(),conductor:value("driverName"),
    costoDescargue:Number(value("unloadingCost")||0),costoDesvio:Number(value("diversionCost")||0),observaciones:value("observations")
  };
}
function preview(root){
  const payload=readPayload(root);
  const calc=calculateLocalDispatch(payload.ciudadDestino,payload.pesoKg,payload.costoDescargue,payload.costoDesvio);
  root.querySelector("[data-trip-base]").textContent=currencyCOP(calc.tariffBase);
  root.querySelector("[data-trip-extra-kg]").textContent=`${new Intl.NumberFormat("es-CO",{maximumFractionDigits:3}).format(calc.extraKg)} kg`;
  root.querySelector("[data-trip-extra-cost]").textContent=currencyCOP(calc.extraCost);
  root.querySelector("[data-trip-total]").textContent=calc.available?currencyCOP(calc.total):"Sin tarifa";
  root.querySelector("[data-local-quote-weight]").textContent=`${fmt.number(payload.pesoKg,3)} kg`;
  const route=tariffFor(payload.ciudadDestino);
  const summary=root.closest('.shipping-core-v11107');
  if(summary?.querySelector('[data-local-quote-price]'))summary.querySelector('[data-local-quote-price]').textContent=calc.available?currencyCOP(calc.total):'Por cotizar';
  if(summary?.querySelector('[data-local-quote-status]'))summary.querySelector('[data-local-quote-status]').textContent=route?route.code+' · '+fmt.number(payload.pesoKg,3)+' kg':'Selecciona un destino para calcular.';
  const warning=root.querySelector('[data-local-matrix-warning]');
  const reason=calc.reason==='PESO_FUERA_DE_RANGO'
   ?'Esta ruta solo tiene tarifa documentada hasta 2.500 kg. Solicita una liquidación especial.'
   :calc.reason==='RUTA_SIN_TARIFA'?'Selecciona una ruta incluida en la matriz.'
   :calc.reason==='EXTRAS_INVALIDOS'?'Revisa los recargos adicionales.'
   :'Registra un peso válido para calcular automáticamente.';
  warning.textContent=reason;
  warning.hidden=calc.available;
  const button=root.querySelector('[data-save-local-dispatch]');
  if(button)button.disabled=!calc.available;
}
export function localDispatchSummary(delivery){
  const trip=localTrip(delivery);
  if(!trip)return "";
  const extras=Number(trip.unloadingCost||0)+Number(trip.diversionCost||0);
  return `<div class="local-dispatch-saved-summary-v1145">
    <div><small>Vehículo</small><strong>${fmt.escape(trip.vehiclePlate||"—")}</strong><span>${fmt.escape(trip.driverName||"Conductor no registrado")}</span></div>
    <div><small>Factura / destino</small><strong>${fmt.escape(trip.invoiceNumber||"—")}</strong><span>${fmt.escape(trip.cityDestination||"—")}</span></div>
    <div><small>Peso</small><strong>${fmt.number(Number(trip.weightKg||0),3)} kg</strong><span>Extra: ${fmt.number(Number(trip.extraKg||0),3)} kg</span></div>
    <div><small>Extras</small><strong>${currencyCOP(extras)}</strong><span>Descargue + desvío</span></div>
    <div class="total"><small>Total viaje</small><strong>${currencyCOP(trip.totalTrip||delivery?.carrier_cost||0)}</strong><span>${fmt.escape(trip.deliveryStatus||"PENDIENTE")}</span></div>
  </div>`;
}
export function renderLocalDispatchStage(host,data,{reload,refreshLists}={}){
  const delivery=latestDelivery(data),place=destination(delivery,data.order),values=initialValues(data);
  shell(host,data,`${workflowHeader(data,"GUIDE",delivery)}${workspace(data,"GUIDE",formHtml(data,values,place),place)}`,{nextLabel:values.persisted?"Enviar a cierre":"Guardar y enviar a cierre"});
  host.querySelector(".shipping-core-v11107")?.classList.add("local-dispatch-modal-aligned");
  const modal=host.querySelector('.shipping-core-v11107');
  const form=modal.querySelector('[data-local-dispatch-form]');
  modal.insertAdjacentHTML('beforeend',localQuoteDrawerHtml(values));
  const top=modal.querySelector('.shipping-process-head');
  const close=top.querySelector(':scope > [data-close]');
  const quoteButton=document.createElement('button');
  quoteButton.type='button';
  quoteButton.className='btn btn-primary local-dispatch-header-quote';
  quoteButton.dataset.localQuoteToggle='';
  quoteButton.setAttribute('aria-controls','local-dispatch-quote-details');
  quoteButton.setAttribute('aria-expanded','false');
  quoteButton.textContent='Cotizar flete local ↗';
  top.insertBefore(quoteButton,close);
  const quoteDrawer=bindLocalQuoteDrawer(modal);
  bindLocalRoutePicker(modal);
  let dirty=!values.persisted;
  const mark=()=>{
   dirty=true;preview(modal);
   const state=form.querySelector('[data-local-save-state]');
   if(state)state.textContent='Cambios pendientes de guardar.';
  };
  modal.querySelectorAll('[data-local-dispatch-form] input,[data-local-dispatch-form] select,[data-local-dispatch-form] textarea,[data-local-quote-panel] input,[data-local-quote-panel] select')
    .forEach(control=>control.addEventListener('input',event=>{
     if(!event.target.matches('[data-local-route-query]'))mark();
    }));
  preview(modal);
  const save=async()=>{
    const payload=readPayload(modal);
    const tariff=calculateLocalDispatch(payload.ciudadDestino,payload.pesoKg,payload.costoDescargue,payload.costoDesvio);
    if(!tariff.available){quoteDrawer.open();throw new Error("Selecciona una ruta y registra un peso válido en Cotizar flete local.");}
    if(payload.costoDescargue+payload.costoDesvio>0&&payload.observaciones.trim().length<8)throw new Error("Describe el motivo del auxiliar o subruta en Observaciones.");
    if(!payload.fecha||!payload.numeroFactura||!payload.sucursal||!payload.ciudadDestino||!(payload.pesoKg>0)||!payload.vehiculoPlaca||!payload.conductor)throw new Error("Completa fecha, factura, sucursal, destino, peso, placa y conductor.");
    const result=await api.localDispatchSave(data.order.id,payload);
    dirty=false;
    const state=form.querySelector("[data-local-save-state]");
    if(state)state.textContent=`Cargue guardado · ${currencyCOP(result?.trip?.total_viaje||result?.trip?.totalTrip||0)}`;
    toast("Cargue y liquidación del vehículo registrados.","success",5500);
    refreshLists?.();
    return result;
  };
  const saveButton=form?.querySelector("[data-save-local-dispatch]");
  saveButton?.addEventListener("click",async()=>{saveButton.disabled=true;try{await save();await reload?.()}catch(error){toast(error.message||"No fue posible guardar el despacho local.","error",7500);saveButton.disabled=false}});
  bindFooter(host,data,{refreshLists,onNext:async()=>{
    if(dirty)await save();
    const current=await api.getOrder(data.order.id);
    await api.sendShippingToClosure(data.order.id,{detail:"Cargue local liquidado y vehículo despachado",expectedVersion:current.order.version});
    toast("Vehículo despachado. Continúa con la evidencia de cierre.","success",6000);
    refreshLists?.();await reload?.();
  }});
}
