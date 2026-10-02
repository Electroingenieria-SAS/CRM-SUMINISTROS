import { icon } from "../../../core/icons.js";

export function enhanceCommercialWizards(){
  document.querySelectorAll("#modal-root .wizard-modal").forEach(modal=>{
    if(modal.dataset.commercialWizard)return;
    const title=modal.querySelector(".wizard-head h3")?.textContent?.trim()||"";
    const isOrder=/crear pedido/i.test(title);
    const isCredit=/crédito|credito|solicitud/i.test(title);
    if(!isOrder&&!isCredit)return;
    modal.dataset.commercialWizard="1";
    modal.classList.add("commercial-wizard",isOrder?"commercial-order-wizard":"commercial-credit-wizard");
    const progress=modal.querySelector(".wizard-progress");
    if(progress){
      const assist=document.createElement("div");
      assist.className="commercial-wizard-assist";
      assist.innerHTML=isOrder?`<span>${icon("check")} 3 pasos guiados</span><span>${icon("orders")} Solo información necesaria</span><span>${icon("audit")} Revisión antes de crear</span>`:`<span>${icon("check")} Proceso guiado</span><span>${icon("credit")} Datos financieros claros</span><span>${icon("audit")} Decisión trazable</span>`;
      progress.before(assist);
    }
  });
}
