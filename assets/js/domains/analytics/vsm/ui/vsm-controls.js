import { toast, guide } from "../../../../core/ui.js";
import { daysBefore, cssEscape } from "../shared/flow-values.js";
import { exportFlow } from "../exports/flow-export.js";

export function bindFlowInteractions(root){
  root.querySelectorAll("[data-flow-stage]").forEach(button=>button.addEventListener("click",()=>{
    const code=button.dataset.flowStage;
    root.querySelectorAll("[data-flow-stage]").forEach(node=>node.classList.toggle("selected",node===button));
    root.querySelectorAll("[data-stage-row],[data-stage-time]").forEach(row=>row.classList.toggle("selected",row.dataset.stageRow===code||row.dataset.stageTime===code));
    const target=root.querySelector(`[data-stage-row="${cssEscape(code)}"]`)||root.querySelector(`[data-stage-time="${cssEscape(code)}"]`);
    target?.scrollIntoView({behavior:window.matchMedia("(prefers-reduced-motion: reduce)").matches?"auto":"smooth",block:"center"});
  }));

  root.querySelectorAll("[data-open-flow-order]").forEach(button=>button.addEventListener("click",()=>{
    const id=button.dataset.openFlowOrder;
    if(id)window.dispatchEvent(new CustomEvent("erp:open-order",{detail:id}));
  }));
}

export function bindVsmControls(vsm){
vsm.root.querySelectorAll("[data-flow-preset]").forEach(button=>button.addEventListener("click",()=>{
    const days=Number(button.dataset.flowPreset);
    vsm.fromInput.value=daysBefore(days-1,new Date(`${vsm.toInput.value||vsm.to}T12:00:00`));
    vsm.markPreset(String(days));
    vsm.load().catch(error=>toast(error.message,"error",7000));
  }));
vsm.root.querySelector("#flow-run-v11120").addEventListener("click",()=>{
    vsm.markPreset("");
    vsm.load().catch(error=>toast(error.message,"error",7000));
  });
vsm.root.querySelector("#flow-help-v11120").addEventListener("click",()=>guide({
    title:"Cómo leer Flujo y tiempos",
    description:"El módulo separa el tiempo de trabajo real del tiempo que un pedido permanece esperando dentro del sistema.",
    items:[
      {title:"Lead time del pedido",detail:"Horas laborales desde la creación del pedido hasta su cierre. Mide el recorrido completo de extremo a extremo."},
      {title:"Tiempo de toque",detail:"Suma de las sesiones efectivamente trabajadas dentro del calendario laboral configurado."},
      {title:"Espera",detail:"Tiempo laboral de la etapa menos tiempo de toque. Expone cola, pausas y tiempo sin trabajo efectivo."},
      {title:"Eficiencia de flujo",detail:"Tiempo de toque ÷ lead time de las etapas. Un porcentaje bajo indica que domina la espera."},
      {title:"WIP y aging",detail:"Trabajo actualmente en curso y antigüedad laboral de la tarea activa. Ayudan a detectar acumulación."},
      {title:"P90 y SLA",detail:"P90 muestra un escenario alto pero frecuente; SLA compara el tiempo de la etapa con el objetivo configurado."}
    ]
  }));
vsm.exportButton.addEventListener("click",()=>{
    if(!vsm.lastData)return;
    exportFlow(vsm.lastData,vsm.lastPartial);
  });
}
