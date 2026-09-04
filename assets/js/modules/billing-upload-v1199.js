import {CONFIG} from "../config.js";

const MAX_FILE_BYTES=Number(CONFIG.drive?.maxFileBytes||15*1024*1024);
let observer=null;
let scheduled=false;

function schedule(){
  if(scheduled)return;
  scheduled=true;
  requestAnimationFrame(()=>{
    scheduled=false;
    observer?.disconnect();
    enhanceAll();
    observe();
  });
}

function observe(){
  const root=document.querySelector("#modal-root");
  if(!root||!observer)return;
  observer.observe(root,{childList:true,subtree:true});
}

function enhanceAll(){
  document.querySelectorAll("#modal-root .modal").forEach(enhanceUploadModal);
}

function enhanceUploadModal(modal){
  const note=modal.querySelector(".billing-upload-note");
  const input=modal.querySelector('input[type="file"][name="file"]');
  if(!note||!input)return;
  if(modal.dataset.billingUploadV1199==="1"){
    syncState(modal,input);
    return;
  }

  modal.dataset.billingUploadV1199="1";
  modal.classList.add("billing-upload-v1199");
  const isPvp=/PVP/i.test(modal.querySelector(".modal-head")?.textContent||modal.textContent||"");
  const kind=isPvp?"Anexo PVP":"factura";
  const title=isPvp?"Subir Anexo PVP":"Subir factura";
  const titleNode=modal.querySelector(".modal-head h3");
  if(titleNode)titleNode.textContent=title;
  const titleGroup=modal.querySelector(".modal-title-group");
  if(titleGroup&&!titleGroup.querySelector(".billing-upload-subtitle-v1199")){
    const subtitle=document.createElement("p");
    subtitle.className="billing-upload-subtitle-v1199";
    subtitle.textContent=isPvp?"Adjunta el documento comercial y confirma. El CRM hará el registro automáticamente.":"Adjunta el PDF y confirma. El CRM hará el registro automáticamente.";
    titleGroup.append(subtitle);
  }

  const field=input.closest(".field");
  if(!field)return;
  field.classList.add("billing-upload-field-v1199");
  input.classList.add("billing-native-file-v1199");
  if(!input.id)input.id=`billing-file-${crypto.randomUUID?.()||Math.random().toString(36).slice(2)}`;

  const workspace=document.createElement("section");
  workspace.className="billing-upload-workspace-v1199";
  workspace.innerHTML=`
    <label class="billing-dropzone-v1199" for="${escapeHtml(input.id)}" role="button" tabindex="0" aria-label="Seleccionar ${escapeHtml(kind)}">
      <span class="billing-dropzone-icon-v1199" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 16V5m0 0-4 4m4-4 4 4"/><path d="M5 15v4h14v-4"/></svg></span>
      <span class="billing-dropzone-kicker-v1199">${isPvp?"Documento requerido":"Factura PDF"}</span>
      <strong>${isPvp?"Arrastra el Anexo PVP aquí":"Arrastra tu factura aquí"}</strong>
      <p>${isPvp?"También puedes tocar esta zona para buscar el archivo en tu dispositivo.":"También puedes tocar esta zona para buscar el PDF en tu computador o iPhone."}</p>
      <span class="billing-dropzone-action-v1199">Seleccionar archivo</span>
      <span class="billing-dropzone-meta-v1199">${isPvp?"Archivo permitido por el CRM":"Solo PDF"} · máximo ${formatSize(MAX_FILE_BYTES)}</span>
    </label>
    <div class="billing-file-state-v1199" aria-live="polite"></div>
    <div class="billing-upload-auto-v1199" aria-label="Acciones automáticas del CRM">
      <div><b aria-hidden="true">✓</b><span><strong>Se vincula al pedido</strong>No tienes que relacionarlo manualmente.</span></div>
      <div><b aria-hidden="true">⌁</b><span><strong>Se guarda en Drive</strong>Queda dentro del repositorio institucional.</span></div>
      <div><b aria-hidden="true">◷</b><span><strong>Fecha automática</strong>El CRM registra el momento de carga.</span></div>
    </div>`;
  field.append(workspace);

  const dropzone=workspace.querySelector(".billing-dropzone-v1199");
  const state=workspace.querySelector(".billing-file-state-v1199");
  const confirm=modal.querySelector("[data-confirm]");
  if(confirm)confirm.disabled=!input.files?.length;

  dropzone.addEventListener("keydown",event=>{
    if(event.key!=="Enter"&&event.key!==" ")return;
    event.preventDefault();
    input.click();
  });
  ["dragenter","dragover"].forEach(type=>dropzone.addEventListener(type,event=>{
    event.preventDefault();
    if(event.dataTransfer)event.dataTransfer.dropEffect="copy";
    dropzone.classList.add("is-dragging");
  }));
  ["dragleave","dragend"].forEach(type=>dropzone.addEventListener(type,()=>dropzone.classList.remove("is-dragging")));
  dropzone.addEventListener("drop",event=>{
    event.preventDefault();
    dropzone.classList.remove("is-dragging");
    const file=event.dataTransfer?.files?.[0];
    if(!file)return;
    try{
      const transfer=new DataTransfer();
      transfer.items.add(file);
      input.files=transfer.files;
      input.dispatchEvent(new Event("change",{bubbles:true}));
    }catch{
      renderError(state,"No fue posible tomar el archivo arrastrado. Toca “Seleccionar archivo”.");
    }
  });

  input.addEventListener("change",()=>{
    validateAndRender(modal,input,isPvp);
  });
  workspace.addEventListener("click",event=>{
    const remove=event.target.closest("[data-billing-file-remove]");
    if(!remove)return;
    event.preventDefault();
    input.value="";
    input.dispatchEvent(new Event("change",{bubbles:true}));
    input.focus({preventScroll:true});
  });

  validateAndRender(modal,input,isPvp);
}

function validateAndRender(modal,input,isPvp){
  const state=modal.querySelector(".billing-file-state-v1199");
  const confirm=modal.querySelector("[data-confirm]");
  const file=input.files?.[0]||null;
  if(!state)return;
  if(!file){
    state.className="billing-file-state-v1199";
    state.replaceChildren();
    if(confirm)confirm.disabled=true;
    return;
  }

  const ext=String(file.name||"").split(".").pop().toLowerCase();
  if(!isPvp&&ext!=="pdf"&&String(file.type||"").toLowerCase()!=="application/pdf"){
    input.value="";
    renderError(state,"La factura debe ser un archivo PDF.");
    if(confirm)confirm.disabled=true;
    return;
  }
  if(file.size<=0){
    input.value="";
    renderError(state,"El archivo está vacío. Selecciona otro documento.");
    if(confirm)confirm.disabled=true;
    return;
  }
  if(file.size>MAX_FILE_BYTES){
    input.value="";
    renderError(state,`El archivo supera el máximo permitido de ${formatSize(MAX_FILE_BYTES)}.`);
    if(confirm)confirm.disabled=true;
    return;
  }

  state.className="billing-file-state-v1199 has-file";
  state.innerHTML=`
    <span class="billing-file-icon-v1199" aria-hidden="true">${isPvp?"DOC":"PDF"}</span>
    <div class="billing-file-copy-v1199"><strong title="${escapeHtml(file.name)}">${escapeHtml(file.name)}</strong><span>${formatSize(file.size)} · listo para guardar</span></div>
    <button type="button" class="billing-file-remove-v1199" data-billing-file-remove>Cambiar archivo</button>`;
  if(confirm)confirm.disabled=false;
  const dropzone=modal.querySelector(".billing-dropzone-v1199");
  dropzone?.classList.add("has-file");
}

function renderError(state,message){
  state.className="billing-file-state-v1199 has-error";
  state.innerHTML=`<span class="billing-file-icon-v1199" aria-hidden="true">!</span><div class="billing-file-copy-v1199"><strong>Revisa el archivo</strong><span>${escapeHtml(message)}</span></div><button type="button" class="billing-file-remove-v1199" data-billing-file-remove>Elegir otro</button>`;
}

function syncState(modal,input){
  const isPvp=/PVP/i.test(modal.querySelector(".modal-head")?.textContent||modal.textContent||"");
  const confirm=modal.querySelector("[data-confirm]");
  if(confirm&&input.files?.length&&!confirm.disabled)return;
  validateAndRender(modal,input,isPvp);
}

function formatSize(bytes){
  const value=Number(bytes||0);
  if(value>=1024*1024)return `${(value/(1024*1024)).toFixed(value>=10*1024*1024?0:1)} MB`;
  if(value>=1024)return `${Math.max(1,Math.round(value/1024))} KB`;
  return `${value} B`;
}

function escapeHtml(value){
  return String(value??"").replace(/[&<>'"]/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[char]));
}

function install(){
  enhanceAll();
  const root=document.querySelector("#modal-root");
  if(!root)return;
  observer=new MutationObserver(schedule);
  observe();
}

if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",install,{once:true});else install();
