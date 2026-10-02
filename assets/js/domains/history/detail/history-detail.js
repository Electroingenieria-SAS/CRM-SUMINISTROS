import { loading } from "../../../core/ui.js";
import { fmt } from "../../../core/format.js";
import { rpc } from "../data/history-rpc.js";
import { safe, date, label, sourceLabel, sourceClass, statusClass } from "../shared/history-values.js";
import { overviewPanel } from "./order-overview.js";
import { itemsPanel, invoicePanel, deliveryPanel, tasksPanel, auditPanel } from "./detail-tables.js";

export async function openHistoryDetail(id){
  const host=document.createElement("div");host.className="history-modal-backdrop-v11150";host.innerHTML=`<section class="history-modal-v11150">${loading("Reconstruyendo expediente histórico…")}</section>`;document.body.append(host);
  host.addEventListener("click",event=>{if(event.target===host)host.remove()});
  try{
    const data=await rpc("erp_x_history_detail",{p_order_id:id});
    host.querySelector(".history-modal-v11150").innerHTML=detailHtml(data);
    host.querySelector("[data-history-close]").onclick=()=>host.remove();
    host.querySelectorAll("[data-detail-tab]").forEach(button=>button.onclick=()=>{
      const key=button.dataset.detailTab;
      host.querySelectorAll("[data-detail-tab]").forEach(n=>n.classList.toggle("active",n===button));
      host.querySelectorAll("[data-detail-panel]").forEach(n=>n.hidden=n.dataset.detailPanel!==key);
    });
  }catch(error){host.querySelector(".history-modal-v11150").innerHTML=`<button class="history-modal-close-v11150" data-history-close>×</button><h3>No fue posible abrir el expediente</h3><p>${safe(error.message)}</p>`;host.querySelector("[data-history-close]").onclick=()=>host.remove()}
}

export function detailHtml(data){
  const o=data.order||{},items=data.items||[],invoices=data.invoices||[],deliveries=data.deliveries||[],tasks=data.tasks||[],issues=data.issues||[],audit=data.audit||[],batch=data.batch;
  return `<button class="history-modal-close-v11150" data-history-close aria-label="Cerrar">×</button>
    <header class="history-detail-head-v11150"><div><span class="history-source-v11150 ${sourceClass(o.history_source)}">${sourceLabel(o.history_source)}</span><h2>${safe(o.order_number)}</h2><p>${safe(o.client_name)} · ${safe(o.client_document||o.client_city||"")}</p></div><div><span class="history-status-v11150 ${statusClass(o.status)}">${safe(label(o.status))}</span><strong>${date(o.closed_at||o.cancelled_at||o.updated_at)}</strong></div></header>
    <div class="history-detail-summary-v11150">
      ${detailStat("Tipo",label(o.order_type_code))}${detailStat("Ruta",fmt.route?.(o.delivery_route_code)||label(o.delivery_route_code))}${detailStat("Condición",label(o.payment_condition_code))}${detailStat("Prioridad",label(o.priority))}${detailStat("Asesor",o.seller_name||"—")}${detailStat("Referencia externa",o.external_reference||"—")}
    </div>
    <nav class="history-detail-tabs-v11150">
      <button class="active" data-detail-tab="overview">Resumen</button><button data-detail-tab="items">Materiales <b>${items.length}</b></button><button data-detail-tab="financial">Facturación <b>${invoices.length}</b></button><button data-detail-tab="delivery">Entregas <b>${deliveries.length}</b></button><button data-detail-tab="flow">Flujo <b>${tasks.length}</b></button><button data-detail-tab="trace">Trazabilidad <b>${audit.length}</b></button>
    </nav>
    <div class="history-detail-panels-v11150">
      <section data-detail-panel="overview">${overviewPanel(o,batch,issues)}</section>
      <section data-detail-panel="items" hidden>${itemsPanel(items)}</section>
      <section data-detail-panel="financial" hidden>${invoicePanel(invoices)}</section>
      <section data-detail-panel="delivery" hidden>${deliveryPanel(deliveries)}</section>
      <section data-detail-panel="flow" hidden>${tasksPanel(tasks)}</section>
      <section data-detail-panel="trace" hidden>${auditPanel(audit)}</section>
    </div>`;
}

export function detailStat(title,value){return `<div><small>${safe(title)}</small><strong>${safe(value)}</strong></div>`}
