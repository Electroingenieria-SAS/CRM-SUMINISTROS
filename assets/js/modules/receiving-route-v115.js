import {state} from "../core/state.js";
import {renderReceivingHub} from "./receiving-hub-v115.js";

let installed=false;
let timer=null;
let rendering=false;

export function installReceivingRouteV115(){
  if(installed)return;
  installed=true;
  const app=document.querySelector("#app");
  if(app){
    const observer=new MutationObserver(schedule);
    observer.observe(app,{childList:true,subtree:true});
  }
  window.addEventListener("hashchange",schedule);
  schedule();
}

function schedule(){
  clearTimeout(timer);
  timer=setTimeout(ensureHub,35);
}

async function ensureHub(){
  if(rendering||state.currentModule!=="receiving")return;
  const root=document.querySelector("#page-content");
  if(!root||root.querySelector(".v115-process-switch"))return;
  rendering=true;
  try{await renderReceivingHub(root)}
  catch(error){console.error("[Recepción V11.5]",error)}
  finally{rendering=false}
}
