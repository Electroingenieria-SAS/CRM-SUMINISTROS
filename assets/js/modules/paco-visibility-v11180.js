import {state} from "../core/state.js";
import {installPacoBot} from "./paco-bot-v11182.js";

/* CRM Suministros · Paco visibility guard V11.19.4
   Keeps Paco attached to document.body and guarantees the canonical chat shell/controller. */

const PACO_VERSION="11.19.4";
const PACO_STYLE="./assets/css/paco-chat-shell-v11193.css?v=11.19.4";
let scheduled=false;
let observer=null;

function ensureStyle(){
  document.querySelectorAll('link[data-paco-enterprise]').forEach(link=>{
    if(link.dataset.pacoEnterprise!==PACO_VERSION)link.remove();
  });
  if(document.querySelector(`link[data-paco-enterprise="${PACO_VERSION}"]`))return;
  const link=document.createElement("link");
  link.rel="stylesheet";
  link.href=PACO_STYLE;
  link.dataset.pacoEnterprise=PACO_VERSION;
  document.head.append(link);
}

function ensurePaco(){
  scheduled=false;
  if(!state.profile||!document.querySelector(".shell"))return;
  ensureStyle();
  let root=document.querySelector("#paco-bot");
  if(root&&root.dataset.pacoVersion!==PACO_VERSION){root.remove();root=null}
  installPacoBot();
  root=document.querySelector("#paco-bot");
  if(!root)return;
  root.dataset.pacoVersion=PACO_VERSION;
  root.dataset.pacoEngine="v11182";
  if(root.parentElement!==document.body)document.body.append(root);
  root.hidden=false;
  root.removeAttribute("aria-hidden");
  [...root.classList].forEach(cls=>{if(/^paco-mounted-v/.test(cls))root.classList.remove(cls)});
  root.classList.add("paco-mounted-v11194","paco-shell-v11193");
  const launcher=root.querySelector("[data-paco-toggle]");
  if(launcher){
    launcher.hidden=false;
    launcher.removeAttribute("aria-hidden");
    launcher.setAttribute("tabindex","0");
  }
  window.dispatchEvent(new CustomEvent("paco:mounted-v11194",{detail:{root,version:PACO_VERSION}}));
}

function scheduleEnsure(){if(scheduled)return;scheduled=true;requestAnimationFrame(ensurePaco)}
function bootGuard(){
  scheduleEnsure();
  if(observer)return;
  observer=new MutationObserver(scheduleEnsure);
  observer.observe(document.body,{childList:true,subtree:true});
  window.addEventListener("hashchange",scheduleEnsure,{passive:true});
  window.addEventListener("pageshow",scheduleEnsure,{passive:true});
  window.addEventListener("focus",scheduleEnsure,{passive:true});
  document.addEventListener("visibilitychange",()=>{if(!document.hidden)scheduleEnsure()},{passive:true});
}

if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",bootGuard,{once:true});
else bootGuard();
