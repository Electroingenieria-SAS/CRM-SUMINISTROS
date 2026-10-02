import { api } from "../../../../services/api.js";
import { fmt } from "../../../../core/format.js";
import { toast } from "../../../../core/ui.js";
import { shell, bindFooter } from "../ui/shipping-shell.js";
import { workflowHeader } from "../ui/workflow-header.js";
import { workspace, destinationCard } from "../ui/workspace.js";
import { latestDelivery } from "../shared/shipping-status.js";
import { destination } from "../routes/shipping-routes.js";
import { LOCAL_DISPATCH_TARIFFS,LOCAL_DISPATCH_BRANCHES,calculateLocalDispatch,currencyCOP,latestInvoiceDefaults,suggestedDestination } from "./tariffs.js";

function bogotaDate(){
  return new Intl.DateTimeFormat("en-CA",{timeZone:"America/Bogota",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
}
function localTrip(delivery){return delivery?.metadata?.localDispatch||null}
function option(value,label,current){return `<option value="${fmt.escape(value)}" ${value===current?"selected":""}>${fmt.escape(label)}</option>`}
function tariffOptions(current){
  const groups=new Map();
  LOCAL_DISPATCH_TARIFFS.forEach(row=>{if(!groups.has(row.zone))groups.set(row.zone,[]);groups.get(row.zone).push(row)});
  const labels={URBANO_LOCAL:"Urbanos y locales",NORTE_VALLE:"Norte y Valle",OCCIDENTE:"Occidente",SUR:"Sur",EJE_CAFETERO:"Eje Cafetero y nacionales"};
  return [...groups].map(([zone,rows])=>`<optgroup label="${fmt.escape(labels[zone]||zone)}">${rows.map(row=>option(row.code,`${row.code} · ${currencyCOP(row.base)}`,current)).join("")}</optgroup>`).join("");
}
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
  return `<div class="shipping-core-task-head-v11107"><div><span class="shipping-core-task-kicker-v11107">PASO 2 · DESPACHO LOCAL</span><h4>Cargue y despacho del vehículo</h4><p>Registra el vehículo, valida el peso facturado y liquida el viaje antes de enviar el pedido a cierre.</p></div><span class="shipping-core-step-badge-v11107">Paso 2 de 3</span></div>
    ${destinationCard(place,"Destino registrado por Ventas")}
    <section class="local-dispatch-form-v1145" data-local-dispatch-form>
      <div class="local-dispatch-form-grid-v1145">
        <label><span>Fecha de salida *</span><input class="control" type="date" name="tripDate" value="${fmt.escape(values.date)}" required></label>
        <label><span>Factura *</span><input class="control" name="invoiceNumber" value="${fmt.escape(values.invoiceNumber)}" required><small>Precargada desde Facturación cuando está disponible.</small></label>
        <label><span>Sucursal / asesor *</span><select class="control" name="branch" required>${LOCAL_DISPATCH_BRANCHES.map(code=>option(code,code,values.branch)).join("")}</select></label>
        <label><span>Destino tarifario *</span><select class="control" name="cityDestination" required><option value="">Selecciona destino</option>${tariffOptions(values.city)}</select></label>
        <label><span>Peso total (kg) *</span><input class="control" type="number" min="0.001" step="0.001" name="weightKg" value="${values.weightKg||""}" required><small>Se precarga con el peso registrado en Facturación.</small></label>
        <label><span>Placa del vehículo *</span><input class="control" name="vehiclePlate" maxlength="20" value="${fmt.escape(values.vehiclePlate)}" placeholder="Ej. ABC123" required></label>
        <label><span>Conductor *</span><input class="control" name="driverName" maxlength="120" value="${fmt.escape(values.driverName)}" placeholder="Nombre del conductor" required></label>
        <label><span>Ayudante / descargue</span><input class="control" type="number" min="0" step="1" name="unloadingCost" value="${values.unloadingCost}"></label>
        <label><span>Destino adicional / desvío</span><input class="control" type="number" min="0" step="1" name="diversionCost" value="${values.diversionCost}"></label>
        <label class="local-dispatch-wide-v1145"><span>Observaciones de salida</span><textarea class="control" name="observations" rows="2" maxlength="1000">${fmt.escape(values.observations)}</textarea></label>
      </div>
      <div class="local-dispatch-liquidation-v1145" aria-live="polite">
        <article><small>Tarifa base</small><strong data-trip-base>$0</strong></article>
        <article><small>Kilos extra (&gt; 1.000 kg)</small><strong data-trip-extra-kg>0 kg</strong></article>
        <article><small>Costo kilos extra</small><strong data-trip-extra-cost>$0</strong></article>
        <article class="total"><small>Total estimado del viaje</small><strong data-trip-total>$0</strong></article>
      </div>
      <div class="local-dispatch-form-actions-v1145">
        <span data-local-save-state>${values.persisted?"Cargue guardado · puedes editar y volver a guardar.":"Aún no se ha registrado el cargue."}</span>
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
  root.querySelector("[data-trip-total]").textContent=currencyCOP(calc.total);
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
  const form=host.querySelector("[data-local-dispatch-form]");
  let dirty=!values.persisted;
  const mark=()=>{dirty=true;preview(form);const state=form.querySelector("[data-local-save-state]");if(state)state.textContent="Cambios pendientes de guardar."};
  form?.querySelectorAll("input,select,textarea").forEach(control=>control.addEventListener("input",mark));
  preview(form);
  const save=async()=>{
    const payload=readPayload(form);
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
