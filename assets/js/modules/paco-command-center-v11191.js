import {state,can,hasRole} from "../core/state.js";
import {navigate} from "../core/router.js";
import {api} from "../services/api.js";
import {toast} from "../core/ui.js";

/* CRM Suministros · Paco Command Center V11.19.1
   Read-only diagnostics + permission-aware operational shortcuts layered over Paco Bot.
   Mutations remain in the native CRM flows and existing permission-controlled actions. */

const VERSION="11.19.1";
let bodyObserver=null;
let rootObserver=null;
let scheduled=false;
let lastRpcError=null;

const TOOLS=[
  {id:"permissions",icon:"◉",label:"Mi acceso",detail:"Roles, módulos y capacidades visibles"},
  {id:"attention",icon:"!",label:"Pedidos a revisar",detail:"SLA, bloqueos y trabajo sin responsable",module:"orders"},
  {id:"exceptions",icon:"◆",label:"Excepciones",detail:"Resumen de novedades y aprobaciones",module:"approvals"},
  {id:"my-day",icon:"◷",label:"Mi jornada",detail:"Actividad y estado operativo de hoy",module:"workforce"},
  {id:"inventory-health",icon:"▣",label:"Inventario",detail:"Salud de reservas y disponibilidad",module:"inventory"},
  {id:"flow",icon:"↗",label:"Flujo y tiempos",detail:"SLA, esperas y cuellos de botella",module:"vsm",route:"vsm"},
  {id:"reports",icon:"▥",label:"Analítica",detail:"KPIs, exploración y exportaciones",module:"reports",route:"reports"},
  {id:"last-error",icon:"⚠",label:"Último error",detail:"Último fallo RPC detectado en la sesión"},
  {id:"system-health",icon:"✓",label:"Salud del CRM",detail:"Diagnóstico técnico del backend",admin:true},
  {id:"users",icon:"♙",label:"Usuarios y permisos",detail:"Abrir Centro de Control Administrativo",module:"admin",admin:true,route:"admin"},
  {id:"audit",icon:"⌁",label:"Auditoría",detail:"Eventos, cambios y trazabilidad",module:"audit",route:"audit"},
  {id:"refresh",icon:"↻",label:"Actualizar vista",detail:"Recargar los datos del módulo actual"}
];

function isAdmin(){return hasRole("super_admin")||can("admin","canRead")}
function allowed(tool){
  if(tool.admin&&!isAdmin())return false;
  if(tool.module&&!can(tool.module,"canRead")&&state.currentModule!==tool.module)return false;
  return true;
}
function esc(value){return String(value??"").replace(/[&<>'"]/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[char]))}
function pretty(value){return String(value??"").replaceAll("_"," ").replace(/([a-z])([A-Z])/g,"$1 $2").toLowerCase().replace(/(^|\s)\S/g,m=>m.toUpperCase())}
function primitive(value){return ["string","number","boolean"].includes(typeof value)}

function flatten(value,prefix="",depth=0,out=[]){
  if(out.length>=10||depth>2||value==null)return out;
  if(primitive(value)){out.push([prefix||"Dato",String(value)]);return out}
  if(Array.isArray(value)){
    if(!value.length){out.push([prefix||"Registros","0"]);return out}
    if(value.every(primitive)){out.push([prefix||"Valores",value.slice(0,6).join(", ")]);return out}
    out.push([prefix||"Registros",String(value.length)]);
    const first=value[0];
    if(first&&typeof first==="object")flatten(first,prefix?`${prefix} muestra`:"Muestra",depth+1,out);
    return out;
  }
  if(typeof value==="object"){
    for(const [key,item] of Object.entries(value)){
      if(out.length>=10)break;
      const label=prefix?`${prefix} · ${pretty(key)}`:pretty(key);
      if(primitive(item))out.push([label,String(item)]);
      else if(Array.isArray(item))out.push([label,String(item.length)]);
      else if(item&&depth<1)flatten(item,label,depth+1,out);
    }
  }
  return out;
}

function toolCards(){
  return TOOLS.filter(allowed).map(tool=>`<button type="button" class="paco-tool-card" data-paco-tool="${esc(tool.id)}"><span class="paco-tool-icon">${esc(tool.icon)}</span><span><strong>${esc(tool.label)}</strong><small>${esc(tool.detail)}</small></span></button>`).join("");
}

function renderCommandCenter(root){
  if(root.querySelector(".paco-command-center-v11191"))return;
  const panel=root.querySelector(".paco-panel");
  const context=root.querySelector(".paco-context");
  if(!panel||!context)return;

  const toggle=document.createElement("button");
  toggle.type="button";
  toggle.className="paco-tools-toggle";
  toggle.dataset.pacoToolsToggle="1";
  toggle.innerHTML='<span class="bolt" aria-hidden="true">⚡</span><span>Herramientas</span>';
  toggle.setAttribute("aria-label","Abrir herramientas avanzadas de Paco");
  toggle.setAttribute("aria-expanded","false");
  const contextButton=context.querySelector(".paco-context-button");
  context.insertBefore(toggle,contextButton||null);

  const center=document.createElement("section");
  center.className="paco-command-center-v11191";
  center.setAttribute("aria-label","Centro de herramientas de Paco");
  center.innerHTML=`
    <header class="paco-tools-head">
      <span class="paco-tools-head-icon" aria-hidden="true">⚡</span>
      <span class="paco-tools-head-copy"><strong>Centro de herramientas</strong><small>Diagnóstico y accesos según tus permisos</small></span>
      <button type="button" class="paco-tools-close" data-paco-tools-close aria-label="Cerrar herramientas">×</button>
    </header>
    <div class="paco-tools-body">
      <div class="paco-tools-grid" data-paco-tools-grid>${toolCards()}</div>
      <div class="paco-tools-result" data-paco-tools-result hidden></div>
    </div>`;
  panel.append(center);

  toggle.addEventListener("click",()=>setToolsOpen(root,!center.classList.contains("is-open")));
  center.querySelector("[data-paco-tools-close]")?.addEventListener("click",()=>setToolsOpen(root,false));
  center.addEventListener("click",event=>{
    const tool=event.target.closest?.("[data-paco-tool]");
    if(tool){runTool(root,tool.dataset.pacoTool);return}
    const openOrder=event.target.closest?.("[data-paco-advanced-open-order]");
    if(openOrder){window.dispatchEvent(new CustomEvent("erp:open-order",{detail:openOrder.dataset.pacoAdvancedOpenOrder}));setToolsOpen(root,false);root.querySelector("[data-paco-close]")?.click();return}
    const route=event.target.closest?.("[data-paco-advanced-route]");
    if(route){navigate(route.dataset.pacoAdvancedRoute);setToolsOpen(root,false);root.querySelector("[data-paco-close]")?.click();return}
    const prompt=event.target.closest?.("[data-paco-advanced-prompt]");
    if(prompt){setToolsOpen(root,false);submitPrompt(root,prompt.dataset.pacoAdvancedPrompt||"")}
  });
}

function setToolsOpen(root,open){
  const center=root.querySelector(".paco-command-center-v11191");
  const toggle=root.querySelector("[data-paco-tools-toggle]");
  if(!center||!toggle)return;
  center.classList.toggle("is-open",Boolean(open));
  toggle.setAttribute("aria-expanded",String(Boolean(open)));
  if(open){
    const grid=center.querySelector("[data-paco-tools-grid]");
    if(grid)grid.innerHTML=toolCards();
    requestAnimationFrame(()=>center.querySelector("[data-paco-tool]")?.focus());
  }
}

function resultBox(root){return root.querySelector("[data-paco-tools-result]")}
function setLoading(root,label="Consultando…"){
  const box=resultBox(root);if(!box)return;
  box.hidden=false;box.innerHTML=`<div class="paco-tools-loading">${esc(label)}</div>`;
}
function renderResult(root,title,rows=[],actions=[]){
  const box=resultBox(root);if(!box)return;
  const safeRows=(rows||[]).slice(0,12);
  box.hidden=false;
  box.innerHTML=`<div class="paco-tools-result-head"><strong>${esc(title)}</strong></div>
    <div class="paco-tools-result-list">${safeRows.length?safeRows.map(row=>`<div class="paco-tools-result-row"><span>${esc(row[0])}</span><b>${esc(row[1])}</b></div>`).join(""):'<div class="paco-tools-result-row"><span>Resultado</span><b>Sin datos adicionales para mostrar</b></div>'}</div>
    ${actions.length?`<div class="paco-tools-result-actions">${actions.map(action=>actionHtml(action)).join("")}</div>`:""}`;
  box.scrollIntoView({block:"nearest",behavior:matchMedia?.("(prefers-reduced-motion: reduce)")?.matches?"auto":"smooth"});
}
function actionHtml(action){
  if(action.orderId)return `<button type="button" data-paco-advanced-open-order="${esc(action.orderId)}">${esc(action.label)}</button>`;
  if(action.route)return `<button type="button" data-paco-advanced-route="${esc(action.route)}">${esc(action.label)}</button>`;
  if(action.prompt)return `<button type="button" data-paco-advanced-prompt="${esc(action.prompt)}">${esc(action.label)}</button>`;
  return"";
}
function renderError(root,title,error){renderResult(root,title,[["Detalle",error?.message||"No fue posible completar la consulta"]],[{label:"Actualizar vista",prompt:"¿Qué fue lo último que falló?"}])}

function submitPrompt(root,prompt){
  const input=root.querySelector("[data-paco-input]");
  const form=root.querySelector("[data-paco-form]");
  if(!input||!form)return;
  input.value=prompt;
  input.focus();
  if(prompt.trim())form.requestSubmit();
}

function profileRows(){
  const roles=state.profile?.roles||[];
  const readable=state.modules.filter(mod=>mod.canRead);
  const writable=state.modules.filter(mod=>mod.canCreate||mod.canUpdate||mod.canApprove||mod.canAdmin);
  const adminModules=state.modules.filter(mod=>mod.canAdmin);
  return [
    ["Usuario",state.profile?.name||state.profile?.displayName||state.profile?.display_name||"Sesión activa"],
    ["Roles",roles.length?roles.join(", "):"Sin roles declarados"],
    ["Módulos visibles",String(readable.length)],
    ["Módulos con acciones",String(writable.length)],
    ["Administración",String(adminModules.length)]
  ];
}

function attentionScore(row){
  const status=String(row.status||row.taskStatus||row.task_status||"").toUpperCase();
  const overdue=Boolean(row.slaExceeded??row.sla_exceeded??row.overdue??row.isOverdue);
  const blocked=/BLOCK|WAIT|HOLD|PAUS|EXCEPTION|INCIDENT/.test(status);
  const assignee=row.assigneeName||row.assignedToName||row.assigned_to_name||row.assignedTo||row.assigned_to;
  return (overdue?5:0)+(blocked?3:0)+(!assignee?1:0);
}
function orderLabel(row){return String(row.orderNumber||row.order_number||row.number||row.id||"Pedido")}

async function runTool(root,id){
  const tool=TOOLS.find(item=>item.id===id);
  if(!tool||!allowed(tool))return;
  if(tool.route){navigate(tool.route);setToolsOpen(root,false);root.querySelector("[data-paco-close]")?.click();return}

  try{
    if(id==="permissions"){
      renderResult(root,"Mi acceso actual",profileRows(),[
        ...(can("admin","canRead")?[{label:"Abrir Administración",route:"admin"}]:[]),
        {label:"Ver todo lo que hace Paco",prompt:"Ver todo lo que puede hacer Paco"}
      ]);return;
    }

    if(id==="attention"){
      setLoading(root,"Revisando pedidos visibles…");
      const data=await api.listOrders({page:1,pageSize:80,includeHistory:false,assignment:"ALL"});
      const items=Array.isArray(data?.items)?data.items:Array.isArray(data)?data:[];
      const ranked=items.map(row=>({row,score:attentionScore(row)})).filter(item=>item.score>0).sort((a,b)=>b.score-a.score);
      const overdue=items.filter(row=>Boolean(row.slaExceeded??row.sla_exceeded??row.overdue??row.isOverdue)).length;
      const rows=[["Pedidos revisados",String(items.length)],["Con señal de atención",String(ranked.length)],["Con SLA señalado",String(overdue)]];
      const actions=ranked.slice(0,6).map(item=>({label:`Abrir ${orderLabel(item.row)}`,orderId:item.row.id||item.row.orderId})).filter(item=>item.orderId);
      actions.push({label:"Ir a Pedidos",route:"orders"});
      renderResult(root,"Pedidos que requieren revisión",rows,actions);return;
    }

    if(id==="exceptions"){
      setLoading(root,"Consultando excepciones…");
      const data=await api.exceptionSummary();
      renderResult(root,"Resumen de excepciones",flatten(data),[{label:"Abrir Excepciones",route:"approvals"}]);return;
    }

    if(id==="my-day"){
      setLoading(root,"Consultando tu jornada…");
      const data=await api.workMyDay();
      renderResult(root,"Mi jornada de hoy",flatten(data),[{label:"Abrir Jornada",route:"workforce"},{label:"Ver Flujo y tiempos",route:"vsm"}]);return;
    }

    if(id==="inventory-health"){
      setLoading(root,"Revisando reservas e inventario…");
      const data=await api.materialReservationHealth();
      renderResult(root,"Salud de inventario",flatten(data),[{label:"Abrir Inventario",route:"inventory"}]);return;
    }

    if(id==="last-error"){
      if(!lastRpcError){renderResult(root,"Último error",[["Estado","No se han detectado errores RPC en esta sesión"]],[{label:"Abrir Auditoría",route:"audit"}]);return}
      renderResult(root,"Último error RPC",[["Operación",lastRpcError.rpc||"CRM"],["Código",lastRpcError.code||"—"],["Detalle",lastRpcError.message||"Sin detalle"]],[{label:"Preguntar a Paco",prompt:"¿Qué fue lo último que falló?"},{label:"Abrir Auditoría",route:"audit"}]);return;
    }

    if(id==="system-health"){
      setLoading(root,"Consultando salud del CRM…");
      const data=await api.health();
      renderResult(root,"Salud del CRM",flatten(data),[{label:"Abrir Administración",route:"admin"},{label:"Abrir Auditoría",route:"audit"}]);return;
    }

    if(id==="refresh"){
      window.dispatchEvent(new CustomEvent("erp:refresh"));
      window.__erpOrderListRefresh?.();
      toast("Paco actualizó la vista actual.");
      renderResult(root,"Vista actualizada",[["Módulo",state.currentModule||"CRM"],["Estado","Solicitud de actualización enviada"]]);return;
    }
  }catch(error){renderError(root,tool.label,error)}
}

function augmentQuick(root){
  const quick=root.querySelector("[data-paco-quick]");
  if(!quick||quick.querySelector("[data-paco-command-shortcut]"))return;
  const button=document.createElement("button");
  button.type="button";
  button.dataset.pacoCommandShortcut="1";
  button.innerHTML="⚡ Herramientas";
  button.addEventListener("click",()=>setToolsOpen(root,true));
  quick.append(button);
}

function wireRoot(root){
  if(!root)return;
  renderCommandCenter(root);
  augmentQuick(root);
  root.dataset.pacoCommandCenterVersion=VERSION;

  rootObserver?.disconnect();
  rootObserver=new MutationObserver(()=>{
    renderCommandCenter(root);
    augmentQuick(root);
  });
  rootObserver.observe(root,{subtree:true,childList:true});
}

function ensure(){
  scheduled=false;
  const root=document.querySelector("#paco-bot");
  if(root&&root.dataset.pacoCommandCenterVersion!==VERSION)wireRoot(root);
  else if(root){renderCommandCenter(root);augmentQuick(root)}
}
function schedule(){if(scheduled)return;scheduled=true;requestAnimationFrame(ensure)}

function boot(){
  window.addEventListener("erp:rpc-error",event=>{lastRpcError=event.detail||null});
  schedule();
  bodyObserver=new MutationObserver(schedule);
  bodyObserver.observe(document.body,{childList:true,subtree:true});
  window.addEventListener("pageshow",schedule,{passive:true});
}

if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot,{once:true});
else boot();
