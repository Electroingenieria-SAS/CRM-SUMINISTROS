import { api } from "../../../services/api.js";
import { modal, toast } from "../../../core/ui.js";
import { uploadWorkEvidence } from "../../../services/drive.js";
import { rerenderWorkforceContent } from "../today/today-controller.js";

export function pickFinalPhoto(useCamera){
  return new Promise(resolve=>{
    const input=document.createElement("input");
    input.type="file";
    input.accept="image/*";
    if(useCamera)input.capture="environment";
    input.onchange=()=>resolve(input.files?.[0]||null);
    input.addEventListener("cancel",()=>resolve(null),{once:true});
    input.click();
  });
}

export function photoPicker(execution,type,content){
  const input=document.createElement("input");input.type="file";input.accept="image/*";input.capture="environment";
  input.onchange=async()=>{const file=input.files?.[0];if(!file)return;try{toast("Cargando evidencia…","success",2500);await uploadWorkEvidence(execution.id,file,type,execution.title);toast("Evidencia guardada.");await rerenderWorkforceContent(content)}catch(error){toast(error.message,"error",8000)}};
  input.click();
}

export function evidenceDialog(execution,content){
  const policy=execution.evidencePolicy;
  if(policy==="FINAL_PHOTO")return photoPicker(execution,"FINAL_PHOTO",content);
  if(policy==="BEFORE_AFTER"){
    const dialog=modal({title:"Completar evidencia",confirmLabel:"Cerrar",body:`<div class="evidence-choice"><button type="button" class="work-evidence-choice" data-evidence-type="BEFORE_PHOTO"><strong>Foto inicial</strong><span>Estado antes de la actividad</span></button><button type="button" class="work-evidence-choice" data-evidence-type="AFTER_PHOTO"><strong>Foto final</strong><span>Resultado después de la actividad</span></button></div>`,onConfirm:async()=>{}});
    dialog.root.querySelectorAll("[data-evidence-type]").forEach(button=>button.onclick=()=>{dialog.close();photoPicker(execution,button.dataset.evidenceType,content)});
    return;
  }
  if(policy==="LINK"||policy==="ERP_REFERENCE"){
    modal({title:policy==="LINK"?"Anexar enlace":"Anexar referencia del CRM",confirmLabel:"Guardar evidencia",body:`<div class="field"><label>${policy==="LINK"?"Enlace":"Referencia"}</label><input class="control" name="value" required placeholder="${policy==="LINK"?"https://…":"Pedido, informe o registro relacionado"}"></div><div class="field"><label>Nota opcional</label><textarea class="control" name="note" rows="3"></textarea></div>`,onConfirm:async dialog=>{await api.workRegisterEvidence(execution.id,{evidenceType:policy,externalValue:dialog.querySelector('[name="value"]').value,note:dialog.querySelector('[name="note"]').value});toast("Evidencia registrada.");await rerenderWorkforceContent(content)}});return;
  }
  const input=document.createElement("input");input.type="file";input.accept=policy==="FILE"?"*/*":"image/*";
  input.onchange=async()=>{const file=input.files?.[0];if(!file)return;try{await uploadWorkEvidence(execution.id,file,policy==="FILE"?"FILE":"FINAL_PHOTO",execution.title);toast("Evidencia guardada.");await rerenderWorkforceContent(content)}catch(error){toast(error.message,"error",8000)}};input.click();
}
