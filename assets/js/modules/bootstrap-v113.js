import {state} from "../core/state.js";
import {installGuidesV113,openModuleGuide} from "./guides-v113.js";
import {installActivityBrowserV113} from "./activity-browser-v113.js";
import {installWorkforceTaxonomyV113} from "./workforce-taxonomy-v113.js";
import {installAccessibilityV114} from "./accessibility-v114.js";
import {installReceivingDomainV115} from "./receiving-hub-v115.js";
import {installReceivingRouteV115} from "./receiving-route-v115.js";

installGuidesV113();
installAccessibilityV114();
installReceivingDomainV115();
installReceivingRouteV115();

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
