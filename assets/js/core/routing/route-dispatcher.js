import {updateShell as updateShellView} from "../layout.js";
import {loading as loadingMarkup,toast as showToast} from "../ui.js";
import {fmt} from "../format.js";
import {renderQueue as renderQueueView} from "../../modules/queue.js";
import {getModuleMetadata as resolveModuleMetadata} from "../layout/module-metadata.js";
import {
  renderModule as renderRegisteredModule,
  queueStepsFor as registeredQueueSteps,
  moduleReadable as canReadModule,
  firstReadableModule as findFirstReadableModule
} from "./module-registry.js";

export function createRouteDispatcher({
  getModules=()=>[],
  navigate,
  openOrder,
  updateShell=updateShellView,
  renderQueue=renderQueueView,
  renderModule=renderRegisteredModule,
  queueStepsFor=registeredQueueSteps,
  moduleReadable=canReadModule,
  firstReadableModule=findFirstReadableModule,
  getModuleMetadata=resolveModuleMetadata,
  loading=loadingMarkup,
  toast=showToast,
  escapeHtml=fmt.escape,
  documentRef=globalThis.document,
  locationRef=globalThis.location,
  defer=callback=>setTimeout(callback,0)
}={}){
  if(typeof navigate!=="function")throw new TypeError("navigate es requerido");
  if(typeof openOrder!=="function")throw new TypeError("openOrder es requerido");

  return async route=>{
    const requestedModule=route.segments[0]==="order"?"orders":route.module;
    const modules=getModules()||[];
    if(!moduleReadable(modules,requestedModule)){
      const fallback=firstReadableModule(modules);
      if(fallback!==route.module){
        navigate(fallback);
        return;
      }
    }

    if(route.segments[0]==="order"&&route.segments[1]){
      navigate("orders");
      defer(()=>openOrder(route.segments[1]));
      return;
    }

    const moduleId=route.module;
    const [title,sub]=getModuleMetadata(moduleId);
    updateShell(moduleId,title,sub);
    const root=documentRef.querySelector("#page-content");
    root.innerHTML=loading();

    try{
      const steps=queueStepsFor(moduleId);
      if(steps)await renderQueue(root,{moduleId,steps,params:route.params});
      else await renderModule(moduleId,root,{moduleId,params:route.params});
    }catch(error){
      console.error("[CRM MODULE]",moduleId,error);
      root.innerHTML=`<div class="card card-pad module-error"><h3>No fue posible cargar el módulo</h3><p class="danger">${escapeHtml(error.message)}</p><button class="btn btn-primary" id="retry-module">Reintentar</button></div>`;
      root.querySelector("#retry-module")?.addEventListener("click",()=>locationRef.reload());
      toast(error.message,"error",8000);
    }
  };
}
