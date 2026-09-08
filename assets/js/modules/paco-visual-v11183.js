/* CRM Suministros · Paco Visual Bridge V11.18.3
   Replaces fragile CSS-sprite faces with real <img> assets and coordinates the compact rolling launcher. */

const PACO_ASSETS=Object.freeze({
  idle:"./assets/img/paco/paco-idle-v11183.svg",
  listening:"./assets/img/paco/paco-listening-v11183.svg",
  thinking:"./assets/img/paco/paco-thinking-v11183.svg",
  wink:"./assets/img/paco/paco-wink-v11183.svg",
  talking:"./assets/img/paco/paco-talking-v11183.svg",
  success:"./assets/img/paco/paco-success-v11183.svg"
});

const FACE_CLASSES=["is-idle","is-listening","is-thinking","is-wink","is-talking","is-success"];
let rootObserver=null;
let bodyObserver=null;
let scheduled=false;

function expressionFrom(node){
  if(node.classList.contains("is-listening"))return "listening";
  if(node.classList.contains("is-thinking"))return "thinking";
  if(node.classList.contains("is-wink"))return "wink";
  if(node.classList.contains("is-talking"))return "talking";
  if(node.classList.contains("is-success"))return "success";
  return "idle";
}

function syncFace(node){
  if(!(node instanceof HTMLImageElement))return;
  const expression=expressionFrom(node);
  const next=PACO_ASSETS[expression]||PACO_ASSETS.idle;
  if(node.getAttribute("src")!==next)node.setAttribute("src",next);
  node.dataset.pacoExpression=expression;
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
  img.classList.add("paco-face-img-v11183");
  for(const attr of [...node.attributes]){
    if(attr.name==="class"||attr.name==="style")continue;
    img.setAttribute(attr.name,attr.value);
  }
  img.loading="eager";
  img.decoding="async";
  img.draggable=false;
  img.alt="";
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

function computeRoll(root){
  const panel=root.querySelector(".paco-panel");
  const launcher=root.querySelector(".paco-launcher");
  if(!panel||!launcher)return;
  const width=Math.min(panel.getBoundingClientRect().width||500,window.innerWidth-32);
  const launcherWidth=launcher.getBoundingClientRect().width||80;
  const available=Math.max(0,window.innerWidth-launcherWidth-34);
  const distance=Math.min(Math.max(118,width-launcherWidth+8),available);
  root.style.setProperty("--paco-roll-distance-v11183",`${Math.round(distance)}px`);
}

function syncOpenState(root){
  const panel=root.querySelector(".paco-panel");
  if(!panel)return;
  const isOpen=!panel.hidden;
  computeRoll(root);
  if(isOpen){
    root.classList.add("paco-opening-v11183");
    requestAnimationFrame(()=>requestAnimationFrame(()=>{
      root.classList.add("paco-open-v11183");
      root.classList.remove("paco-opening-v11183");
    }));
  }else{
    root.classList.remove("paco-open-v11183","paco-opening-v11183");
  }
}

function wireRoot(root){
  if(!root||root.dataset.pacoVisualVersion==="11.18.3")return;
  root.dataset.pacoVisualVersion="11.18.3";
  root.classList.add("paco-visual-v11183");
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
      root.classList.add("paco-opening-v11183");
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
  window.addEventListener("pageshow",schedule,{passive:true});
}

if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot,{once:true});
else boot();
