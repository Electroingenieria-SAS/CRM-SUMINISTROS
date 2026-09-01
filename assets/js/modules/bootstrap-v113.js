import {state} from "../core/state.js";
import {installGuidesV113,openModuleGuide} from "./guides-v113.js";
import {installActivityBrowserV113} from "./activity-browser-v113.js";
import {installWorkforceTaxonomyV113} from "./workforce-taxonomy-v113.js";

installGuidesV113();

document.addEventListener("click",event=>{
  const button=event.target.closest?.("[data-v113-guide-module]");
  if(!button)return;
  event.preventDefault();
  event.stopImmediatePropagation();
  openModuleGuide(state.currentModule||"dashboard");
},true);

const startEnhancers=()=>{
  if(document.querySelector("#page-content")){
    installActivityBrowserV113();
    installWorkforceTaxonomyV113();
    return true;
  }
  return false;
};

if(!startEnhancers()){
  const app=document.querySelector("#app");
  if(app){
    const observer=new MutationObserver(()=>{if(startEnhancers())observer.disconnect()});
    observer.observe(app,{childList:true,subtree:true});
  }
}
