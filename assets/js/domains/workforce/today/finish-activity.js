import { api } from "../../../services/api.js";
import { fmt } from "../../../core/format.js";
import { modal, toast } from "../../../core/ui.js";
import { uploadWorkEvidence } from "../../../services/drive.js";
import { timeTrafficLight, trafficHelp, elapsedActiveSeconds, finalEvidenceType } from "./time-traffic.js";
import { rerenderWorkforceContent } from "./today-controller.js";
import { pickFinalPhoto } from "../evidence/evidence-dialogs.js";
import { clock } from "../shared/local-dates.js";

export function finishDialog(active,content){
  const activeSeconds=elapsedActiveSeconds(active);
  const traffic=timeTrafficLight(activeSeconds);
  const dialog=modal({
    title:"Finalizar actividad",
    confirmLabel:"",
    cancelLabel:"Seguir trabajando",
    body:`<div class="work-finish-simple">
      <div class="work-finish-summary"><strong>${fmt.escape(active.title)}</strong><span>Tiempo registrado: <b>${clock(activeSeconds)}</b></span></div>
      <div class="work-time-traffic large tone-${traffic.tone}">
        <span class="work-traffic-light"><i></i><i></i><i></i></span>
        <div><b>${traffic.label}</b><small>${trafficHelp(activeSeconds)}</small></div>
      </div>
      <div class="work-photo-required">
        <span class="work-photo-required-icon">📷</span>
        <div><strong>Foto final obligatoria</strong><p>Para finalizar debes tomar una foto o subir una foto de la actividad terminada. Se guardará mediante el script institucional en Google Drive.</p></div>
      </div>
      <div class="work-photo-actions">
        <button type="button" class="btn btn-primary" data-finish-camera>Tomar foto</button>
        <button type="button" class="btn btn-ghost" data-finish-upload>Subir foto</button>
      </div>
      ${traffic.review?'<div class="work-review-warning"><strong>Pendiente de revisión</strong><span>Esta actividad superó 1 hora. El sistema la enviará automáticamente a revisión cuando adjuntes la foto.</span></div>':""}
    </div>`
  });
  dialog.root.querySelector("[data-finish-camera]").onclick=()=>finishWithPhoto(active,content,dialog,true);
  dialog.root.querySelector("[data-finish-upload]").onclick=()=>finishWithPhoto(active,content,dialog,false);
}

export async function finishWithPhoto(active,content,dialog,useCamera){
  const file=await pickFinalPhoto(useCamera);
  if(!file)return;
  const buttons=[...dialog.root.querySelectorAll("[data-finish-camera],[data-finish-upload]")];
  buttons.forEach(button=>button.disabled=true);
  const activeSeconds=elapsedActiveSeconds(active);
  const traffic=timeTrafficLight(activeSeconds);
  try{
    const result=await api.workFinish(active.id,{
      timeReviewRequired:traffic.review,
      completionMode:"PHOTO_REQUIRED",
      clientActiveSeconds:activeSeconds
    });
    await uploadWorkEvidence(active.id,file,finalEvidenceType(active.evidencePolicy),active.title);
    const reviewRequired=result?.timeReviewRequired??traffic.review;
    dialog.close();
    toast(reviewRequired?"Actividad finalizada con foto. Quedó pendiente de revisión.":"Actividad finalizada con foto.");
    await rerenderWorkforceContent(content);
  }catch(error){
    toast(error.message,"error",9000);
    buttons.forEach(button=>button.disabled=false);
    await rerenderWorkforceContent(content).catch(()=>{});
  }
}
