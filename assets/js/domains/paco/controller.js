import { state, subscribe } from "../../core/state.js";
import { ASSETS } from "./paco-config.js";
import { paco } from "./paco-state.js";
import { ensureStyles, renderRoot } from "./ui/root.js";
import { saveVoicePreference, savePreferredVoice } from "./voice/preferences.js";
import { readLastDigest } from "./alerts/digest-storage.js";
import { message, renderMessages, add, typing, replaceTyping, setBusy, setFace } from "./ui/messages.js";
import { isOpen, setQuickMenuOpen, toggleQuickMenu, setOpen, toggleOpen, renderQuick, updateContext } from "./ui/panel.js";
import { setFlow, restartPaco } from "./actions/conversation-flow.js";
import { renderVoiceOptions } from "./voice/voice-selection.js";
import { updateVoiceButton, toggleVoice, testVoice } from "./voice/speech.js";
import { refreshMonitor, startMonitor } from "./alerts/monitor.js";
import { resolveQuery } from "./answers/resolve-query.js";
import { runAction } from "./actions/run-actions.js";

export async function submit(input){
  const text=String(input||"").trim();
  if(!text||paco.busy)return;
  add(message({role:"user",text}));
  setBusy(true);typing();
  try{
    const answer=await resolveQuery(text);
    replaceTyping(answer);
    setFace(answer?.type==="success"?"success":"talking");
    setTimeout(()=>isOpen()&&setFace("listening"),700);
  }catch(error){
    console.error("[PACO V11.37]",error);
    replaceTyping(message({text:"No pude completar esa consulta con los datos o permisos actuales.",alert:{title:"Detalle",text:error.message||"Error inesperado",tone:"warning"}}));
    setFace("idle");
  }finally{setBusy(false)}
}

export function bindRoot(){
  const root=paco.root;if(!root||root.dataset.pacoBound==="1")return;
  root.dataset.pacoBound="1";
  root.querySelector("[data-paco-toggle]")?.addEventListener("click",toggleOpen);
  root.querySelector("[data-paco-close]")?.addEventListener("click",()=>setOpen(false));
  root.querySelector("[data-paco-voice]")?.addEventListener("click",toggleVoice);
  root.querySelector("[data-paco-voice-select]")?.addEventListener("change",event=>{
    savePreferredVoice(event.target.value);
    paco.voiceEnabled=true;
    saveVoicePreference();
    updateVoiceButton();
    testVoice();
  });
  root.querySelector("[data-paco-test-voice]")?.addEventListener("click",testVoice);
  root.querySelector("[data-paco-summary-now]")?.addEventListener("click",()=>runAction({dataset:{pacoAction:"summary-now"}}));
  root.querySelector("[data-paco-restart]")?.addEventListener("click",restartPaco);
  root.querySelector("[data-paco-quick-toggle]")?.addEventListener("click",toggleQuickMenu);
  root.querySelector("[data-paco-quick-close]")?.addEventListener("click",()=>setQuickMenuOpen(false));
  root.querySelector("[data-paco-form]")?.addEventListener("submit",event=>{event.preventDefault();const input=root.querySelector("[data-paco-input]");const value=input.value;input.value="";submit(value)});
  root.querySelector("[data-paco-input]")?.addEventListener("keydown",event=>{if(event.key==="Enter"&&!event.shiftKey){event.preventDefault();root.querySelector("[data-paco-form]")?.requestSubmit()}});
  root.addEventListener("click",event=>{
    const action=event.target.closest?.("[data-paco-action]");if(action){setQuickMenuOpen(false);void runAction(action);return}
    const quick=event.target.closest?.("[data-paco-quick]");if(quick){setQuickMenuOpen(false);submit(quick.dataset.pacoQuick)}
  });
}

export function bindGlobal(){
  if(paco.globalBound)return;paco.globalBound=true;
  document.addEventListener("click",event=>{
    if(event.target.closest?.(".nav-item"))setTimeout(updateContext,40);
    if(paco.root&&!event.target.closest?.("[data-paco-quick-wrap]"))setQuickMenuOpen(false);
  });
  document.addEventListener("keydown",event=>{if(event.key==="Escape"&&paco.root?.querySelector("[data-paco-quick-menu]")?.hidden===false)setQuickMenuOpen(false)});
  window.addEventListener("erp:work-changed",()=>setTimeout(()=>refreshMonitor(true),1200));
  window.addEventListener("erp:refresh",()=>setTimeout(()=>refreshMonitor(true),600));
  window.addEventListener("paco:open",event=>{if(!state.profile)return;setOpen(true);const prompt=event.detail?.prompt;if(prompt){const input=paco.root?.querySelector("[data-paco-input]");if(input){input.value=prompt;input.focus()}}});
  window.addEventListener("paco:close",()=>setOpen(false));
}

export function syncProfile(next=state){
  if(!paco.root)return;
  const active=Boolean(next.profile);
  paco.root.hidden=!active;
  if(active){
    updateContext();
    updateVoiceButton();
    paco.lastDigestAt=readLastDigest();
    startMonitor();
  }else{
    clearInterval(paco.monitorTimer);paco.monitorTimer=null;paco.previous=null;paco.messages=[];setFlow(null);paco.lastDigestAt=0;renderMessages();setOpen(false);
  }
}

export function installPacoAssistant(){
  ensureStyles();
  const legacy=document.querySelector("#paco-bot");
  if(legacy)legacy.remove();
  const template=document.createElement("template");
  template.innerHTML=renderRoot().trim();
  const root=template.content.firstElementChild;
  document.body.append(root);
  paco.root=root;
  bindRoot();bindGlobal();renderQuick();syncProfile();
  if("speechSynthesis" in window){
    speechSynthesis.addEventListener?.("voiceschanged",()=>renderVoiceOptions(),{passive:true});
    setTimeout(renderVoiceOptions,250);
    setTimeout(renderVoiceOptions,1200);
  }
  if(!paco.unsubscribe)paco.unsubscribe=subscribe(syncProfile);
  Object.values(ASSETS).forEach(src=>{const image=new Image();image.decoding="async";image.src=src});
  return root;
}
