import {state} from "../core/state.js";
import {installPacoBot} from "./paco-bot-v11180.js";

/* CRM Suministros · Paco visibility guard
   Keeps Paco attached to document.body and visible whenever an authenticated CRM shell exists.
   It does not create a second bot instance and does not alter permissions or business logic. */

let scheduled=false;
let observer=null;

function ensurePaco(){
  scheduled=false;
  if(!state.profile||!document.querySelector(".shell"))return;
  installPacoBot();
  const root=document.querySelector("#paco-bot");
  if(!root)return;
  if(root.parentElement!==document.body)document.body.append(root);
  root.hidden=false;
  root.removeAttribute("aria-hidden");
  root.classList.add("paco-mounted-v11181");
  const launcher=root.querySelector("[data-paco-toggle]");
  if(launcher){
    launcher.hidden=false;
    launcher.removeAttribute("aria-hidden");
    launcher.setAttribute("tabindex","0");
  }
}

function scheduleEnsure(){
  if(scheduled)return;
  scheduled=true;
  requestAnimationFrame(ensurePaco);
}

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
