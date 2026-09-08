import {state,subscribe,hasRole,can} from "../core/state.js";
import {navigate} from "../core/router.js";
import {getSupabase} from "../services/supabase.js";
import {api} from "../services/api.js";
import {fmt} from "../core/format.js";
import {toast} from "../core/ui.js";

/* CRM Suministros · Paco Bot Enterprise V11.18.2
   Contextual assistant over existing permission-controlled CRM services.
   Paco never stores privileged credentials and never bypasses workflow permissions. */

const MODULE_META={
  dashboard:{label:"Centro de operaciones",keywords:["inicio","dashboard","centro","indicadores"],help:"Revisa cargas, alertas, pedidos activos y prioridades generales."},
  orders:{label:"Pedidos",keywords:["pedido","pedidos","orden","buscar pedido","corregir pedido"],help:"Consulta expediente, estado, responsable, materiales y trazabilidad."},
  sales:{label:"Ventas y pedidos",keywords:["venta","ventas","crear pedido","nuevo pedido","cliente"],help:"Crea pedidos y registra información comercial y de entrega."},
  credit:{label:"Crédito",keywords:["credito","crédito","cupo","solicitud de credito"],help:"Radica, revisa y decide solicitudes de crédito."},
  cartera:{label:"Cartera",keywords:["cartera","mora","validacion financiera"],help:"Valida cartera y libera pedidos que requieren revisión financiera."},
  caja:{label:"Caja",keywords:["caja","retenido","pvn","caja facturacion"],help:"Gestiona validaciones de Caja y liberaciones asociadas."},
  purchasing:{label:"Compras",keywords:["compra","compras","abastecimiento","pve"],help:"Gestiona necesidades de compra y llegada de mercancía."},
  receiving:{label:"Recepción",keywords:["recepcion","recepción","recibir","mercancia","mercancía"],help:"Confirma recepción documental o física y asigna el siguiente paso."},
  picking:{label:"Alistamiento",keywords:["alistamiento","picking","buscar material","faltante"],help:"Verifica materiales, origen físico y faltantes antes de continuar."},
  cutting:{label:"Centro de corte",keywords:["corte","cortar","carreto","merma","reel"],help:"Ejecuta el corte guiado por referencia, carreto, plan y evidencia."},
  billing:{label:"Facturación",keywords:["factura","facturacion","facturación","facturar"],help:"Registra factura y soportes necesarios para liberar el pedido."},
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

const STEP_MODULE={
  CARTERA:"cartera",CAJA:"caja",CAJA_FACTURACION:"caja",COMPRAS:"purchasing",RECEPCION_MERCANCIA:"receiving",RECEPCION_PEDIDO:"receiving",
  ALISTAMIENTO:"picking",CORTE:"cutting",FACTURACION:"billing",CLIENT_POINT:"shipping",CLIENT_PICKUP:"shipping",LOCAL_DISPATCH:"shipping",NATIONAL_DISPATCH:"shipping",CLOSURE:"shipping",CLOSED:"orders"
};

const GUIDES=[
  {id:"create-order",title:"Crear un pedido",module:"sales",keywords:["crear pedido","nuevo pedido","registrar pedido","hacer pedido"],intro:"Te llevo al asistente de creación y te indico qué revisar antes de confirmar.",steps:[["Pedido y cliente","Registra número, cliente, tipo, condición de pago, ruta, prioridad y dirección."],["Materiales","Busca referencias oficiales y define cantidades o cortes."],["Revisión","Valida el resumen; el workflow define la primera etapa."]],actions:[{label:"Abrir Crear pedido",sub:"Iniciar el asistente comercial",icon:"＋",kind:"primary",action:"navigate",module:"sales",params:{create:"1"}}]},
  {id:"find-order",title:"Buscar o revisar un pedido",module:"orders",keywords:["buscar pedido","ver pedido","consultar pedido","encontrar pedido","revisar pedido"],intro:"Puedo buscar por número y diagnosticar etapa, responsable, incidencias y acciones visibles.",steps:[["Busca","Escribe el número del pedido."],["Diagnostica","Reviso etapa, estado, responsable y bloqueos visibles."],["Abre","Te llevo al expediente o al módulo correcto."]],actions:[{label:"Buscar pedido",sub:"Escribe el número para diagnosticar",icon:"⌕",kind:"primary",action:"prompt",prompt:"Buscar pedido "},{label:"Ir a Pedidos",sub:"Abrir el listado general",icon:"→",action:"navigate",module:"orders"}]},
  {id:"correct-order",title:"Corregir un pedido",module:"orders",keywords:["corregir pedido","editar pedido","arreglar pedido","modificar pedido"],intro:"La corrección depende del estado. Primero se identifica el pedido y luego se usa la acción autorizada, sin saltar controles.",steps:[["Identifica","Dime el número exacto."],["Ubica el dato","Abre expediente y revisa la etapa."],["Corrige con trazabilidad","Si ya avanzó, registra novedad o solicita aprobación."]],actions:[{label:"Diagnosticar pedido",sub:"Ver qué puede corregirse ahora",icon:"⌕",kind:"primary",action:"prompt",prompt:"Diagnosticar pedido "},{label:"Abrir Excepciones",sub:"Novedades y aprobaciones",icon:"!",action:"navigate",module:"approvals"}]},
  {id:"password",title:"Cambiar mi contraseña",module:null,keywords:["cambiar clave","cambiar contraseña","cambiar password","mi clave","mi contraseña","password"],intro:"Puedo cambiar la contraseña de tu propia sesión sin guardarla ni imprimirla en el chat.",steps:[["Nueva clave","10+ caracteres, mayúscula, minúscula y número."],["Confirmación","Repítela para evitar errores."],["Actualización","Se envía directamente a Supabase Auth."]],actions:[{label:"Cambiar mi contraseña",sub:"Acción segura de mi propia cuenta",icon:"⌂",kind:"primary",action:"password-self"}]},
  {id:"unblock",title:"Diagnosticar o destrabar un pedido",module:"approvals",keywords:["destrabar","desbloquear pedido","pedido bloqueado","bloqueo pedido","atascado","estancado","no avanza"],intro:"Primero encuentro la causa real: responsable, incidencia, aprobación, SLA o etapa pendiente.",steps:[["Diagnóstico","Dime el número del pedido."],["Causa","Reviso etapa, acciones e incidencias visibles."],["Resolución segura","Te llevo al control legítimo; no fuerzo estados por detrás del workflow."]],actions:[{label:"Diagnosticar pedido",sub:"Encontrar qué lo retiene",icon:"⚙",kind:"primary",action:"prompt",prompt:"Diagnosticar pedido "},{label:"Abrir Excepciones",sub:"Resolver bloqueos y aprobaciones",icon:"!",action:"navigate",module:"approvals"}]},
  {id:"inventory",title:"Consultar o corregir inventario",module:"inventory",keywords:["ajustar inventario","corregir inventario","ver disponible","ver reservado","stock disponible","movimiento inventario","lote"],intro:"Inventario separa físico, reservado, bloqueado y disponible. Las correcciones deben conservar trazabilidad por lote y ubicación.",steps:[["Busca referencia","Usa referencia, descripción, lote o ubicación."],["Valida detalle","Comprueba físico, reservas y movimientos."],["Ajusta con motivo","Si tu rol lo permite, registra el ajuste autorizado."]],actions:[{label:"Abrir Inventario",sub:"Existencias, lotes y movimientos",icon:"▣",kind:"primary",action:"navigate",module:"inventory"}]},
  {id:"cutting",title:"Trabajar una referencia en Corte",module:"cutting",keywords:["como cortar","cómo cortar","hacer corte","usar corte","carreto","merma corte"],intro:"Corte funciona como un flujo guiado de referencia, origen, ejecución y evidencia.",steps:[["Referencia","Busca una pendiente."],["Origen","Selecciona carreto/lote y confirma cantidad física."],["Ejecución","Revisa plan y merma; confirma."],["Cierre","Adjunta evidencia y termina."]],actions:[{label:"Abrir Centro de corte",sub:"Ir al flujo guiado de Corte",icon:"✂",kind:"primary",action:"navigate",module:"cutting"}]},
  {id:"receiving",title:"Resolver Recepción",module:"receiving",keywords:["como recibir","cómo recibir","recepcion mercancia","recepción mercancía","recepcion pedido"],intro:"Recepción valida ingreso físico/documental y determina el siguiente paso.",steps:[["Identifica el pedido","Abre el pedido asignado."],["Verifica soporte","Confirma mercancía o documento según el proceso."],["Completa","Registra resultado y deja evidencia cuando aplique."]],actions:[{label:"Abrir Recepción",sub:"Recepción de mercancía y pedido",icon:"↓",kind:"primary",action:"navigate",module:"receiving"}]},
  {id:"picking",title:"Resolver Alistamiento",module:"picking",keywords:["alistamiento","picking","faltante material","material no aparece"],intro:"Alistamiento verifica qué se entrega, de dónde sale y qué falta antes de continuar.",steps:[["Pedido","Abre la tarea asignada."],["Materiales","Confirma cantidades y origen físico."],["Novedad","Si falta material, registra la excepción en vez de avanzar incorrectamente."]],actions:[{label:"Abrir Alistamiento",sub:"Preparación y control de materiales",icon:"✓",kind:"primary",action:"navigate",module:"picking"},{label:"Abrir Excepciones",sub:"Registrar faltantes o bloqueos",icon:"!",action:"navigate",module:"approvals"}]},
  {id:"billing",title:"Resolver Facturación",module:"billing",keywords:["facturar","registrar factura","error factura","factura no carga"],intro:"Facturación registra la factura, soportes y datos requeridos para liberar el pedido.",steps:[["Pedido","Confirma que esté en Facturación."],["Factura","Registra número, fecha, valor y soporte."],["Validación","Corrige cualquier dato faltante antes de completar."]],actions:[{label:"Abrir Facturación",sub:"Registrar o revisar factura",icon:"▤",kind:"primary",action:"navigate",module:"billing"}]},
  {id:"shipping",title:"Resolver despacho o entrega",module:"shipping",keywords:["despachar","entregar pedido","guia transportadora","guía transportadora","pedido no entregado"],intro:"Despachos controla ruta, guía, salida, entrega, evidencia y cierre.",steps:[["Ruta","Confirma el tipo de entrega."],["Despacho","Registra guía/salida cuando aplique."],["Entrega","Adjunta evidencia y resultado."],["Cierre","Completa la verificación final."]],actions:[{label:"Abrir Despachos",sub:"Guías, entregas y cierre",icon:"→",kind:"primary",action:"navigate",module:"shipping"}]},
  {id:"workflow",title:"Corregir flujo, etapa o SLA",module:"admin",keywords:["corregir ciclo","cambiar ciclo","flujo incorrecto","cambiar sla","configurar sla","workflow","cambiar etapa","etapa incorrecta"],intro:"Los ciclos y SLA se gobiernan desde Administración. No deben corregirse editando estados directamente.",steps:[["Impacto","Identifica etapa, SLA, rol y pedidos afectados."],["Administración","Modifica solo el parámetro necesario."],["Validación","Comprueba el resultado en Flujo y tiempos."]],actions:[{label:"Abrir Administración",sub:"Flujo, SLA y permisos",icon:"⚙",kind:"primary",action:"navigate",module:"admin"},{label:"Abrir Flujo y tiempos",sub:"Validar efecto del cambio",icon:"↗",action:"navigate",module:"vsm"}]},
  {id:"reports",title:"Analizar o exportar información",module:"reports",keywords:["exportar excel","hacer reporte","analizar datos","crear analisis","crear análisis","kpi","reporte"],intro:"Analítica permite análisis ejecutivo y exploración BI sin escribir SQL.",steps:[["Periodo","Selecciona rango."],["Dominio","Escoge Operación, Comercial, Logística, Personas o Calidad."],["Explora","Combina dataset, dimensión y métrica."],["Exporta","Usa XLSX, CSV, JSON o Imprimir/PDF."]],actions:[{label:"Abrir Analítica",sub:"KPIs, BI y exportaciones",icon:"▥",kind:"primary",action:"navigate",module:"reports"}]},
  {id:"history",title:"Consultar Histórico",module:"imports",keywords:["historico","histórico","pedido antiguo","importar csv","archivo historico"],intro:"Histórico reúne pedidos cerrados, importaciones y expedientes auditables.",steps:[["Busca","Filtra por pedido, cliente o fecha."],["Expediente","Abre materiales, facturación, entregas, flujo y trazabilidad."],["Importaciones","Revisa lotes CSV y errores cuando existan."]],actions:[{label:"Abrir Histórico",sub:"Archivo y expedientes cerrados",icon:"◷",kind:"primary",action:"navigate",module:"imports"}]},
  {id:"audit",title:"Revisar trazabilidad",module:"audit",keywords:["quien cambio","quién cambió","auditoria","auditoría","trazabilidad","quien hizo"],intro:"Auditoría te permite rastrear qué cambió, quién lo hizo y cuándo.",steps:[["Filtra","Ubica entidad, pedido o periodo."],["Revisa evento","Consulta actor, acción y metadatos."],["Contrasta","Usa el expediente del pedido si necesitas contexto operativo."]],actions:[{label:"Abrir Auditoría",sub:"Eventos y decisiones del sistema",icon:"⌁",kind:"primary",action:"navigate",module:"audit"}]},
  {id:"users",title:"Usuarios, roles y permisos",module:"admin",keywords:["crear usuario","usuario no entra","permiso faltante","rol incorrecto","cambiar rol","activar usuario","desactivar usuario"],intro:"Administración centraliza usuarios, roles y permisos. Paco no eleva privilegios por sí mismo.",steps:[["Usuario","Verifica estado y perfil operativo."],["Rol","Comprueba roles asignados."],["Permiso","Revisa lectura/crear/actualizar/aprobar/administrar por módulo."],["Prueba","Super Admin puede entrar como usuario en sesión aislada."]],actions:[{label:"Abrir Administración",sub:"Usuarios y matriz de permisos",icon:"♙",kind:"primary",action:"navigate",module:"admin"}]},
  {id:"workforce",title:"Jornada y productividad",module:"workforce",keywords:["registrar actividad","jornada","pausa","productividad","tiempo muerto","actividad usuario"],intro:"Jornada y actividades registra trabajo, pausas y evidencia para que los KPIs de personas sean confiables.",steps:[["Actividad","Inicia o registra la actividad correcta."],["Pausa","Registra pausas explícitas cuando correspondan."],["Cierre","Completa resultado y evidencia."],["Análisis","Revisa métricas en Flujo y tiempos."]],actions:[{label:"Abrir Jornada",sub:"Actividades, pausas y evidencias",icon:"◴",kind:"primary",action:"navigate",module:"workforce"},{label:"Abrir Flujo y tiempos",sub:"Productividad y tiempos",icon:"↗",action:"navigate",module:"vsm"}]}
];

const CAPABILITIES=[
  {icon:"⌕",title:"Pedidos y clientes",detail:"Buscar, diagnosticar, corregir, abrir expedientes y detectar bloqueos.",prompt:"Ayuda con pedidos"},
  {icon:"↗",title:"Flujo y SLA",detail:"Etapas, cuellos de botella, tiempos, responsables y ciclos.",prompt:"Ayuda con flujo y SLA"},
  {icon:"▣",title:"Inventario",detail:"Stock, lotes, reservado, bloqueado, movimientos y ajustes.",prompt:"Ayuda con inventario"},
  {icon:"✂",title:"Corte",detail:"Referencia, carreto, merma, ejecución, evidencia y cierre.",prompt:"Ayuda con corte"},
  {icon:"▤",title:"Facturación",detail:"Registro de factura, soportes, errores y liberación del pedido.",prompt:"Ayuda con facturación"},
  {icon:"→",title:"Despachos",detail:"Rutas, guías, transportadora, entrega, evidencia y cierre.",prompt:"Ayuda con despachos"},
  {icon:"▥",title:"Analítica",detail:"KPIs, explorador BI, calidad del dato y exportaciones.",prompt:"Ayuda con analítica y reportes"},
  {icon:"◷",title:"Histórico",detail:"Expedientes cerrados, filtros, importaciones y cobertura.",prompt:"Ayuda con histórico"},
  {icon:"♙",title:"Usuarios y permisos",detail:"Roles, accesos, perfiles y verificación de usuarios.",prompt:"Ayuda con usuarios y permisos",module:"admin"},
  {icon:"⚙",title:"Administración",detail:"Workflow, SLA, calendarios, catálogos, reglas y sistema.",prompt:"Herramientas Super Admin",module:"admin"}
];

const bot={root:null,open:false,busy:false,messages:[],lastError:null,idleTimer:null,unsubscribe:null};

function escape(value){return fmt.escape(String(value??""))}
function norm(value){return String(value||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/\s+/g," ").trim()}
function pretty(value){return String(value||"").replaceAll("_"," ").toLowerCase().replace(/(^|\s)\S/g,m=>m.toUpperCase())}
function allowed(moduleId){return !moduleId||can(moduleId,"canRead")||moduleId===state.currentModule}
function currentModule(){return state.currentModule||document.querySelector(".nav-item.active")?.dataset?.module||"dashboard"}
function currentModuleLabel(){return MODULE_META[currentModule()]?.label||"CRM Suministros"}
function isSuperAdmin(){return hasRole("super_admin")}
function arrayFrom(value){return Array.isArray(value)?value:Array.isArray(value?.items)?value.items:Array.isArray(value?.actions)?value.actions:Array.isArray(value?.data)?value.data:[]}

function faceClass(name="idle"){return {idle:"is-idle",listening:"is-listening",wink:"is-wink",thinking:"is-thinking",talking:"is-talking",success:"is-success"}[name]||"is-idle"}
function setFace(name="idle"){
  bot.root?.querySelectorAll(".paco-face").forEach(face=>{
    face.classList.remove("is-idle","is-listening","is-wink","is-thinking","is-talking","is-success");
    face.classList.add(faceClass(name));
  });
}

function renderRoot(){
  return `<div id="paco-bot" class="paco-root" aria-live="polite">
    <button type="button" class="paco-launcher" aria-label="Abrir Paco Bot" aria-expanded="false" data-paco-toggle>
      <span class="paco-face is-idle" aria-hidden="true"></span><span class="paco-launcher-dot" aria-hidden="true"></span><span class="paco-launcher-label">Hola, soy Paco Bot</span>
    </button>
    <section class="paco-panel" aria-label="Paco Bot, asistente del CRM" hidden>
      <header class="paco-head">
        <span class="paco-face is-idle" aria-hidden="true"></span>
        <div class="paco-head-copy"><span>Asistente del CRM</span><strong>Paco Bot</strong><small data-paco-head-context>${escape(currentModuleLabel())}</small></div>
        <button type="button" class="paco-close" aria-label="Cerrar Paco Bot" data-paco-close>×</button>
      </header>
      <div class="paco-context"><span></span><div>Contexto actual: <strong data-paco-context>${escape(currentModuleLabel())}</strong></div><button type="button" class="paco-context-button" data-paco-action="context-list">Cambiar contexto</button></div>
      <div class="paco-messages" data-paco-messages></div>
      <div class="paco-quick" data-paco-quick></div>
      <form class="paco-composer" data-paco-form>
        <textarea rows="1" maxlength="700" aria-label="Escribe tu pregunta a Paco" placeholder="Escribe tu pregunta aquí…" data-paco-input></textarea>
        <button type="submit" class="paco-send" aria-label="Enviar" data-paco-send>➜</button>
      </form>
      <div class="paco-safe-note">◇ Paco ejecuta únicamente acciones seguras permitidas por tu sesión</div>
    </section>
  </div>`;
}

function assistantMessage({text="",steps=[],actions=[],card=null,alert=null,type="normal",catalog=null}={}){return {role:"assistant",text,steps,actions,card,alert,type,catalog,id:crypto.randomUUID()}}
function userMessage(text){return {role:"user",text,id:crypto.randomUUID()}}

function actionHtml(action){
  return `<button type="button" class="paco-action ${escape(action.kind||"")}" data-paco-action="${escape(action.action)}" ${action.module?`data-module="${escape(action.module)}"`:""} ${action.orderId?`data-order-id="${escape(action.orderId)}"`:""} ${action.prompt?`data-prompt="${escape(action.prompt)}"`:""}>
    <span class="paco-action-icon">${escape(action.icon||"→")}</span><span class="paco-action-copy"><b>${escape(action.label)}</b>${action.sub?`<small>${escape(action.sub)}</small>`:""}</span><span class="paco-action-arrow">›</span>
  </button>`;
}

function catalogHtml(catalog){
  const rows=(catalog||[]).filter(item=>allowed(item.module));
  if(!rows.length)return "";
  return `<div class="paco-capability-grid">${rows.map(item=>`<button type="button" class="paco-capability" data-paco-action="prompt" data-prompt="${escape(item.prompt)}"><span class="paco-capability-icon">${escape(item.icon)}</span><span><b>${escape(item.title)}</b><small>${escape(item.detail)}</small></span></button>`).join("")}</div>`;
}

function messageHtml(message){
  if(message.role==="user")return `<article class="paco-message user"><div class="paco-bubble"><div class="paco-message-text">${escape(message.text)}</div></div></article>`;
  if(message.type==="typing")return `<article class="paco-message assistant"><span class="paco-face paco-mini-face is-thinking" aria-hidden="true"></span><div class="paco-bubble"><span class="paco-typing" aria-label="Paco está pensando"><i></i><i></i><i></i></span></div></article>`;
  const steps=(message.steps||[]).length?`<div class="paco-steps">${message.steps.map((step,index)=>`<div class="paco-step"><span>${index+1}</span><div><strong>${escape(step[0])}</strong><small>${escape(step[1])}</small></div></div>`).join("")}</div>`:"";
  const card=message.card?`<div class="${message.card.type==="system"?"paco-system-card":"paco-order-card"}">${(message.card.rows||[]).map(row=>`<div><small>${escape(row[0])}</small><b>${escape(row[1])}</b></div>`).join("")}</div>`:"";
  const alert=message.alert?`<div class="paco-alert"><strong>${escape(message.alert.title)}</strong><span>${escape(message.alert.text)}</span></div>`:"";
  const availableActions=(message.actions||[]).filter(action=>allowed(action.module));
  const actions=availableActions.length?`<div class="paco-actions">${availableActions.map(actionHtml).join("")}</div>`:"";
  const password=message.type==="password"?passwordFormHtml():"";
  const catalog=message.catalog?catalogHtml(message.catalog):"";
  const welcome=message.type==="welcome"?`<span class="paco-welcome-title">Soy Paco Bot</span><div class="paco-message-text">${escape(message.text)}</div><span class="paco-welcome-question">¿En qué puedo ayudarte hoy?</span>`:`<div class="paco-message-text">${escape(message.text)}</div>`;
  return `<article class="paco-message assistant ${message.type==="welcome"?"welcome":""}"><span class="paco-face paco-mini-face ${faceClass(message.type==="success"?"success":"idle")}" aria-hidden="true"></span><div class="paco-bubble">${welcome}${steps}${card}${alert}${password}${catalog}${actions}</div></article>`;
}

function passwordFormHtml(){
  return `<form class="paco-password-box" data-paco-password-form autocomplete="off"><label>Nueva contraseña<input type="password" name="password" minlength="10" autocomplete="new-password" required></label><label>Confirmar contraseña<input type="password" name="confirm" minlength="10" autocomplete="new-password" required></label><small>10+ caracteres con mayúscula, minúscula y número. Paco no guarda este valor.</small><button class="paco-action primary" type="submit"><span class="paco-action-icon">⌂</span><span class="paco-action-copy"><b>Actualizar mi contraseña</b></span><span class="paco-action-arrow">›</span></button></form>`;
}

function renderMessages(){const box=bot.root?.querySelector("[data-paco-messages]");if(!box)return;box.innerHTML=bot.messages.map(messageHtml).join("");box.scrollTop=box.scrollHeight;bindPasswordForms()}

function quickPrompts(){
  const contextual={orders:["Buscar pedido","Corregir pedido","Destrabar pedido","Ver todo lo que puede hacer Paco"],sales:["Crear pedido","Buscar pedido","Cambiar mi clave","Ver todo lo que puede hacer Paco"],cutting:["¿Cómo hago el corte?","Destrabar pedido","Ir a Flujo y tiempos","Ver todo lo que puede hacer Paco"],inventory:["Corregir inventario","Ver disponible","Exportar reporte","Ver todo lo que puede hacer Paco"],admin:["Usuarios y permisos","Corregir flujo o SLA","Diagnóstico del sistema","Ver todo lo que puede hacer Paco"],reports:["Crear análisis","Exportar Excel","Calidad del dato","Ver todo lo que puede hacer Paco"],workforce:["Registrar actividad","Ver productividad","Cambiar mi clave","Ver todo lo que puede hacer Paco"]};
  return contextual[currentModule()]||["Buscar pedido","¿Cómo hago esto?","Cambiar mi clave","Ver todo lo que puede hacer Paco"];
}
function renderQuick(){const row=bot.root?.querySelector("[data-paco-quick]");if(!row)return;row.innerHTML=quickPrompts().map(prompt=>`<button type="button" data-paco-quick-prompt="${escape(prompt)}">${escape(prompt)}</button>`).join("")}
function updateContext(){const label=currentModuleLabel();bot.root?.querySelectorAll("[data-paco-context],[data-paco-head-context]").forEach(node=>node.textContent=label);renderQuick()}
function add(message){bot.messages.push(message);renderMessages()}
function replaceTyping(message){bot.messages=bot.messages.filter(item=>item.type!=="typing");if(message)bot.messages.push(message);renderMessages()}
function typing(){bot.messages=bot.messages.filter(item=>item.type!=="typing");bot.messages.push({role:"assistant",type:"typing",id:"typing"});renderMessages();setFace("thinking")}
function setBusy(value){bot.busy=value;const send=bot.root?.querySelector("[data-paco-send]");if(send)send.disabled=value}

function welcome(){
  if(bot.messages.length)return;
  const name=state.profile?.displayName||state.profile?.display_name||"";
  add(assistantMessage({type:"welcome",text:`${name?`Hola, ${name}. `:""}Puedo explicarte procesos, llevarte al módulo correcto, buscar y diagnosticar pedidos, ayudarte con errores del CRM y ejecutar acciones seguras permitidas por tu cuenta.`,actions:[
    {label:"Buscar un pedido",sub:"Estado, etapa y bloqueos",icon:"⌕",kind:"primary",action:"prompt",prompt:"Buscar pedido "},
    {label:"¿Cómo hago esto?",sub:"Guía del módulo actual",icon:"?",action:"context-help"},
    {label:"Cambiar mi contraseña",sub:"Acción segura de mi cuenta",icon:"⌂",action:"password-self"},
    {label:"Destrabar pedido",sub:"Diagnosticar antes de actuar",icon:"⚙",action:"prompt",prompt:"Destrabar pedido "},
    ...(isSuperAdmin()?[{label:"Herramientas Super Admin",sub:"Usuarios, permisos, flujo y sistema",icon:"★",kind:"warning",action:"admin-help",module:"admin"}]:[]),
    {label:"Ver todas las capacidades",sub:"Centro completo de ayuda de Paco",icon:"☷",action:"all-help"}
  ]}));
}

function openPanel(){const panel=bot.root?.querySelector(".paco-panel"),launcher=bot.root?.querySelector(".paco-launcher");if(!panel||!launcher)return;panel.hidden=false;launcher.setAttribute("aria-expanded","true");bot.open=true;launcher.classList.remove("has-alert");setFace("listening");welcome();updateContext();setTimeout(()=>bot.root?.querySelector("[data-paco-input]")?.focus(),80)}
function closePanel(){const panel=bot.root?.querySelector(".paco-panel"),launcher=bot.root?.querySelector(".paco-launcher");if(!panel||!launcher)return;panel.hidden=true;launcher.setAttribute("aria-expanded","false");bot.open=false;setFace("idle")}

function bestGuide(input){const text=norm(input);let best=null,score=0;for(const guide of GUIDES){let current=0;for(const keyword of guide.keywords){const key=norm(keyword);if(text.includes(key))current+=Math.max(2,key.split(" ").length*2)}if(current>score){best=guide;score=current}}return score?best:null}
function moduleMatch(input){const text=norm(input);let best=null,score=0;for(const [id,meta] of Object.entries(MODULE_META)){let current=0;for(const keyword of meta.keywords)if(text.includes(norm(keyword)))current+=norm(keyword).split(" ").length;if(current>score){best={id,...meta};score=current}}return score?best:null}
function extractOrderTerm(input){const raw=String(input||"");const explicit=raw.match(/(?:pedido|orden)\s*(?:#|n[úu]mero|no\.?|nro\.?|:)?\s*([A-Za-z0-9][A-Za-z0-9._/-]{2,})/i)?.[1];if(explicit&&!/^(bloqueado|atascado|estancado|pendiente|que|como|cómo)$/i.test(explicit))return explicit;const code=raw.match(/\b[A-Za-z]{1,8}[-_]\d{2,}[A-Za-z0-9-]*\b/)?.[0];if(code)return code;return raw.match(/\b\d{4,}\b/)?.[0]||""}
function guideMessage(guide){return assistantMessage({text:`${guide.title}. ${guide.intro}`,steps:guide.steps,actions:guide.actions})}

function allHelp(){return assistantMessage({text:"Este es mi centro de ayuda. Elige el tema y te doy instrucciones, te llevo al módulo correcto o reviso información real cuando la acción lo permite.",catalog:CAPABILITIES,actions:[{label:"Ayuda del módulo actual",sub:currentModuleLabel(),icon:"?",kind:"primary",action:"context-help"},{label:"Último error detectado",sub:"Explicar el último error RPC de esta sesión",icon:"!",action:"last-error"}]})}

function contextList(){
  const readable=Object.entries(MODULE_META).filter(([id])=>allowed(id)).map(([id,meta])=>({icon:"→",title:meta.label,detail:meta.help,prompt:`Ayuda con ${meta.label}`,module:id}));
  return assistantMessage({text:"Selecciona el área sobre la que quieres ayuda. Solo muestro módulos que tu sesión puede consultar.",catalog:readable});
}

async function diagnoseOrder(term){
  if(!term)return assistantMessage({text:"Dime el número exacto del pedido.",actions:[{label:"Escribir número",sub:"Ejemplo: 45832",icon:"⌕",kind:"primary",action:"prompt",prompt:"Diagnosticar pedido "}]});
  const list=await api.listOrders({search:term,page:1,pageSize:8,includeHistory:true,assignment:"ALL"});
  const rows=list?.items||[];
  if(!rows.length)return assistantMessage({text:`No encontré pedidos visibles para “${term}”.`,actions:[{label:"Abrir Pedidos",sub:"Buscar manualmente",icon:"→",action:"navigate",module:"orders"}]});
  if(rows.length>1)return assistantMessage({text:`Encontré ${rows.length} coincidencias. Elige cuál revisar.`,actions:rows.slice(0,6).map(row=>({label:`${row.orderNumber} · ${row.clientName||"Cliente"}`,sub:"Diagnosticar este pedido",icon:"⌕",action:"diagnose-order-id",orderId:row.id}))});
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
  const orderNumber=detail.orderNumber||detail.order_number||row.orderNumber||"Pedido";
  const route=detail.route||detail.deliveryRoute||row.route||"";
  const moduleId=STEP_MODULE[String(step).toUpperCase()]||"orders";
  const warning=openIssues.length?`${openIssues.length} incidencia(s) abierta(s) pueden estar reteniendo el flujo.`:(row.slaExceeded?"El pedido aparece con plazo excedido.":(!actions.length?"No veo acciones operativas disponibles para tu usuario en este momento.":null));
  return assistantMessage({text:`Diagnóstico de ${orderNumber}: está en ${stepName} con estado ${pretty(status)}.`,card:{type:"order",rows:[["Cliente",detail.clientName||row.clientName||"—"],["Responsable",assignee],["Ruta",route?pretty(route):"—"],["Acciones visibles",String(actions.length)],["Incidencias abiertas",String(openIssues.length)]]},alert:warning?{title:"Atención",text:warning}:null,actions:[...(id?[{label:"Abrir expediente",sub:"Ver el pedido completo",icon:"→",kind:"primary",action:"open-order",orderId:id,module:"orders"}]:[]),...(moduleId!=="orders"?[{label:`Ir a ${MODULE_META[moduleId]?.label||"etapa"}`,sub:"Abrir la etapa operativa actual",icon:"↗",action:"navigate",module:moduleId}]:[]),...(openIssues.length?[{label:"Resolver en Excepciones",sub:"Incidencias y aprobaciones",icon:"!",kind:"warning",action:"navigate",module:"approvals"}]:[])]});
}

async function systemHealth(){if(!(isSuperAdmin()||can("admin","canRead")))return assistantMessage({text:"El diagnóstico técnico global está reservado a perfiles administrativos. Sí puedo diagnosticar el módulo o pedido que tengas abierto."});const result=await api.health();const entries=Object.entries(result||{}).filter(([,value])=>["string","number","boolean"].includes(typeof value)).slice(0,8);return assistantMessage({text:"Consulté el health check del CRM con tus permisos actuales.",card:{type:"system",rows:entries.length?entries.map(([key,value])=>[pretty(key),String(value)]):[["Resultado","Servicio respondió correctamente"]]},actions:[{label:"Abrir Administración",sub:"Configuración y salud",icon:"⚙",action:"navigate",module:"admin"},{label:"Abrir Auditoría",sub:"Revisar eventos",icon:"⌁",action:"navigate",module:"audit"}]})}

function explainLastError(){const error=bot.lastError;if(!error)return assistantMessage({text:"No he detectado errores RPC del CRM durante esta sesión. Si algo visual falla, dime qué estabas haciendo y en qué módulo."});const technical=String(error.message||"Error sin detalle");const friendly=/permission|42501|autoriz/i.test(technical)?"La operación fue rechazada por permisos.":/network|fetch|connection|503|504/i.test(technical)?"Parece un problema temporal de conexión o disponibilidad.":/concurrent|version|simult/i.test(technical)?"El registro cambió mientras lo estabas editando; conviene actualizar y repetir la acción.":"El servidor devolvió un error durante la última operación.";return assistantMessage({text:`${friendly} RPC: ${error.rpc||"operación del CRM"}.`,alert:{title:"Último error detectado",text:technical.slice(0,340)},actions:[{label:"Actualizar módulo",sub:"Recargar datos de la vista",icon:"↻",action:"refresh-module"},{label:"Abrir Auditoría",sub:"Buscar trazabilidad",icon:"⌁",action:"navigate",module:"audit"}]})}

function contextHelp(){const id=currentModule(),meta=MODULE_META[id];if(!meta)return assistantMessage({text:"Dime qué quieres hacer y te llevaré al proceso correcto."});const guide=GUIDES.find(item=>item.module===id);if(guide)return guideMessage(guide);return assistantMessage({text:`Estás en ${meta.label}. ${meta.help}`,actions:[{label:`Volver a ${meta.label}`,sub:"Abrir módulo",icon:"→",kind:"primary",action:"navigate",module:id},{label:"Buscar pedido",sub:"Diagnóstico por número",icon:"⌕",action:"prompt",prompt:"Buscar pedido "}]})}
function adminHelp(){if(!isSuperAdmin())return assistantMessage({text:"Las herramientas Super Admin solo aparecen cuando la sesión actual tiene ese rol. Paco no utiliza credenciales administrativas propias ni puede elevar permisos."});return assistantMessage({text:"Tu sesión tiene rol Super Admin. Puedo ayudarte a llegar a los controles privilegiados, diagnosticar salud y explicar el impacto antes de modificar configuración.",steps:[["Usuarios y permisos","Alta, activación, roles, permisos y verificación de perfiles."],["Flujo y SLA","Etapas, orden, tiempos objetivo y permisos por rol."],["Sistema","Calendario, catálogos, reglas, secuencias y salud."],["Auditoría","Cada cambio administrativo conserva actor y trazabilidad."]],actions:[{label:"Abrir Administración",sub:"Centro de control",icon:"⚙",kind:"primary",action:"navigate",module:"admin"},{label:"Diagnóstico del sistema",sub:"Health check",icon:"✓",action:"system-health"},{label:"Abrir Auditoría",sub:"Eventos administrativos",icon:"⌁",action:"navigate",module:"audit"}]})}

async function resolveQuery(input){
  const text=norm(input);
  if(!text)return assistantMessage({text:"Escribe qué quieres hacer. Puedes hablarme como: “buscar pedido 45832”, “cambiar mi clave”, “cómo hago un corte” o “qué puedes hacer”."});
  if(/^(hola|buenas|hey|paco|ayuda)$/.test(text))return assistantMessage({text:"Aquí estoy. Puedo orientarte, navegar, diagnosticar pedidos, explicar errores y ayudarte con acciones seguras.",actions:[{label:"Ver todas mis capacidades",sub:"Centro de ayuda completo",icon:"☷",kind:"primary",action:"all-help"},{label:"Buscar pedido",sub:"Estado y bloqueos",icon:"⌕",action:"prompt",prompt:"Buscar pedido "},{label:"Cambiar mi clave",sub:"Mi propia cuenta",icon:"⌂",action:"password-self"}]});
  if(text.includes("que puedes hacer")||text.includes("qué puedes hacer")||text.includes("ayudame con todo")||text.includes("ayúdame con todo")||text.includes("ver todo lo que puede hacer paco"))return allHelp();
  if(text.includes("ultimo error")||text.includes("último error")||text.includes("que fallo")||text.includes("qué falló")||text.includes("por que fallo")||text.includes("por qué falló"))return explainLastError();
  if(text.includes("diagnostico del sistema")||text.includes("diagnóstico del sistema")||text.includes("health check")||text.includes("salud del sistema"))return systemHealth();
  if(text.includes("super admin")||text.includes("superadmin")||text.includes("herramientas admin"))return adminHelp();
  const orderTerm=extractOrderTerm(input);
  if(text.includes("diagnost")&&text.includes("pedido"))return diagnoseOrder(orderTerm);
  if((text.includes("destrabar")||text.includes("desbloquear")||text.includes("atascado")||text.includes("estancado")||text.includes("bloqueado")||text.includes("no avanza"))&&text.includes("pedido"))return diagnoseOrder(orderTerm);
  if((text.includes("buscar")||text.includes("ver")||text.includes("consultar")||text.includes("revisar"))&&text.includes("pedido"))return orderTerm?diagnoseOrder(orderTerm):guideMessage(GUIDES.find(item=>item.id==="find-order"));
  const guide=bestGuide(input);if(guide)return guideMessage(guide);
  const module=moduleMatch(input);if(module)return assistantMessage({text:`${module.label}: ${module.help}`,actions:[{label:`Abrir ${module.label}`,sub:"Ir al módulo",icon:"→",kind:"primary",action:"navigate",module:module.id},{label:"Explicar paso a paso",sub:"Guía contextual",icon:"?",action:"context-help",module:module.id}]});
  return assistantMessage({text:"No quiero inventarte un procedimiento. Dime la acción concreta y, cuando aplique, el número del pedido. También puedes abrir mi centro completo de ayuda.",actions:[{label:"Ver todas mis capacidades",sub:"Pedidos, inventario, flujo, admin y más",icon:"☷",kind:"primary",action:"all-help"},{label:"Ayuda del módulo actual",sub:currentModuleLabel(),icon:"?",action:"context-help"},{label:"Último error",sub:"Explicar el error RPC más reciente",icon:"!",action:"last-error"}]});
}

async function submitQuery(input){const text=String(input||"").trim();if(!text||bot.busy)return;add(userMessage(text));setBusy(true);typing();try{const answer=await resolveQuery(text);replaceTyping(answer);setFace(answer.type==="success"?"success":"talking");setTimeout(()=>bot.open&&setFace("listening"),800)}catch(error){console.error("[PACO]",error);replaceTyping(assistantMessage({text:"No pude completar esa consulta con los permisos o datos actuales.",alert:{title:"Detalle",text:error.message||"Error inesperado"},actions:[{label:"Reintentar",sub:"Volver a consultar",icon:"↻",action:"prompt",prompt:text},{label:"Abrir módulo actual",sub:currentModuleLabel(),icon:"→",action:"navigate",module:currentModule()}]}));setFace("idle")}finally{setBusy(false)}}

function route(moduleId,params={}){if(!allowed(moduleId)){add(assistantMessage({text:`Tu usuario no tiene lectura habilitada para ${MODULE_META[moduleId]?.label||moduleId}. No voy a intentar saltar ese permiso.`}));return}navigate(moduleId,params);closePanel()}

function handleAction(button){
  const action=button.dataset.pacoAction;
  if(action==="navigate"){route(button.dataset.module||"dashboard");return}
  if(action==="open-order"){window.dispatchEvent(new CustomEvent("erp:open-order",{detail:button.dataset.orderId}));closePanel();return}
  if(action==="diagnose-order-id"){setBusy(true);typing();diagnoseOrderById(button.dataset.orderId).then(answer=>replaceTyping(answer)).catch(error=>replaceTyping(assistantMessage({text:error.message}))).finally(()=>setBusy(false));return}
  if(action==="prompt"){const input=bot.root.querySelector("[data-paco-input]");input.value=button.dataset.prompt||"";input.focus();input.setSelectionRange(input.value.length,input.value.length);return}
  if(action==="password-self"){add(assistantMessage({text:"Escribe la nueva contraseña dos veces. El valor no se registra en el historial de Paco.",type:"password"}));setFace("listening");return}
  if(action==="context-help"){add(contextHelp());return}
  if(action==="context-list"){add(contextList());return}
  if(action==="all-help"){add(allHelp());return}
  if(action==="admin-help"){add(adminHelp());return}
  if(action==="system-health"){setBusy(true);typing();systemHealth().then(answer=>replaceTyping(answer)).catch(error=>replaceTyping(assistantMessage({text:error.message}))).finally(()=>setBusy(false));return}
  if(action==="last-error"){add(explainLastError());return}
  if(action==="refresh-module"){window.__erpOrderListRefresh?.();toast("Paco solicitó actualizar la vista actual.");return}
}

function bindPasswordForms(){bot.root?.querySelectorAll("[data-paco-password-form]").forEach(form=>{if(form.dataset.bound)return;form.dataset.bound="1";form.addEventListener("submit",async event=>{event.preventDefault();if(bot.busy)return;const password=form.password.value,confirmValue=form.confirm.value;if(password!==confirmValue){toast("Las contraseñas no coinciden.","error");return}if(password.length<10||!/[A-Z]/.test(password)||!/[a-z]/.test(password)||!/\d/.test(password)){toast("Usa 10+ caracteres con mayúscula, minúscula y número.","error",6000);return}setBusy(true);form.querySelector("button").disabled=true;setFace("thinking");try{const {error}=await getSupabase().auth.updateUser({password});if(error)throw error;form.remove();add(assistantMessage({text:"Tu contraseña fue actualizada correctamente. Tu sesión actual continúa activa.",type:"success",actions:[{label:"Seguir trabajando",sub:"Volver a la ayuda contextual",icon:"✓",kind:"primary",action:"context-help"}]}));setFace("success");toast("Contraseña actualizada.")}catch(error){add(assistantMessage({text:"No fue posible actualizar la contraseña.",alert:{title:"Auth",text:error.message||"Error de autenticación"}}));setFace("idle")}finally{form.password.value="";form.confirm.value="";setBusy(false)}})})}

function bind(){
  bot.root.querySelector("[data-paco-toggle]").addEventListener("click",()=>bot.open?closePanel():openPanel());
  bot.root.querySelector("[data-paco-close]").addEventListener("click",closePanel);
  bot.root.querySelector("[data-paco-form]").addEventListener("submit",event=>{event.preventDefault();const input=bot.root.querySelector("[data-paco-input]");const text=input.value;input.value="";submitQuery(text)});
  bot.root.querySelector("[data-paco-input]").addEventListener("keydown",event=>{if(event.key==="Enter"&&!event.shiftKey){event.preventDefault();bot.root.querySelector("[data-paco-form]").requestSubmit()}});
  bot.root.addEventListener("click",event=>{const action=event.target.closest?.("[data-paco-action]");if(action){handleAction(action);return}const quick=event.target.closest?.("[data-paco-quick-prompt]");if(quick)submitQuery(quick.dataset.pacoQuickPrompt)});
  document.addEventListener("click",event=>{if(event.target.closest?.(".nav-item"))setTimeout(updateContext,40)});
  window.addEventListener("erp:rpc-error",event=>{bot.lastError=event.detail||null;bot.root?.querySelector(".paco-launcher")?.classList.add("has-alert")});
  window.addEventListener("paco:open",event=>{openPanel();if(event.detail?.prompt){const input=bot.root.querySelector("[data-paco-input]");input.value=event.detail.prompt;input.focus()}});
}

function startIdleGestures(){clearInterval(bot.idleTimer);if(matchMedia?.("(prefers-reduced-motion: reduce)")?.matches)return;bot.idleTimer=setInterval(()=>{if(bot.open||bot.busy||!state.profile)return;setFace(Math.random()>.45?"wink":"listening");setTimeout(()=>!bot.open&&!bot.busy&&setFace("idle"),950)},12000)}

export function installPacoBot(){
  const existing=document.querySelector("#paco-bot");
  if(existing){bot.root=existing;existing.hidden=!state.profile;updateContext();return}
  const wrapper=document.createElement("div");wrapper.innerHTML=renderRoot();bot.root=wrapper.firstElementChild;document.body.append(bot.root);
  bind();renderQuick();startIdleGestures();
  bot.unsubscribe=subscribe(next=>{if(!bot.root)return;bot.root.hidden=!next.profile;if(next.profile)updateContext();else{closePanel();bot.messages=[]}});
}
