import { fmt } from "../format.js";
import { sanitizeHtml } from "./sanitation.js";

export function renderWizardShell(wizardState){
wizardState.root.innerHTML=`
    <div class="modal-overlay wizard-overlay">
      <section class="modal wizard-modal ${wizardState.size}" role="dialog" aria-modal="true" aria-labelledby="${wizardState.titleId}" tabindex="-1">
        <header class="modal-head wizard-head">
          <div><span class="wizard-kicker">Flujo asistido</span><h3 id="${wizardState.titleId}">${fmt.escape(wizardState.title)}</h3><p>${fmt.escape(wizardState.subtitle)}</p></div>
          <button type="button" class="icon-btn icon-close" data-close aria-label="Cerrar ventana">×</button>
        </header>
        <div class="wizard-progress" role="list" style="--wizard-steps:${wizardState.steps.length}">
          ${wizardState.steps.map((step,index)=>`<button type="button" class="wizard-progress-item ${index===0?"active":""}" data-wizard-jump="${index}" role="listitem"><span>${index+1}</span><strong>${fmt.escape(step.title)}</strong></button>`).join("")}
        </div>
        <form class="wizard-form" novalidate>
          <div class="modal-body wizard-body">
            ${wizardState.steps.map((step,index)=>`<section class="wizard-panel ${index===0?"active":""}" data-wizard-panel="${index}"><div class="wizard-step-intro"><span>Paso ${index+1} de ${wizardState.steps.length}</span><h4>${fmt.escape(step.title)}</h4>${step.description?`<p>${fmt.escape(step.description)}</p>`:""}</div><div class="wizard-step-content">${sanitizeHtml(step.content||"")}</div></section>`).join("")}
          </div>
          <footer class="modal-foot wizard-foot">
            <button class="btn btn-ghost" type="button" data-close>${fmt.escape(wizardState.cancelLabel)}</button>
            <div class="wizard-foot-actions">
              <button class="btn btn-ghost" type="button" data-prev disabled>Anterior</button>
              <button class="btn btn-primary" type="button" data-next>Continuar</button>
            </div>
          </footer>
        </form>
      </section>
    </div>`;
}
