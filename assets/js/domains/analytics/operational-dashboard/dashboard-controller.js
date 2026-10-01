import { loading } from "../../../core/ui.js";
import { state } from "../../../core/state.js";
import { rpc } from "../../../core/layout/operational/operational-rpc.js";
import { escapeText } from "../../../core/layout/operational/operational-values.js";
import { dashboardHtml } from "./dashboard-view.js";
import { exportOperationalWorkbook } from "./export-workbook.js";
import { printReceiptLabel } from "../../receiving/operational/receipt-label.js";

export const OPS_MODULES=[
  {code:"receiving",label:"Recepción",icon:"▣"},
  {code:"billing",label:"Facturación",icon:"▤"},
  {code:"shipping",label:"Transportadoras",icon:"↗"}
];

export let dashboardState={module:null,from:null,to:null,data:null};

export function moduleReadable(code){return Boolean(state.modules?.find(m=>m.code===code)?.canRead)}

export async function enhanceOperationalDashboard(root){
  if(!root||state.currentModule!=="dashboard")return;
  root.querySelector("[data-v112-operational-dashboard]")?.remove();
  const available=OPS_MODULES.filter(m=>moduleReadable(m.code));
  if(!available.length)return;
  const today=new Date();
  const to=today.toISOString().slice(0,10);
  const from=new Date(today.getTime()-29*864e5).toISOString().slice(0,10);
  dashboardState={module:available[0].code,from,to,data:null};
  const section=document.createElement("section");
  section.className="card v112-operational-dashboard";
  section.dataset.v112OperationalDashboard="1";
  section.innerHTML=`
    <header class="card-head v112-dashboard-head"><div><span class="v112-dashboard-kicker">Control operativo integrado</span><h3>Recepción · Facturación · Transportadoras</h3><p>Indicadores, consecutivos y exportaciones con fórmulas sin separar los procesos del CRM.</p></div></header>
    <div class="card-body">
      <div class="v112-dashboard-toolbar">
        <div class="v112-dashboard-tabs">${available.map((m,i)=>`<button class="btn ${i===0?"btn-primary":"btn-ghost"}" data-v112-module="${m.code}"><span>${m.icon}</span>${m.label}</button>`).join("")}</div>
        <div class="v112-dashboard-filters"><label>Desde<input class="control" type="date" data-v112-from value="${from}"></label><label>Hasta<input class="control" type="date" data-v112-to value="${to}"></label><button class="btn btn-search" data-v112-apply>Aplicar</button><button class="btn btn-success" data-v112-export disabled>Exportar Excel con fórmulas</button></div>
      </div>
      <div data-v112-dashboard-content>${loading("Preparando indicadores operativos…")}</div>
    </div>`;
  const firstGap=root.querySelector(".section-gap");
  if(firstGap)firstGap.before(section);else root.append(section);
  section.querySelectorAll("[data-v112-module]").forEach(button=>button.addEventListener("click",async()=>{
    dashboardState.module=button.dataset.v112Module;
    section.querySelectorAll("[data-v112-module]").forEach(b=>{b.classList.toggle("btn-primary",b===button);b.classList.toggle("btn-ghost",b!==button)});
    await loadDashboardModule(section);
  }));
  section.querySelector("[data-v112-apply]").addEventListener("click",async()=>{
    dashboardState.from=section.querySelector("[data-v112-from]").value;
    dashboardState.to=section.querySelector("[data-v112-to]").value;
    await loadDashboardModule(section);
  });
  section.querySelector("[data-v112-export]").addEventListener("click",()=>exportOperationalWorkbook(dashboardState.module,dashboardState.data));
  await loadDashboardModule(section);
}

export async function loadDashboardModule(section){
  const target=section.querySelector("[data-v112-dashboard-content]");
  const exportButton=section.querySelector("[data-v112-export]");
  target.innerHTML=loading("Consultando datos operativos…");exportButton.disabled=true;
  try{
    const data=await rpc("erp_x_operational_module_dashboard",{p_module:dashboardState.module,p_from:dashboardState.from,p_to:dashboardState.to});
    dashboardState.data=data;
    target.innerHTML=dashboardHtml(dashboardState.module,data);
    exportButton.disabled=!(data.rows||[]).length;
    if(dashboardState.module==="billing"){
      const filter=target.querySelector("[data-v1139-billing-filter]");
      const count=target.querySelector("[data-v1139-billing-count]");
      const applyBillingFilter=()=>{
        const term=String(filter?.value||"").trim().toLowerCase();
        let visible=0;
        target.querySelectorAll("[data-v1139-billing-row]").forEach(row=>{
          const show=!term||String(row.dataset.search||"").includes(term);
          row.hidden=!show;
          if(show)visible++;
        });
        if(count)count.textContent=`${visible} de ${(data.rows||[]).length} factura${(data.rows||[]).length===1?"":"s"}`;
      };
      filter?.addEventListener("input",applyBillingFilter);
      applyBillingFilter();
    }
    if(dashboardState.module==="receiving"){
      target.querySelectorAll("[data-v112-print-receipt]").forEach(button=>button.addEventListener("click",()=>{
        const row=(data.rows||[])[Number(button.dataset.v112PrintReceipt)];if(row)printReceiptLabel(row);
      }));
    }
  }catch(error){dashboardState.data=null;target.innerHTML=`<div class="module-error"><strong>No fue posible cargar estos indicadores</strong><p>${escapeText(error.message)}</p></div>`;}
}
