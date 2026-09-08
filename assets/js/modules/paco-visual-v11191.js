/* CRM Suministros · Paco Visual Bridge V11.19.1
   Real image faces, circular launcher and precise left-side rolling dock. */

const PACO_ASSETS=Object.freeze({
  idle:"./assets/img/paco/paco-idle-v11183.svg",
  listening:"./assets/img/paco/paco-listening-v11183.svg",
  thinking:"./assets/img/paco/paco-thinking-v11183.svg",
  wink:"./assets/img/paco/paco-wink-v11183.svg",
  talking:"./assets/img/paco/paco-talking-v11183.svg",
  success:"./assets/img/paco/paco-success-v11183.svg"
});

const ROOT_VERSION="11.19.1";
let rootObserver=null;
let bodyObserver=null;
let scheduled=false;

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
  img.classList.add("paco-face-img-v11191");
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

function preload(){
  Object.values(PACO_ASSETS).forEach(src=>{const img=new Image();img.decoding="async";img.src=src});
}

function panelWidth(root){
  const panel=root.querySelector(".paco-panel");
  if(!panel)return 500;
  const rect=panel.getBoundingClientRect();
  return Math.max(280,Math.round(rect.width||500));
}

function computeRoll(root){
  const panel=root.querySelector(".paco-panel");
  const launcher=root.querySelector(".paco-launcher");
  if(!panel||!launcher)return;

  const width=panelWidth(root);
  const launcherWidth=Math.round(launcher.getBoundingClientRect().width||68);
  const gap=16;
  const desired=width+gap;
  const rootRight=Math.max(0,window.innerWidth-root.getBoundingClientRect().right);
  const safeLeft=12;
  const maximum=Math.max(0,window.innerWidth-rootRight-launcherWidth-safeLeft);
  const distance=Math.min(desired,maximum);

  root.style.setProperty("--paco-roll-distance-v11191",`${Math.round(distance)}px`);
  root.style.setProperty("--paco-panel-width-v11191",`${Math.round(width)}px`);
  launcher.setAttribute("title",root.classList.contains("paco-open-v11191")?"Paco Bot abierto":"Abrir Paco Bot");
}

function syncOpenState(root){
  const panel=root.querySelector(".paco-panel");
  const launcher=root.querySelector(".paco-launcher");
  if(!panel||!launcher)return;
  const isOpen=!panel.hidden;
  computeRoll(root);

  if(isOpen){
    root.classList.add("paco-opening-v11191");
    launcher.setAttribute("aria-label","Paco Bot abierto. Cerrar asistente");
    requestAnimationFrame(()=>requestAnimationFrame(()=>{
      root.classList.add("paco-open-v11191");
      root.classList.remove("paco-opening-v11191");
      launcher.setAttribute("title","Paco Bot abierto");
    }));
  }else{
    root.classList.remove("paco-open-v11191","paco-opening-v11191");
    launcher.setAttribute("aria-label","Abrir Paco Bot");
    launcher.setAttribute("title","Abrir Paco Bot");
  }
}

function wireRoot(root){
  if(!root)return;
  if(root.dataset.pacoVisualVersion===ROOT_VERSION){computeRoll(root);return}

  root.dataset.pacoVisualVersion=ROOT_VERSION;
  root.classList.remove("paco-visual-v11183","paco-open-v11183","paco-opening-v11183");
  root.classList.add("paco-visual-v11191");
  upgradeFaces(root);
  computeRoll(root);
  syncOpenState(root);

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

  const launcher=root.querySelector("[data-paco-toggle]");
  launcher?.addEventListener("click",()=>{
    if(launcher.getAttribute("aria-expanded")!=="true"){
      computeRoll(root);
      root.classList.add("paco-opening-v11191");
    }
  },{capture:true});
}

function ensure(){
  scheduled=false;
  const root=document.querySelector("#paco-bot");
  if(root)wireRoot(root);
}
function schedule(){if(scheduled)return;scheduled=true;requestAnimationFrame(ensure)}

function boot(){
  preload();
  schedule();
  bodyObserver=new MutationObserver(schedule);
  bodyObserver.observe(document.body,{childList:true,subtree:true});
  window.addEventListener("resize",schedule,{passive:true});
  window.addEventListener("orientationchange",schedule,{passive:true});
  window.visualViewport?.addEventListener("resize",schedule,{passive:true});
  window.addEventListener("pageshow",schedule,{passive:true});
}

if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot,{once:true});
else boot();
