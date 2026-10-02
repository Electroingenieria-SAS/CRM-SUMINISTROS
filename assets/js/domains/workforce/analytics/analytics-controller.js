import { api } from "../../../services/api.js";
import { modal, toast } from "../../../core/ui.js";
import { state } from "../../../core/state.js";
import { analyticsHeroHtml } from "./hero.js";
import { analyticsSummarySectionHtml, analyticsCapacitySectionHtml } from "./summary-section.js";
import { analyticsActivitySectionHtml, analyticsStandardsSectionHtml } from "./activity-section.js";
import { analyticsCustomersSectionHtml } from "./customer-section.js";
import { analyticsTeamSectionHtml, analyticsReviewsSectionHtml, analyticsMethodSectionHtml } from "./team-section.js";
import { workforceState } from "../workforce-state.js";

export async function renderAnalytics(root,content){
const analytics={root,content};
await loadAnalyticsContext(analytics);
renderAnalyticsSections(analytics);
bindAnalyticsFilters(analytics);
}

export function reviewDelivery(id,decision,content,root){modal({title:decision==="ACCEPTED"?"Aceptar entregable":"Devolver entregable",confirmLabel:decision==="ACCEPTED"?"Aceptar resultado":"Devolver para corrección",body:`<div class="field"><label>${decision==="RETURNED"?"Qué debe corregirse *":"Nota opcional"}</label><textarea class="control" name="note" rows="4" ${decision==="RETURNED"?"required":""}></textarea></div>`,onConfirm:async dialog=>{await api.workReviewDelivery(id,decision,dialog.querySelector('[name="note"]').value||null);toast(decision==="ACCEPTED"?"Entregable aceptado.":"Entregable devuelto para corrección.");await renderAnalytics(root,content)}})}

export async function loadAnalyticsContext(analytics){
analytics.canManage=state.profile?.roles?.some(r=>["super_admin","gerencia","jefe_logistica","auditoria"].includes(r));
analytics.people=analytics.canManage?await api.workPeople(null).catch(()=>[]):[];
analytics.canViewCommercial=state.profile?.roles?.some(r=>["super_admin","gerencia","ventas","jefe_logistica","auditoria"].includes(r));
analytics.customerRanking=analytics.canViewCommercial?await api.customerRanking(12).catch(()=>null):null;
analytics.selected=analytics.content.dataset.analyticsProfile||"";
analytics.data=await api.workAnalytics(workforceState.analyticsRange.from,workforceState.analyticsRange.to,analytics.selected||null);
analytics.summary=analytics.data.summary||{};
analytics.scopeName=analytics.selected?(analytics.people.find(person=>String(person.id)===String(analytics.selected))?.name||"Trabajador seleccionado"):(analytics.canManage?"Ámbito completo":"Mi jornada");
analytics.utilization=Math.max(0,Math.min(100,Number(analytics.summary.utilizationPct||0)));
analytics.utilizationTone=analytics.utilization>=80?"good":analytics.utilization>=55?"medium":"low";
}

export function renderAnalyticsSections(analytics){
analytics.content.innerHTML=analyticsHeroHtml(analytics)+analyticsSummarySectionHtml(analytics)+analyticsCapacitySectionHtml(analytics)+analyticsActivitySectionHtml(analytics)+analyticsStandardsSectionHtml(analytics)+analyticsCustomersSectionHtml(analytics)+analyticsTeamSectionHtml(analytics)+analyticsReviewsSectionHtml(analytics)+analyticsMethodSectionHtml(analytics);
}

export function bindAnalyticsFilters(analytics){
analytics.content.querySelector("[data-analytics-apply]").onclick=()=>{
    workforceState.analyticsRange={from:analytics.content.querySelector("[data-analytics-from]").value,to:analytics.content.querySelector("[data-analytics-to]").value};
    analytics.content.dataset.analyticsProfile=analytics.content.querySelector("[data-analytics-profile]")?.value||"";
    renderAnalytics(analytics.root,analytics.content);
  };
analytics.content.querySelectorAll("[data-review-accept]").forEach(button=>button.onclick=()=>reviewDelivery(button.dataset.reviewAccept,"ACCEPTED",analytics.content,analytics.root));
analytics.content.querySelectorAll("[data-review-return]").forEach(button=>button.onclick=()=>reviewDelivery(button.dataset.reviewReturn,"RETURNED",analytics.content,analytics.root));
}
