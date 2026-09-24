
import {state,subscribe,can} from "../core/state.js";
import {navigate} from "../core/router.js";
import {api} from "../services/api.js";
import {fmt} from "../core/format.js";
import {catalogTaxonomy} from "./workforce-catalog-v11343.js";
import {
  assistantIntent,
  normalizeAssistantText,
  editDistance,
  extractOrderReference,
  extractInventoryTerm
} from "./paco-assistant-intent-v11370.js";

// CRM Suministros · PACO Operational Assistant V11.37.0
// Single-owner runtime: conversación, feed operativo, voz y acciones seguras.

const VERSION="11.37.0";
const STYLE_ID="paco-assistant-v11370-style";
const ROOT_ID="paco-assistant-v11370";
const VOICE_PREF_KEY="erp:paco:v11370:voice";
const SEEN_KEY="erp:paco:v11370:seen";
const MAX_MESSAGES=80;

const ASSETS=Object.freeze({
  idle:"./assets/img/paco/paco-idle-v11183.svg",
  listening:"./assets/img/paco/paco-listening-v11183.svg",
  thinking:"./assets/img/paco/paco-thinking-v11183.svg",
  talking:"./assets/img/paco/paco-talking-v11183.svg",
  success:"./assets/img/paco/paco-success-v11183.svg"
});

const STEP_MODULE={
  CARTERA:"cartera",
  CAJA:"caja",
  CAJA_FACTURACION:"caja",
  COMPRAS:"purchasing",
  RECEPCION_MERCANCIA:"receiving",
  RECEPCION_PEDIDO:"receiving",
  ALISTAMIENTO:"picking",
  CORTE:"cutting",
  FACTURACION:"billing",
  CLIENT_POINT:"shipping",
  CLIENT_PICKUP:"shipping",
  LOCAL_DISPATCH:"shipping",
  NATIONAL_DISPATCH:"shipping",
  CLOSURE:"shipping",
  CLOSED:"orders"
};

const MODULE_LABELS={
  dashboard:"Centro de operaciones",
  orders:"Pedidos",
  sales:"Ventas y pedidos",
  credit:"Crédito",
  cartera:"Cartera",
  caja:"Caja",
  purchasing:"Compras",
  receiving:"Recepción",
  picking:"Alistamiento",
  cutting:"Centro de corte",
  billing:"Facturación",
  shipping:"Despachos y entregas",
  inventory:"Inventario",
  workforce:"Jornada y actividades",
  approvals:"Excepciones y aprobaciones",
  vsm:"Flujo y tiempos",
  reports:"Analítica y reportes",
  imports:"Histórico",
  audit:"Auditoría",
  admin:"Administración"
};

const paco={
  root:null,
  messages:[],
  busy:false,
  feed:null,
  flow:null,
  catalog:null,
  lastServerTime:null,
  firstFeed:true,
  pollTimer:null,
  pollBusy:false,
  unread:0,
  voiceEnabled:readBoolean(VOICE_PREF_KEY,true),
  voiceUnlocked:false,
  seen:readSeen(),
  alertKeys:new Set(),
  unsubscribe:null,
  globalBound:false,
  stateBound:false,
  installed:false,
  face:"idle",
  peekTimer:null
};

export function installPacoAssistant(){
  if(paco.installed&&document.getElementById(ROOT_ID))return;
  paco.installed=true;

  document.getElementById("paco-bot")?.remove();
  document.getElementById(ROOT_ID)?.remove();
  ensureStyles();

  document.body.insertAdjacentHTML("beforeend",renderRoot());
  paco.root=document.getElementById(ROOT_ID);
  bindRoot();
  bindGlobal();
  syncProfile();
  ensureWelcome();
  renderMessages();
  renderQuick();
  renderOperationalSummary();
  scheduleFeed(250);
}

function ensureStyles(){
  if(document.getElementById(STYLE_ID))return;
  const link=document.createElement("link");
  link.id=STYLE_ID;
  link.rel="stylesheet";
  link.href="./assets/runtime-css/paco-assistant-v11370.css?v=11.37.0";
  document.head.appendChild(link);
}

function renderRoot(){
  return `<div id="${ROOT_ID}" class="paco3-root" data-paco-version="${VERSION}">
    <div class="paco3-peek" data-paco3-peek hidden>
      <button type="button" class="paco3-peek-main" data-paco3-peek-open>
        <span class="paco3-peek-icon" data-paco3-peek-icon>!</span>
        <span class="paco3-peek-copy"><strong data-paco3-peek-title>PACO</strong><small data-paco3-peek-text></small></span>
      </button>
      <button type="button" class="paco3-peek-close" aria-label="Cerrar aviso" data-paco3-peek-close>×</button>
    </div>

    <button type="button" class="paco3-launcher" aria-label="Abrir PACO" aria-expanded="false" data-paco3-toggle>
      <img src="${ASSETS.idle}" alt="" aria-hidden="true" draggable="false" data-paco3-launcher-face>
      <span class="paco3-launcher-status"></span>
      <b class="paco3-unread" data-paco3-unread hidden>0</b>
    </button>

    <section class="paco3-panel" role="dialog" aria-label="PACO, asistente operativo del CRM" aria-modal="false">
      <header class="paco3-head">
        <img src="${ASSETS.idle}" alt="" aria-hidden="true" draggable="false" data-paco3-face>
        <div class="paco3-head-copy">
          <span>ASISTENTE OPERATIVO</span>
          <strong>PACO</strong>
          <small data-paco3-context>Conectado al CRM</small>
        </div>
        <button type="button" class="paco3-head-action" data-paco3-voice aria-label="Activar o desactivar voz"></button>
        <button type="button" class="paco3-close" data-paco3-close aria-label="Cerrar PACO">×</button>
      </header>

      <section class="paco3-livebar" data-paco3-livebar>
        <button type="button" data-paco3-action="show-alerts">
          <span class="paco3-live-dot"></span>
          <span><strong data-paco3-live-title>Operación en línea</strong><small data-paco3-live-detail>Sin alertas pendientes</small></span>
          <b data-paco3-live-count>0</b>
        </button>
      </section>

      <div class="paco3-messages" data-paco3-messages aria-live="polite"></div>
      <div class="paco3-quick" data-paco3-quick></div>

      <form class="paco3-composer" data-paco3-form>
        <textarea rows="1" maxlength="700" autocomplete="off" data-paco3-input
          aria-label="Escribe a PACO"
          placeholder="Ej: registrar actividad, pedido 45832, quién está libre…"></textarea>
        <button type="submit" data-paco3-send aria-label="Enviar mensaje">➜</button>
      </form>

      <div class="paco3-footnote">
        <span></span>PACO consulta el CRM y solo ejecuta acciones permitidas por tu sesión.
      </div>
    </section>
  </div>`;
}

function bindRoot(){
  const root=paco.root;
  if(!root)return;

  root.querySelector("[data-paco3-toggle]")?.addEventListener("click",()=>setOpen(!isOpen()));
  root.querySelector("[data-paco3-close]")?.addEventListener("click",()=>setOpen(false));
  root.querySelector("[data-paco3-voice]")?.addEventListener("click",toggleVoice);
  root.querySelector("[data-paco3-peek-open]")?.addEventListener("click",()=>setOpen(true));
  root.querySelector("[data-paco3-peek-close]")?.addEventListener("click",hidePeek);

  root.querySelector("[data-paco3-form]")?.addEventListener("submit",event=>{
    event.preventDefault();
    const input=root.querySelector("[data-paco3-input]");
    const value=input?.value?.trim();
    if(!value)return;
    input.value="";
    submit(value);
  });

  root.querySelector("[data-paco3-input]")?.addEventListener("keydown",event=>{
    if(event.key==="Enter"&&!event.shiftKey){
      event.preventDefault();
      root.querySelector("[data-paco3-form]")?.requestSubmit();
    }
  });

  root.addEventListener("click",event=>{
    const button=event.target.closest?.("[data-paco3-action]");
    if(!button)return;
    handleAction(button);
  });

  syncVoiceButton();
}

function bindGlobal(){
  if(paco.globalBound)return;
  paco.globalBound=true;

  const unlock=()=>{
    paco.voiceUnlocked=true;
    document.removeEventListener("pointerdown",unlock,true);
    document.removeEventListener("keydown",unlock,true);
  };
  document.addEventListener("pointerdown",unlock,true);
  document.addEventListener("keydown",unlock,true);

  window.addEventListener("erp:work-changed",()=>scheduleFeed(500));
  window.addEventListener("paco:open",()=>setOpen(true));
  window.addEventListener("paco:close",()=>setOpen(false));

  document.addEventListener("visibilitychange",()=>{
    if(document.hidden){
      clearTimeout(paco.pollTimer);
      paco.pollTimer=null;
    }else scheduleFeed(250);
  });

  if(!paco.stateBound){
    paco.stateBound=true;
    paco.unsubscribe=subscribe(()=>syncProfile());
  }
}

function syncProfile(){
  if(!paco.root)return;
  const module=state.currentModule||"dashboard";
  const label=MODULE_LABELS[module]||"CRM Suministros";
  const context=paco.root.querySelector("[data-paco3-context]");
  const display=state.profile?.displayName||state.profile?.name||"";
  if(context)context.textContent=`${label} · ${firstName(display)||"Tu sesión"}`;
}

function isOpen(){
  return Boolean(paco.root?.classList.contains("is-open"));
}

function setOpen(open){
  if(!paco.root)return;
  paco.root.classList.toggle("is-open",Boolean(open));
  paco.root.querySelector("[data-paco3-toggle]")?.setAttribute("aria-expanded",String(Boolean(open)));

  if(open){
    paco.unread=0;
    renderUnread();
    hidePeek();
    setFace("listening");
    scheduleFeed(100);
    requestAnimationFrame(()=>setTimeout(()=>paco.root?.querySelector("[data-paco3-input]")?.focus(),80));
  }else{
    setFace("idle");
    scheduleFeed(1000);
  }
}

function setFace(name){
  paco.face=name;
  const src=ASSETS[name]||ASSETS.idle;
  paco.root?.querySelectorAll("[data-paco3-face],[data-paco3-launcher-face]").forEach(img=>{
    if(img.getAttribute("src")!==src)img.setAttribute("src",src);
  });
}

function ensureWelcome(){
  if(paco.messages.length)return;
  const display=state.profile?.displayName||state.profile?.name||"";
  const name=firstName(display);
  pushMessage({
    role:"assistant",
    tone:"welcome",
    text:`${name?`Hola, ${name}. `:""}Soy PACO. Estoy conectado a la operación del CRM: te aviso retrasos, novedades y movimientos importantes, y también puedo ayudarte a registrar actividades o ubicar un pedido.`,
    actions:[
      action("Registrar actividad","activity-guide","primary"),
      action("Revisar alertas","show-alerts"),
      action("Buscar pedido","prompt",null,{prompt:"¿En qué va el pedido "})
    ]
  },{render:false});
}

function renderQuick(){
  const host=paco.root?.querySelector("[data-paco3-quick]");
  if(!host)return;
  host.innerHTML=[
    ["＋","Registrar actividad","activity-guide"],
    ["!","Alertas","show-alerts"],
    ["⌕","Pedido","prompt","¿En qué va el pedido "],
    ["◷","Mi jornada","my-work"]
  ].map(([icon,label,act,prompt])=>`<button type="button" data-paco3-action="${act}" ${prompt?`data-prompt="${esc(prompt)}"`:""}><span>${icon}</span>${esc(label)}</button>`).join("");
}

function messageHtml(item){
  const user=item.role==="user";
  const actions=(item.actions||[]).length?`<div class="paco3-actions">${item.actions.map(actionHtml).join("")}</div>`:"";
  const facts=(item.facts||[]).length?`<div class="paco3-facts">${item.facts.map(([label,value])=>`<span><small>${esc(label)}</small><strong>${esc(value)}</strong></span>`).join("")}</div>`:"";
  const list=(item.list||[]).length?`<div class="paco3-list">${item.list.map(row=>`<div><span>${esc(row.icon||"•")}</span><p>${esc(row.text||row)}</p></div>`).join("")}</div>`:"";

  return `<article class="paco3-message ${user?"user":"assistant"} tone-${esc(item.tone||"normal")}" data-message-id="${esc(item.id)}">
    ${user?"":`<img src="${ASSETS.idle}" alt="" aria-hidden="true">`}
    <div class="paco3-bubble">
      ${item.kicker?`<span class="paco3-kicker">${esc(item.kicker)}</span>`:""}
      <p>${esc(item.text)}</p>
      ${facts}
      ${list}
      ${actions}
      <time>${timeLabel(item.createdAt)}</time>
    </div>
  </article>`;
}

function actionHtml(item){
  return `<button type="button" class="${item.kind==="primary"?"primary":item.kind==="warning"?"warning":""}"
    data-paco3-action="${esc(item.action)}"
    ${item.value!=null?`data-value="${esc(item.value)}"`:""}
    ${item.orderId?`data-order-id="${esc(item.orderId)}"`:""}
    ${item.module?`data-module="${esc(item.module)}"`:""}
    ${item.prompt?`data-prompt="${esc(item.prompt)}"`:""}>
    <span>${esc(item.icon||"→")}</span>
    <strong>${esc(item.label)}</strong>
  </button>`;
}

function renderMessages(){
  const host=paco.root?.querySelector("[data-paco3-messages]");
  if(!host)return;
  host.innerHTML=paco.messages.map(messageHtml).join("");
  requestAnimationFrame(()=>{host.scrollTop=host.scrollHeight});
}

function pushMessage(item,{render=true,unread=true}={}){
  const msg={
    id:item.id||uid(),
    role:item.role||"assistant",
    tone:item.tone||"normal",
    text:String(item.text||""),
    kicker:item.kicker||"",
    actions:item.actions||[],
    facts:item.facts||[],
    list:item.list||[],
    createdAt:item.createdAt||new Date().toISOString()
  };
  paco.messages.push(msg);
  if(paco.messages.length>MAX_MESSAGES)paco.messages.splice(0,paco.messages.length-MAX_MESSAGES);
  if(unread&&!isOpen()&&msg.role!=="user"){
    paco.unread+=1;
    renderUnread();
  }
  if(render)renderMessages();
  return msg;
}

function renderUnread(){
  const badge=paco.root?.querySelector("[data-paco3-unread]");
  if(!badge)return;
  badge.hidden=!paco.unread;
  badge.textContent=paco.unread>9?"9+":String(paco.unread);
}

function setBusy(value){
  paco.busy=Boolean(value);
  paco.root?.classList.toggle("is-busy",paco.busy);
  const send=paco.root?.querySelector("[data-paco3-send]");
  if(send)send.disabled=paco.busy;
  setFace(paco.busy?"thinking":isOpen()?"listening":"idle");
}

async function submit(input){
  const text=String(input||"").trim();
  if(!text||paco.busy)return;

  pushMessage({role:"user",text},{unread:false});
  setBusy(true);

  try{
    if(paco.flow&&await handleFlowText(text))return;
    const intent=assistantIntent(text);
    await resolveIntent(intent,text);
  }catch(error){
    console.error("[PACO V11.37]",error);
    pushMessage({
      tone:"error",
      kicker:"No pude completar la consulta",
      text:error?.message||"Ocurrió un error inesperado.",
      actions:[action("Reintentar","prompt",null,{prompt:text})]
    });
  }finally{
    setBusy(false);
  }
}

async function resolveIntent(intent,input){
  switch(intent.id){
    case "REGISTER_ACTIVITY": return startActivityGuide();
    case "ORDER_STATUS": return diagnoseOrder(intent.orderRef||extractOrderReference(input));
    case "MY_WORK": return showMyWork();
    case "OPERATION_ALERTS": return showAlerts();
    case "IDLE_TEAM": return showAlerts("AUX_IDLE");
    case "LONG_ACTIVITY": return showAlerts("LONG_ACTIVITY");
    case "NOVELTIES": return showNovelties();
    case "INVENTORY": return showInventory(intent.searchTerm||extractInventoryTerm(input));
    case "OPEN_WORKFORCE": return route("workforce");
    case "OPEN_ORDERS": return route("orders");
    case "HELP": return showCapabilities();
    case "EMPTY": return;
    default:
      if(/pedido/i.test(input))return diagnoseOrder(extractOrderReference(input));
      pushMessage({
        text:"Puedo ayudarte si me dices la acción concreta. Por ejemplo: registrar actividad, revisar alertas, buscar un pedido, consultar quién está libre o ver tu jornada.",
        actions:[
          action("Registrar actividad","activity-guide","primary"),
          action("Revisar alertas","show-alerts"),
          action("Buscar pedido","prompt",null,{prompt:"¿En qué va el pedido "})
        ]
      });
  }
}

async function startActivityGuide(){
  const catalog=paco.catalog||await api.workCatalog();
  paco.catalog=catalog;
  const tree=catalogTaxonomy(catalog);

  if(!tree.length){
    pushMessage({
      tone:"warning",
      text:"No veo actividades habilitadas para tu rol en el catálogo actual.",
      actions:[action("Abrir Mi jornada","navigate",null,{module:"workforce"})]
    });
    return;
  }

  paco.flow={type:"activity",stage:"category",tree,category:null,subcategory:null,activity:null};
  showActivityCategories();
}

function showActivityCategories(){
  const tree=paco.flow?.tree||[];
  pushMessage({
    kicker:"Registrar actividad · Paso 1 de 3",
    text:"¿En qué categoría está lo que vas a hacer? Puedes tocar una opción o escribir su nombre.",
    actions:[
      ...tree.map(row=>action(row.label,"activity-category",null,{value:row.key})),
      action("Cancelar","flow-cancel")
    ]
  });
}

function chooseActivityCategory(key){
  const flow=paco.flow;
  if(!flow||flow.type!=="activity")return;
  const category=flow.tree.find(row=>String(row.key)===String(key));
  if(!category)return;
  flow.category=category;
  flow.subcategory=null;
  flow.activity=null;
  flow.stage="subcategory";

  pushMessage({
    kicker:`${category.label} · Paso 2 de 3`,
    text:"Ahora elige una subcategoría.",
    actions:[
      ...category.subcategories.map(row=>action(row.label,"activity-subcategory",null,{value:row.label})),
      action("Volver","activity-back-category"),
      action("Cancelar","flow-cancel")
    ]
  });
}

function chooseActivitySubcategory(label){
  const flow=paco.flow;
  if(!flow?.category)return;
  const sub=flow.category.subcategories.find(row=>String(row.label)===String(label));
  if(!sub)return;
  flow.subcategory=sub;
  flow.activity=null;
  flow.stage="activity";

  pushMessage({
    kicker:`${flow.category.label} · Paso 3 de 3`,
    text:`Selecciona la actividad de “${sub.label}”.`,
    actions:[
      ...sub.activities.slice(0,12).map(row=>action(row.name,"activity-select",null,{value:row.id})),
      action("Volver","activity-back-subcategory"),
      action("Cancelar","flow-cancel")
    ]
  });
}

function chooseActivity(id){
  const flow=paco.flow;
  if(!flow?.subcategory)return;
  const item=flow.subcategory.activities.find(row=>String(row.id)===String(id));
  if(!item)return;
  flow.activity=item;
  flow.stage="confirm";

  pushMessage({
    tone:"info",
    kicker:"Actividad seleccionada",
    text:item.name,
    facts:[
      ["Categoría",item.uiCategoryLabel||flow.category?.label||"—"],
      ["Subcategoría",item.uiSubcategory||flow.subcategory?.label||"—"],
      ["Duración estándar",item.standardMinutes?`${item.standardMinutes} min`:"Sin tiempo estándar"]
    ],
    actions:[
      action("Iniciar actividad","activity-start","primary",{value:item.id}),
      action("Cambiar","activity-back-subcategory"),
      action("Cancelar","flow-cancel")
    ]
  });
}

async function startSelectedActivity(id){
  const flow=paco.flow;
  const item=flow?.activity||paco.catalog?.find?.(row=>String(row.id)===String(id));
  if(!item)return;

  await api.workStart(item.id,null,{assistant:"PACO",assistantVersion:VERSION});
  paco.flow=null;
  pushMessage({
    tone:"success",
    kicker:"Actividad iniciada",
    text:`Listo. Inicié “${item.name}” y el cronómetro de Mi jornada ya está corriendo.`,
    actions:[action("Abrir Mi jornada","navigate",null,{module:"workforce"})]
  });
  speak(`Listo. Inicié la actividad ${item.name}.`);
  scheduleFeed(250);
}

async function handleFlowText(input){
  const text=normalizeAssistantText(input);
  if(["cancelar","cancel","salir","terminar"].includes(text)){
    cancelFlow();
    return true;
  }

  if(paco.flow.type==="order-ref"){
    paco.flow=null;
    await diagnoseOrder(extractOrderReference(input)||input.trim());
    return true;
  }

  if(paco.flow.type==="inventory-ref"){
    paco.flow=null;
    await showInventory(input.trim());
    return true;
  }

  if(paco.flow.type!=="activity")return false;

  const flow=paco.flow;
  if(flow.stage==="category"){
    const match=bestTextMatch(input,flow.tree,row=>row.label);
    if(match){chooseActivityCategory(match.key);return true}
  }else if(flow.stage==="subcategory"){
    const match=bestTextMatch(input,flow.category?.subcategories||[],row=>row.label);
    if(match){chooseActivitySubcategory(match.label);return true}
  }else if(flow.stage==="activity"){
    const match=bestTextMatch(input,flow.subcategory?.activities||[],row=>row.name);
    if(match){chooseActivity(match.id);return true}
  }else if(flow.stage==="confirm"&&/^(si|sí|iniciar|empezar|confirmar|listo)$/i.test(input.trim())){
    await startSelectedActivity(flow.activity?.id);
    return true;
  }

  pushMessage({
    tone:"warning",
    text:"No identifiqué esa opción con suficiente seguridad. Elige una de las opciones visibles o escribe “cancelar”."
  });
  return true;
}

function cancelFlow(){
  paco.flow=null;
  pushMessage({text:"Listo, cancelé ese proceso. ¿Qué necesitas ahora?"});
}

async function diagnoseOrder(term){
  const value=String(term||"").trim();
  if(!value){
    paco.flow={type:"order-ref"};
    pushMessage({
      text:"Dime el número o referencia del pedido que quieres consultar.",
      actions:[action("Abrir Pedidos","navigate",null,{module:"orders"})]
    });
    return;
  }

  const list=await api.listOrders({
    search:value,
    page:1,
    pageSize:8,
    includeHistory:true,
    assignment:"ALL"
  });
  const rows=arrayFrom(list);

  if(!rows.length){
    pushMessage({
      tone:"warning",
      text:`No encontré un pedido visible para “${value}”.`,
      actions:[
        action("Intentar otro número","prompt",null,{prompt:"¿En qué va el pedido "}),
        action("Abrir Pedidos","navigate",null,{module:"orders"})
      ]
    });
    return;
  }

  if(rows.length>1){
    pushMessage({
      text:`Encontré ${rows.length} coincidencias. Elige el pedido correcto.`,
      actions:rows.slice(0,6).map(row=>action(
        `${row.orderNumber||row.order_number||"Pedido"} · ${row.clientName||row.client_name||"Cliente"}`,
        "order-by-id",
        null,
        {orderId:row.id}
      ))
    });
    return;
  }

  await diagnoseOrderByRow(rows[0]);
}

async function diagnoseOrderById(id){
  const detail=await api.getOrder(id);
  return diagnoseOrderByRow(detail?.order||detail||{id});
}

async function diagnoseOrderByRow(row){
  const id=row.id||row.orderId;
  const [detailResult,issueResult,actionsResult]=await Promise.allSettled([
    id?api.getOrder(id):Promise.resolve(row),
    id?api.orderIssues(id):Promise.resolve([]),
    id?api.getActions(id):Promise.resolve([])
  ]);

  const detail=detailResult.status==="fulfilled"
    ? (detailResult.value?.order||detailResult.value||row)
    : row;
  const issues=issueResult.status==="fulfilled"?arrayFrom(issueResult.value):[];
  const actions=actionsResult.status==="fulfilled"?arrayFrom(actionsResult.value):[];
  const openIssues=issues.filter(issue=>!["RESOLVED","CLOSED","CANCELLED"].includes(String(issue.status||"").toUpperCase()));

  const step=detail.currentStep||detail.current_step_code||row.currentStep||row.stepCode||"";
  const stepName=detail.stepName||detail.currentStepName||row.stepName||fmt.step(step)||"Sin etapa";
  const status=detail.status||row.status||"Sin estado";
  const number=detail.orderNumber||detail.order_number||row.orderNumber||row.order_number||"Pedido";
  const assignee=detail.assigneeName||detail.assignedToName||row.assigneeName||"En cola / sin asignar";
  const moduleId=STEP_MODULE[String(step).toUpperCase()]||"orders";

  pushMessage({
    tone:openIssues.length?"warning":"info",
    kicker:`Pedido ${number}`,
    text:`Está en ${stepName} con estado ${fmt.label(status)}.`,
    facts:[
      ["Cliente",detail.clientName||detail.client_name||row.clientName||"—"],
      ["Responsable",assignee],
      ["Novedades abiertas",String(openIssues.length)],
      ["Acciones disponibles",String(actions.length)]
    ],
    actions:[
      ...(id?[action("Abrir expediente","open-order","primary",{orderId:id})]:[]),
      ...(moduleId!=="orders"?[action(`Ir a ${MODULE_LABELS[moduleId]||"la etapa"}`,"navigate",null,{module:moduleId})]:[]),
      ...(openIssues.length?[action("Ver novedades","navigate","warning",{module:"approvals"})]:[])
    ]
  });
}

async function showMyWork(){
  const data=await api.workMyDay();
  const active=data?.active;

  if(active){
    const seconds=liveActiveSeconds(active);
    pushMessage({
      tone:active.status==="PAUSED"?"warning":"success",
      kicker:"Tu actividad actual",
      text:active.title||"Actividad en curso",
      facts:[
        ["Estado",active.status==="PAUSED"?"Pausada":"En curso"],
        ["Tiempo activo",durationLabel(seconds)],
        ["Categoría",active.catalogName||"—"]
      ],
      actions:[action("Abrir Mi jornada","navigate","primary",{module:"workforce"})]
    });
    return;
  }

  const today=data?.today?.length||0;
  const overdue=data?.overdue?.length||0;
  pushMessage({
    text:today||overdue
      ?`No tienes una actividad corriendo. Tienes ${today} programada(s) para hoy y ${overdue} vencida(s).`
      :"No tienes una actividad en curso ni actividades programadas pendientes para hoy.",
    actions:[
      action("Registrar actividad","activity-guide","primary"),
      action("Abrir Mi jornada","navigate",null,{module:"workforce"})
    ]
  });
}

async function showAlerts(type=null){
  await refreshFeed({announce:false});
  const all=paco.feed?.alerts||[];
  const rows=type?all.filter(row=>row.type===type):all;

  if(!rows.length){
    const label=type==="AUX_IDLE"?"inactividad de auxiliares":type==="LONG_ACTIVITY"?"actividades demoradas":"alertas operativas";
    pushMessage({tone:"success",text:`No hay ${label} en este momento.`});
    return;
  }

  pushMessage({
    tone:rows.some(row=>row.severity==="critical")?"warning":"info",
    kicker:type==="AUX_IDLE"?"Equipo disponible":type==="LONG_ACTIVITY"?"Actividades prolongadas":"Alertas operativas",
    text:`Encontré ${rows.length} situación${rows.length===1?"":"es"} que requiere${rows.length===1?"":"n"} atención.`,
    list:rows.slice(0,8).map(row=>({
      icon:row.severity==="critical"?"!":"•",
      text:alertDescriptor(row).text
    })),
    actions:[
      ...(rows.find(row=>row.orderId)?[action("Abrir primer pedido","open-order","primary",{orderId:rows.find(row=>row.orderId).orderId})]:[]),
      action("Ver Mi jornada","navigate",null,{module:"workforce"}),
      action("Actualizar","show-alerts")
    ]
  });
}

async function showNovelties(){
  const result=await api.exceptionCenter(null,"OPEN",1,30);
  const rows=extractExceptionRows(result);

  if(!rows.length){
    pushMessage({
      tone:"success",
      text:"No encontré novedades o excepciones abiertas visibles para tu sesión.",
      actions:[action("Abrir Excepciones","navigate",null,{module:"approvals"})]
    });
    return;
  }

  pushMessage({
    tone:"warning",
    kicker:"Novedades abiertas",
    text:`Hay ${rows.length} registro${rows.length===1?"":"s"} abierto${rows.length===1?"":"s"} visible${rows.length===1?"":"s"} para ti.`,
    list:rows.slice(0,8).map(row=>({
      icon:"!",
      text:[
        row.orderNumber||row.order_number?`Pedido ${row.orderNumber||row.order_number}`:"",
        row.title||row.type||row.kind||"Novedad"
      ].filter(Boolean).join(" · ")
    })),
    actions:[action("Abrir Excepciones","navigate","primary",{module:"approvals"})]
  });
}

async function showInventory(term){
  const search=String(term||"").trim();
  if(!search){
    paco.flow={type:"inventory-ref"};
    pushMessage({
      text:"Dime la referencia, SKU o descripción del material que quieres buscar.",
      actions:[action("Abrir Inventario","navigate",null,{module:"inventory"})]
    });
    return;
  }

  const result=await api.inventory(search,1,8);
  const rows=arrayFrom(result);

  if(!rows.length){
    pushMessage({
      tone:"warning",
      text:`No encontré existencias visibles para “${search}”.`,
      actions:[action("Abrir Inventario","navigate",null,{module:"inventory"})]
    });
    return;
  }

  pushMessage({
    kicker:`Inventario · ${search}`,
    text:`Encontré ${rows.length} coincidencia${rows.length===1?"":"s"}.`,
    list:rows.slice(0,6).map(row=>({icon:"▣",text:inventoryRowText(row)})),
    actions:[action("Abrir Inventario","navigate","primary",{module:"inventory"})]
  });
}

function showCapabilities(){
  pushMessage({
    text:"Puedo acompañarte durante la operación sin salir del CRM.",
    list:[
      {icon:"!",text:"Avisarte pedidos demorados, auxiliares sin actividad y actividades que se están extendiendo."},
      {icon:"◷",text:"Guiarte para registrar e iniciar una actividad desde el catálogo oficial."},
      {icon:"⌕",text:"Decirte en qué etapa va un pedido, quién lo tiene y si presenta novedades."},
      {icon:"▣",text:"Consultar una referencia de inventario cuando me das un término de búsqueda."},
      {icon:"↗",text:"Avisarte cuando una actividad termina, un pedido se despacha, se registra una novedad o se cierra."}
    ],
    actions:[
      action("Registrar actividad","activity-guide","primary"),
      action("Revisar alertas","show-alerts"),
      action("Mi jornada","my-work")
    ]
  });
}

function handleAction(button){
  const name=button.dataset.paco3Action;
  const value=button.dataset.value;

  if(name==="navigate")return route(button.dataset.module||"dashboard");
  if(name==="open-order"){
    window.dispatchEvent(new CustomEvent("erp:open-order",{detail:button.dataset.orderId}));
    setOpen(false);
    return;
  }
  if(name==="order-by-id"){
    setBusy(true);
    diagnoseOrderById(button.dataset.orderId)
      .catch(error=>pushMessage({tone:"error",text:error.message}))
      .finally(()=>setBusy(false));
    return;
  }
  if(name==="prompt"){
    const input=paco.root?.querySelector("[data-paco3-input]");
    if(input){
      input.value=button.dataset.prompt||"";
      input.focus();
      input.setSelectionRange(input.value.length,input.value.length);
    }
    return;
  }
  if(name==="activity-guide")return startActivityGuide().catch(handleAsyncError);
  if(name==="activity-category")return chooseActivityCategory(value);
  if(name==="activity-subcategory")return chooseActivitySubcategory(value);
  if(name==="activity-select")return chooseActivity(value);
  if(name==="activity-start"){
    setBusy(true);
    return startSelectedActivity(value).catch(handleAsyncError).finally(()=>setBusy(false));
  }
  if(name==="activity-back-category"){
    if(paco.flow){paco.flow.stage="category";paco.flow.category=null;paco.flow.subcategory=null;paco.flow.activity=null}
    return showActivityCategories();
  }
  if(name==="activity-back-subcategory"){
    if(paco.flow?.category)return chooseActivityCategory(paco.flow.category.key);
  }
  if(name==="flow-cancel")return cancelFlow();
  if(name==="show-alerts"){
    setBusy(true);
    return showAlerts().catch(handleAsyncError).finally(()=>setBusy(false));
  }
  if(name==="my-work"){
    setBusy(true);
    return showMyWork().catch(handleAsyncError).finally(()=>setBusy(false));
  }
}

function handleAsyncError(error){
  console.error("[PACO V11.37]",error);
  pushMessage({tone:"error",text:error?.message||"No pude completar la acción."});
}

function route(moduleId){
  if(moduleId&&can(moduleId,"canRead")===false&&moduleId!=="dashboard"){
    pushMessage({tone:"warning",text:`Tu sesión no tiene acceso de lectura a ${MODULE_LABELS[moduleId]||moduleId}.`});
    return;
  }
  navigate(moduleId||"dashboard");
  setOpen(false);
}

function scheduleFeed(delay=0){
  clearTimeout(paco.pollTimer);
  if(document.hidden)return;
  paco.pollTimer=setTimeout(()=>refreshFeed().catch(error=>{
    console.warn("[PACO FEED]",error);
    scheduleNextFeed(60);
  }),Math.max(0,delay));
}

function scheduleNextFeed(seconds=null){
  clearTimeout(paco.pollTimer);
  if(document.hidden)return;
  const configured=isOpen()
    ? Number(paco.feed?.settings?.pollOpenSeconds||20)
    : Number(paco.feed?.settings?.pollClosedSeconds||45);
  paco.pollTimer=setTimeout(()=>refreshFeed().catch(error=>{
    console.warn("[PACO FEED]",error);
    scheduleNextFeed(60);
  }),Math.max(10,Number(seconds||configured))*1000);
}

async function refreshFeed({announce=true}={}){
  if(paco.pollBusy||!state.profile)return paco.feed;
  paco.pollBusy=true;

  try{
    const previousFirst=paco.firstFeed;
    const result=await api.pacoFeed(paco.lastServerTime,20);
    paco.feed=result||{};
    paco.lastServerTime=result?.serverTime||paco.lastServerTime||new Date().toISOString();
    renderOperationalSummary();

    const alerts=result?.alerts||[];
    const events=result?.events||[];

    if(previousFirst){
      paco.firstFeed=false;
      for(const event of events)markSeen(event.id);
      for(const alert of alerts)paco.alertKeys.add(`${alert.id}:${alert.severity}`);
      if(announce&&alerts.length){
        const critical=alerts.find(row=>row.severity==="critical");
        pushMessage({
          tone:critical?"warning":"info",
          kicker:"Estado de la operación",
          text:`Al conectarme encontré ${alerts.length} alerta${alerts.length===1?"":"s"} activa${alerts.length===1?"":"s"}.`,
          actions:[action("Revisar alertas","show-alerts","primary")]
        });
        if(critical)announceDescriptor(alertDescriptor(critical),critical.id+":"+critical.severity);
      }
    }else if(announce){
      for(const alert of alerts){
        const key=`${alert.id}:${alert.severity}`;
        if(paco.alertKeys.has(key))continue;
        paco.alertKeys.add(key);
        pushOperationalNotification(alertDescriptor(alert),key);
      }

      const activeIds=new Set(alerts.map(row=>`${row.id}:${row.severity}`));
      for(const key of [...paco.alertKeys]){
        if((key.startsWith("order:")||key.startsWith("idle:")||key.startsWith("execution:"))&&!activeIds.has(key)){
          paco.alertKeys.delete(key);
        }
      }

      for(const event of events.slice().reverse()){
        if(isSeen(event.id))continue;
        markSeen(event.id);
        pushOperationalNotification(eventDescriptor(event),event.id);
      }
    }

    return paco.feed;
  }finally{
    paco.pollBusy=false;
    scheduleNextFeed();
  }
}

function renderOperationalSummary(){
  const alerts=paco.feed?.alerts||[];
  const critical=alerts.filter(row=>row.severity==="critical").length;
  const title=paco.root?.querySelector("[data-paco3-live-title]");
  const detail=paco.root?.querySelector("[data-paco3-live-detail]");
  const count=paco.root?.querySelector("[data-paco3-live-count]");
  const livebar=paco.root?.querySelector("[data-paco3-livebar]");

  if(title)title.textContent=alerts.length?`${alerts.length} alerta${alerts.length===1?"":"s"} operativa${alerts.length===1?"":"s"}`:"Operación en línea";
  if(detail)detail.textContent=alerts.length
    ?`${critical?`${critical} crítica${critical===1?"":"s"} · `:""}PACO sigue monitoreando`
    :"Sin alertas pendientes";
  if(count)count.textContent=String(alerts.length);
  livebar?.classList.toggle("has-alerts",alerts.length>0);
  livebar?.classList.toggle("has-critical",critical>0);
}

function pushOperationalNotification(descriptor,key){
  const message=pushMessage({
    tone:descriptor.tone,
    kicker:descriptor.title,
    text:descriptor.text,
    actions:descriptor.actions
  });
  showPeek(descriptor);
  announceDescriptor(descriptor,key);
  return message;
}

function alertDescriptor(alert){
  const age=durationLabel(alert.ageSeconds);

  if(alert.type==="ORDER_QUEUE_DELAY"){
    return {
      title:alert.severity==="critical"?"Pedido fuera de SLA":"Pedido cerca del SLA",
      text:`El pedido ${alert.orderNumber||"—"} lleva ${age} en ${alert.stepName||fmt.step(alert.stepCode)}${alert.profileName?` con ${alert.profileName}`:""}.`,
      voice:`Atención. El pedido ${alert.orderNumber||""} lleva ${age} en ${alert.stepName||fmt.step(alert.stepCode)}.`,
      tone:alert.severity==="critical"?"critical":"warning",
      actions:[action("Abrir pedido","open-order","primary",{orderId:alert.orderId})]
    };
  }

  if(alert.type==="AUX_IDLE"){
    return {
      title:alert.severity==="critical"?"Inactividad prolongada":"Auxiliar disponible",
      text:`${alert.profileName||"Un auxiliar"} lleva ${age} sin una actividad en curso.`,
      voice:`Atención. ${alert.profileName||"Un auxiliar"} lleva ${age} sin una actividad en curso.`,
      tone:alert.severity==="critical"?"critical":"warning",
      actions:[
        ...(String(alert.profileId)===String(state.profile?.id)?[action("Registrar actividad","activity-guide","primary")]:[]),
        action("Ver jornada","navigate",null,{module:"workforce"})
      ]
    };
  }

  if(alert.type==="LONG_ACTIVITY"){
    return {
      title:alert.severity==="critical"?"Actividad muy prolongada":"Actividad sobre tiempo",
      text:`${alert.profileName||"Una persona"} lleva ${age} en “${alert.stepName||"actividad"}” y superó el tiempo esperado.`,
      voice:`Atención. ${alert.profileName||"Una persona"} lleva ${age} en la actividad ${alert.stepName||""} y superó el tiempo esperado.`,
      tone:alert.severity==="critical"?"critical":"warning",
      actions:[action("Ver jornada","navigate","primary",{module:"workforce"})]
    };
  }

  return {
    title:"Alerta operativa",
    text:"PACO detectó una situación que requiere revisión.",
    voice:"PACO detectó una situación que requiere revisión.",
    tone:"warning",
    actions:[action("Revisar alertas","show-alerts","primary")]
  };
}

function eventDescriptor(event){
  if(event.type==="WORK_FINISHED"){
    return {
      title:"Actividad terminada",
      text:`${event.profileName||"Un integrante del equipo"} terminó “${event.title||"una actividad"}”.`,
      voice:`${event.profileName||"Un integrante del equipo"} terminó la actividad ${event.title||""}.`,
      tone:"success",
      actions:[action("Ver jornada","navigate",null,{module:"workforce"})]
    };
  }

  if(event.type==="ORDER_DISPATCHED"){
    return {
      title:"Pedido despachado",
      text:`El pedido ${event.orderNumber||"—"} terminó ${event.stepName||fmt.step(event.stepCode)} y pasó a cierre.`,
      voice:`El pedido ${event.orderNumber||""} fue despachado y pasó a cierre.`,
      tone:"success",
      actions:[action("Abrir pedido","open-order","primary",{orderId:event.orderId})]
    };
  }

  if(event.type==="ORDER_NOVELTY"){
    return {
      title:"Nueva novedad",
      text:`Se registró una novedad en el pedido ${event.orderNumber||"—"}${event.title?`: ${event.title}`:""}.`,
      voice:`Atención. Se registró una novedad en el pedido ${event.orderNumber||""}.`,
      tone:"warning",
      actions:[
        action("Abrir pedido","open-order","primary",{orderId:event.orderId}),
        action("Ver Excepciones","navigate",null,{module:"approvals"})
      ]
    };
  }

  if(event.type==="ORDER_CLOSED"){
    return {
      title:"Pedido cerrado",
      text:`El pedido ${event.orderNumber||"—"} quedó cerrado.`,
      voice:"",
      tone:"success",
      actions:[action("Abrir pedido","open-order",null,{orderId:event.orderId})]
    };
  }

  return {
    title:"Actualización operativa",
    text:"Hay un cambio nuevo en la operación.",
    voice:"",
    tone:"info",
    actions:[]
  };
}

function showPeek(descriptor){
  if(!paco.root||isOpen())return;
  const peek=paco.root.querySelector("[data-paco3-peek]");
  if(!peek)return;

  const title=peek.querySelector("[data-paco3-peek-title]");
  const text=peek.querySelector("[data-paco3-peek-text]");
  const icon=peek.querySelector("[data-paco3-peek-icon]");

  if(title)title.textContent=descriptor.title;
  if(text)text.textContent=descriptor.text;
  if(icon)icon.textContent=descriptor.tone==="success"?"✓":"!";
  peek.className=`paco3-peek tone-${descriptor.tone}`;
  peek.hidden=false;

  clearTimeout(paco.peekTimer);
  paco.peekTimer=setTimeout(hidePeek,12000);
}

function hidePeek(){
  clearTimeout(paco.peekTimer);
  const peek=paco.root?.querySelector("[data-paco3-peek]");
  if(peek)peek.hidden=true;
}

function announceDescriptor(descriptor,key){
  if(!descriptor.voice||isSeen(`voice:${key}`))return;
  markSeen(`voice:${key}`);
  speak(descriptor.voice);
}

function toggleVoice(){
  paco.voiceEnabled=!paco.voiceEnabled;
  localStorage.setItem(VOICE_PREF_KEY,String(paco.voiceEnabled));
  paco.voiceUnlocked=true;
  syncVoiceButton();
  if(paco.voiceEnabled)speak("Voz de PACO activada.");
}

function syncVoiceButton(){
  const button=paco.root?.querySelector("[data-paco3-voice]");
  if(!button)return;
  button.classList.toggle("is-on",paco.voiceEnabled);
  button.setAttribute("aria-pressed",String(paco.voiceEnabled));
  button.textContent=paco.voiceEnabled?"🔊":"🔇";
  button.title=paco.voiceEnabled?"Desactivar voz":"Activar voz";
}

function speak(text){
  if(!paco.voiceEnabled||!text||typeof speechSynthesis==="undefined"||document.hidden)return;

  try{
    const utterance=new SpeechSynthesisUtterance(String(text));
    const voices=speechSynthesis.getVoices?.()||[];
    const preferred=[
      voices.find(v=>/^es-CO$/i.test(v.lang)),
      voices.find(v=>/^es-MX$/i.test(v.lang)),
      voices.find(v=>/^es-(?:US|419)$/i.test(v.lang)),
      voices.find(v=>/^es/i.test(v.lang))
    ].find(Boolean);

    if(preferred)utterance.voice=preferred;
    utterance.lang=preferred?.lang||"es-CO";
    utterance.rate=.96;
    utterance.pitch=1;
    utterance.volume=1;
    speechSynthesis.speak(utterance);
    setFace("talking");
    utterance.onend=()=>setFace(isOpen()?"listening":"idle");
  }catch(error){
    console.warn("[PACO VOICE]",error);
  }
}

function action(label,name,kind=null,extra={}){
  return {label,action:name,kind,...extra};
}

function bestTextMatch(input,rows,labelFn){
  const normalized=normalizeAssistantText(input);
  if(!normalized||!rows?.length)return null;

  let best=null;
  let bestScore=Infinity;
  for(const row of rows){
    const label=normalizeAssistantText(labelFn(row));
    if(!label)continue;
    if(label===normalized||label.includes(normalized)||normalized.includes(label))return row;

    const direct=editDistance(label,normalized)/Math.max(label.length,normalized.length,1);
    const tokenScore=bestTokenDistance(normalized,label);
    const score=Math.min(direct,tokenScore);
    if(score<bestScore){bestScore=score;best=row}
  }

  return bestScore<=.34?best:null;
}

function bestTokenDistance(a,b){
  const aa=a.split(" ").filter(Boolean);
  const bb=b.split(" ").filter(Boolean);
  if(!aa.length||!bb.length)return 1;
  let total=0;
  for(const token of aa){
    let min=1;
    for(const target of bb){
      const ratio=editDistance(token,target)/Math.max(token.length,target.length,1);
      min=Math.min(min,ratio);
    }
    total+=min;
  }
  return total/aa.length;
}

function arrayFrom(value){
  if(Array.isArray(value))return value;
  for(const key of ["items","rows","data","actions","issues","results"]){
    if(Array.isArray(value?.[key]))return value[key];
  }
  return [];
}

function extractExceptionRows(value){
  const direct=arrayFrom(value);
  if(direct.length)return direct;

  const found=[];
  const walk=(node,depth=0)=>{
    if(depth>3||node==null)return;
    if(Array.isArray(node)){
      for(const item of node)walk(item,depth+1);
      return;
    }
    if(typeof node!=="object")return;
    if(node.id&&(node.title||node.orderNumber||node.order_number||node.type||node.kind))found.push(node);
    for(const child of Object.values(node))if(child&&typeof child==="object")walk(child,depth+1);
  };
  walk(value);
  return [...new Map(found.map(row=>[row.id,row])).values()];
}

function inventoryRowText(row){
  const code=row.sku||row.reference||row.code||row.itemCode||row.item_code||"Material";
  const name=row.description||row.name||row.itemName||row.item_name||"";
  const available=row.available??row.availableQuantity??row.available_quantity??row.stockAvailable??row.stock_available;
  const total=row.quantity??row.onHand??row.on_hand??row.stock;
  const qty=available!=null?`Disponible: ${fmt.number(available,2)}`:total!=null?`Cantidad: ${fmt.number(total,2)}`:"";
  return [code,name,qty].filter(Boolean).join(" · ");
}

function liveActiveSeconds(active){
  const base=Number(active?.metrics?.elapsedSeconds||active?.activeSeconds||0);
  if(active?.status==="PAUSED"||!active?.startedAt)return base;
  return Math.max(base,Math.floor((Date.now()-new Date(active.startedAt).getTime())/1000));
}

function durationLabel(seconds){
  const total=Math.max(0,Math.round(Number(seconds||0)));
  if(total<60)return `${total} s`;
  const minutes=Math.round(total/60);
  if(minutes<60)return `${minutes} min`;
  const hours=Math.floor(minutes/60);
  const rest=minutes%60;
  return `${hours} h${rest?` ${rest} min`:""}`;
}

function firstName(value){
  return String(value||"").trim().split(/\s+/)[0]||"";
}

function timeLabel(value){
  try{
    return new Intl.DateTimeFormat("es-CO",{
      hour:"2-digit",
      minute:"2-digit",
      hour12:false,
      timeZone:"America/Bogota"
    }).format(new Date(value));
  }catch{return ""}
}

function uid(){
  return globalThis.crypto?.randomUUID?.()||`paco-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function esc(value){
  return fmt.escape(String(value??""));
}

function readBoolean(key,fallback){
  try{
    const raw=localStorage.getItem(key);
    return raw==null?fallback:raw==="true";
  }catch{return fallback}
}

function readSeen(){
  try{
    const parsed=JSON.parse(sessionStorage.getItem(SEEN_KEY)||"[]");
    return new Set(Array.isArray(parsed)?parsed.slice(-160):[]);
  }catch{return new Set()}
}

function markSeen(key){
  if(!key)return;
  paco.seen.add(String(key));
  if(paco.seen.size>180)paco.seen=new Set([...paco.seen].slice(-140));
  try{sessionStorage.setItem(SEEN_KEY,JSON.stringify([...paco.seen]))}catch{}
}

function isSeen(key){
  return paco.seen.has(String(key));
}
