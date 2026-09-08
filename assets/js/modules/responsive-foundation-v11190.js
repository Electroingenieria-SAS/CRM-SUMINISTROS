/* CRM Suministros · Responsive Runtime Foundation V11.19.0
   Device/viewport contract, visual viewport support and adaptive data-table normalization. */

const PHONE_MAX=720;
const TABLET_MAX=900;
const COMPACT_DESKTOP_MAX=1180;
const WIDE_MIN=1600;
const KEYBOARD_THRESHOLD=160;

let observer=null;
let scheduled=false;
let lastKeyboardState="closed";

const html=document.documentElement;

function platform(){
  const ua=navigator.userAgent||"";
  const touchMac=/Macintosh/i.test(ua)&&navigator.maxTouchPoints>1;
  if(/iPhone|iPad|iPod/i.test(ua)||touchMac)return"ios";
  if(/Android/i.test(ua))return"android";
  if(/Macintosh|Mac OS X/i.test(ua))return"macos";
  if(/Windows/i.test(ua))return"windows";
  return"other";
}

function breakpoint(width){
  if(width<=PHONE_MAX)return"phone";
  if(width<=TABLET_MAX)return"tablet";
  if(width<=COMPACT_DESKTOP_MAX)return"compact-desktop";
  if(width>=WIDE_MIN)return"wide";
  return"desktop";
}

function inputMode(){return window.matchMedia?.("(pointer: coarse)").matches||navigator.maxTouchPoints>0?"touch":"mouse"}
function orientation(){return innerWidth>=innerHeight?"landscape":"portrait"}
function heightClass(){return innerHeight<=650?"short":"normal"}

function viewportMetrics(){
  const vv=window.visualViewport;
  const width=Math.round(vv?.width||innerWidth);
  const height=Math.round(vv?.height||innerHeight);
  const keyboardGap=Math.max(0,Math.round(innerHeight-height-(vv?.offsetTop||0)));
  const keyboardOpen=window.innerWidth<=TABLET_MAX&&keyboardGap>KEYBOARD_THRESHOLD;
  html.style.setProperty("--rf-visual-height",`${height}px`);
  html.style.setProperty("--rf-visual-width",`${width}px`);
  html.style.setProperty("--rf-keyboard-offset",`${keyboardOpen?keyboardGap:0}px`);
  html.dataset.rfBreakpoint=breakpoint(innerWidth);
  html.dataset.rfPlatform=platform();
  html.dataset.rfInput=inputMode();
  html.dataset.rfOrientation=orientation();
  html.dataset.rfHeight=heightClass();
  html.dataset.rfKeyboard=keyboardOpen?"open":"closed";
  if(lastKeyboardState!==html.dataset.rfKeyboard){
    lastKeyboardState=html.dataset.rfKeyboard;
    window.dispatchEvent(new CustomEvent("erp:responsive-keyboard",{detail:{open:keyboardOpen,height,keyboardGap}}));
  }
}

function cleanLabel(value){return String(value||"").replace(/\s+/g," ").trim().replace(/[:：]+$/g,"")}

function nearestTableLabel(table){
  const caption=cleanLabel(table.querySelector("caption")?.textContent);
  if(caption)return caption;
  const scope=table.closest(".card,.guided-workspace,.modal,.drawer,section,article,#page-content");
  const heading=scope?.querySelector("h1,h2,h3,h4,.card-title,.page-title,strong");
  return cleanLabel(heading?.textContent)||"Tabla de datos";
}

function ensureTableShell(table){
  const current=table.parentElement;
  if(current?.classList.contains("table-wrap")){current.classList.add("rf-table-shell");return current}
  if(current?.classList.contains("rf-table-shell"))return current;
  const shell=document.createElement("div");
  shell.className="rf-table-shell";
  table.before(shell);
  shell.appendChild(table);
  return shell;
}

function tableHeaders(table){
  const row=table.tHead?.rows?.[0];
  if(!row)return[];
  return [...row.cells].map(cell=>cleanLabel(cell.textContent));
}

function tableIsComplex(table,headers){
  if(headers.length>6||headers.length===0)return true;
  if(table.querySelector("[rowspan]:not([rowspan='1']),[colspan]:not([colspan='1'])"))return true;
  const rows=[...table.tBodies].flatMap(body=>[...body.rows]);
  if(rows.some(row=>row.cells.length!==headers.length))return true;
  return false;
}

function normalizeTable(table){
  if(!(table instanceof HTMLTableElement))return;
  const headers=tableHeaders(table);
  const shell=ensureTableShell(table);
  table.classList.add("rf-responsive-table");
  const mode=tableIsComplex(table,headers)?"scroll":"cards";
  table.dataset.rfMode=mode;
  shell.dataset.rfMode=mode;
  if(mode==="scroll"){
    shell.tabIndex=0;
    shell.setAttribute("role","region");
    shell.setAttribute("aria-label",`${nearestTableLabel(table)}. Desliza horizontalmente para consultar todas las columnas.`);
  }else{
    shell.removeAttribute("tabindex");
    shell.removeAttribute("role");
    shell.removeAttribute("aria-label");
  }
  for(const body of table.tBodies){
    for(const row of body.rows){
      [...row.cells].forEach((cell,index)=>{
        const label=headers[index]||`Campo ${index+1}`;
        if(cell.getAttribute("data-rf-label")!==label)cell.setAttribute("data-rf-label",label);
      });
    }
  }
}

function normalizeScrollStrips(scope=document){
  const selectors=".detail-tabs,.wizard-progress,.workforce-tabs,.simple-stage-selector,.view-switch,.segment-control";
  if(scope instanceof Element&&scope.matches?.(selectors))scope.classList.add("rf-scroll-strip");
  scope.querySelectorAll?.(selectors).forEach(node=>node.classList.add("rf-scroll-strip"));
}

function normalizeTables(scope=document){
  if(scope instanceof HTMLTableElement)normalizeTable(scope);
  scope.querySelectorAll?.("table").forEach(normalizeTable);
}

function normalize(scope=document){normalizeScrollStrips(scope);normalizeTables(scope)}

function scheduleNormalize(){
  if(scheduled)return;
  scheduled=true;
  requestAnimationFrame(()=>{
    scheduled=false;
    viewportMetrics();
    normalize(document.querySelector("#app")||document);
    const modalRoot=document.querySelector("#modal-root");
    if(modalRoot)normalize(modalRoot);
  });
}

function observeDynamicUi(){
  observer?.disconnect();
  observer=new MutationObserver(records=>{
    let relevant=false;
    for(const record of records){
      if(record.type!=="childList"||!record.addedNodes.length)continue;
      relevant=true;
      break;
    }
    if(relevant)scheduleNormalize();
  });
  observer.observe(document.body,{childList:true,subtree:true});
}

function bindViewport(){
  const vv=window.visualViewport;
  const handler=()=>scheduleNormalize();
  window.addEventListener("resize",handler,{passive:true});
  window.addEventListener("orientationchange",handler,{passive:true});
  window.addEventListener("pageshow",handler,{passive:true});
  vv?.addEventListener("resize",handler,{passive:true});
  vv?.addEventListener("scroll",handler,{passive:true});
  window.matchMedia?.("(pointer: coarse)")?.addEventListener?.("change",handler);
}

function boot(){
  viewportMetrics();
  normalize();
  observeDynamicUi();
  bindViewport();
  window.dispatchEvent(new CustomEvent("erp:responsive-ready",{detail:{version:"11.19.0",breakpoint:html.dataset.rfBreakpoint,platform:html.dataset.rfPlatform}}));
}

if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot,{once:true});
else boot();
