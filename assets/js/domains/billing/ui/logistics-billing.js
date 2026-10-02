import { api } from "../../../services/api.js";
import { fmt } from "../../../core/format.js";
import { toast } from "../../../core/ui.js";
import { parallelWorkFooter } from "../../../modules/active-work.js";
import { activeTask, actionCodes } from "../../finance/shared/financial-status.js";
import { registeredInvoice, pvpAnnex, isCashOrder, isPvpOrder, approvedException } from "../shared/billing-document.js";
import { closeHost, refresh, guarded } from "../../finance/shared/flow-callbacks.js";
import { begin } from "../../finance/actions/start-financial-task.js";
import { invoiceStep } from "./cash-invoice.js";
import { billingDocumentSummary } from "./invoice-summary.js";
import { openInvoiceUpload, openPvpAnnexUpload } from "../uploads/invoice-upload.js";
import { completeBillingAndDispatch } from "../actions/complete-billing.js";
import { orderDetails } from "../../finance/ui/order-financial-details.js";
import { enhanceBillingExperience } from "./billing-focus.js";

export function renderLogisticsBilling(host,data,{reload,refreshLists}){
  const order=data.order;
  const task=activeTask(data);
  const actions=actionCodes(data);
  const accepted=task?.status==="IN_PROGRESS";
  const cashOrder=isCashOrder(order);
  const pvp=isPvpOrder(order);
  const invoice=registeredInvoice(data);
  const annex=pvpAnnex(data);
  const document=pvp?annex:invoice;
  const noInvoiceApproval=!pvp&&approvedException(data,"PAYMENT_EXCEPTION","NO_INVOICE");
  const canAccept=actions.has("CLAIM")||actions.has("START")||actions.has("RESUME");
  const canRouteToCash=cashOrder&&!document;
  const documentTitle=pvp?"Anexo PVP":"Factura";
  const documentDetail=pvp
    ?(annex?`Anexo ${annex.file_name} cargado.`:"Adjunta el archivo comercial denominado Anexo PVP.")
    :(invoice?`Factura ${invoice.invoice_number} registrada.`:"Adjunta la factura mediante Google Drive.");

  host.innerHTML=`
    <div class="modal-overlay simple-process-overlay">
      <section class="modal simple-process-modal financial-simple-modal billing-process-modal" data-order-id="${fmt.escape(data.order.id)}">
        <header class="modal-head simple-process-head">
          <div><span class="wizard-kicker">Facturación · Logística</span><h3>${fmt.escape(order.order_number)}</h3><p>${fmt.escape(order.client_name)} · ${fmt.escape(fmt.label(order.order_type_code))} · ${fmt.escape(fmt.route(order.delivery_route_code))}</p></div>
          <button class="icon-btn" data-close aria-label="Cerrar">×</button>
        </header>
        <div class="modal-body simple-process-body">
          <section class="billing-process-intro ${cashOrder?"cash-warning":""}">
            <div><span>${cashOrder?"Pedido pagado de contado":"Documento requerido"}</span><strong>${cashOrder?"Este pedido debe facturarlo Caja":pvp?"Carga de Anexo PVP":"Facturación normal de Logística"}</strong><p>${cashOrder?"El ERP intenta enviarlo automáticamente a Caja. Usa Enviar a Caja cuando haya llegado por error a Facturación.":pvp?"Para los pedidos PVP no se registra factura en este paso; se adjunta el Anexo PVP.":"Los pedidos PVC y PVE conservan el proceso normal de factura y envío a despacho."}</p></div>
          </section>

          ${!accepted?`<section class="billing-entry-actions ${cashOrder?"two-options":""}">
            <button type="button" class="billing-entry-card accept" data-billing-action="accept" ${canAccept?"":"disabled"}>
              <span>1</span><div><strong>Aceptar pedido</strong><small>${cashOrder?"Continúa aquí solo si Logística debe resolverlo manualmente.":"Toma el pedido para cargar el documento correspondiente."}</small></div>
            </button>
            ${cashOrder?`<button type="button" class="billing-entry-card cash" data-billing-action="cash" ${canRouteToCash?"":"disabled"}>
              <span>→</span><div><strong>Enviar a Caja</strong><small>Corrige el enrutamiento y mueve la facturación a Caja.</small></div>
            </button>`:""}
          </section>`:`<section class="cash-invoice-steps billing-document-steps">
            ${invoiceStep(1,"Pedido aceptado",true,"La gestión fue tomada por el responsable.",false,"accepted")}
            ${invoiceStep(2,`Subir ${documentTitle}`,Boolean(document),documentDetail,!document,pvp?"annex":"invoice")}
            ${invoiceStep(3,"Enviar a despacho",false,noInvoiceApproval&&!document?"Salida sin factura autorizada. La aprobación quedará en la trazabilidad.":`El pedido continuará a ${fmt.route(order.delivery_route_code)}.`,Boolean(document)||noInvoiceApproval,"send")}
          </section>`}

          ${document?billingDocumentSummary(document,{pvp}):""}
          ${noInvoiceApproval&&!document?'<section class="billing-approved-exception"><span>APROBACIÓN VIGENTE</span><strong>Salida sin factura autorizada</strong><small>La excepción fue aprobada y será auditada en el pedido.</small></section>':""}
          <details class="simple-details"><summary>Ver información completa del pedido</summary>${orderDetails(data)}</details>
        </div>
        ${parallelWorkFooter(order.current_step_code)}
      </section>
    </div>`;

  host.querySelectorAll("[data-close]").forEach(button=>button.onclick=()=>closeHost(host));
  host.querySelector('[data-billing-action="accept"]')?.addEventListener("click",()=>guarded(async()=>{
    await begin(data);toast("Pedido aceptado en Facturación.","success");refresh(refreshLists);await reload();
  }));
  host.querySelector('[data-billing-action="cash"]')?.addEventListener("click",()=>guarded(async()=>{
    await api.routeBillingToCash(order.id,"Pedido pagado de contado enviado manualmente a Caja");
    toast("Pedido enviado a Caja.","success",6000);refresh(refreshLists);closeHost(host);
  }));
  host.querySelector('[data-cash-action="invoice"]')?.addEventListener("click",()=>openInvoiceUpload(data,{reload,refreshLists,source:"LOGISTICA_FACTURACION"}));
  host.querySelector('[data-cash-action="annex"]')?.addEventListener("click",()=>openPvpAnnexUpload(data,{reload,refreshLists}));
  host.querySelector('[data-cash-action="send"]')?.addEventListener("click",()=>guarded(()=>completeBillingAndDispatch(data,{refreshLists,host,pvp})));
  enhanceBillingExperience(host);
}
