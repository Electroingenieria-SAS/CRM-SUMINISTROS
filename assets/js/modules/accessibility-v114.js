let installed=false;

function focusOutsideSidebar(){
  const sidebar=document.querySelector("#sidebar");
  const active=document.activeElement;
  if(!sidebar||!(active instanceof HTMLElement)||!sidebar.contains(active))return;
  const toggle=document.querySelector("#menu-toggle");
  if(toggle instanceof HTMLElement){
    try{toggle.focus({preventScroll:true})}catch{toggle.focus()}
    return;
  }
  const main=document.querySelector("#main-content");
  if(main instanceof HTMLElement){
    const hadTabindex=main.hasAttribute("tabindex");
    if(!hadTabindex)main.setAttribute("tabindex","-1");
    try{main.focus({preventScroll:true})}catch{main.focus()}
    if(!hadTabindex)queueMicrotask(()=>main.removeAttribute("tabindex"));
  }
}

function syncSidebarInert(){
  const sidebar=document.querySelector("#sidebar");
  if(!sidebar)return;
  const hidden=sidebar.getAttribute("aria-hidden")==="true";
  if(hidden)focusOutsideSidebar();
  if("inert" in sidebar)sidebar.inert=hidden;
}

export function installAccessibilityV114(){
  if(installed)return;
  installed=true;

  document.addEventListener("click",event=>{
    const target=event.target?.closest?.("#sidebar [data-nav],#sidebar-close,#sidebar-backdrop");
    if(target)focusOutsideSidebar();
  },true);

  document.addEventListener("keydown",event=>{
    if(event.key==="Escape"&&document.querySelector("#sidebar.open"))focusOutsideSidebar();
  },true);

  const attach=()=>{
    const sidebar=document.querySelector("#sidebar");
    if(!sidebar)return false;
    syncSidebarInert();
    new MutationObserver(syncSidebarInert).observe(sidebar,{attributes:true,attributeFilter:["aria-hidden","class"]});
    return true;
  };

  if(!attach()){
    const app=document.querySelector("#app");
    if(app){
      const observer=new MutationObserver(()=>{if(attach())observer.disconnect()});
      observer.observe(app,{childList:true,subtree:true});
    }
  }
}
