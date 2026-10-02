import { api } from "../../../services/api.js";
import { fmt } from "../../../core/format.js";
import { modal, toast } from "../../../core/ui.js";
import { PAUSE_REASONS } from "../shared/activity-labels.js";
import { rerenderWorkforceContent } from "./today-controller.js";

export function pauseDialog(active,content){
  modal({title:"Pausar actividad",confirmLabel:"Pausar",body:`<div class="form-grid"><div class="field"><label>Motivo de la pausa</label><select class="control" name="reason">${Object.entries(PAUSE_REASONS).map(([value,label])=>`<option value="${value}">${fmt.escape(label)}</option>`).join("")}</select></div><div class="field full"><label>Nota opcional</label><textarea class="control" name="note" rows="3" placeholder="Contexto breve de la pausa"></textarea></div></div>`,onConfirm:async dialog=>{await api.workPause(active.id,dialog.querySelector('[name="reason"]').value,dialog.querySelector('[name="note"]').value);toast("Actividad pausada.");await rerenderWorkforceContent(content)}});
}
