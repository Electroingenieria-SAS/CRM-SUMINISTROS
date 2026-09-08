/* CRM Suministros · Paco Visual Runtime V11.19.3
   Viewport-driven geometry. Never measures the already-constrained panel to decide its width. */

const PACO_ASSETS=Object.freeze({
  idle:"./assets/img/paco/paco-idle-v11183.svg",
  listening:"./assets/img/paco/paco-listening-v11183.svg",
  thinking:"./assets/img/paco/paco-thinking-v11183.svg",
  wink:"./assets/img/paco/paco-wink-v11183.svg",
  talking:"./assets/img/paco/paco-talking-v11183.svg",
  success:"./assets/img/paco/paco-success-v11183.svg"
});

const ROOT_VERSION="11.19.3";
const OPEN_GAP=16;
let rootObserver=null;
let bodyObserver=null;
let scheduled=false;

function viewportWidth(){return Math.round(window.visualViewport?.width||window.innerWidth||1366)}
function targetWidth(){
  const w=viewportWidth();
  if(w<=760)return Math.max(300,w-20);
  if(w<=900)return Math.min(640,w-40);
  if(w<=1100)return Math.min(680,w-52);
  if(w<=1366)return Math.min(720,Math.max(660,Math.round(w*.52)));
  return Math.min(820,Math.max(720,Math.round(w*.46)));
}
function launcherSize(){return viewportWidth()<=760?62:68}

function expressionFrom(node){
  if(node.classList.contains("is-listening"))return"listening";
  if(node.classList.contains("is-thinking"))return"thinking";
  if(node.classList.contains("is-wink"))return"wink";
  if(node.classList.contains("is-talking"))return"talking";
  if(node.classList.contains("is-success"))return"success";
  return"idle";
}
function syncFace(node){
  if(!(node instanceof HTMLImageElement))return;
  const expression=expressionFrom(node);
  const next=PACO_ASSETS[expression]||PACO_ASSETS.idle;
  if(node.getAttribute("src")!==next)node.setAttribute("src",next);
  node.dataset.pacoExpression=expression;
  node.loading="eager";
  node.decoding="async";
  node.draggable=false;
  node.alt="";
  node.setAttribute("aria-hidden","true");
}
function upgradeFace(node){
  if(!(node instanceof Element)||!node.classList.contains("paco-face"))return node;
  if(node instanceof HTMLImageElement){syncFace(node);return node}
  const img=document.createElement("img");
  for(const cls of node.classList)img.classList.add(cls);
  img.classList.add("paco-face-img-v11193");
  for(const attr of [...node.attributes]){
    if(attr.name==="class"||attr.name==="style")continue;
    img.setAttribute(attr.name,attr.value);
  }
  node.replaceWith(img);
  syncFace(img);
  return img;
}
function upgradeFaces(scope=document){
  if(scope instanceof Element&&scope.matches?.(".paco-face"))upgradeFace(scope);
  scope.querySelectorAll?.(".paco-face").forEach(upgradeFace);
}
function preload(){Object.values(PACO_ASSETS).forEach(src=>{const img=new Image();img.decoding="async";img.src=src})}

function applyGeometry(root){
  if(!root)return;
  const w=viewportWidth();
  const target=targetWidth();
  const launcher=launcherSize();
  const right=Math.max(0,w-root.getBoundingClientRect().right);
  const safeLeft=8;
  const desired=target+OPEN_GAP;
  const maximum=Math.max(0,w-right-launcher-safeLeft);
  const roll=Math.min(desired,maximum);
  root.style.setProperty("--paco-target-width-v11193",`${target}px`);
  root.style.setProperty("--paco-roll-v11193",`${Math.round(roll)}px`);
  root.dataset.pacoViewport=`${w}`;
  root.dataset.pacoTargetWidth=`${target}`;
}
function setLauncherMode(root,isOpen){
  const launcher=root.querySelector(".paco-launcher");
  if(!launcher)return;
  launcher.dataset.pacoLauncherMode=isOpen?"bolt":"paco";
  launcher.setAttribute("aria-label",isOpen?"Cerrar Paco Bot":"Abrir Paco Bot");
  launcher.setAttribute("title",isOpen?"Cerrar Paco Bot":"Abrir Paco Bot");
}
function syncOpenState(root){
  const panel=root.querySelector(".paco-panel");
  if(!panel)return;
  const isOpen=!panel.hidden;
  applyGeometry(root);
  if(isOpen){
    root.classList.add("paco-opening-v11193");
    setLauncherMode(root,true);
    requestAnimationFrame(()=>requestAnimationFrame(()=>{
      root.classList.add("paco-open-v11193");
      root.classList.remove("paco-opening-v11193");
      setLauncherMode(root,true);
    }));
  }else{
    root.classList.remove("paco-open-v11193","paco-opening-v11193");
    setLauncherMode(root,false);
  }
}
function cleanupLegacyClasses(root){
  [...root.classList].forEach(cls=>{
    if(/^paco-(visual|open|opening)-v111(83|91|92)$/.test(cls))root.classList.remove(cls);
  });
  root.classList.add("paco-shell-v11193");
}
function wireRoot(root){
  if(!root)return;
  cleanupLegacyClasses(root);
  upgradeFaces(root);
  applyGeometry(root);
  syncOpenState(root);
  if(root.dataset.pacoVisualVersion===ROOT_VERSION)return;
  root.dataset.pacoVisualVersion=ROOT_VERSION;

  rootObserver?.disconnect();
  rootObserver=new MutationObserver(records=>{
    for(const record of records){
      if(record.type==="childList")record.addedNodes.forEach(node=>{if(node instanceof Element)upgradeFaces(node)});
      if(record.type==="attributes"){
        if(record.target.classList?.contains("paco-face"))syncFace(upgradeFace(record.target));
        if(record.target.classList?.contains("paco-panel")&&record.attributeName==="hidden")syncOpenState(root);
      }
    }
  });
  rootObserver.observe(root,{subtree:true,childList:true,attributes:true,attributeFilter:["class","hidden"]});

  root.querySelector("[data-paco-toggle]")?.addEventListener("click",event=>{
    const launcher=event.currentTarget;
    const opening=launcher.getAttribute("aria-expanded")!=="true";
    if(opening){applyGeometry(root);root.classList.add("paco-opening-v11193")}
  },{capture:true});
}
function ensure(){scheduled=false;const root=document.querySelector("#paco-bot");if(root)wireRoot(root)}
function schedule(){if(scheduled)return;scheduled=true;requestAnimationFrame(ensure)}
function boot(){
  preload();
  schedule();
  bodyObserver=new MutationObserver(schedule);
  bodyObserver.observe(document.body,{childList:true,subtree:true});
  window.addEventListener("resize",schedule,{passive:true});
  window.addEventListener("orientationchange",schedule,{passive:true});
  window.visualViewport?.addEventListener("resize",schedule,{passive:true});
  window.visualViewport?.addEventListener("scroll",schedule,{passive:true});
  window.addEventListener("pageshow",schedule,{passive:true});
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot,{once:true});
else boot();
