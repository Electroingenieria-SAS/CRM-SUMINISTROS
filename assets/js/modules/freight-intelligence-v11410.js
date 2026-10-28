import {api} from "../services/api.js";
import {fmt} from "../core/format.js";
import {loading} from "../core/ui.js";
import {renderFreightAuditRows,riskLabel} from "../domains/freight-intelligence/audit-table.js";

const money=value=>{try{return new Intl.NumberFormat("es-CO",{style:"currency",currency:"COP",maximumFractionDigits:0}).format(Number(value||0))}catch{return fmt.number(value||0)}};
const num=value=>Number.isFinite(Number(value))?Number(value):0;
const pct=value=>value==null?"—":`${fmt.number(value,1)}%`;

export async function enhanceFreightIntelligenceDashboard(root){
  if(!root||document.body.dataset.freightIntelLoading==="1")return;
  root.querySelector("[data-freight-intelligence-v1141]")?.remove();
  const today=new Date();
  const to=today.toISOString().slice(0,10);
  const from=new Date(today.getTime()-89*864e5).toISOString().slice(0,10);
  const section=document.createElement("section");
  section.className="card freight-intel-v1141";
  section.dataset.freightIntelligenceV1141="1";
  section.innerHTML=`
    <header class="card-head freight-intel-head-v1141">
      <div><span class="freight-intel-kicker-v1141">Inteligencia logística predictiva</span><h3>Predicho vs real · ahorro · riesgo · presupuesto</h3><p>Convierte el histórico de fletes y los costos reales del CRM en control operativo continuo.</p></div>
      <div class="freight-intel-filters-v11