import {renderAdmin as renderAdminBase} from "./admin-center-v11160.js";
import {getSupabase} from "../services/supabase.js";
import {modal,toast} from "../core/ui.js";

/* V11.16.0 · Verificación de perfiles desde Administración.
   La sesión de prueba se abre en otra pestaña y usa almacenamiento Auth aislado. */
const observers=new WeakMap();

async function invokeImpersonation(profileId,reason){
  const {data,error}=await getSupabase().functions.invoke("erp-admin-impersonate",{body:{profileId,reason}});
  if(error){
    let message=error.message||"No fue posible iniciar la verificación del usuario.";
    try{
      const response=error.context;
      if(response&&typeof response.clone==="function"){
        const payload=await response.clone().json();
        message=payload?.error||payload?.message||message;
      }
    }catch{}
    throw new Error(message);
  }
  if(!data?.success||!data?.tokenHash)throw new Error(data?.error||"No fue posible generar la sesión de verificación.");
  return data;
}

async function openAsUser(profileId,reason){
  const tab=window.open("about:blank","_blank");
  if(!tab)throw new Error("El navegador bloqueó la pestaña de verificación. Habilita ventanas emergentes para este sitio.");
  try{tab.opener=null}catch{}
  try{
    const data=await invokeImpersonation(profileId,reason);
    const slot=crypto.randomUUID();
    const url=new URL(window.location.href);
    url.search="";
    url.hash="";
    url.searchParams.set("impersonation","1");
    url.searchParams.set("slot",slot);
    const hash=new URLSearchParams();
    hash.set("impersonation_token",data.tokenHash);
    if(data.target?.name)hash.set("target",data.target.name);
    url.hash=hash.toString();
    tab.location.replace(url.toString());
    toast(`Verificación iniciada para ${data.target?.name||"el usuario"}.`);
  }catch(error){
    try{tab.close()}catch{}
    throw error;
  }
}

function requestImpersonation(profileId,label){
  modal({
    title:`Entrar como · ${label||"usuario"}`,
    confirmLabel:"Abrir verificación",
    body:`<div class="admin-warning-v11160"><strong>Sesión temporal y auditable</strong><p>Se abrirá otra pestaña autenticada como este perfil. Tu sesión Super Admin permanecerá intacta en esta pestaña. Las acciones que realices en la pestaña de prueba se ejecutarán realmente con los permisos del usuario.</p></div><label class="field"><span>Motivo de la verificación</span><textarea class="control" data-imp-reason rows="3" minlength="5" maxlength="500" required placeholder="Ej. Validar acceso y permisos del módulo de compras"></textarea></label>`,
    onConfirm:async root=>{
      const reason=root.querySelector("[data-imp-reason]")?.value.trim()||"";
      if(reason.length<5)throw new Error("Describe brevemente el motivo de la verificación.");
      await openAsUser(profileId,reason);
    }
  });
}

function enhanceUserRows(root){
  root.querySelectorAll("button[data-edit-user]").forEach(edit=>{
    const row=edit.closest("tr");
    if(!row||row.querySelector("[data-impersonate-user]"))return;
    const cells=row.querySelectorAll("td");
    const status=String(cells[2]?.textContent||"");
    const auth=String(cells[3]?.textContent||"");
    if(/inactiv/i.test(status)||!/activ/i.test(status)||!/vinculada/i.test(auth))return;
    const profileId=edit.dataset.editUser;
    if(!profileId)return;
    const label=String(cells[0]?.querySelector("strong")?.textContent||"usuario").trim();
    const button=document.createElement("button");
    button.type="button";
    button.className="btn btn-ghost";
    button.dataset.impersonateUser=profileId;
    button.textContent="Entrar como usuario";
    button.title="Abrir una sesión aislada para verificar este perfil";
    button.addEventListener("click",event=>{event.preventDefault();event.stopPropagation();requestImpersonation(profileId,label)});
    edit.insertAdjacentElement("beforebegin",button);
  });
}

export async function renderAdmin(root){
  observers.get(root)?.disconnect();
  await renderAdminBase(root);
  enhanceUserRows(root);
  const observer=new MutationObserver(()=>{
    if(!root.querySelector(".admin-center-v11160")){observer.disconnect();observers.delete(root);return}
    enhanceUserRows(root);
  });
  observer.observe(root,{childList:true,subtree:true});
  observers.set(root,observer);
}
