import { paco } from "../paco-state.js";
import { esc, moduleLabel, isManager } from "../context/profile-context.js";
import { setFace } from "./messages.js";
import { ensureWelcome } from "../actions/conversation-flow.js";

export function isOpen(){return Boolean(paco.root?.classList.contains("is-open"))}

export function setQuickMenuOpen(open){
  const menu=paco.root?.querySelector("[data-paco-quick-menu]");
  const toggle=paco.root?.querySelector("[data-paco-quick-toggle]");
  const wrap=paco.root?.querySelector("[data-paco-quick-wrap]");
  if(!menu||!toggle||!wrap)return;
  const next=Boolean(open);
  menu.hidden=!next;
  wrap.classList.toggle("is-open",next);
  toggle.setAttribute("aria-expanded",String(next));
}

export function toggleQuickMenu(){setQuickMenuOpen(paco.root?.querySelector("[data-paco-quick-menu]")?.hidden!==false)}

export function setOpen(open){
  if(!paco.root)return;
  paco.root.classList.toggle("is-open",Boolean(open));
  paco.root.querySelector("[data-paco-toggle]")?.setAttribute("aria-expanded",String(Boolean(open)));
  if(open){
    ensureWelcome();
    clearBadge();
    setFace("listening");
    setTimeout(()=>paco.root?.querySelector("[data-paco-input]")?.focus(),80);
  }else{
    setQuickMenuOpen(false);
    setFace("idle");
  }
}

export function toggleOpen(){setOpen(!isOpen())}

export function quickPrompts(){
  const base=["Registrar actividad","Pedidos demorados","Mi jornada","Novedades"];
  if(isManager())base.splice(1,0,"Resumen operativo","Estado del equipo","¿Quién está desocupado?");
  if(paco.flow)base.push("Cancelar consulta");
  return base;
}

export function renderQuick(){
  const row=paco.root?.querySelector("[data-paco-quick]");
  if(row)row.innerHTML=quickPrompts().map(text=>`<button type="button" data-paco-quick="${esc(text)}">${esc(text)}</button>`).join("");
}

export function updateContext(){
  paco.root?.querySelector("[data-paco-context]")?.replaceChildren(document.createTextNode(moduleLabel()));
  renderQuick();
}

export function setBadge(count=1){
  const badge=paco.root?.querySelector("[data-paco-badge]");
  if(!badge)return;
  const current=Number(badge.textContent||0);
  const next=Math.min(99,current+count);
  badge.textContent=String(next);
  badge.hidden=false;
  paco.root.classList.add("has-alert");
}

export function clearBadge(){
  const badge=paco.root?.querySelector("[data-paco-badge]");
  if(badge){badge.hidden=true;badge.textContent="0"}
  paco.root?.classList.remove("has-alert");
}
