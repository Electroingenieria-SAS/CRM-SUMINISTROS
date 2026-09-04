import {state} from "../core/state.js";
import {openModuleGuide} from "./guides-v113.js";
import {installActivityBrowserV113} from "./activity-browser-v113.js";
import {installWorkforceTaxonomyV113} from "./workforce-taxonomy-v113.js";
import {installAccessibilityV114} from "./accessibility-v114.js";
import {installReceivingDomainV115} from "./receiving-hub-v115.js";
import {installReceivingGuideV115} from "./receiving-guide-v115.js";

/*
 * V11.9.7
 * La antigua installGuidesV113() inyectaba botones dentro de modal-head usando
 * insertBefore sobre un botón de cierre que podía estar anidado en otro contenedor.
 * Eso producía NotFoundError durante re-renderizados de los flujos.
 *
 * La guía global se conserva. Los popups ya cuentan con ayuda contextual propia,
 * por lo que no se agrega un segundo botón redundante dentro de cada modal.
 */
installGlobalGuideV1197();
installAccessibilityV114();
installReceivingDomainV115();
installReceivingGuideV115();

document.addEventListener("click",event=>{
  const button=event.target.closest?.("[data-v113-guide-module]");
  if(!button)return;
  event.preventDefault();
  event.stopImmediatePropagation();
  openModuleGuide(state.currentModule||"dashboard");
},true);

function installGlobalGuideV1197(){
  const ensure=()=>{
    const actions=document.querySelector(".top-actions");
    if(!actions)return;
    let button=actions.querySelector("[data-v113-guide-module]");
    if(!button){
      button=document.createElement("button");
      button.type="button";
      button.className="btn btn-ghost v113-guide-button";
      button.innerHTML='<span class="v113-guide-icon">?</span><span>Guía</span>';
      const refresh=actions.querySelector("#refresh-page");
      if(refresh&&refresh.parentNode===actions)actions.insertBefore(button,refresh);
      else actions.prepend(button);
    }
    button.dataset.v113GuideModule=state.currentModule||"dashboard";
  };

  ensure();
  const app=document.querySelector("#app");
  if(!app)return;
  const observer=new MutationObserver(()=>ensure());
  observer.observe(app,{childList:true,subtree:true});
}

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
