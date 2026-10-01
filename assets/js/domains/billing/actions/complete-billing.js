import { api } from "../../../services/api.js";
import { fmt } from "../../../core/format.js";
import { toast } from "../../../core/ui.js";
import { actionCodes } from "../../finance/shared/financial-status.js";
import { registeredInvoice, pvpAnnex, approvedException } from "../shared/billing-document.js";
import { closeHost, refresh } from "../../finance/shared/flow-callbacks.js";
import { completeChecklist } from "../../finance/actions/apply-financial-status.js";

export async function completeBillingAndDispatch(data,{refreshLists,host,pvp}){
  let latest=await api.getOrder(data.order.id);
  if(pvp){
    if(!pvpAnnex(latest))throw new Error("Primero debes subir el Anexo PVP.");
  }else if(!registeredInvoice(latest)&&!approvedException(latest,"PAYMENT_EXCEPTION","NO_INVOICE"))throw new Error("Primero debes subir la factura o contar con una aprobación de salida sin factura.");
  const exceptionWithoutInvoice=!pvp&&!registeredInvoice(latest)&&approvedException(latest,"PAYMENT_EXCEPTION","NO_INVOICE");
  await completeChecklist(latest,pvp?"Anexo PVP verificado":exceptionWithoutInvoice?"Control cerrado por aprobación de salida sin factura":"Factura verificada");
  latest=await api.getOrder(data.order.id);
  if(!actionCodes(latest).has("COMPLETE"))throw new Error("El pedido no está listo para enviarse a despacho.");
  await api.executeAction(data.order.id,"COMPLETE",{detail:pvp?"Anexo PVP cargado y pedido enviado a despacho":exceptionWithoutInvoice?"Salida sin factura aprobada y pedido enviado a despacho":"Factura cargada y pedido enviado a despacho"},latest.order.version);
  toast(`Pedido enviado a ${fmt.route(data.order.delivery_route_code)}.`,"success",6000);refresh(refreshLists);closeHost(host);
}
