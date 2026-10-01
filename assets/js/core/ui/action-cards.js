import { fmt } from "../format.js";
import { sanitizeHtml } from "./sanitation.js";

export function actionCards(cards=[]){
  return `<section class="guided-action-grid">${cards.map(card=>`
    <button type="button" class="guided-action-card ${card.tone||""}" ${card.disabled?"disabled":""} ${card.id?`id="${fmt.escape(card.id)}"`:""} ${card.data?Object.entries(card.data).map(([key,value])=>`data-${fmt.escape(key)}="${fmt.escape(value)}"`).join(" "):""}>
      <span class="guided-action-icon">${sanitizeHtml(card.icon||"→")}</span>
      <span class="guided-action-copy"><strong>${fmt.escape(card.title)}</strong><small>${fmt.escape(card.description||"")}</small></span>
      <span class="guided-action-arrow">›</span>
    </button>`).join("")}</section>`;
}
