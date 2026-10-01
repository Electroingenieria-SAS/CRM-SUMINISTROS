import { enhanceCommercialExperience } from "./commercial-controller.js";

export function schedule(){
  if(commercialObserverState.queued)return;
  commercialObserverState.queued=true;
  requestAnimationFrame(()=>{
    commercialObserverState.queued=false;
    enhanceCommercialExperience();
  });
}

export function install(){
  const root=document.querySelector("#page-content");
  if(!root){setTimeout(install,80);return;}
  if(!commercialObserverState.pageObserver){
    commercialObserverState.pageObserver=new MutationObserver(schedule);
    commercialObserverState.pageObserver.observe(root,{childList:true,subtree:true});
    const modal=document.querySelector("#modal-root");
    if(modal)commercialObserverState.pageObserver.observe(modal,{childList:true,subtree:true});
    window.addEventListener("hashchange",schedule);
  }
  schedule();
}

export const commercialObserverState={
queued:false,
pageObserver:null
};
