import {state,subscribe,hasRole,can} from "../core/state.js";
import {navigate} from "../core/router.js";
import {getSupabase} from "../services/supabase.js";
import {api} from "../services/api.js";
import {fmt} from "../core/format.js";
import {toast} from "../core/ui.js";

/* CRM Suministros · Paco Assistant V11.20.0
   Single-owner architecture: one DOM, one state, one event pipeline and one visual namespace.
   No MutationObservers, no visual bridge, no visibility guard and no secondary command-center runtime. */

const VERSION="11.20.0";
const ASSETS=Object.freeze({
  idle:"./assets/img/paco/paco-idle-v11183.svg",
  listening:"./assets/img/paco/paco-listening-v11183.svg",
  thinking:"./assets/img/paco/paco-thinking-v11183.svg",
  talking:"./assets/img/paco/paco-talking-v11183.svg",
  wink:"./assets/img/paco/paco-wink-v11183.svg",
  success:"./assets/img/paco/paco-success-v11183.svg"
});

const MODULE_META={
  dashboard:{label:"Centro de operaciones",keywords:["inicio","dashboard","centro","indicadores"],help:"Revisa cargas, alertas, pedidos activos y prioridades generales."},
  orders:{label:"Pedidos",keywords:["pedido","pedidos","orden","buscar pedido","corregir pedido"],help:"Consulta expediente, estado, responsable, materiales, incidencias y trazabilidad."},
  sales:{label:"Ventas y pedidos",keywords:["venta","ventas","crear pedido","nuevo pedido","cliente"],help:"Crea pedidos y registra la información comercial y de entrega."},
  credit:{label:"Crédito",keywords:["credito","crédito","cupo"],help:"Radica, revisa y decide solicitudes de crédito."},
  cartera:{label:"Cartera",keywords:["cartera","mora","validacion financiera"],help:"Valida cartera y libera pedidos que requieren revisión financiera."},
  caja:{label:"Caja",keywords:["caja","retenido","pvn","caja facturacion"],help:"Gestiona validaciones de Caja y liberaciones asociadas."},
  purchasing:{label:"Compras",keywords:["compra","compras","abastecimiento","pve"],help:"Gestiona necesidades de compra y llegada de mercancía."},
  receiving:{label:"Recepción",keywords:["recepcion","recepción","recibir","mercancia","mercancía"],help:"Confirma recepción documental o física y asigna el siguiente paso."},
  picking:{label:"Alistamiento",keywords:["alistamiento","picking","faltante"],help:"Verifica materiales, origen físico y faltantes antes de continuar."},
  cutting:{label:"Centro de corte",keywords:["corte","cortar","carreto","merma"],help:"Ejecuta el corte guiado por referencia, carreto, plan y evidencia."},
  billing:{label:"Facturación",keywords:["factura","facturacion","facturación","facturar"],help:"Registra factura y soportes necesarios para liberar el pedido."},
  shipping:{label:"Despachos y entregas",keywords:["despacho","entrega","guia","guía","transportadora","cierre"],help:"Gestiona guía, salida, entrega, evidencia y cierre."},
  inventory:{label:"Inventario",keywords:["inventario","stock","lote","ubicacion","ubicación","reservado"],help:"Consulta físico, reservado, bloqueado, disponible, lotes y movimientos."},
  workforce:{label:"Jornada y actividades",keywords:["jornada","actividad","productividad","tiempo"],help:"Registra trabajo, pausas, evidencias, agenda y productividad."},
  approvals:{label:"Excepciones y aprobaciones",keywords:["aprobacion","aprobación","excepcion","excepción","bloqueo","novedad"],help:"Gestiona novedades, bloqueos, solicitudes de aprobación y SLA."},
  vsm:{label:"Flujo y tiempos",keywords:["flujo","tiempos","vsm","cuello de botella","sla"],help:"Analiza lead time, espera, touch time, WIP y cuellos de botella."},
  reports:{label:"Analítica y reportes",keywords:["analitica","analítica","reporte","excel","kpi"],help:"Explora KPIs, tendencias, calidad del dato y exportaciones."},
  imports:{label:"Histórico",keywords:["historico","histórico","archivo","csv"],help:"Consulta expedientes históricos, importaciones y cobertura."},
  audit:{label:"Auditoría",keywords:["auditoria","auditoría","trazabilidad","quien hizo","quién hizo"],help:"Consulta decisiones, eventos y cambios registrados por el sistema."},
  admin:{label:"Administración",keywords:["administracion","administración","usuario","usuarios","rol","roles","permiso","permisos","calendario","secuencia","ciclo"],help:"Controla usuarios, permisos, flujo, SLA, calendarios, catálogos y configuración."}
};

const STEP_MODULE={
  CARTERA:"cartera",CAJA:"caja",CAJA_FACTURACION:"caja",COMPRAS:"purchasing",RECEPCION_MERCANCIA:"receiving",RECEPCION_PEDIDO:"receiving",
  ALISTAMIENTO:"picking",CORTE:"cutting",FACTURACION:"billing",CLIENT_POINT:"shipping",CLIENT_PICKUP:"shipping",LOCAL_DISPATCH:"shipping",NATIONAL_DISPATCH:"shipping",CLOSURE:"shipping",CLOSED:"orders"
};

const GUIDES=[
  {id:"create-order",title:"Crear un pedido",module:"sales",keywords:["crear pedido","nuevo pedido","registrar pedido","hacer pedido"],steps:[["Cliente y pedido","Registra cliente, condición comercial, prioridad, ruta y dirección."],["Materiales","Selecciona referencias oficiales y cantidades o cortes."],["Revisión","Valida el resumen antes de confirmar; el workflow define la primera etapa."]]},
  {id:"find-order",title:"Buscar o revisar un pedido",module:"orders",keywords:["buscar pedido","ver pedido","consultar pedido","encontrar pedido","revisar pedido"],steps:[["Busca","Escribe el número exacto del pedido."],["Diagnostica","Paco revisa etapa, responsable, incidencias y acciones visibles."],["Continúa","Abre el expediente o el módulo operativo correcto."]]},
  {id:"correct-order",title:"Corregir un pedido",module:"orders",keywords:["corregir pedido","editar pedido","arreglar pedido","modificar pedido"],steps:[["Identifica","Ubica el pedido y su etapa actual."],["Valida permisos","La corrección depende del estado y de tu rol."],["Conserva trazabilidad","Si el flujo avanzó, registra novedad o utiliza aprobación en vez de alterar estados por fuera del proceso."]]},
  {id:"unblock",title:"Diagnosticar un pedido detenido",module:"approvals",keywords:["destrabar","desbloquear pedido","pedido bloqueado","atascado","estancado","no avanza"],steps:[["Diagnóstico","Revisa estado, etapa, responsable e incidencias."],["Causa","Determina si espera responsable, aprobación, material, documento o SLA."],["Resolución","Usa la acción autorizada del módulo correspondiente."]]},
  {id:"inventory",title:"Consultar o corregir inventario",module:"inventory",keywords:["ajustar inventario","corregir inventario","ver disponible","ver reservado","stock disponible","movimiento inventario","lote"],steps:[["Busca","Usa referencia, descripción, lote o ubicación."],["Verifica","Compara físico, reservado, bloqueado y disponible."],["Ajusta","Si tu rol lo permite, registra el movimiento o ajuste con motivo y trazabilidad."]]},
  {id:"receiving",title:"Resolver Recepción",module:"receiving",keywords:["como recibir","cómo recibir","recepcion mercancia","recepción mercancía","recepcion pedido"],steps:[["Pedido","Abre la tarea asignada."],["Soporte","Verifica mercancía o documento según el proceso."],["Resultado","Registra el resultado y evidencia cuando aplique."]]},
  {id:"picking",title:"Resolver Alistamiento",module:"picking",keywords:["alistamiento","picking","faltante material","material no aparece"],steps:[["Pedido","Abre la tarea asignada."],["Materiales","Confirma cantidades y origen físico."],["Novedad","Si falta material, registra la excepción antes de avanzar."]]},
  {id:"cutting",title:"Trabajar una referencia en Corte",module:"cutting",keywords:["como cortar","cómo cortar","hacer corte","usar corte","carreto","merma corte"],steps:[["Referencia","Selecciona una referencia pendiente."],["Origen","Selecciona carreto o lote y confirma cantidad."],["Ejecución","Revisa plan, corte y merma."],["Cierre","Adjunta evidencia y finaliza."]]},
  {id:"billing",title:"Resolver Facturación",module:"billing",keywords:["facturar","registrar factura","error factura","factura no carga"],steps:[["Pedido","Confirma que esté en Facturación."],["Documento","Registra número, fecha, valor y soporte."],["Validación","Corrige datos faltantes antes de completar."]]},
  {id:"shipping",title:"Resolver despacho o entrega",module:"shipping",keywords:["despachar","entregar pedido","guia transportadora","guía transportadora","pedido no entregado"],steps:[["Ruta","Confirma el tipo de entrega."],["Despacho","Registra guía o salida cuando aplique."],["Entrega","Adjunta evidencia y resultado."],["Cierre","Completa la verificación final."]]},
  {id:"workflow",title:"Corregir flujo, etapa o SLA",module:"admin",keywords:["corregir ciclo","cambiar ciclo","flujo incorrecto","cambiar sla","configurar sla","workflow","cambiar etapa","etapa incorrecta"],steps:[["Impacto","Identifica etapa, SLA, rol y pedidos afectados."],["Gobierno","Modifica el parámetro únicamente desde Administración."],["Validación","Comprueba el efecto en Flujo y tiempos."]]},
  {id:"reports",title:"Analizar o exportar información",module:"reports",keywords:["exportar excel","hacer reporte","analizar datos","crear analisis","crear análisis","kpi","reporte"],steps:[["Periodo","Selecciona el rango."],["Dominio","Escoge el conjunto de datos."],["Explora","Combina dimensión y métrica."],["Exporta","Utiliza XLSX, CSV, JSON o impresión/PDF."]]},
  {id:"history",title:"Consultar Histórico",module:"imports",keywords:["historico","histórico","pedido antiguo","importar csv","archivo historico"],steps:[["Busca","Filtra por pedido, cliente o fecha."],["Expediente","Revisa materiales, facturación, entregas, flujo y trazabilidad."],["Importaciones","Consulta lotes y errores de carga."]]},
  {id:"audit",title:"Revisar trazabilidad",module:"audit",keywords:["quien cambio","quién cambió","auditoria","auditoría","trazabilidad","quien hizo"],steps:[["Filtra","Ubica entidad, pedido o periodo."],["Evento","Consulta actor, acción y metadatos."],["Contrasta","Abre el expediente cuando necesites contexto operativo."]]},
  {id:"users",title:"Usuarios, roles y permisos",module:"admin",keywords:["crear usuario","usuario no entra","permiso faltante","rol incorrecto","cambiar rol","activar usuario","desactivar usuario"],steps:[["Perfil","Verifica que el usuario tenga perfil operativo activo."],["Rol","Comprueba roles asignados."],["Permisos","Revisa lectura, creación, actualización, aprobación y administración por módulo."]]},
  {id:"workforce",title:"Jornada y productividad",module:"workforce",keywords:["registrar actividad","jornada","pausa","productividad","tiempo muerto","actividad usuario"],steps:[["Actividad","Inicia o registra la actividad correcta."],["Pausa","Registra pausas cuando correspondan."],["Cierre","Completa resultado y evidencia."],["Análisis","Revisa productividad en Jornada y Flujo y tiempos."]]}
];

const TOOLS=[
  {id:"permissions",icon:"◉",label:"Mi acceso",detail:"Roles, módulos y capacidades visibles"},
  {id:"attention",icon:"!",label:"Pedidos a revisar",detail:"SLA, bloqueos y trabajo sin responsable",module:"orders"},
  {id:"exceptions",icon:"◆",label:"Excepciones",detail:"Novedades y aprobaciones",module:"approvals"},
  {id:"my-day",icon:"◷",label:"Mi jornada",detail:"Actividad y estado operativo de hoy",module:"workforce"},
  {id:"inventory-health",icon:"▣",label:"Inventario",detail:"Salud de reservas y disponibilidad",module:"inventory"},
  {id:"flow",icon:"↗",label:"Flujo y tiempos",detail:"SLA, esperas y cuellos de botella",module:"vsm",route:"vsm"},
  {id:"reports",icon:"▥",label:"Analítica",detail:"KPIs, exploración y exportaciones",module:"reports",route:"reports"},
  {id:"last-error",icon:"⚠",label:"Último error",detail:"Último fallo RPC detectado en esta sesión"},
  {id:"system-health",icon:"✓",label:"Salud del CRM",detail:"Diagnóstico técnico del backend",admin:true},
  {id:"users",icon:"♙",label:"Usuarios y permisos",detail:"Centro de Control Administrativo",module:"admin",admin:true,route:"admin"},
  {id:"audit",icon:"⌁",label:"Auditoría",detail:"Eventos, cambios y trazabilidad",module:"audit",route:"audit"},
  {id:"refresh",icon:"↻",label:"Actualizar vista",detail:"Recargar datos del módulo actual"}
];

const CAPABILITIES=[
  ["⌕","Pedidos","Buscar, diagnosticar, abrir expedientes y detectar bloqueos.","Ayuda con pedidos"],
  ["↗","Flujo y SLA","Etapas, tiempos, responsables, cuellos de botella y ciclos.","Ayuda con flujo y SLA"],
  ["▣","Inventario","Stock, lotes, reservado, bloqueado, movimientos y ajustes.","Ayuda con inventario"],
  ["✂","Corte","Referencia, carreto, merma, ejecución, evidencia y cierre.","Ayuda con corte"],
  ["▤","Facturación","Factura, soportes, errores y liberación.","Ayuda con facturación"],
  ["→","Despachos","Rutas, guías, transportadora, entrega, evidencia y cierre.","Ayuda con despachos"],
  ["◷","Jornada","Actividad, pausas, evidencias, agenda y productividad.","Ayuda con jornada"],
  ["▥","Analítica","KPIs, BI, calidad del dato y exportaciones.","Ayuda con analítica y reportes"],
  ["⌁","Auditoría","Cambios, actor, fecha y trazabilidad.","Ayuda con auditoría"],
  ["⚙","Administración","Usuarios, permisos, workflow, SLA y sistema.","Ayuda con administración"]
];

const paco={root:null,messages:[],busy:false,lastRpcError:null,unsubscribe:null,globalBound:false,face:"idle"};

function uid(){return globalThis.crypto?.randomUUID?.()||`paco-${Date.now()}-${Math.random().toString(36).slice(2)}`}
function esc(value){return fmt.escape(String(value??""))}
function norm(value){return String(value||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/\s+/g," ").trim()}
function pretty(value){return String(value||"").replaceAll("_"," ").toLowerCase().replace(/(^|\s)\S/g,m=>m.toUpperCase())}
function arrayFrom(value){return Array.isArray(value)?value:Array.isArray(value?.items)?value.items:Array.isArray(value?.actions)?value.actions:Array.isArray(value?.data)?value.data:[]}
function currentModule(){return state.currentModule||document.querySelector(".nav-item.active")?.dataset?.module||"dashboard"}
function currentModuleLabel(){return MODULE_META[currentModule()]?.label||"CRM Suministros"}
function allowed(moduleId){return !moduleId||can(moduleId,"canRead")||moduleId===currentModule()}
function isAdmin(){return hasRole("super_admin")||can("admin","canRead")}
function isOpen(){return Boolean(paco.root?.classList.contains("is-open"))}

function renderRoot(){
  return `<div id="paco-bot" class="paco2-root" data-paco-version="${VERSION}" hidden>
    <button type="button" class="paco2-launcher" aria-label="Abrir Paco Bot" aria-expanded="false" data-paco2-toggle>
      <img class="paco2-launcher-face" src="${ASSETS.idle}" alt="" aria-hidden="true" draggable="false">
      <span class="paco2-launcher-dot" aria-hidden="true"></span>
      <span class="paco2-launcher-bolt" aria-hidden="true">⚡</span>
    </button>
    <section class="paco2-panel" role="dialog" aria-label="Paco Bot, asistente del CRM" aria-modal="false">
      <header class="paco2-head">
        <img class="paco2-head-face" src="${ASSETS.idle}" alt="" aria-hidden="true" draggable="false" data-paco2-face>
        <div class="paco2-head-copy"><span>Asistente del CRM</span><strong>Paco Bot</strong><small data-paco2-head-context>${esc(currentModuleLabel())}</small></div>
        <button type="button" class="paco2-close" aria-label="Cerrar Paco Bot" data-paco2-close>×</button>
      </header>
      <div class="paco2-context">
        <span class="paco2-online" aria-hidden="true"></span>
        <div>Contexto actual: <strong data-paco2-context>${esc(currentModuleLabel())}</strong></div>
        <button type="button" class="paco2-context-btn" data-paco2-action="context-list">Cambiar contexto</button>
        <button type="button" class="paco2-tools-btn" aria-expanded="false" data-paco2-tools-toggle><span aria-hidden="true">⚡</span> Herramientas</button>
      </div>
      <section class="paco2-tools" aria-label="Herramientas de Paco" data-paco2-tools>
        <div class="paco2-tools-head"><div><strong>Centro de herramientas</strong><small>Diagnóstico y accesos según tus permisos</small></div><button type="button" data-paco2-tools-close aria-label="Cerrar herramientas">×</button></div>
        <div class="paco2-tools-grid" data-paco2-tools-grid></div>
        <div class="paco2-tools-result" data-paco2-tools-result hidden></div>
      </section>
      <div class="paco2-messages" data-paco2-messages aria-live="polite"></div>
      <div class="paco2-quick" data-paco2-quick></div>
      <form class="paco2-composer" data-paco2-form>
        <textarea rows="1" maxlength="700" aria-label="Escribe tu pregunta a Paco" placeholder="Escribe tu pregunta aquí…" data-paco2-input></textarea>
        <button type="submit" class="paco2-send" aria-label="Enviar" data-paco2-send>➜</button>
      </form>
      <div class="paco2-safe-note">◇ Paco ejecuta únicamente acciones seguras permitidas por tu sesión</div>
    </section>
  </div>`;
}

function setFace(name="idle"){
  paco.face=name;
  const src=ASSETS[name]||ASSETS.idle;
  paco.root?.querySelectorAll("[data-paco2-face],.paco2-launcher-face").forEach(img=>{if(img.getAttribute("src")!==src)img.setAttribute("src",src)});
  paco.root?.dataset&&(paco.root.dataset.pacoExpression=name);
}
function setOpen(open){
  if(!paco.root)return;
  paco.root.classList.toggle("is-open",Boolean(open));
  paco.root.classList.remove("is-tools-open");
  const launcher=paco.root.querySelector("[data-paco2-toggle]");
  launcher?.setAttribute("aria-expanded",String(Boolean(open)));
  launcher?.setAttribute("aria-label",open?"Cerrar Paco Bot":"Abrir Paco Bot");
  paco.root.querySelector("[data-paco2-tools-toggle]")?.setAttribute("aria-expanded","false");
  if(open){
    ensureWelcome();
    updateContext();
    setFace("listening");
    requestAnimationFrame(()=>setTimeout(()=>paco.root?.querySelector("[data-paco2-input]")?.focus(),80));
  }else setFace("idle");
}
function toggleOpen(){setOpen(!isOpen())}
function setToolsOpen(open){
  if(!paco.root||!isOpen())return;
  paco.root.classList.toggle("is-tools-open",Boolean(open));
  const toggle=paco.root.querySelector("[data-paco2-tools-toggle]");
  toggle?.setAttribute("aria-expanded",String(Boolean(open)));
  if(open){renderTools();requestAnimationFrame(()=>paco.root?.querySelector("[data-paco2-tool]")?.focus())}
}

function message({role="assistant",text="",steps=[],actions=[],type="normal",card=null,alert=null,catalog=null}={}){return {id:uid(),role,text,steps,actions,type,card,alert,catalog}}
function actionHtml(action){
  return `<button type="button" class="paco2-action ${esc(action.kind||"")}" data-paco2-action="${esc(action.action||"")}"${action.module?` data-module="${esc(action.module)}"`:""}${action.orderId?` data-order-id="${esc(action.orderId)}"`:""}${action.prompt?` data-prompt="${esc(action.prompt)}"`:""}>
    <span class="paco2-action-icon">${esc(action.icon||"→")}</span><span class="paco2-action-copy"><b>${esc(action.label||"Continuar")}</b>${action.sub?`<small>${esc(action.sub)}</small>`:""}</span><span class="paco2-action-arrow">›</span>
  </button>`;
}
function catalogHtml(){
  return `<div class="paco2-cap-grid">${CAPABILITIES.map(item=>`<button type="button" class="paco2-cap" data-paco2-action="prompt" data-prompt="${esc(item[3])}"><span>${esc(item[0])}</span><div><b>${esc(item[1])}</b><small>${esc(item[2])}</small></div></button>`).join("")}</div>`;
}
function passwordHtml(){return `<form class="paco2-password" data-paco2-password-form autocomplete="off"><label>Nueva contraseña<input type="password" name="password" minlength="10" autocomplete="new-password" required></label><label>Confirmar contraseña<input type="password" name="confirm" minlength="10" autocomplete="new-password" required></label><small>10+ caracteres con mayúscula, minúscula y número. Paco no guarda este valor.</small><button type="submit">Actualizar mi contraseña</button></form>`}
function messageHtml(item){
  if(item.role==="user")return `<article class="paco2-message user"><div class="paco2-bubble"><div class="paco2-text">${esc(item.text)}</div></div></article>`;
  if(item.type==="typing")return `<article class="paco2-message assistant"><img class="paco2-mini" src="${ASSETS.thinking}" alt="" aria-hidden="true"><div class="paco2-bubble"><span class="paco2-typing"><i></i><i></i><i></i></span></div></article>`;
  const steps=item.steps?.length?`<div class="paco2-steps">${item.steps.map((step,index)=>`<div class="paco2-step"><span>${index+1}</span><div><strong>${esc(step[0])}</strong><small>${esc(step[1])}</small></div></div>`).join("")}</div>`:"";
  const card=item.card?`<div class="paco2-data-card">${item.card.map(row=>`<div><small>${esc(row[0])}</small><b>${esc(row[1])}</b></div>`).join("")}</div>`:"";
  const alert=item.alert?`<div class="paco2-alert"><strong>${esc(item.alert.title||"Atención")}</strong><span>${esc(item.alert.text||"")}</span></div>`:"";
  const actions=(item.actions||[]).filter(action=>allowed(action.module));
  const body=item.type==="welcome"?`<span class="paco2-welcome-title">Soy Paco Bot</span><div class="paco2-text">${esc(item.text)}</div><span class="paco2-welcome-question">¿En qué puedo ayudarte hoy?</span>`:`<div class="paco2-text">${esc(item.text)}</div>`;
  return `<article class="paco2-message assistant ${item.type==="welcome"?"welcome":""}"><img class="paco2-mini" src="${item.type==="success"?ASSETS.success:ASSETS.idle}" alt="" aria-hidden="true"><div class="paco2-bubble">${body}${steps}${card}${alert}${item.type==="password"?passwordHtml():""}${item.catalog?catalogHtml():""}${actions.length?`<div class="paco2-actions">${actions.map(actionHtml).join("")}</div>`:""}</div></article>`;
}
function renderMessages(){
  const box=paco.root?.querySelector("[data-paco2-messages]");
  if(!box)return;
  box.innerHTML=paco.messages.map(messageHtml).join("");
  box.scrollTop=box.scrollHeight;
  bindPasswordForms();
}
function add(item){paco.messages.push(item);renderMessages()}
function typing(){paco.messages=paco.messages.filter(item=>item.type!=="typing");paco.messages.push(message({type:"typing"}));renderMessages();setFace("thinking")}
function replaceTyping(item){paco.messages=paco.messages.filter(row=>row.type!=="typing");if(item)paco.messages.push(item);renderMessages()}
function setBusy(value){paco.busy=Boolean(value);const send=paco.root?.querySelector("[data-paco2-send]");if(send)send.disabled=paco.busy}

function ensureWelcome(){
  if(paco.messages.length)return;
  const name=state.profile?.displayName||state.profile?.display_name||state.profile?.name||"";
  add(message({type:"welcome",text:`${name?`Hola, ${name}. `:""}Puedo explicarte procesos, llevarte al módulo correcto, buscar y diagnosticar pedidos, revisar señales operativas y ayudarte con errores del CRM sin saltar permisos.`,actions:[
    {label:"Buscar un pedido",sub:"Estado, etapa y bloqueos",icon:"⌕",kind:"primary",action:"prompt",prompt:"Buscar pedido "},
    {label:"Ayuda del módulo",sub:currentModuleLabel(),icon:"?",action:"context-help"},
    {label:"Cambiar mi contraseña",sub:"Mi propia cuenta",icon:"⌂",action:"password-self"},
    {label:"Diagnosticar pedido",sub:"Encontrar qué lo detiene",icon:"⚙",action:"prompt",prompt:"Diagnosticar pedido "},
    {label:"Centro de herramientas",sub:"Diagnósticos según permisos",icon:"⚡",kind:"warning",action:"tools"},
    {label:"Ver todas las capacidades",sub:"Centro completo de ayuda",icon:"☷",action:"all-help"}
  ]}));
}

function quickPrompts(){
  const map={orders:["Buscar pedido","Corregir pedido","Destrabar pedido","Herramientas"],sales:["Crear pedido","Buscar pedido","Cambiar mi clave","Herramientas"],cutting:["¿Cómo hago el corte?","Destrabar pedido","Flujo y tiempos","Herramientas"],inventory:["Corregir inventario","Ver disponible","Exportar reporte","Herramientas"],admin:["Usuarios y permisos","Corregir flujo o SLA","Diagnóstico del sistema","Herramientas"],reports:["Crear análisis","Exportar Excel","Calidad del dato","Herramientas"],workforce:["Registrar actividad","Ver productividad","Mi jornada","Herramientas"]};
  return map[currentModule()]||["Buscar pedido","¿Cómo hago esto?","Cambiar mi clave","Herramientas"];
}
function renderQuick(){const row=paco.root?.querySelector("[data-paco2-quick]");if(row)row.innerHTML=quickPrompts().map(text=>`<button type="button" data-paco2-quick="${esc(text)}">${esc(text)}</button>`).join("")}
function updateContext(){const label=currentModuleLabel();paco.root?.querySelectorAll("[data-paco2-context],[data-paco2-head-context]").forEach(node=>node.textContent=label);renderQuick()}

function guideFor(input){const text=norm(input);let best=null,score=0;for(const guide of GUIDES){let current=0;for(const keyword of guide.keywords){const k=norm(keyword);if(text.includes(k))current+=Math.max(2,k.split(" ").length*2)}if(current>score){score=current;best=guide}}return score?best:null}
function moduleFor(input){const text=norm(input);let best=null,score=0;for(const [id,meta] of Object.entries(MODULE_META)){let current=0;for(const keyword of meta.keywords){const k=norm(keyword);if(text.includes(k))current+=k.split(" ").length}if(current>score){score=current;best={id,...meta}}}return score?best:null}
function orderTerm(input){const raw=String(input||"");const explicit=raw.match(/(?:pedido|orden)\s*(?:#|n[úu]mero|no\.?|nro\.?|:)?\s*([A-Za-z0-9][A-Za-z0-9._/-]{2,})/i)?.[1];if(explicit&&!/^(bloqueado|atascado|estancado|pendiente|que|como|cómo)$/i.test(explicit))return explicit;return raw.match(/\b[A-Za-z]{1,8}[-_]\d{2,}[A-Za-z0-9-]*\b/)?.[0]||raw.match(/\b\d{4,}\b/)?.[0]||""}
function guideMessage(guide){return message({text:`${guide.title}. Te explico el flujo correcto sin saltar controles.`,steps:guide.steps,actions:[{label:`Abrir ${MODULE_META[guide.module]?.label||"módulo"}`,sub:"Ir al proceso",icon:"→",kind:"primary",action:"navigate",module:guide.module},...(guide.id==="find-order"?[{label:"Buscar pedido",sub:"Diagnóstico por número",icon:"⌕",action:"prompt",prompt:"Buscar pedido "}]:[])]})}

async function diagnoseOrder(term){
  if(!term)return message({text:"Dime el número exacto del pedido para revisarlo.",actions:[{label:"Escribir número",sub:"Ejemplo: 45832",icon:"⌕",kind:"primary",action:"prompt",prompt:"Diagnosticar pedido "}]});
  const list=await api.listOrders({search:term,page:1,pageSize:8,includeHistory:true,assignment:"ALL"});
  const rows=list?.items||[];
  if(!rows.length)return message({text:`No encontré pedidos visibles para “${term}”.`,actions:[{label:"Abrir Pedidos",sub:"Buscar manualmente",icon:"→",action:"navigate",module:"orders"}]});
  if(rows.length>1)return message({text:`Encontré ${rows.length} coincidencias. Elige cuál revisar.`,actions:rows.slice(0,6).map(row=>({label:`${row.orderNumber||row.order_number||"Pedido"} · ${row.clientName||row.client_name||"Cliente"}`,sub:"Diagnosticar",icon:"⌕",action:"diagnose-order-id",orderId:row.id}))});
  return diagnoseOrderByRow(rows[0]);
}
async function diagnoseOrderById(id){const detail=await api.getOrder(id);return diagnoseOrderByRow(detail?.order||detail||{id})}
async function diagnoseOrderByRow(row){
  const id=row.id||row.orderId;
  const [actionResult,issueResult,detailResult]=await Promise.allSettled([id?api.getActions(id):Promise.resolve([]),id?api.orderIssues(id):Promise.resolve([]),id?api.getOrder(id):Promise.resolve(row)]);
  const detail=detailResult.status==="fulfilled"?(detailResult.value?.order||detailResult.value||row):row;
  const actions=actionResult.status==="fulfilled"?arrayFrom(actionResult.value):[];
  const issues=issueResult.status==="fulfilled"?arrayFrom(issueResult.value):[];
  const openIssues=issues.filter(issue=>!["RESOLVED","CLOSED","CANCELLED"].includes(String(issue.status||"").toUpperCase()));
  const step=detail.currentStep||detail.current_step_code||row.currentStep||row.stepCode||"";
  const stepName=detail.stepName||detail.currentStepName||row.stepName||pretty(step)||"Sin etapa";
  const status=detail.status||row.status||"Sin estado";
  const assignee=detail.assigneeName||detail.assignedToName||row.assigneeName||"En cola / sin asignar";
  const number=detail.orderNumber||detail.order_number||row.orderNumber||row.order_number||"Pedido";
  const moduleId=STEP_MODULE[String(step).toUpperCase()]||"orders";
  const warning=openIssues.length?`${openIssues.length} incidencia(s) abierta(s) pueden estar reteniendo el flujo.`:(row.slaExceeded||row.sla_exceeded?"El pedido aparece con plazo excedido.":(!actions.length?"No veo acciones operativas disponibles para tu usuario en este momento.":null));
  return message({text:`Diagnóstico de ${number}: está en ${stepName} con estado ${pretty(status)}.`,card:[["Cliente",detail.clientName||detail.client_name||row.clientName||"—"],["Responsable",assignee],["Acciones visibles",String(actions.length)],["Incidencias abiertas",String(openIssues.length)]],alert:warning?{title:"Atención",text:warning}:null,actions:[...(id?[{label:"Abrir expediente",sub:"Ver el pedido completo",icon:"→",kind:"primary",action:"open-order",orderId:id,module:"orders"}]:[]),...(moduleId!=="orders"?[{label:`Ir a ${MODULE_META[moduleId]?.label||"etapa"}`,sub:"Abrir etapa actual",icon:"↗",action:"navigate",module:moduleId}]:[]),...(openIssues.length?[{label:"Abrir Excepciones",sub:"Resolver incidencias",icon:"!",kind:"warning",action:"navigate",module:"approvals"}]:[])]});
}

function contextHelp(){const id=currentModule(),meta=MODULE_META[id];if(!meta)return message({text:"Dime qué quieres hacer y te llevaré al proceso correcto."});const guide=GUIDES.find(item=>item.module===id);return guide?guideMessage(guide):message({text:`Estás en ${meta.label}. ${meta.help}`,actions:[{label:`Abrir ${meta.label}`,sub:"Volver al módulo",icon:"→",kind:"primary",action:"navigate",module:id}]})}
function contextList(){const actions=Object.entries(MODULE_META).filter(([id])=>allowed(id)).map(([id,meta])=>({label:meta.label,sub:meta.help,icon:"→",action:"navigate",module:id}));return message({text:"Selecciona el área. Solo aparecen módulos visibles para tu sesión.",actions})}
function allHelp(){return message({text:"Este es mi centro completo de ayuda. Puedo orientarte, diagnosticar información visible y llevarte al control correcto.",catalog:true,actions:[{label:"Centro de herramientas",sub:"Diagnósticos operativos",icon:"⚡",kind:"warning",action:"tools"},{label:"Ayuda del módulo actual",sub:currentModuleLabel(),icon:"?",action:"context-help"}]})}
function explainLastError(){const error=paco.lastRpcError;if(!error)return message({text:"No he detectado errores RPC durante esta sesión. Si el problema es visual, indícame el módulo y la acción que estabas realizando."});return message({text:`El último error se produjo en ${error.rpc||"una operación del CRM"}.`,alert:{title:error.code||"Error RPC",text:String(error.message||"Sin detalle").slice(0,420)},actions:[{label:"Actualizar vista",sub:"Solicitar recarga del módulo",icon:"↻",action:"refresh"},{label:"Abrir Auditoría",sub:"Revisar trazabilidad",icon:"⌁",action:"navigate",module:"audit"}]})}

async function resolveQuery(input){
  const text=norm(input);
  if(!text)return message({text:"Escribe qué quieres hacer. Por ejemplo: “buscar pedido 45832”, “cómo hago un corte”, “cambiar mi clave” o “diagnóstico del sistema”."});
  if(/^(hola|buenas|hey|paco|ayuda)$/.test(text))return message({text:"Aquí estoy. Puedo orientarte, navegar, diagnosticar pedidos, revisar señales operativas y explicar errores.",actions:[{label:"Ver capacidades",sub:"Centro completo",icon:"☷",kind:"primary",action:"all-help"},{label:"Herramientas",sub:"Diagnóstico operativo",icon:"⚡",action:"tools"}]});
  if(text.includes("herramientas")||text.includes("centro de herramientas")){setToolsOpen(true);return null}
  if(text.includes("que puedes hacer")||text.includes("qué puedes hacer")||text.includes("todas las capacidades"))return allHelp();
  if(text.includes("ultimo error")||text.includes("último error")||text.includes("que fallo")||text.includes("qué falló"))return explainLastError();
  if(text.includes("diagnostico del sistema")||text.includes("diagnóstico del sistema")||text.includes("salud del sistema")||text.includes("health check")){await runTool("system-health",true);return null}
  if(text.includes("mi acceso")||text.includes("mis permisos")){await runTool("permissions",true);return null}
  if(text.includes("mi jornada")){await runTool("my-day",true);return null}
  const term=orderTerm(input);
  if(text.includes("diagnost")&&text.includes("pedido"))return diagnoseOrder(term);
  if((text.includes("destrabar")||text.includes("desbloquear")||text.includes("atascado")||text.includes("estancado")||text.includes("bloqueado")||text.includes("no avanza"))&&text.includes("pedido"))return diagnoseOrder(term);
  if((text.includes("buscar")||text.includes("ver")||text.includes("consultar")||text.includes("revisar"))&&text.includes("pedido"))return term?diagnoseOrder(term):guideMessage(GUIDES.find(item=>item.id==="find-order"));
  const guide=guideFor(input);if(guide)return guideMessage(guide);
  const mod=moduleFor(input);if(mod)return message({text:`${mod.label}: ${mod.help}`,actions:[{label:`Abrir ${mod.label}`,sub:"Ir al módulo",icon:"→",kind:"primary",action:"navigate",module:mod.id},{label:"Explicar paso a paso",sub:"Guía contextual",icon:"?",action:"context-help",module:mod.id}]});
  return message({text:"No quiero inventarte un procedimiento. Dime la acción concreta y, si aplica, el número del pedido.",actions:[{label:"Ver capacidades",sub:"Pedidos, inventario, flujo y más",icon:"☷",kind:"primary",action:"all-help"},{label:"Herramientas",sub:"Diagnóstico operativo",icon:"⚡",action:"tools"},{label:"Ayuda del módulo",sub:currentModuleLabel(),icon:"?",action:"context-help"}]});
}

async function submit(input){const text=String(input||"").trim();if(!text||paco.busy)return;add(message({role:"user",text}));setBusy(true);typing();try{const answer=await resolveQuery(text);if(answer)replaceTyping(answer);else replaceTyping(null);setFace(answer?.type==="success"?"success":"talking");setTimeout(()=>isOpen()&&setFace("listening"),750)}catch(error){console.error("[PACO V11.20]",error);replaceTyping(message({text:"No pude completar esa consulta con los permisos o datos actuales.",alert:{title:"Detalle",text:error.message||"Error inesperado"},actions:[{label:"Reintentar",sub:"Volver a consultar",icon:"↻",action:"prompt",prompt:text},{label:"Abrir módulo actual",sub:currentModuleLabel(),icon:"→",action:"navigate",module:currentModule()}]}));setFace("idle")}finally{setBusy(false)}}

function route(moduleId){if(!allowed(moduleId)){add(message({text:`Tu usuario no tiene lectura habilitada para ${MODULE_META[moduleId]?.label||moduleId}. Paco no intentará saltar ese permiso.`}));return}navigate(moduleId);setOpen(false)}
function handleAction(button){
  const action=button.dataset.paco2Action;
  if(action==="navigate"){route(button.dataset.module||"dashboard");return}
  if(action==="open-order"){window.dispatchEvent(new CustomEvent("erp:open-order",{detail:button.dataset.orderId}));setOpen(false);return}
  if(action==="diagnose-order-id"){setBusy(true);typing();diagnoseOrderById(button.dataset.orderId).then(answer=>replaceTyping(answer)).catch(error=>replaceTyping(message({text:error.message}))).finally(()=>setBusy(false));return}
  if(action==="prompt"){const input=paco.root.querySelector("[data-paco2-input]");input.value=button.dataset.prompt||"";input.focus();input.setSelectionRange(input.value.length,input.value.length);return}
  if(action==="password-self"){add(message({text:"Escribe la nueva contraseña dos veces. El valor no se registra en el historial de Paco.",type:"password"}));return}
  if(action==="context-help"){add(contextHelp());return}
  if(action==="context-list"){add(contextList());return}
  if(action==="all-help"){add(allHelp());return}
  if(action==="tools"){setToolsOpen(true);return}
  if(action==="refresh"){window.dispatchEvent(new CustomEvent("erp:refresh"));window.__erpOrderListRefresh?.();toast("Paco solicitó actualizar la vista.");return}
}

function toolAllowed(tool){if(tool.admin&&!isAdmin())return false;if(tool.module&&!allowed(tool.module))return false;return true}
function renderTools(){const grid=paco.root?.querySelector("[data-paco2-tools-grid]");if(!grid)return;grid.innerHTML=TOOLS.filter(toolAllowed).map(tool=>`<button type="button" class="paco2-tool" data-paco2-tool="${esc(tool.id)}"><span>${esc(tool.icon)}</span><div><strong>${esc(tool.label)}</strong><small>${esc(tool.detail)}</small></div></button>`).join("")}
function flatten(value,prefix="",depth=0,out=[]){if(out.length>=12||depth>2||value==null)return out;if(["string","number","boolean"].includes(typeof value)){out.push([prefix||"Dato",String(value)]);return out}if(Array.isArray(value)){out.push([prefix||"Registros",String(value.length)]);if(value[0]&&typeof value[0]==="object")flatten(value[0],prefix?`${prefix} muestra`:"Muestra",depth+1,out);return out}if(typeof value==="object")for(const [key,item] of Object.entries(value)){if(out.length>=12)break;const label=prefix?`${prefix} · ${pretty(key)}`:pretty(key);if(["string","number","boolean"].includes(typeof item))out.push([label,String(item)]);else if(Array.isArray(item))out.push([label,String(item.length)]);else if(item&&depth<1)flatten(item,label,depth+1,out)}return out}
function toolResult(title,rows=[],actions=[]){const box=paco.root?.querySelector("[data-paco2-tools-result]");if(!box)return;box.hidden=false;box.innerHTML=`<div class="paco2-tool-result-head"><strong>${esc(title)}</strong></div><div class="paco2-tool-result-list">${rows.slice(0,12).map(row=>`<div><span>${esc(row[0])}</span><b>${esc(row[1])}</b></div>`).join("")||"<div><span>Resultado</span><b>Sin datos adicionales</b></div>"}</div>${actions.length?`<div class="paco2-tool-result-actions">${actions.map(action=>`<button type="button" data-paco2-tool-route="${esc(action.route||"")}"${action.prompt?` data-paco2-tool-prompt="${esc(action.prompt)}"`:""}>${esc(action.label)}</button>`).join("")}</div>`:""}`;box.scrollIntoView({block:"nearest"})}
function toolLoading(label="Consultando…"){const box=paco.root?.querySelector("[data-paco2-tools-result]");if(box){box.hidden=false;box.innerHTML=`<div class="paco2-tool-loading">${esc(label)}</div>`}}
function attentionScore(row){const status=String(row.status||row.taskStatus||row.task_status||"").toUpperCase();const overdue=Boolean(row.slaExceeded??row.sla_exceeded??row.overdue??row.isOverdue);const blocked=/BLOCK|WAIT|HOLD|PAUS|EXCEPTION|INCIDENT/.test(status);const assignee=row.assigneeName||row.assignedToName||row.assigned_to_name||row.assignedTo||row.assigned_to;return(overdue?5:0)+(blocked?3:0)+(!assignee?1:0)}
async function runTool(id,openTools=false){
  const tool=TOOLS.find(item=>item.id===id);if(!tool||!toolAllowed(tool))return;
  if(openTools)setToolsOpen(true);
  if(tool.route){navigate(tool.route);setOpen(false);return}
  try{
    if(id==="permissions"){const roles=state.profile?.roles||[];const readable=state.modules.filter(mod=>mod.canRead);const writable=state.modules.filter(mod=>mod.canCreate||mod.canUpdate||mod.canApprove||mod.canAdmin);toolResult("Mi acceso actual",[["Usuario",state.profile?.displayName||state.profile?.display_name||state.profile?.name||"Sesión activa"],["Roles",roles.join(", ")||"Sin roles declarados"],["Módulos visibles",String(readable.length)],["Módulos con acciones",String(writable.length)],["Super Admin",hasRole("super_admin")?"Sí":"No"]]);return}
    if(id==="attention"){toolLoading("Revisando pedidos visibles…");const data=await api.listOrders({page:1,pageSize:80,includeHistory:false,assignment:"ALL"});const items=Array.isArray(data?.items)?data.items:Array.isArray(data)?data:[];const ranked=items.map(row=>({row,score:attentionScore(row)})).filter(item=>item.score>0).sort((a,b)=>b.score-a.score);toolResult("Pedidos que requieren revisión",[["Pedidos revisados",String(items.length)],["Con señal de atención",String(ranked.length)],["Con SLA señalado",String(items.filter(row=>row.slaExceeded||row.sla_exceeded).length)]],[{label:"Abrir Pedidos",route:"orders"}]);return}
    if(id==="exceptions"){toolLoading("Consultando excepciones…");toolResult("Resumen de excepciones",flatten(await api.exceptionSummary()),[{label:"Abrir Excepciones",route:"approvals"}]);return}
    if(id==="my-day"){toolLoading("Consultando tu jornada…");toolResult("Mi jornada de hoy",flatten(await api.workMyDay()),[{label:"Abrir Jornada",route:"workforce"}]);return}
    if(id==="inventory-health"){toolLoading("Revisando inventario…");toolResult("Salud de inventario",flatten(await api.materialReservationHealth()),[{label:"Abrir Inventario",route:"inventory"}]);return}
    if(id==="last-error"){const e=paco.lastRpcError;toolResult("Último error RPC",e?[["Operación",e.rpc||"CRM"],["Código",e.code||"—"],["Detalle",e.message||"Sin detalle"]]:[["Estado","No se han detectado errores RPC en esta sesión"]],[{label:"Abrir Auditoría",route:"audit"}]);return}
    if(id==="system-health"){toolLoading("Consultando salud del CRM…");toolResult("Salud del CRM",flatten(await api.health()),[{label:"Abrir Administración",route:"admin"},{label:"Abrir Auditoría",route:"audit"}]);return}
    if(id==="refresh"){window.dispatchEvent(new CustomEvent("erp:refresh"));window.__erpOrderListRefresh?.();toolResult("Vista actualizada",[["Módulo",currentModuleLabel()],["Estado","Solicitud enviada"]]);toast("Paco actualizó la vista actual.");return}
  }catch(error){toolResult(tool.label,[["Detalle",error?.message||"No fue posible completar la consulta"]])}
}

function bindPasswordForms(){paco.root?.querySelectorAll("[data-paco2-password-form]").forEach(form=>{if(form.dataset.bound)return;form.dataset.bound="1";form.addEventListener("submit",async event=>{event.preventDefault();if(paco.busy)return;const password=form.password.value,confirmValue=form.confirm.value;if(password!==confirmValue){toast("Las contraseñas no coinciden.","error");return}if(password.length<10||!/[A-Z]/.test(password)||!/[a-z]/.test(password)||!/\d/.test(password)){toast("Usa 10+ caracteres con mayúscula, minúscula y número.","error",6000);return}setBusy(true);try{setFace("thinking");const {error}=await getSupabase().auth.updateUser({password});if(error)throw error;form.remove();add(message({text:"Tu contraseña fue actualizada correctamente.",type:"success"}));setFace("success");toast("Contraseña actualizada.")}catch(error){add(message({text:"No fue posible actualizar la contraseña.",alert:{title:"Auth",text:error.message||"Error de autenticación"}}));setFace("idle")}finally{form.password.value="";form.confirm.value="";setBusy(false)}})})}

function bindRoot(){
  const root=paco.root;if(!root||root.dataset.pacoBound==="1")return;root.dataset.pacoBound="1";
  root.querySelector("[data-paco2-toggle]")?.addEventListener("click",toggleOpen);
  root.querySelector("[data-paco2-close]")?.addEventListener("click",()=>setOpen(false));
  root.querySelector("[data-paco2-tools-toggle]")?.addEventListener("click",()=>setToolsOpen(!root.classList.contains("is-tools-open")));
  root.querySelector("[data-paco2-tools-close]")?.addEventListener("click",()=>setToolsOpen(false));
  root.querySelector("[data-paco2-form]")?.addEventListener("submit",event=>{event.preventDefault();const input=root.querySelector("[data-paco2-input]");const text=input.value;input.value="";submit(text)});
  root.querySelector("[data-paco2-input]")?.addEventListener("keydown",event=>{if(event.key==="Enter"&&!event.shiftKey){event.preventDefault();root.querySelector("[data-paco2-form]")?.requestSubmit()}});
  root.addEventListener("click",event=>{
    const action=event.target.closest?.("[data-paco2-action]");if(action){handleAction(action);return}
    const quick=event.target.closest?.("[data-paco2-quick]");if(quick){if(norm(quick.dataset.paco2Quick)==="herramientas")setToolsOpen(true);else submit(quick.dataset.paco2Quick);return}
    const tool=event.target.closest?.("[data-paco2-tool]");if(tool){runTool(tool.dataset.paco2Tool);return}
    const routeButton=event.target.closest?.("[data-paco2-tool-route]");if(routeButton){const route=routeButton.dataset.paco2ToolRoute,prompt=routeButton.dataset.paco2ToolPrompt;if(route){navigate(route);setOpen(false)}else if(prompt){setToolsOpen(false);submit(prompt)}}
  });
}

function bindGlobal(){
  if(paco.globalBound)return;paco.globalBound=true;
  document.addEventListener("click",event=>{if(event.target.closest?.(".nav-item"))setTimeout(updateContext,40)});
  window.addEventListener("erp:rpc-error",event=>{paco.lastRpcError=event.detail||null;paco.root?.classList.add("has-alert")});
  window.addEventListener("paco:open",event=>{if(!state.profile)return;setOpen(true);const prompt=event.detail?.prompt;if(prompt){const input=paco.root?.querySelector("[data-paco2-input]");if(input){input.value=prompt;input.focus()}}});
  window.addEventListener("paco:close",()=>setOpen(false));
}

function syncProfile(next=state){
  if(!paco.root)return;
  const active=Boolean(next.profile);
  paco.root.hidden=!active;
  if(active){updateContext();renderTools()}else{setOpen(false);paco.messages=[];renderMessages()}
}

export function installPacoAssistant(){
  const existing=document.querySelector("#paco-bot");
  if(existing&&!existing.classList.contains("paco2-root"))existing.remove();
  let root=document.querySelector("#paco-bot.paco2-root");
  if(!root){const template=document.createElement("template");template.innerHTML=renderRoot().trim();root=template.content.firstElementChild;document.body.append(root)}
  paco.root=root;
  bindRoot();bindGlobal();renderQuick();renderTools();syncProfile();
  if(!paco.unsubscribe)paco.unsubscribe=subscribe(syncProfile);
  Object.values(ASSETS).forEach(src=>{const image=new Image();image.decoding="async";image.src=src});
  return root;
}
