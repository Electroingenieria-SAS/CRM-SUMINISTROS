import { fmt } from "../../../core/format.js";
import { toast } from "../../../core/ui.js";
import { parallelWorkFooter } from "../../../modules/active-work.js";
import { activeTask, actionCodes } from "../../finance/shared/financial-status.js";
import { registeredInvoice, approvedException } from "../shared/billing-document.js";
import { closeHost, refresh, guarded } from "../../finance/shared/flow-callbacks.js";
import { begin } from "../../finance/actions/start-financial-task.js";
import { billingDocumentSummary } from "./invoice-summary.js";
import { openInvoiceUpload } from "../uploads/invoice-upload.js";
import { completeBillingAndDispatch } from "../actions/complete-billing.js";
import { orderDetails } from "../../finance/ui/order-financial-details.js";

export function renderCashInvoice(host,data,{reload,refreshLists}){
  const order=data.order;
  const task=activeTask(data);
  const actions=actionCodes(data);
  const accepted=task?.status==="IN_PROGRESS";
  const invoice=registeredInvoice(data);
  const noInvoiceApproval=approvedException(data,"PAYMENT_EXCEPTION","NO_INVOICE");
  const canAccept=actions.has("CLAIM")||actions.has("START")||actions.has("RESUME");

  host.innerHTML=`
    <div class="modal-overlay simple-process-overlay">
      <section class="modal simple-process-modal financial-simple-modal billing-process-modal" data-order-id="${fmt.escape(data.order.id)}">
        <header class="modal-head simple-process-head">
          <div><span class="wizard-kicker">Caja · Pedido pagado de contado</span><h3>${fmt.escape(order.order_number)}</h3><p>${fmt.escape(order.client_name)} · ${fmt.escape(fmt.route(order.delivery_route_code))}</p></div>
          <button class="icon-btn" data-close aria-label="Cerrar">×</button>
        </header>
        <div class="modal-body simple-process-body">
          <section class="cash-invoice-intro"><strong>Pedido pagado de contado</strong><p>Caja debe aceptar el pedido, cargar la factura mediante Google Drive y enviarlo al despacho correspondiente.</p></section>
          <section class="cash-invoice-steps">
            ${invoiceStep(1,"Aceptar pedido",accepted,"Toma el pedido para iniciar la facturación.",!accepted&&canAccept,"accept")}
            ${invoiceStep(2,"Subir factura",Boolean(invoice),invoice?`Factura ${invoice.invoice_number} registrada.`:"Adjunta el PDF y registra los datos de la factura.",accepted&&!invoice,"invoice")}
            ${invoiceStep(3,"Enviar a despacho",false,noInvoiceApproval&&!invoice?"Salida sin factura autorizada. La aprobación quedará trazada.":`El pedido irá a ${fmt.route(order.delivery_route_code)}.`,accepted&&(Boolean(invoice)||noInvoiceApproval),"send")}
          </section>
          ${invoice?billingDocumentSummary(invoice,{pvp:false}):""}
          ${noInvoiceApproval&&!invoice?'<section class="billing-approved-exception"><span>APROBACIÓN VIGENTE</span><strong>Salida sin factura autorizada</strong><small>Caja puede enviar el pedido sin cargar factura.</small></section>':""}
          <details class="simple-details"><summary>Ver información completa del pedido</summary>${orderDetails(data)}</details>
        </div>
        ${parallelWorkFooter(order.current_step_code)}
      </section>
    </div>`;

  host.querySelectorAll("[data-close]").forEach(button=>button.onclick=()=>closeHost(host));
  host.querySelector('[data-cash-action="accept"]')?.addEventListener("click",()=>guarded(async()=>{
    await begin(data);toast("Pedido aceptado por Caja.","success");refresh(refreshLists);await reload();
  }));
  host.querySelector('[data-cash-action="invoice"]')?.addEventListener("click",()=>openInvoiceUpload(data,{reload,refreshLists,source:"CAJA_FACTURACION"}));
  host.querySelector('[data-cash-action="send"]')?.addEventListener("click",()=>guarded(()=>completeBillingAndDispatch(data,{refreshLists,host,pvp:false})));
}

export function invoiceStep(number,title,done,detail,enabled,action){
  return `<button type="button" class="cash-invoice-step ${done?"done":enabled?"active":"locked"}" data-cash-action="${action}" ${enabled?"":"disabled"}><span>${done?"✓":number}</span><div><strong>${fmt.escape(title)}</strong><small>${fmt.escape(detail)}</small></div></button>`;
}
