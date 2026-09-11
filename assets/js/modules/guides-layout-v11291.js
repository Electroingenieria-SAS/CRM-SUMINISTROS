/* CRM Suministros V11.29.1 · Capa de presentación para guías.
   Solo amplía y reorganiza ventanas de ayuda ya existentes. */

let observer=null;
let scheduled=false;

function isGuideDialog(dialog){
  return Boolean(dialog?.querySelector?.(".v113-guide-hero,.v115-guide-grid"));
}

function enhanceGuideDialog(dialog){
  if(!dialog||dialog.dataset.guideLayoutV11291==="1"||!isGuideDialog(dialog))return;
  dialog.dataset.guideLayoutV11291="1";
  dialog.classList.add("guide-modal-v11291");

  /* Las guías generales quedan completamente visibles al abrirse.
     El usuario puede seguir plegando un paso si lo desea. */
  dialog.querySelectorAll("details.v113-guide-step").forEach(step=>{
    step.open=true;
  });
}

function enhanceAll(){
  document.querySelectorAll("#modal-root .modal").forEach(enhanceGuideDialog);
}

function schedule(){
  if(scheduled)return;
  scheduled=true;
  requestAnimationFrame(()=>{
    scheduled=false;
    enhanceAll();
  });
}

function install(){
  const root=document.querySelector("#modal-root");
  if(!root)return;
  enhanceAll();
  observer=new MutationObserver(schedule);
  observer.observe(root,{childList:true,subtree:true});
}

if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",install,{once:true});
else install();
