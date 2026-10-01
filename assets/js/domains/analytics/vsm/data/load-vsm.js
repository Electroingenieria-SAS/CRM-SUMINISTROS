import { api } from "../../../../services/api.js";
import { fmt } from "../../../../core/format.js";
import { loading, toast } from "../../../../core/ui.js";
import { DAY_MS } from "../shared/flow-values.js";
import { renderFlow } from "../ui/flow-composition.js";
import { bindFlowInteractions } from "../ui/vsm-controls.js";

export function prepareVsmLoading(vsm){
vsm.fromInput=vsm.root.querySelector("#flow-from-v11120");
vsm.toInput=vsm.root.querySelector("#flow-to-v11120");
vsm.exportButton=vsm.root.querySelector("#flow-export-v11120");
vsm.markPreset=value=>{
    vsm.root.querySelectorAll("[data-flow-preset]").forEach(button=>button.classList.toggle("active",button.dataset.flowPreset===value));
  };
vsm.load=async(from=vsm.fromInput.value,toValue=vsm.toInput.value)=>{
    if(!from||!toValue)return toast("Selecciona fecha inicial y final.","error");
    if(from>toValue)return toast("La fecha inicial no puede ser posterior a la final.","error");
    const span=Math.round((new Date(`${toValue}T00:00:00`)-new Date(`${from}T00:00:00`))/DAY_MS);
    if(span>366)return toast("El análisis admite un máximo de 367 días por consulta.","error");

    const target=vsm.root.querySelector("#vsm-result");
    target.innerHTML=loading("Calculando lead time, toque, espera, WIP, SLA y percentiles…");
    vsm.exportButton.disabled=true;

    const [vsmResult,partialResult]=await Promise.allSettled([
      api.vsm(from,toValue),
      api.partialFulfillmentMetrics(from,toValue)
    ]);

    if(vsmResult.status==="rejected"){
      target.innerHTML=`<section class="card card-pad module-error"><strong>No fue posible calcular el flujo</strong><p>${fmt.escape(vsmResult.reason?.message||"Error de consulta")}</p></section>`;
      throw vsmResult.reason;
    }

    vsm.lastData=vsmResult.value||{};
    vsm.lastPartial=partialResult.status==="fulfilled"?(partialResult.value||{orders:[]}):{orders:[]};
    target.innerHTML=renderFlow(vsm.lastData,vsm.lastPartial);
    bindFlowInteractions(vsm.root);
    vsm.exportButton.disabled=false;

    if(partialResult.status==="rejected"){
      const note=target.querySelector("[data-partial-health]");
      if(note)note.textContent="La métrica de pedidos parciales no estuvo disponible en esta actualización.";
    }
  };
}

export async function loadInitialVsm(vsm){
await vsm.load(vsm.initialFrom,vsm.to);
}
