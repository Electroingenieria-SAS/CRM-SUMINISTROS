/* CRM Suministros · capa visual aislada para guías contextuales.
   No modifica flujos, datos, permisos ni lógica operativa. */

const STYLE_ID="guides-layout-v11291-style";
let observer=null;
let scheduled=false;

function ensureStyles(){
  if(document.getElementById(STYLE_ID))return;
  const link=document.createElement("link");
  link.id=STYLE_ID;link.rel="stylesheet";link.href="./assets/runtime-css/guides-layout-v11291.css?v=11.30.2";
  document.head.appendChild(link);
}

function isGuideDialog(dialog){
  return Boolean(dialog?.querySelector?.(".v113-guide-hero,.v115-guide-grid"));
}

function enhanceGuideDialog(dialog){
  if(!dialog||dialog.dataset.guideLayoutV11291==="1"||!isGuideDialog(dialog))return;
  dialog.dataset.guideLayoutV11291="1";
  dialog.classList.add("guide-modal-v11291");
  dialog.querySelectorAll("details.v113-guide-step").forEach(step=>{step.open=true});
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
  ensureStyles();
  const root=document.querySelector("#modal-root");
  if(!root)return;
  enhanceAll();
  observer=new MutationObserver(schedule);
  observer.observe(root,{childList:true,subtree:true});
}

if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",install,{once:true});
else install();
