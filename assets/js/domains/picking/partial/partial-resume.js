import { api } from "../../../services/api.js";
import { fmt } from "../../../core/format.js";
import { toast } from "../../../core/ui.js";
import { ACTIVE_STATUSES } from "../picking-state.js";
import { shell, bindClose } from "../ui/picking-shell.js";
import { rounds, pendingItems } from "../shared/picking-status.js";
import { pendingPreview, roundHistory } from "./round-history.js";

export function renderPartialResume(host,data,{reload,refreshLists}){
  const pending=pendingItems(data);
  const hasActive=(data.tasks||[]).some(task=>ACTIVE_STATUSES.has(task.status));
  const canResume=data.order.status==="CLOSED"&&!hasActive&&pending.length>0;
  host.innerHTML=shell(data,`
    <section class="picking-partial-resume">
      <span class="picking-partial-badge">PEDIDO PARCIAL</span>
      <h4>${canResume?"Retomar pedido":"Salida parcial en curso"}</h4>
      <p>${canResume?"La salida anterior ya terminó. Retoma el mismo pedido para verificar únicamente la mercancía que llegó después.":"La primera salida todavía está en facturación o despacho. Cuando finalice, el pedido quedará disponible para retomar lo pendiente."}</p>
      <div class="picking-resume-stats"><div><small>Rondas realizadas</small><strong>${rounds(data).length}</strong></div><div><small>Líneas pendientes</small><strong>${pending.length}</strong></div><div><small>Etapa actual</small><strong>${fmt.escape(fmt.step(data.order.current_step_code))}</strong></div></div>
      ${pendingPreview(pending)}
      <button type="button" class="btn btn-primary picking-take-button" data-resume-partial ${canResume?"":"disabled"}>Retomar pedido</button>
    </section>
    ${roundHistory(data)}
  `);
  bindClose(host);
  host.querySelector("[data-resume-partial]")?.addEventListener("click",async event=>{
    const button=event.currentTarget;
    button.disabled=true;
    try{
      await api.resumePartialPicking(data.order.id);
      toast("Pedido parcial reabierto en Alistamiento.","success",6000);
      refreshLists?.();
      await reload?.();
    }catch(error){
      toast(error.message,"error",7000);
      button.disabled=false;
    }
  });
}
