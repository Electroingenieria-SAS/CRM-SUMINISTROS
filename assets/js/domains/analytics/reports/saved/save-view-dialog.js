import { toast } from "../../../../core/ui.js";
import { state } from "../reports-state.js";
import { rpc } from "../data/report-rpc.js";
import { loadViews } from "../data/load-dashboard.js";

export function openSaveModal(){
  const explorer=state.explorer;
  const host=document.createElement("div");
  host.className="bi-modal-backdrop-v11140";
  host.innerHTML=`<form class="bi-modal-v11140">
    <h3>Guardar vista</h3><p>Conserva esta combinación de dataset, dimensión, métrica y visualización.</p>
    <label>Nombre<input class="control" name="name" required maxlength="80"></label>
    <label>Descripción<textarea class="control" name="description" rows="3" maxlength="240"></textarea></label>
    <label><span><input type="checkbox" name="shared"> Compartir con otros usuarios que tengan acceso a Reportes</span></label>
    <div class="bi-modal-actions-v11140"><button type="button" class="btn btn-ghost" data-cancel>Cancelar</button><button class="btn btn-primary">Guardar</button></div>
  </form>`;
  document.body.append(host);
  host.querySelector("[data-cancel]").onclick=()=>host.remove();
  host.querySelector("form").onsubmit=async event=>{
    event.preventDefault();
    const form=event.currentTarget;
    try{
      await rpc("erp_x_reports_views",{p_action:"SAVE",p_payload:{name:form.name.value.trim(),description:form.description.value.trim(),isShared:form.shared.checked,config:{...explorer,from:state.from,to:state.to,result:null}}});
      host.remove();
      await loadViews();
      toast("Vista guardada.");
    }catch(error){toast(error.message,"error",7000)}
  };
}
