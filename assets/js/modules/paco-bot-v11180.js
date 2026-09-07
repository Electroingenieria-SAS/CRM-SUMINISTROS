import {state,subscribe,hasRole,can} from "../core/state.js";
import {navigate} from "../core/router.js";
import {getSupabase} from "../services/supabase.js";
import {api} from "../services/api.js";
import {fmt} from "../core/format.js";
import {toast} from "../core/ui.js";

/* CRM Suministros · Paco Bot V11.18.0
   Contextual assistant over existing permission-controlled CRM services.
   Paco never stores a privileged credential and never bypasses workflow permissions. */

const MODULE_META={
  dashboard:{label:"Centro de operaciones",keywords:["inicio","dashboard","centro","indicadores"],help:"Revisa cargas, alertas, pedidos activos y prioridades generales."},
  orders:{label:"Pedidos",keywords:["pedido","pedidos","orden","buscar pedido","corregir pedido"],help:"Consulta el expediente completo, estado, responsable, materiales y trazabilidad."},
  sales:{label:"Ventas",keywords:["venta","ventas","crear pedido","nuevo pedido","cliente"],help:"Crea pedidos y registra la información comercial y de entrega."},
  credit:{label:"Crédito",keywords:["credito","crédito","cupo","solicitud de credito"],help:"Radica, revisa y decide solicitudes de crédito."},
  cartera:{label:"Cartera",keywords:["cartera","mora","validacion financiera"],help:"Valida cartera y libera los pedidos que requieren esta revisión."},
  caja:{label:"Caja",keywords:["caja","retenido","pvn","caja facturacion"],help:"Gestiona retenciones y validaciones de Caja."},
  purchasing:{label:"Compras",keywords:["compra","compras","abastecimiento","pve"],help:"Gestiona necesidades de compra y llegada de mercancía."},
  receiving:{label:"Recepción",keywords:["recepcion","recepción","recibir","mercancia","mercancía"],help:"Confirma recepción documental o física y asigna el siguiente paso."},
  picking:{label:"Alistamiento",keywords:["alistamiento","picking","buscar material","faltante"],help:"Verifica materiales, origen físico y faltantes antes de continuar."},
  cutting:{label:"Corte",keywords:["corte","cortar","carreto","merma","reel"],help:"Ejecuta el corte guiado por referencia, carreto, plan y evidencia."},
  billing:{label:"Facturación",keywords:["factura","facturacion","facturación","facturar"],help:"Registra la factura y completa los soportes del pedido."},
  shipping:{label:"Despachos y entregas",keywords:["despacho","entrega","guia","guía","transportadora","cierre"],help:"Gestiona guía, salida, entrega, evidencia y cierre."},
  inventory:{label:"Inventario",keywords:["inventario","stock","lote","ubicacion","ubicación","reservado"],help:"Consulta físico, reservado, bloqueado, disponible, lotes y movimientos."},
  workforce:{label:"Jornada y actividades",keywords:["jornada","actividad","actividades","tiempo persona","productividad"],help:"Registra trabajo, pausas, evidencias, agenda y productividad."},
  approvals:{label:"Excepciones y aprobaciones",keywords:["aprobacion","aprobación","excepcion","excepción","bloqueo","novedad","destrabar"],help:"Gestiona novedades, bloqueos, solicitudes de aprobación y SLA."},
  vsm:{label:"Flujo y tiempos",keywords:["flujo","tiempos","vsm","cuello de botella","sla"],help:"Analiza lead time, espera, touch time, WIP, usuarios y cuellos de botella."},
  reports:{label:"Analítica y reportes",keywords:["analitica","analítica","reporte","reportes","bi","excel","kpi"],help:"Explora KPIs, tendencias, calidad del dato y exportaciones."},
  imports:{label:"Histórico",keywords:["historico","histórico","archivo","importar csv","csv"],help:"Consulta expedientes históricos, lotes de importación y cobertura."},
  audit:{label:"Auditoría",keywords:["auditoria","auditoría","trazabilidad","quien hizo","quién hizo"],help:"Consulta decisiones, eventos y cambios registrados por el sistema."},
  admin:{label:"Administración",keywords:["administracion","administración","usuario","usuarios","rol","roles","permiso","permisos","calendario","secuencia","ciclo"],help:"Controla usuarios, permisos, flujo, SLA, calendarios, catálogos y configuración."}
};

const GUIDES=[
  {
    id:"create-order",title:"Crear un pedido",keywords:["crear pedido","nuevo pedido","registrar pedido","hacer pedido"],module:"sales",
    intro:"Paco puede llevarte directamente al asistente de creación. El pedido se registra en tres bloques claros.",
    steps:[
      ["Pedido y cliente","Registra número, cliente, tipo, condición de pago, ruta, prioridad y dirección."],
      ["Materiales","Busca cada referencia oficial y define la cantidad o cortes solicitados."],
      ["Revisión","Valida el resumen y confirma la creación. El workflow decide la primera etapa." ]
    ],actions:[{label:"Abrir Crear pedido",kind:"primary",action:"navigate",module:"sales",params:{create:"1"}}]
  },
  {
    id:"find-order",title:"Buscar o revisar un pedido",keywords:["buscar pedido","ver pedido","consultar pedido","encontrar pedido","revisar pedido"],module:"orders",
    intro:"Puedo buscarlo por número, cliente o referencia. Si me escribes el número del pedido también puedo diagnosticar su etapa y bloqueos.",
    steps:[["Busca","Escribe el número, cliente o referencia."],["Abre","Entra al expediente desde Abrir / Continuar."],["Revisa","El popup muestra únicamente el paso que corresponde y su trazabilidad."]],
    actions:[{label:"Ir a Pedidos",kind:"primary",action:"navigate",module:"orders"}]
  },
  {
    id:"correct-order",title:"Corregir un pedido",keywords:["corregir pedido","editar pedido","arreglar pedido","modificar pedido"],module:"orders",
    intro:"La corrección depende del estado del pedido. Paco no salta controles: primero abre el expediente y te lleva a la acción permitida para tu rol.",
    steps:[["Identifica el pedido","Dime el número para revisar etapa, estado y acciones disponibles."],["Ubica el dato","Abre el expediente y entra al bloque correspondiente."],["Corrige con trazabilidad","Usa la acción habilitada; si el proceso ya avanzó, registra novedad o solicita aprobación." ]],
    actions:[{label:"Buscar pedido",kind:"primary",action:"prompt",prompt:"Buscar pedido "},{label:"Ir a Excepciones",action:"navigate",module:"approvals"}]
  },
  {
    id:"password",title:"Cambiar mi contraseña",keywords:["cambiar clave","cambiar contraseña","cambiar password","mi clave","mi contraseña","password"],module:null,
    intro:"Puedo cambiar la contraseña de tu propia sesión sin mostrarla ni guardarla. La nueva clave se envía directamente a Supabase Auth.",
    steps:[["Define una nueva clave","Debe tener al menos 10 caracteres, mayúscula, minúscula y número."],["Confirma","Escríbela una segunda vez para evitar errores."],["Actualiza","Paco la cambia en tu sesión actual; nunca la registra en el chat ni en auditoría." ]],
    actions:[{label:"Cambiar mi contraseña",kind:"primary",action:"password-self"}]
  },
  {
    id:"unblock",title:"Diagnosticar o destrabar un pedido",keywords:["destrabar","desbloquear pedido","pedido bloqueado","bloqueo pedido","atascado","estancado"],module:"approvals",
    intro:"Primero diagnostico la causa real. Un pedido puede estar esperando responsable, bloqueado por incidencia, pendiente de aprobación o simplemente en otra etapa.",
    steps:[["Diagnóstico","Dime el número del pedido y consultaré estado, etapa, responsable, acciones e incidencias visibles para tu usuario."],["Causa","Te mostraré el control que está reteniendo el flujo."],["Resolución segura","Abrimos el pedido o Excepciones y aplicas la acción autorizada. No fuerzo estados por detrás del workflow." ]],
    actions:[{label:"Diagnosticar pedido",kind:"primary",action:"prompt",prompt:"Diagnosticar pedido "},{label:"Abrir Excepciones",action:"navigate",module:"approvals"}]
  },
  {
    id:"cycle",title:"Corregir flujo, ciclo o SLA",keywords:["corregir ciclo","cambiar ciclo","flujo incorrecto","cambiar sla","configurar sla","workflow","cambiar etapa"],module:"admin",
    intro:"Los ciclos se corrigen desde la configuración de workflow y SLA. Paco respeta el gobierno del sistema: la edición solo aparece para usuarios con permiso administrativo.",
    steps:[["Revisa el impacto","Identifica etapa, SLA, rol y pedidos que podrían verse afectados."],["Administración → Flujo y SLA","Modifica únicamente el parámetro necesario."],["Valida","Regresa a Flujo y tiempos o al pedido para confirmar que el comportamiento sea correcto." ]],
    actions:[{label:"Abrir Administración",kind:"primary",action:"navigate",module:"admin"},{label:"Abrir Flujo y tiempos",action:"navigate",module:"vsm"}]
  },
  {
    id:"cutting",title:"Trabajar una referencia en Corte",keywords:["como cortar","cómo cortar","hacer corte","usar corte","carreto","merma corte"],module:"cutting",
    intro:"Corte ya trabaja como un flujo guiado. La pantalla debe llevarte de una decisión a la siguiente sin mostrarte información innecesaria.",
    steps:[["Selecciona referencia","Busca o abre una referencia pendiente."],["Elige origen","Selecciona el carreto/lote y confirma cantidad física."],["Ejecuta","Revisa el plan, merma y cantidades; confirma el corte."],["Evidencia y cierre","Adjunta la foto final y termina la ejecución." ]],
    actions:[{label:"Abrir Centro de corte",kind:"primary",action:"navigate",module:"cutting"}]
  },
  {
    id:"inventory",title:"Entender o corregir inventario",keywords:["ajustar inventario","corregir inventario","ver disponible","ver reservado","stock disponible","movimiento inventario"],module:"inventory",
    intro:"Inventario separa físico, reservado, bloqueado y disponible para venta. Las correcciones deben conservar trazabilidad por lote y ubicación.",
    steps:[["Busca la referencia","Usa referencia, descripción, lote o ubicación."],["Abre detalle","Valida lotes, reservas y movimientos antes de modificar."],["Ajusta con motivo","Si tu rol lo permite, registra el ajuste indicando causa y cantidad." ]],
    actions:[{label:"Abrir Inventario",kind:"primary",action:"navigate",module:"inventory"}]
  },
  {
    id:"reports",title:"Analizar o exportar información",keywords:["exportar excel","hacer reporte","analizar datos","crear analisis","crear análisis","kpi"],module:"reports",
    intro:"Analítica y reportes permite análisis ejecutivo y exploración BI sin escribir SQL.",
    steps:[["Define periodo","Selecciona rango o preset."],["Escoge dominio","Operación, Comercial, Logística, Personas o Calidad."],["Explora","En Explorador BI combina dataset, dimensión y métrica."],["Exporta","Descarga XLSX, CSV, JSON o utiliza Imprimir/PDF." ]],
    actions:[{label:"Abrir Analítica",kind:"primary",action:"navigate",module:"reports"}]
  }
];

const STEP_MODULE={
  CARTERA:"cartera",CAJA:"caja",CAJA_FACTURACION:"caja",COMPRAS:"purchasing",RECEPCION_MERCANCIA:"receiving",RECEPCION_PEDIDO:"receiving",
  ALISTAMIENTO:"picking",CORTE:"cutting",FACTURACION:"billing",CLIENT_POINT:"shipping",CLIENT_PICKUP:"shipping",LOCAL_DISPATCH:"shipping",NATIONAL_DISPATCH:"shipping",CLOSURE:"shipping",CLOSED:"orders"
};

const bot={root:null,open:false,busy:false,messages:[],lastError:null,idleTimer:null,unsubscribe:null};

function escape(value){return fmt.escape(String(value??""))}
function norm(value){return String(value||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/\s+/g," ").trim()}
function pretty(value){return String(value||"").replaceAll("_"," ").toLowerCase().replace(/(^|\s)\S/g,m=>m.toUpperCase())}
function allowed(moduleId){return !moduleId||can(moduleId,"canRead")||moduleId===state.currentModule}
function currentModule(){return state.currentModule||document.querySelector(".nav-item.active")?.dataset?.module||"dashboard"}
function currentModuleLabel(){return MODULE_META[currentModule()]?.label||"CRM Suministros"}
function isSuperAdmin(){return hasRole("super_admin")}
function arrayFrom(value){return Array.isArray(value)?value:Array.isArray(value?.items)?value.items:Array.isArray(value?.actions)?value.actions:Array.isArray(value?.data)?value.data:[]}

function faceClass(stateName="idle"){
  return {idle:"is-idle",listening:"is-listening",wink:"is-wink",thinking:"is-thinking",talking:"is-talking",success:"is-success"}[stateName]||"is-idle";
}

function setFace(stateName="idle"){
  bot.root?.querySelectorAll(".paco-face").forEach(face=>{
    face.classList.remove("is-idle","is-listening","is-wink","is-thinking","is-talking","is-success");
    face.classList.add(faceClass(stateName));
  });
}

function renderRoot(){
  return `<div id="paco-bot" class="paco-root" aria-live="polite">
    <button type="button" class="paco-launcher" aria-label="Abrir Paco Bot" aria-expanded="false" data-paco-toggle>
      <span class="paco-face is-idle" aria-hidden="true"></span><span class="paco-launcher-dot" aria-hidden="true"></span><span class="paco-launcher-label">Paco Bot · Ayuda</span>
    </button>
    <section class="paco-panel" aria-label="Paco Bot, asistente del CRM" hidden>
      <header class="paco-head">
        <span class="paco-face is-idle" aria-hidden="true"></span>
        <div class="paco-head-copy"><span>Asistente del CRM</span><strong>Paco Bot</strong><small data-paco-head-context>${escape(currentModuleLabel())}</small></div>
        <button type="button" class="paco-close" aria-label="Cerrar Paco Bot" data-paco-close>×</button>
      </header>
      <div class="paco-context"><span></span><div>Contexto actual: <strong data-paco-context>${escape(currentModuleLabel())}</strong></div></div>
      <div class="paco-messages" data-paco-messages></div>
      <div class="paco-quick" data-paco-quick></div>
      <form class="paco-composer" data-paco-form>
        <textarea rows="1" maxlength="700" aria-label="Escribe tu pregunta a Paco" placeholder="Pregúntame cómo hacer, corregir o encontrar algo…" data-paco-input></textarea>
        <button type="submit" class="paco-send" aria-label="Enviar" data-paco-send>➜</button>
      </form>
    </section>
  </div>`;
}

function assistantMessage({text="",steps=[],actions=[],card=null,alert=null,type="normal"}={}){
  return {role:"assistant",text,steps,actions,card,alert,type,id:crypto.randomUUID()};
}
function userMessage(text){return {role:"user",text,id:crypto.randomUUID()}}

function messageHtml(message){
  if(message.role==="user")return `<article class="paco-message user"><div class="paco-bubble"><div class="paco-message-text">${escape(message.text)}</div></div></article>`;
  if(message.type==="typing")return `<article class="paco-message assistant"><span class="paco-face paco-mini-face is-thinking" aria-hidden="true"></span><div class="paco-bubble"><span class="paco-typing" aria-label="Paco está pensando"><i></i><i></i><i></i></span></div></article>`;
  const steps=(message.steps||[]).length?`<div class="paco-steps">${message.steps.map((step,index)=>`<div class="paco-step"><span>${index+1}</span><div><strong>${escape(step[0])}</strong><small>${escape(step[1])}</small></div></div>`).join("")}</div>`:"";
  const card=message.card?`<div class="${message.card.type==="system"?"paco-system-card":"paco-order-card"}">${(message.card.rows||[]).map(row=>`<div><small>${escape(row[0])}</small><b>${escape(row[1])}</b></div>`).join("")}</div>`:"";
  const alert=message.alert?`<div class="paco-alert"><strong>${escape(message.alert.title)}</strong><span>${escape(message.alert.text)}</span></div>`:"";
  const actions=(message.actions||[]).filter(action=>allowed(action.module)).length?`<div class="paco-actions">${message.actions.filter(action=>allowed(action.module)).map(action=>`<button type="button" class="paco-action ${escape(action.kind||"")}" data-paco-action="${escape(action.action)}" ${action.module?`data-module="${escape(action.module)}"`:""} ${action.orderId?`data-order-id="${escape(action.orderId)}"`:""} ${action.prompt?`data-prompt="${escape(action.prompt)}"`:""}>${escape(action.label)}</button>`).join("")}</div>`:"";
  const password=message.type==="password"?passwordFormHtml():"";
  return `<article class="paco-message assistant"><span class="paco-face paco-mini-face ${faceClass(message.type==="success"?"success":"idle")}" aria-hidden="true"></span><div class="paco-bubble"><div class="paco-message-text">${escape(message.text)}</div>${steps}${card}${alert}${password}${actions}</div></article>`;
}

function passwordFormHtml(){
  return `<form class="paco-password-box" data-paco-password-form autocomplete="off">
    <label>Nueva contraseña<input type="password" name="password" minlength="10" autocomplete="new-password" required></label>
    <label>Confirmar contraseña<input type="password" name="confirm" minlength="10" autocomplete="new-password" required></label>
    <small>10+ caracteres con mayúscula, minúscula y número. Paco no almacena ni imprime este valor.</small>
    <button class="paco-action primary" type="submit">Actualizar mi contraseña</button>
  </form>`;
}

function renderMessages(){
  const box=bot.root?.querySelector("[data-paco-messages]");if(!box)return;
  box.innerHTML=bot.messages.map(messageHtml).join("");
  box.scrollTop=box.scrollHeight;
  bindPasswordForms();
}

function quickPrompts(){
  const moduleId=currentModule();
  const contextual={
    orders:["Buscar pedido","Corregir pedido","Destrabar pedido"],sales:["Crear pedido","Buscar material","Cambiar mi clave"],
    cutting:["¿Cómo hago el corte?","Destrabar pedido","Ir a Flujo y tiempos"],inventory:["Corregir inventario","Ver disponible","Exportar reporte"],
    admin:["Usuarios y permisos","Corregir ciclo o SLA","Diagnóstico del sistema"],reports:["Crear análisis","Exportar Excel","Calidad del dato"],
    workforce:["Registrar actividad","Ver productividad","Cambiar mi clave"]
  };
  return contextual[moduleId]||["Buscar pedido","¿Cómo hago esto?","Cambiar mi clave","Destrabar pedido"];
}

function renderQuick(){
  const row=bot.root?.querySelector("[data-paco-quick]");if(!row)return;
  row.innerHTML=quickPrompts().map(prompt=>`<button type="button" data-paco-quick-prompt="${escape(prompt)}">${escape(prompt)}</button>`).join("");
}

function updateContext(){
  const label=currentModuleLabel();
  bot.root?.querySelectorAll("[data-paco-context],[data-paco-head-context]").forEach(node=>node.textContent=label);
  renderQuick();
}

function add(message){bot.messages.push(message);renderMessages()}
function replaceTyping(message){bot.messages=bot.messages.filter(item=>item.type!=="typing");if(message)bot.messages.push(message);renderMessages()}
function typing(){bot.messages=bot.messages.filter(item=>item.type!=="typing");bot.messages.push({role:"assistant",type:"typing",id:"typing"});renderMessages();setFace("thinking")}
function setBusy(value){bot.busy=value;const send=bot.root?.querySelector("[data-paco-send]");if(send)send.disabled=value}

function welcome(){
  if(bot.messages.length)return;
  const name=state.profile?.displayName||state.profile?.display_name||"";
  add(assistantMessage({
    text:`${name?`Hola, ${name}. `:""}Soy Paco Bot. Puedo explicarte procesos, llevarte al módulo correcto, buscar y diagnosticar pedidos, ayudarte con errores del CRM y ejecutar acciones seguras de tu propia cuenta.`,
    actions:[
      {label:"Buscar un pedido",kind:"primary",action:"prompt",prompt:"Buscar pedido "},
      {label:"¿Cómo hago esto?",action:"context-help"},
      {label:"Cambiar mi contraseña",action:"password-self"},
      ...(isSuperAdmin()?[{label:"Herramientas Super Admin",kind:"warning",action:"admin-help",module:"admin"}]:[])
    ]
  }));
}

function openPanel(){
  const panel=bot.root?.querySelector(".paco-panel"),launcher=bot.root?.querySelector(".paco-launcher");if(!panel||!launcher)return;
  panel.hidden=false;launcher.setAttribute("aria-expanded","true");bot.open=true;launcher.classList.remove("has-alert");setFace("listening");welcome();updateContext();
  setTimeout(()=>bot.root?.querySelector("[data-paco-input]")?.focus(),80);
}
function closePanel(){
  const panel=bot.root?.querySelector(".paco-panel"),launcher=bot.root?.querySelector(".paco-launcher");if(!panel||!launcher)return;
  panel.hidden=true;launcher.setAttribute("aria-expanded","false");bot.open=false;setFace("idle");
}

function bestGuide(input){
  const text=norm(input);let best=null,score=0;
  for(const guide of GUIDES){
    let current=0;
    for(const keyword of guide.keywords){const key=norm(keyword);if(text.includes(key))current+=Math.max(2,key.split(" ").length*2)}
    if(current>score){best=guide;score=current}
  }
  return score?best:null;
}
function moduleMatch(input){
  const text=norm(input);let best=null,score=0;
  for(const [id,meta] of Object.entries(MODULE_META)){
    let current=0;for(const keyword of meta.keywords)if(text.includes(norm(keyword)))current+=norm(keyword).split(" ").length;
    if(current>score){best={id,...meta};score=current}
  }
  return score?best:null;
}
function extractOrderTerm(input){
  const raw=String(input||"");
  const explicit=raw.match(/(?:pedido|orden)\s*(?:#|n[úu]mero|no\.?|nro\.?|:)?\s*([A-Za-z0-9][A-Za-z0-9._/-]{2,})/i)?.[1];
  if(explicit&&!/^(bloqueado|atascado|estancado|pendiente|que|como|cómo)$/i.test(explicit))return explicit;
  const code=raw.match(/\b[A-Za-z]{1,8}[-_]\d{2,}[A-Za-z0-9-]*\b/)?.[0];if(code)return code;
  const digits=raw.match(/\b\d{4,}\b/)?.[0];if(digits)return digits;
  return "";
}

function guideMessage(guide){
  return assistantMessage({text:`${guide.title}. ${guide.intro}`,steps:guide.steps,actions:guide.actions});
}

async function diagnoseOrder(term){
  if(!term){return assistantMessage({text:"Dime el número exacto del pedido. Por ejemplo: “Diagnosticar pedido PVC-5001”.",actions:[{label:"Escribir número",kind:"primary",action:"prompt",prompt:"Diagnosticar pedido "}]})}
  const list=await api.listOrders({search:term,page:1,pageSize:8,includeHistory:true,assignment:"ALL"});
  const rows=list?.items||[];
  if(!rows.length)return assistantMessage({text:`No encontré pedidos visibles para “${term}”. Verifica el número o busca por cliente/referencia.`,actions:[{label:"Abrir búsqueda de pedidos",action:"navigate",module:"orders"}]});
  if(rows.length>1){
    return assistantMessage({text:`Encontré ${rows.length} coincidencias. Selecciona el pedido que quieres revisar.`,actions:rows.slice(0,6).map(row=>({label:`${row.orderNumber} · ${row.clientName||"Cliente"}`,action:"diagnose-order-id",orderId:row.id,kind:""}))});
  }
  return diagnoseOrderByRow(rows[0]);
}

async function diagnoseOrderById(id){
  const detail=await api.getOrder(id);
  const order=detail?.order||detail;
  return diagnoseOrderByRow(order||{id});
}

async function diagnoseOrderByRow(row){
  const id=row.id||row.orderId;
  const [actionResult,issueResult,detailResult]=await Promise.allSettled([
    id?api.getActions(id):Promise.resolve([]),id?api.orderIssues(id):Promise.resolve([]),id?api.getOrder(id):Promise.resolve(row)
  ]);
  const detail=detailResult.status==="fulfilled"?(detailResult.value?.order||detailResult.value||row):row;
  const actions=actionResult.status==="fulfilled"?arrayFrom(actionResult.value):[];
  const issues=issueResult.status==="fulfilled"?arrayFrom(issueResult.value):[];
  const openIssues=issues.filter(issue=>!["RESOLVED","CLOSED","CANCELLED"].includes(String(issue.status||"").toUpperCase()));
  const step=detail.currentStep||detail.current_step_code||row.currentStep||row.stepCode||"";
  const stepName=detail.stepName||detail.currentStepName||row.stepName||pretty(step)||"Sin etapa";
  const status=detail.status||row.status||"Sin estado";
  const assignee=detail.assigneeName||detail.assignedToName||row.assigneeName||"En cola / sin asignar";
  const orderNumber=detail.orderNumber||detail.order_number||row.orderNumber||"Pedido";
  const route=detail.route||detail.deliveryRoute||row.route||"";
  const moduleId=STEP_MODULE[String(step).toUpperCase()]||"orders";
  const warning=openIssues.length?`${openIssues.length} incidencia(s) abierta(s) pueden estar reteniendo el flujo.`:(row.slaExceeded?"El pedido aparece con plazo excedido.":(!actions.length?"No veo acciones operativas disponibles para tu usuario en este momento.":null));
  return assistantMessage({
    text:`Diagnóstico de ${orderNumber}: está en ${stepName} con estado ${pretty(status)}.`,
    card:{type:"order",rows:[["Cliente",detail.clientName||row.clientName||"—"],["Responsable",assignee],["Ruta",route?pretty(route):"—"],["Acciones visibles",String(actions.length)],["Incidencias abiertas",String(openIssues.length)]]},
    alert:warning?{title:"Atención",text:warning}:null,
    actions:[
      ...(id?[{label:"Abrir expediente",kind:"primary",action:"open-order",orderId:id,module:"orders"}]:[]),
      ...(moduleId!=="orders"?[{label:`Ir a ${MODULE_META[moduleId]?.label||"etapa"}`,action:"navigate",module:moduleId}]:[]),
      ...(openIssues.length?[{label:"Resolver en Excepciones",kind:"warning",action:"navigate",module:"approvals"}]:[])
    ]
  });
}

async function systemHealth(){
  if(!(isSuperAdmin()||can("admin","canRead")))return assistantMessage({text:"El diagnóstico técnico global está reservado a perfiles administrativos. Sí puedo ayudarte a diagnosticar el módulo o pedido que tengas abierto."});
  const result=await api.health();
  const entries=Object.entries(result||{}).filter(([,value])=>["string","number","boolean"].includes(typeof value)).slice(0,8);
  return assistantMessage({text:"Consulté el health check del CRM con tus permisos actuales.",card:{type:"system",rows:entries.length?entries.map(([key,value])=>[pretty(key),String(value)]):[["Resultado","Servicio respondió correctamente"]]},actions:[{label:"Abrir Administración",action:"navigate",module:"admin"},{label:"Abrir Auditoría",action:"navigate",module:"audit"}]});
}

function explainLastError(){
  const error=bot.lastError;
  if(!error)return assistantMessage({text:"No he detectado errores RPC del CRM durante esta sesión. Si algo visual falla, dime qué estabas haciendo y en qué módulo."});
  const technical=String(error.message||"Error sin detalle");
  const friendly=/permission|42501|autoriz/i.test(technical)?"La operación fue rechazada por permisos.":/network|fetch|connection|503|504/i.test(technical)?"Parece un problema temporal de conexión o disponibilidad.":/concurrent|version|simult/i.test(technical)?"El registro cambió mientras lo estabas editando; conviene actualizar y repetir la acción.":"El servidor devolvió un error durante la última operación.";
  return assistantMessage({text:`${friendly} RPC: ${error.rpc||"operación del CRM"}.`,alert:{title:"Último error detectado",text:technical.slice(0,340)},actions:[{label:"Actualizar módulo",action:"refresh-module"},{label:"Abrir Auditoría",action:"navigate",module:"audit"}]});
}

function contextHelp(){
  const id=currentModule(),meta=MODULE_META[id];
  if(!meta)return assistantMessage({text:"Dime qué quieres hacer y te llevaré al proceso correcto."});
  const guide=GUIDES.find(item=>item.module===id);
  if(guide)return guideMessage(guide);
  return assistantMessage({text:`Estás en ${meta.label}. ${meta.help}`,actions:[{label:`Volver a ${meta.label}`,kind:"primary",action:"navigate",module:id},{label:"Buscar pedido",action:"prompt",prompt:"Buscar pedido "}]});
}

function adminHelp(){
  if(!isSuperAdmin())return assistantMessage({text:"Las herramientas de Super Admin solo se muestran cuando la sesión actual tiene ese rol. Paco no utiliza credenciales administrativas propias ni puede elevar permisos."});
  return assistantMessage({text:"Tu sesión tiene rol Super Admin. Puedo ayudarte a llegar a los controles privilegiados, diagnosticar salud y explicar el impacto antes de modificar configuración.",steps:[["Usuarios","Alta, activación, roles, contraseñas temporales y verificación de perfiles."],["Flujo y SLA","Etapas, orden, tiempos objetivo y permisos por rol."],["Sistema","Calendario, catálogos, reglas, secuencias y salud."],["Auditoría","Cada cambio administrativo conserva actor y antes/después."]],actions:[{label:"Abrir Administración",kind:"primary",action:"navigate",module:"admin"},{label:"Diagnóstico del sistema",action:"system-health"},{label:"Abrir Auditoría",action:"navigate",module:"audit"}]});
}

async function resolveQuery(input){
  const text=norm(input);
  if(!text)return assistantMessage({text:"Escribe qué quieres hacer. Puedes hablarme como: “buscar pedido 12345”, “cambiar mi clave” o “cómo hago un corte”."});

  if(/^(hola|buenas|hey|paco|ayuda)$/.test(text))return assistantMessage({text:"Aquí estoy. Puedo orientarte, navegar, diagnosticar pedidos, explicar errores y ayudarte con acciones seguras de tu cuenta.",actions:[{label:"¿Cómo hago esto?",action:"context-help"},{label:"Buscar pedido",kind:"primary",action:"prompt",prompt:"Buscar pedido "},{label:"Cambiar mi clave",action:"password-self"}]});
  if(text.includes("que puedes hacer")||text.includes("qué puedes hacer")||text.includes("ayudame con todo")||text.includes("ayúdame con todo"))return assistantMessage({text:"Puedo cubrir todo el recorrido del CRM: pedidos, crédito, cartera, caja, compras, recepción, alistamiento, corte, facturación, despachos, inventario, productividad, excepciones, analítica, histórico, auditoría y administración. También puedo diagnosticar pedidos y el último error RPC detectado.",actions:[{label:"Ayuda del módulo actual",kind:"primary",action:"context-help"},{label:"Diagnóstico del sistema",action:"system-health"}]});
  if((text.includes("ultimo error")||text.includes("último error")||text.includes("que fallo")||text.includes("qué falló")||text.includes("por que fallo")||text.includes("por qué falló")))return explainLastError();
  if(text.includes("diagnostico del sistema")||text.includes("diagnóstico del sistema")||text.includes("health check")||text.includes("salud del sistema"))return systemHealth();
  if(text.includes("super admin")||text.includes("superadmin")||text.includes("herramientas admin"))return adminHelp();

  const orderTerm=extractOrderTerm(input);
  if(text.includes("diagnost")&&text.includes("pedido"))return diagnoseOrder(orderTerm);
  if((text.includes("destrabar")||text.includes("desbloquear")||text.includes("atascado")||text.includes("estancado")||text.includes("bloqueado"))&&text.includes("pedido"))return diagnoseOrder(orderTerm);
  if((text.includes("buscar")||text.includes("ver")||text.includes("consultar")||text.includes("revisar"))&&text.includes("pedido"))return orderTerm?diagnoseOrder(orderTerm):guideMessage(GUIDES.find(item=>item.id==="find-order"));

  const guide=bestGuide(input);if(guide)return guideMessage(guide);
  const module=moduleMatch(input);
  if(module){return assistantMessage({text:`${module.label}: ${module.help}`,actions:[{label:`Abrir ${module.label}`,kind:"primary",action:"navigate",module:module.id},{label:"Explicar paso a paso",action:"context-help",module:module.id}]})}

  return assistantMessage({text:"No quiero inventarte un procedimiento. Puedo ayudarte mejor si me dices la acción y, cuando aplique, el número del pedido. También puedes elegir una opción rápida abajo.",actions:[{label:"Ayuda del módulo actual",kind:"primary",action:"context-help"},{label:"Buscar pedido",action:"prompt",prompt:"Buscar pedido "},{label:"Último error",action:"last-error"}]});
}

async function submitQuery(input){
  const text=String(input||"").trim();if(!text||bot.busy)return;
  add(userMessage(text));setBusy(true);typing();
  try{
    const answer=await resolveQuery(text);
    replaceTyping(answer);setFace(answer.type==="success"?"success":"talking");
    setTimeout(()=>bot.open&&setFace("listening"),800);
  }catch(error){
    console.error("[PACO]",error);
    replaceTyping(assistantMessage({text:"No pude completar esa consulta con los permisos o datos actuales.",alert:{title:"Detalle",text:error.message||"Error inesperado"},actions:[{label:"Reintentar",action:"prompt",prompt:text},{label:"Abrir módulo actual",action:"navigate",module:currentModule()}]}));
    setFace("idle");
  }finally{setBusy(false)}
}

function route(moduleId,params={}){
  if(!allowed(moduleId)){add(assistantMessage({text:`Tu usuario no tiene lectura habilitada para ${MODULE_META[moduleId]?.label||moduleId}. No voy a intentar saltar ese permiso.`}));return}
  navigate(moduleId,params);closePanel();
}

function handleAction(button){
  const action=button.dataset.pacoAction;
  if(action==="navigate"){route(button.dataset.module||"dashboard");return}
  if(action==="open-order"){window.dispatchEvent(new CustomEvent("erp:open-order",{detail:button.dataset.orderId}));closePanel();return}
  if(action==="diagnose-order-id"){setBusy(true);typing();diagnoseOrderById(button.dataset.orderId).then(answer=>replaceTyping(answer)).catch(error=>replaceTyping(assistantMessage({text:error.message}))).finally(()=>setBusy(false));return}
  if(action==="prompt"){
    const input=bot.root.querySelector("[data-paco-input]");input.value=button.dataset.prompt||"";input.focus();input.setSelectionRange(input.value.length,input.value.length);return;
  }
  if(action==="password-self"){add(assistantMessage({text:"Escribe la nueva contraseña dos veces. El valor no se registra en el historial de Paco.",type:"password"}));setFace("listening");return}
  if(action==="context-help"){add(contextHelp());return}
  if(action==="admin-help"){add(adminHelp());return}
  if(action==="system-health"){setBusy(true);typing();systemHealth().then(answer=>replaceTyping(answer)).catch(error=>replaceTyping(assistantMessage({text:error.message}))).finally(()=>setBusy(false));return}
  if(action==="last-error"){add(explainLastError());return}
  if(action==="refresh-module"){window.__erpOrderListRefresh?.();toast("Paco solicitó actualizar la vista actual.");return}
}

function bindPasswordForms(){
  bot.root?.querySelectorAll("[data-paco-password-form]").forEach(form=>{
    if(form.dataset.bound)return;form.dataset.bound="1";
    form.addEventListener("submit",async event=>{
      event.preventDefault();if(bot.busy)return;
      const password=form.password.value,confirmValue=form.confirm.value;
      if(password!==confirmValue){toast("Las contraseñas no coinciden.","error");return}
      if(password.length<10||!/[A-Z]/.test(password)||!/[a-z]/.test(password)||!/\d/.test(password)){toast("Usa 10+ caracteres con mayúscula, minúscula y número.","error",6000);return}
      setBusy(true);form.querySelector("button").disabled=true;setFace("thinking");
      try{
        const {error}=await getSupabase().auth.updateUser({password});if(error)throw error;
        form.remove();add(assistantMessage({text:"Tu contraseña fue actualizada correctamente. Tu sesión administrativa u operativa actual continúa activa.",type:"success",actions:[{label:"Seguir trabajando",kind:"primary",action:"context-help"}]}));
        setFace("success");toast("Contraseña actualizada.");
      }catch(error){add(assistantMessage({text:"No fue posible actualizar la contraseña.",alert:{title:"Auth",text:error.message||"Error de autenticación"}}));setFace("idle")}
      finally{password.replace?.(/./g,"•");form.password.value="";form.confirm.value="";setBusy(false)}
    });
  });
}

function bind(){
  bot.root.querySelector("[data-paco-toggle]").addEventListener("click",()=>bot.open?closePanel():openPanel());
  bot.root.querySelector("[data-paco-close]").addEventListener("click",closePanel);
  bot.root.querySelector("[data-paco-form]").addEventListener("submit",event=>{event.preventDefault();const input=bot.root.querySelector("[data-paco-input]");const text=input.value;input.value="";submitQuery(text)});
  bot.root.querySelector("[data-paco-input]").addEventListener("keydown",event=>{if(event.key==="Enter"&&!event.shiftKey){event.preventDefault();bot.root.querySelector("[data-paco-form]").requestSubmit()}});
  bot.root.addEventListener("click",event=>{
    const action=event.target.closest?.("[data-paco-action]");if(action){handleAction(action);return}
    const quick=event.target.closest?.("[data-paco-quick-prompt]");if(quick)submitQuery(quick.dataset.pacoQuickPrompt);
  });
  document.addEventListener("click",event=>{if(event.target.closest?.(".nav-item"))setTimeout(updateContext,40)});
  window.addEventListener("erp:rpc-error",event=>{
    bot.lastError=event.detail||null;
    bot.root?.querySelector(".paco-launcher")?.classList.add("has-alert");
  });
  window.addEventListener("paco:open",event=>{openPanel();if(event.detail?.prompt){const input=bot.root.querySelector("[data-paco-input]");input.value=event.detail.prompt;input.focus()}});
}

function startIdleGestures(){
  clearInterval(bot.idleTimer);
  if(matchMedia?.("(prefers-reduced-motion: reduce)")?.matches)return;
  bot.idleTimer=setInterval(()=>{
    if(bot.open||bot.busy||!state.profile)return;
    setFace(Math.random()>.45?"wink":"listening");
    setTimeout(()=>!bot.open&&!bot.busy&&setFace("idle"),950);
  },12000);
}

export function installPacoBot(){
  const existing=document.querySelector("#paco-bot");
  if(existing){bot.root=existing;existing.hidden=!state.profile;updateContext();return}
  const wrapper=document.createElement("div");wrapper.innerHTML=renderRoot();bot.root=wrapper.firstElementChild;document.body.append(bot.root);
  bind();renderQuick();startIdleGestures();
  bot.unsubscribe=subscribe(next=>{if(!bot.root)return;bot.root.hidden=!next.profile;if(next.profile)updateContext();else{closePanel();bot.messages=[]}});
}
