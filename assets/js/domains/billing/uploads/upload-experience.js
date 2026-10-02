import { CONFIG } from "../../../config.js";

export const BILLING_MAX_FILE_BYTES=Number(CONFIG.drive?.maxFileBytes||15*1024*1024);

export function validateBillingUploadFile(file,{pvp=false,maxFileBytes=BILLING_MAX_FILE_BYTES}={}){
  if(!file)return {valid:false,message:"Selecciona un archivo."};
  const ext=String(file.name||"").split(".").pop().toLowerCase();
  const type=String(file.type||"").toLowerCase();
  if(!pvp&&ext!=="pdf"&&type!=="application/pdf")return {valid:false,message:"La factura debe ser un archivo PDF."};
  if(Number(file.size||0)<=0)return {valid:false,message:"El archivo está vacío. Selecciona otro documento."};
  if(Number(file.size)>maxFileBytes)return {valid:false,message:`El archivo supera el máximo permitido de ${formatSize(maxFileBytes)}.`};
  return {valid:true,message:""};
}

export function installBillingUpload(modal,{pvp=false,maxFileBytes=BILLING_MAX_FILE_BYTES}={}){
  const input=modal?.querySelector?.('input[type="file"][name="file"]');
  if(!modal||!input)return null;
  modal.classList.add("billing-upload-v1199","billing-upload-dialog-v1198");
  modal.dataset.billingUploadV1199="1";
  const kind=pvp?"Anexo PVP":"factura";
  input.classList.add("billing-native-file-v1199");
  if(!input.id)input.id=`billing-file-${crypto.randomUUID?.()||Math.random().toString(36).slice(2)}`;

  const title=modal.querySelector(".modal-head h3");
  if(title)title.textContent=pvp?"Subir Anexo PVP":"Subir factura";
  const group=modal.querySelector(".modal-title-group");
  if(group&&!group.querySelector(".billing-upload-subtitle-v1199")){
    const subtitle=document.createElement("p");
    subtitle.className="billing-upload-subtitle-v1199";
    subtitle.textContent=pvp?"Adjunta el documento comercial y confirma. El CRM hará el registro automáticamente.":"Adjunta el PDF y confirma. El CRM hará el registro automáticamente.";
    group.append(subtitle);
  }

  const note=modal.querySelector(".billing-upload-note");
  setText(note?.querySelector("strong"),pvp?"Selecciona el Anexo PVP":"Selecciona la factura en PDF");
  setText(note?.querySelector("p"),pvp?"El archivo quedará asociado automáticamente al pedido.":"El CRM registra automáticamente el archivo y sus datos.");

  const field=input.closest(".field");
  if(!field)return modal;
  field.classList.add("billing-upload-field-v1199");
  let workspace=field.querySelector(".billing-upload-workspace-v1199");
  if(!workspace){
    workspace=document.createElement("section");
    workspace.className="billing-upload-workspace-v1199";
    workspace.innerHTML=`<label class="billing-dropzone-v1199" for="${escapeHtml(input.id)}" role="button" tabindex="0" aria-label="Seleccionar ${escapeHtml(kind)}"><span class="billing-dropzone-icon-v1199" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 16V5m0 0-4 4m4-4 4 4"/><path d="M5 15v4h14v-4"/></svg></span><span class="billing-dropzone-kicker-v1199">${pvp?"Documento requerido":"Factura PDF"}</span><strong>${pvp?"Arrastra el Anexo PVP aquí":"Arrastra tu factura aquí"}</strong><p>${pvp?"También puedes tocar esta zona para buscar el archivo en tu dispositivo.":"También puedes tocar esta zona para buscar el PDF en tu computador o iPhone."}</p><span class="billing-dropzone-action-v1199">Seleccionar archivo</span><span class="billing-dropzone-meta-v1199">${pvp?"Archivo permitido por el CRM":"Solo PDF"} · máximo ${formatSize(maxFileBytes)}</span></label><div class="billing-file-state-v1199" aria-live="polite"></div><div class="billing-upload-auto-v1199" aria-label="Acciones automáticas del CRM"><div><b aria-hidden="true">✓</b><span><strong>Se vincula al pedido</strong>No tienes que relacionarlo manualmente.</span></div><div><b aria-hidden="true">⌁</b><span><strong>Se guarda en Drive</strong>Queda dentro del repositorio institucional.</span></div><div><b aria-hidden="true">◷</b><span><strong>Fecha automática</strong>El CRM registra el momento de carga.</span></div></div>`;
    field.append(workspace);
  }

  const dropzone=workspace.querySelector(".billing-dropzone-v1199");
  dropzone.onkeydown=event=>{if(event.key==="Enter"||event.key===" "){event.preventDefault();input.click()}};
  dropzone.ondragenter=dropzone.ondragover=event=>{event.preventDefault();if(event.dataTransfer)event.dataTransfer.dropEffect="copy";dropzone.classList.add("is-dragging")};
  dropzone.ondragleave=dropzone.ondragend=()=>dropzone.classList.remove("is-dragging");
  dropzone.ondrop=event=>{
    event.preventDefault();
    dropzone.classList.remove("is-dragging");
    const file=event.dataTransfer?.files?.[0];
    if(!file)return;
    try{
      const transfer=new DataTransfer();
      transfer.items.add(file);
      input.files=transfer.files;
      input.dispatchEvent(new Event("change",{bubbles:true}));
    }catch{renderError(workspace.querySelector(".billing-file-state-v1199"),"No fue posible tomar el archivo arrastrado. Toca “Seleccionar archivo”.")}
  };
  input.onchange=()=>renderBillingUploadState(modal,input,{pvp,maxFileBytes});
  workspace.onclick=event=>{
    const remove=event.target.closest?.("[data-billing-file-remove]");
    if(!remove)return;
    event.preventDefault();
    input.value="";
    input.dispatchEvent(new Event("change",{bubbles:true}));
    input.focus?.({preventScroll:true});
  };
  renderBillingUploadState(modal,input,{pvp,maxFileBytes});
  return modal;
}

export function renderBillingUploadState(modal,input,{pvp=false,maxFileBytes=BILLING_MAX_FILE_BYTES}={}){
  const state=modal.querySelector(".billing-file-state-v1199");
  const confirm=modal.querySelector("[data-confirm]");
  if(!state)return false;
  const file=input.files?.[0]||null;
  if(!file){
    state.className="billing-file-state-v1199";
    state.replaceChildren();
    if(confirm)confirm.disabled=true;
    return false;
  }
  const validation=validateBillingUploadFile(file,{pvp,maxFileBytes});
  if(!validation.valid){
    input.value="";
    renderError(state,validation.message);
    if(confirm)confirm.disabled=true;
    return false;
  }
  state.className="billing-file-state-v1199 has-file";
  state.innerHTML=`<span class="billing-file-icon-v1199" aria-hidden="true">${pvp?"DOC":"PDF"}</span><div class="billing-file-copy-v1199"><strong title="${escapeHtml(file.name)}">${escapeHtml(file.name)}</strong><span>${formatSize(file.size)} · listo para guardar</span></div><button type="button" class="billing-file-remove-v1199" data-billing-file-remove>Cambiar archivo</button>`;
  if(confirm)confirm.disabled=false;
  modal.querySelector(".billing-dropzone-v1199")?.classList.add("has-file");
  return true;
}

function renderError(state,message){
  if(!state)return;
  state.className="billing-file-state-v1199 has-error";
  state.innerHTML=`<span class="billing-file-icon-v1199" aria-hidden="true">!</span><div class="billing-file-copy-v1199"><strong>Revisa el archivo</strong><span>${escapeHtml(message)}</span></div><button type="button" class="billing-file-remove-v1199" data-billing-file-remove>Elegir otro</button>`;
}
function setText(node,value){if(node&&node.textContent!==value)node.textContent=value}
export function formatSize(bytes){const value=Number(bytes||0);if(value>=1024*1024)return `${(value/(1024*1024)).toFixed(value>=10*1024*1024?0:1)} MB`;if(value>=1024)return `${Math.max(1,Math.round(value/1024))} KB`;return `${value} B`}
function escapeHtml(value){return String(value??"").replace(/[&<>'"]/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[char]))}
