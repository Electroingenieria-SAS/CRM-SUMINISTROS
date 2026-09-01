import {state} from "../core/state.js";
import {installGuidesV113,openModuleGuide} from "./guides-v113.js";
import {installActivityBrowserV113} from "./activity-browser-v113.js";

installGuidesV113();

document.addEventListener("click",event=>{
  const button=event.target.closest?.("[data-v113-guide-module]");
  if(!button)return;
  event.preventDefault();
  event.stopImmediatePropagation();
  openModuleGuide(state.currentModule||"dashboard");
},true);

const startActivityBrowser=()=>{
  if(document.querySelector("#page-content")){
    installActivityBrowserV113();
    return true;
  }
  return false;
};

if(!startActivityBrowser()){
  const app=document.querySelector("#app");
  if(app){
    const observer=new MutationObserver(()=>{if(startActivityBrowser())observer.disconnect()});
    observer.observe(app,{childList:true,subtree:true});
  }
}
