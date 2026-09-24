import {state,subscribe,hasRole,can} from "../core/state.js";
import {navigate} from "../core/router.js";
import {api} from "../services/api.js";
import {fmt} from "../core/format.js";
import {toast} from "../core/ui.js";

/* CRM Suministros · PACO Virtual Assistant V11.37.0
   Un solo runtime: conversación, acciones guiadas y vigilancia operativa.
   El asistente reutiliza los RPC canónicos del CRM; no duplica workflows. */

const VERSION="11.37.0";
const SNAPSHOT_LIMIT=30;
const DEFAULT_POLL_SECONDS=60;
const HIDDEN_POLL_SECONDS=180;
const MAX_MESSAGES=80;
const WORK_CACHE_MS=60_000;

const ASSETS=Object.freeze({
  idle:"./assets/img/paco/paco-idle-v11183.svg",
  listening:"./assets/img/paco/paco-listening-v11183.svg",
  thinking:"./assets/img/paco/paco-thinking-v11183.svg",
  talking:"./assets/img/paco/paco-talking-v11183.svg",
  wink:"./assets/img/paco/paco-wink-v11183.svg",
  success:"./assets/img/paco/paco-success-v11183.svg"
});

const MODULES={
  dashboard:{label:"Centro de operaciones",help:"Resumen de cargas, alertas, prioridades y operación.",keywords:["inicio","centro","dashboard","indicadores"]},
  orders:{label:"Pedidos",help:"Estado, etapa, responsable, incidencias y trazabilidad.",keywords:["pedido","pedidos","orden"]},
  sales:{label:"Ventas y pedidos",help:"Creación y seguimiento comercial.",keywords:["venta","ventas","crear pedido","nuevo pedido"]},
  cartera:{label:"Cartera",help:"Validación financiera y liberación.",keywords:["cartera","mora","financiera"]},
  caja:{label:"Caja",help:"Retenidos y validaciones de Caja.",keywords:["caja","retenido"]},
  purchasing:{label:"Compras",help:"Abastecimiento, proveedores y órdenes de compra.",keywords:["compra","compras","abastecimiento"]},
  receiving:{label:"Recepción",help:"Recepción de mercancía y recepción documental del pedido.",keywords:["recepcion","recibir","mercancia"]},
  picking:{label:"Alistamiento",help:"Preparación, materiales, faltantes y novedades.",keywords:["alistamiento","picking","faltante"]},
  cutting:{label:"Centro de corte",help:"Cortes, carretos, merma, evidencias y cierre.",keywords:["corte","cortar","carreto","merma"]},
  billing:{label:"Facturación",help:"Factura, soporte y liberación del pedido.",keywords:["factura","facturacion","facturar"]},
  shipping:{label:"Despachos y entregas",help:"Guías, salida, entrega, evidencia y cierre.",keywords:["despacho","despachar","entrega","guia","transportadora"]},
  inventory:{label:"Inventario",help:"Stock, lotes, ubicaciones y movimientos.",keywords:["inventario","stock","lote","ubicacion"]},
  workforce:{label:"Jornada y actividades",help:"Actividades, pausas, evidencias, cronograma y capacidad.",keywords:["jornada","actividad","tarea","productividad"]},
  approvals:{label:"Excepciones y aprobaciones",help:"Novedades, bloqueos, reportes y decisiones.",keywords:["novedad","reporte","excepcion","aprobacion","bloqueo"]},
  vsm:{label:"Flujo y tiempos",help:"SLA, esperas, productividad y cuellos de botella.",keywords:["flujo","tiempo","sla","demora","cuello"]},
  reports:{label:"Analítica y reportes",help:"Indicadores, análisis y exportaciones.",keywords:["analitica","reporte","kpi","excel"]},
  audit:{label:"Auditoría",help:"Actor, fecha, evento y trazabilidad.",keywords:["auditoria","trazabilidad","quien hizo"]},
  admin:{label:"Administración",help:"Usuarios, roles, permisos y configuración.",keywords:["administracion","usuario","rol","permiso"]}
};

const STEP_MODULE={
  CARTERA:"cartera",CAJA:"caja",CAJA_FACTURACION:"caja",COMPRAS:"purchasing",
  RECEPCION_MERCANCIA:"receiving",RECEPCION_PEDIDO:"receiving",
  ALISTAMIENTO:"picking",CORTE:"cutting",FACTURACION:"billing",
  CLIENT_POINT:"shipping",CLIENT_PICKUP:"shipping",LOCAL_DISPATCH:"shipping",
  NATIONAL_DISPATCH:"shipping",CLOSURE:"shipping",CLOSED:"orders"
};

const QUICK_ACTIONS=[
  {label:"Registrar actividad",action:"activity-search",icon:"+"},
  {label:"Buscar pedido",action:"prompt",prompt:"¿Dónde va el pedido ",icon:"⌕"},
  {label:"Qué está demorado",action:"delays",icon:"!"},
  {label:"Mi jornada",action:"my-day",icon:"◷"}
];

const INTENTS={
  activity:[
    "registrar actividad","registar actividad","registrar actibidad","registrar tarea",
    "iniciar actividad","empezar actividad","hacer actividad","anotar actividad",
    "registrar trabajo","iniciar tarea"
  ],
  order:[
    "donde va el pedido","en que va el pedido","estado del pedido","por donde va el pedido",
    "buscar pedido","ver pedido","consultar pedido","revisar pedido","como va el pedido"
  ],
  delays:[
    "que esta demorado","que esta atrasado","que lleva mucho tiempo","pedidos demorados",
    "quien esta desocupado","tiempo desocupado","alertas operativas","que esta pasando"
  ],
  myDay:["mi jornada","mi actividad","que estoy haciendo","actividad actual","mi trabajo"],
  capabilities:["que puedes hacer","como me ayudas","ayuda paco","ayuda","paco"]
};

const paco={
  root:null,
  messages:[],
  busy:false,
  face:"idle",
  unsubscribe:null,
  globalBound:false,
  pendingIntent:null,
  selectedActivity:null,
  workCache:null,
  workCacheAt:0,
  watcherTimer:null,
  watcherRunning:false,
  snapshotCursor:null,
  seen:new Map(),
  unread:0,
  voiceEnabled:true,
  voiceArmed:false,
  lastRpcError:null
};

function uid(){
  return globalThis.crypto?.randomUUID?.()||`paco-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function esc(value){return fmt.escape(String(value??""))}

function norm(value){
  return String(value||"")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g,"")
    .toLowerCase()
    .replace(/[^a-z0-9#._/-]+/g," ")
    .replace(/\s+/g," ")
    .trim();
}

function tokens(value){return norm(value).split(" ").filter(Boolean)}

function editDistance(a,b){
  const x=norm(a),y=norm(b);
  if(x===y)return 0;
  if(!x)return y.length;
  if(!y)return x.length;
  const row=Array.from({length:y.length+1},(_,i)=>i);
  for(let i=1;i<=x.length;i++){
    let prev=row[0];
    row[0]=i;
    for(let j=1;j<=y.length;j++){
      const old=row[j];
      row[j]=Math.min(row[j]+1,row[j-1]+1,prev+(x[i-1]===y[j-1]?0:1));
      prev=old;
    }
  }
  return row[y.length];
}

function tokenSimilarity(a,b){
  const x=norm(a),y=norm(b);
  if(!x||!y)return 0;
  if(x===y)return 1;
  if(x.includes(y)||y.includes(x))return Math.min(x.length,y.length)/Math.max(x.length,y.length)+.15;
  return Math.max(0,1-editDistance(x,y)/Math.max(x.length,y.length));
}

function phraseScore(input,phrase){
  const source=tokens(input),wanted=tokens(phrase);
  if(!source.length||!wanted.length)return 0;
  const direct=norm(input).includes(norm(phrase))?1:0;
  const matched=wanted.reduce((sum,word)=>{
    const best=source.reduce((max,candidate)=>Math.max(max,tokenSimilarity(word,candidate)),0);
    return sum+best;
  },0)/wanted.length;
  return Math.max(direct,matched);
}

function intentScore(input,phrases){
  return phrases.reduce((max,phrase)=>Math.max(max,phraseScore(input,phrase)),0);
}

function isIntent(input,name,threshold=.72){
  return intentScore(input,INTENTS[name]||[])>=threshold;
}

function currentModule(){
  return state.currentModule||document.querySelector(".nav-item.active")?.dataset?.module||"dashboard";
}

function currentModuleLabel(){return MODULES[currentModule()]?.label||"CRM Suministros"}
function allowed(moduleId){return !moduleId||can(moduleId,"canRead")||moduleId===currentModule()}
function isOpen(){return Boolean(paco.root?.classList.contains("is-open"))}
function profileName(){return state.profile?.displayName||state.profile?.display_name||state.profile?.name||""}

function message({
  role="assistant",
  text="",
  actions=[],
  type="normal",
  alert=null,
  card=null,
  meta=null
}={}){
  return {id:uid(),role,text,actions,type,alert,card,meta};
}

function actionAttrs(action){
  const fields={
    "data-paco-action":action.action,
    "data-module":action.module,
    "data-order-id":action.orderId,
    "data-catalog-id":action.catalogId,
    "data-assignment-id":action.assignmentId,
    "data-execution-id":action.executionId,
    "data-prompt":action.prompt
  };
  return Object.entries(fields)
    .filter(([,value])=>value!==undefined&&value!==null&&value!=="")
    .map(([key,value])=>` ${key}="${esc(value)}"`)
    .join("");
}

function actionHtml(action){
  return `<button type="button" class="paco2-action tone-${esc(action.tone||"default")}"${actionAttrs(action)}>
    <span class="paco2-action-icon">${esc(action.icon||"→")}</span>
    <span class="paco2-action-copy"><b>${esc(action.label||"Continuar")}</b>${action.sub?`<small>${esc(action.sub)}</small>`:""}</span>
  </button>`;
}

function messageHtml(item){
  if(item.type==="typing"){
    return `<div class="paco2-message assistant typing"><span></span><span></span><span></span></div>`;
  }

  const card=item.card?.length
    ? `<div class="paco2-card">${item.card.map(row=>`<div><span>${esc(row[0])}</span><strong>${esc(row[1])}</strong></div>`).join("")}</div>`
    :"";

  const alert=item.alert
    ? `<div class="paco2-inline-alert severity-${Number(item.alert.severity||1)}">
        <strong>${esc(item.alert.title||"Atención")}</strong>
        <span>${esc(item.alert.text||"")}</span>
      </div>`
    :"";

  const actions=item.actions?.length
    ? `<div class="paco2-actions">${item.actions.map(actionHtml).join("")}</div>`
    :"";

  return `<article class="paco2-message ${esc(item.role)} type-${esc(item.type)}">
    <div class="paco2-bubble">
      ${item.text?`<p>${esc(item.text)}</p>`:""}
      ${alert}
      ${card}
      ${actions}
    </div>
  </article>`;
}

function renderMessages(){
  const box=paco.root?.querySelector("[data-paco-messages]");
  if(!box)return;
  box.innerHTML=paco.messages.map(messageHtml).join("");
  box.scrollTop=box.scrollHeight;
  syncLauncher();
}

function pushMessage(item,{speak=false,unread=false}={}){
  paco.messages.push(item);
  if(paco.messages.length>MAX_MESSAGES)paco.messages.splice(0,paco.messages.length-MAX_MESSAGES);
  if(unread&&!isOpen())paco.unread+=1;
  renderMessages();
  if(speak&&item?.text)speakText(item.text);
}

function typing(){
  paco.messages=paco.messages.filter(item=>item.type!=="typing");
  paco.messages.push(message({type:"typing"}));
  renderMessages();
  setFace("thinking");
}

function replaceTyping(item){
  paco.messages=paco.messages.filter(row=>row.type!=="typing");
  if(item)paco.messages.push(item);
  renderMessages();
}

function setBusy(value){
  paco.busy=Boolean(value);
  const send=paco.root?.querySelector("[data-paco-send]");
  if(send)send.disabled=paco.busy;
}

function setFace(name="idle"){
  paco.face=name;
  const src=ASSETS[name]||ASSETS.idle;
  paco.root?.querySelectorAll("[data-paco-face],.paco2-launcher-face").forEach(img=>{
    if(img.getAttribute("src")!==src)img.setAttribute("src",src);
  });
  if(paco.root)paco.root.dataset.pacoExpression=name;
}

function renderRoot(){
  return `<div id="paco-bot" class="paco2-root" data-paco-version="${VERSION}" hidden>
    <button type="button" class="paco2-launcher" aria-label="Abrir PACO" aria-expanded="false" data-paco-toggle>
      <img class="paco2-launcher-face" src="${ASSETS.idle}" alt="" aria-hidden="true" draggable="false">
      <span class="paco2-launcher-status" aria-hidden="true"></span>
      <b class="paco2-unread" data-paco-unread hidden>0</b>
    </button>

    <section class="paco2-panel" role="dialog" aria-label="PACO, asistente virtual del CRM" aria-modal="false">
      <header class="paco2-head">
        <div class="paco2-head-identity">
          <img class="paco2-head-face" src="${ASSETS.idle}" alt="" aria-hidden="true" draggable="false" data-paco-face>
          <div class="paco2-head-copy">
            <span>Asistente virtual del CRM</span>
            <strong>PACO</strong>
            <small><i></i><b data-paco-context>${esc(currentModuleLabel())}</b> · monitoreo activo</small>
          </div>
        </div>
        <div class="paco2-head-actions">
          <button type="button" class="paco2-voice" data-paco-voice aria-label="Activar o silenciar voz">🔊</button>
          <button type="button" class="paco2-close" data-paco-close aria-label="Cerrar PACO">×</button>
        </div>
      </header>

      <div class="paco2-messages" data-paco-messages aria-live="polite"></div>

      <div class="paco2-quick">
        ${QUICK_ACTIONS.map(action=>`<button type="button"${actionAttrs(action)}><span>${esc(action.icon)}</span>${esc(action.label)}</button>`).join("")}
      </div>

      <form class="paco2-composer" data-paco-form>
        <textarea rows="1" maxlength="700" aria-label="Escribe a PACO" placeholder="Pregúntame o dime qué necesitas hacer…" data-paco-input></textarea>
        <button type="submit" class="paco2-send" aria-label="Enviar" data-paco-send>➜</button>
      </form>

      <div class="paco2-footnote">
        <span>●</span> PACO usa tus permisos y la información vigente del CRM
      </div>
    </section>
  </div>`;
}

function syncLauncher(){
  if(!paco.root)return;
  const badge=paco.root.querySelector("[data-paco-unread]");
  if(badge){
    badge.hidden=paco.unread<1;
    badge.textContent=paco.unread>99?"99+":String(paco.unread);
  }
  paco.root.classList.toggle("has-alert",paco.unread>0);
  const voice=paco.root.querySelector("[data-paco-voice]");
  if(voice){
    voice.textContent=paco.voiceEnabled?"🔊":"🔇";
    voice.setAttribute("aria-pressed",String(paco.voiceEnabled));
    voice.title=paco.voiceEnabled?"Voz de alertas activada":"Voz de alertas silenciada";
  }
}

function armVoice(){
  paco.voiceArmed=true;
  if("speechSynthesis" in window)window.speechSynthesis.getVoices();
}

function latinSpanishVoice(){
  if(!("speechSynthesis" in window))return null;
  const voices=window.speechSynthesis.getVoices();
  const preferences=["es-CO","es-419","es-MX","es-US","es"];
  for(const lang of preferences){
    const exact=voices.find(voice=>String(voice.lang||"").toLowerCase()===lang.toLowerCase());
    if(exact)return exact;
  }
  return voices.find(voice=>String(voice.lang||"").toLowerCase().startsWith("es"))||null;
}

function speakText(text,{interrupt=false}={}){
  if(!paco.voiceEnabled||!paco.voiceArmed||!("speechSynthesis" in window)||!text)return;
  try{
    if(interrupt)window.speechSynthesis.cancel();
    const utterance=new SpeechSynthesisUtterance(String(text));
    const voice=latinSpanishVoice();
    if(voice)utterance.voice=voice;
    utterance.lang=voice?.lang||"es-CO";
    utterance.rate=.98;
    utterance.pitch=1;
    utterance.volume=1;
    window.speechSynthesis.speak(utterance);
  }catch(error){
    console.warn("[PACO] Voz no disponible",error);
  }
}

function toggleVoice(){
  armVoice();
  paco.voiceEnabled=!paco.voiceEnabled;
  localStorage.setItem("paco.voice.enabled",paco.voiceEnabled?"1":"0");
  if(!paco.voiceEnabled&&"speechSynthesis" in window)window.speechSynthesis.cancel();
  syncLauncher();
  toast(paco.voiceEnabled?"Voz de PACO activada.":"Voz de PACO silenciada.");
  if(paco.voiceEnabled)speakText("Voz de PACO activada.");
}

function setOpen(open){
  if(!paco.root)return;
  paco.root.classList.toggle("is-open",Boolean(open));
  const launcher=paco.root.querySelector("[data-paco-toggle]");
  launcher?.setAttribute("aria-expanded",String(Boolean(open)));
  if(open){
    armVoice();
    paco.unread=0;
    syncLauncher();
    ensureWelcome();
    updateContext();
    setFace("listening");
    requestAnimationFrame(()=>setTimeout(()=>paco.root?.querySelector("[data-paco-input]")?.focus(),80));
  }else{
    setFace("idle");
  }
}

function toggleOpen(){setOpen(!isOpen())}

function ensureWelcome(){
  if(paco.messages.length)return;
  const name=profileName();
  pushMessage(message({
    type:"welcome",
    text:`${name?`Hola, ${name}. `:""}Soy PACO. Puedo decirte dónde va un pedido, avisarte demoras y novedades, vigilar la jornada y ayudarte a registrar actividades sin salir del asistente.`,
    actions:[
      {label:"Registrar actividad",sub:"Te guío paso a paso",icon:"+",action:"activity-search",tone:"primary"},
      {label:"Buscar pedido",sub:"Estado, etapa y responsable",icon:"⌕",action:"prompt",prompt:"¿Dónde va el pedido "},
      {label:"Revisar alertas",sub:"Demoras, novedades y equipo",icon:"!",action:"delays"},
      {label:"Ver mi jornada",sub:"Actividad actual y pendientes",icon:"◷",action:"my-day"}
    ]
  }));
}

function updateContext(){
  const label=currentModuleLabel();
  paco.root?.querySelectorAll("[data-paco-context]").forEach(node=>node.textContent=label);
}

function orderTerm(input){
  const raw=String(input||"");
  const explicit=raw.match(/(?:pedido|orden)\s*(?:#|n[úu]mero|no\.?|nro\.?|:)?\s*([A-Za-z0-9][A-Za-z0-9._/-]{2,})/i)?.[1];
  if(explicit&&!/^(bloqueado|atascado|estancado|pendiente|que|como|donde)$/i.test(explicit))return explicit;
  return raw.match(/\b[A-Za-z]{1,8}[-_]\d{2,}[A-Za-z0-9-]*\b/)?.[0]
    ||raw.match(/\b\d{4,}\b/)?.[0]
    ||"";
}

function moduleFor(input){
  let best=null,bestScore=0;
  for(const [id,meta] of Object.entries(MODULES)){
    const score=Math.max(...meta.keywords.map(word=>phraseScore(input,word)));
    if(score>bestScore){bestScore=score;best={id,...meta};}
  }
  return bestScore>=.72?best:null;
}

function formatDuration(seconds){
  const total=Math.max(0,Math.round(Number(seconds||0)));
  const minutes=Math.round(total/60);
  if(minutes<1)return "menos de un minuto";
  if(minutes<60)return `${minutes} min`;
  const hours=Math.floor(minutes/60);
  const rest=minutes%60;
  return rest?`${hours} h ${rest} min`:`${hours} h`;
}

function activityEvidenceLabel(policy){
  const key=String(policy||"NONE").toUpperCase();
  return {
    NONE:"Sin evidencia",
    FINAL_PHOTO:"Foto final",
    BEFORE_AFTER:"Foto antes y después",
    FILE:"Archivo",
    LINK:"Enlace",
    ERP_REFERENCE:"Referencia del CRM"
  }[key]||fmt.label(key);
}

function workContextValid(){
  return paco.workCache&&Date.now()-paco.workCacheAt<WORK_CACHE_MS;
}

async function loadWorkContext(force=false){
  if(!force&&workContextValid())return paco.workCache;
  const data=await api.workMyDay();
  paco.workCache=data||{};
  paco.workCacheAt=Date.now();
  return paco.workCache;
}

function catalogScore(item,query){
  if(!query)return Math.max(0,100-Number(item.sortOrder||100));
  const haystack=[item.name,item.description,item.code,item.activityGroup].filter(Boolean);
  const queryTokens=tokens(query);
  if(!queryTokens.length)return 0;
  let score=0;
  for(const token of queryTokens){
    let best=0;
    for(const text of haystack){
      for(const candidate of tokens(text)){
        best=Math.max(best,tokenSimilarity(token,candidate));
      }
      if(norm(text).includes(norm(token)))best=Math.max(best,.95);
    }
    score+=best;
  }
  return score/queryTokens.length;
}

function catalogCandidates(context,query=""){
  const catalog=(Array.isArray(context?.catalog)?context.catalog:[])
    .filter(item=>String(item.activityKind||"ACTIVITY").toUpperCase()==="ACTIVITY");
  const scheduled=(Array.isArray(context?.today)?context.today:[])
    .filter(item=>item.catalogId&&![ "COMPLETED","CANCELLED" ].includes(String(item.memberStatus||"").toUpperCase()))
    .map(item=>({
      id:item.catalogId,
      assignmentId:item.id,
      name:item.title||item.catalogName,
      description:item.description||"Actividad programada para hoy",
      standardMinutes:item.estimatedMinutes,
      evidencePolicy:item.evidencePolicy,
      scheduled:true,
      plannedStart:item.plannedStart
    }));

  const ranked=catalog
    .map(item=>({...item,score:catalogScore(item,query)}))
    .filter(item=>!query||item.score>=.48)
    .sort((a,b)=>b.score-a.score||Number(a.sortOrder||100)-Number(b.sortOrder||100));

  const seen=new Set();
  return [...scheduled,...ranked].filter(item=>{
    const key=`${item.id}:${item.assignmentId||""}`;
    if(seen.has(key))return false;
    seen.add(key);
    return true;
  }).slice(0,8);
}

async function activitySearch(query=""){
  paco.pendingIntent="ACTIVITY_QUERY";
  const context=await loadWorkContext();
  if(context?.active){
    paco.pendingIntent=null;
    const active=context.active;
    return message({
      text:`Ya tienes una actividad activa: “${active.title||active.catalogName||"Actividad"}”. Antes de iniciar otra, puedes pausarla, reanudarla o terminarla.`,
      card:[
        ["Estado",fmt.label(active.status)],
        ["Inicio",active.startedAt?fmt.date(active.startedAt):"—"]
      ],
      actions:activityControlActions(active)
    });
  }

  const candidates=catalogCandidates(context,query);
  if(!candidates.length){
    return message({
      text:`No encontré una actividad suficientemente parecida a “${query}”. Escríbeme otras palabras; por ejemplo: limpieza, cargue, inventario, apoyo a corte o reunión.`,
      actions:[{label:"Ver actividades disponibles",sub:"Mostrar opciones",icon:"☷",action:"activity-search"}]
    });
  }

  const text=query
    ? `Encontré estas actividades parecidas a “${query}”. Elige la correcta y te mostraré qué exige antes de iniciarla.`
    :"¿Qué actividad vas a realizar? Te muestro primero lo programado para hoy y las opciones más habituales.";

  return message({
    text,
    actions:candidates.map(item=>({
      label:item.name||"Actividad",
      sub:item.scheduled
        ? `Programada${item.plannedStart?` · ${fmt.date(item.plannedStart)}`:""}`
        : `${item.standardMinutes||60} min · ${activityEvidenceLabel(item.evidencePolicy)}`,
      icon:item.scheduled?"◷":"→",
      action:"activity-select",
      catalogId:item.id,
      assignmentId:item.assignmentId||null,
      tone:item.scheduled?"primary":"default"
    }))
  });
}

async function activitySelection(catalogId,assignmentId=null){
  const context=await loadWorkContext();
  const scheduled=(context?.today||[]).find(item=>String(item.catalogId)===String(catalogId)&&(!assignmentId||String(item.id)===String(assignmentId)));
  const catalog=(context?.catalog||[]).find(item=>String(item.id)===String(catalogId));
  const item=scheduled?{
    id:catalogId,
    assignmentId:scheduled.id,
    name:scheduled.title||scheduled.catalogName||catalog?.name,
    description:scheduled.description||catalog?.description,
    standardMinutes:scheduled.estimatedMinutes||catalog?.standardMinutes,
    evidencePolicy:scheduled.evidencePolicy||catalog?.evidencePolicy,
    plannedStart:scheduled.plannedStart
  }:catalog;

  if(!item)return message({text:"Esa actividad ya no está disponible en tu catálogo. Voy a actualizar las opciones.",actions:[{label:"Actualizar actividades",action:"activity-search",icon:"↻"}]});

  paco.pendingIntent=null;
  paco.selectedActivity=item;
  return message({
    text:`Antes de iniciar, confirma que esta es la actividad correcta: “${item.name}”.`,
    card:[
      ["Duración estimada",`${item.standardMinutes||60} min`],
      ["Evidencia",activityEvidenceLabel(item.evidencePolicy)],
      ...(item.plannedStart?[["Programada",fmt.date(item.plannedStart)]]:[])
    ],
    actions:[
      {label:"Iniciar actividad",sub:"Comenzar cronómetro ahora",icon:"▶",action:"activity-start",catalogId:item.id,assignmentId:item.assignmentId||null,tone:"primary"},
      {label:"Elegir otra",sub:"Volver al catálogo",icon:"↩",action:"activity-search"}
    ]
  });
}

function activityControlActions(active){
  const status=String(active?.status||"").toUpperCase();
  const executionId=active?.id;
  if(!executionId)return [{label:"Abrir Mi jornada",icon:"→",action:"navigate",module:"workforce"}];
  const actions=[];
  if(status==="IN_PROGRESS")actions.push({label:"Pausar actividad",sub:"Detener temporalmente el cronómetro",icon:"Ⅱ",action:"activity-pause",executionId});
  if(status==="PAUSED")actions.push({label:"Reanudar actividad",sub:"Continuar el cronómetro",icon:"▶",action:"activity-resume",executionId,tone:"primary"});
  actions.push({label:"Finalizar actividad",sub:"PACO validará la evidencia requerida",icon:"✓",action:"activity-finish",executionId,tone:"success"});
  actions.push({label:"Abrir Mi jornada",sub:"Evidencias y detalle",icon:"→",action:"navigate",module:"workforce"});
  return actions;
}

async function startActivity(catalogId,assignmentId=null){
  setBusy(true);
  typing();
  try{
    const result=await api.workStart(catalogId,assignmentId||null,{source:"PACO_ASSISTANT",assistantVersion:VERSION});
    paco.workCache=null;
    const title=result?.title||paco.selectedActivity?.name||"la actividad";
    const answer=message({
      type:"success",
      text:`Listo. Inicié “${title}”. El tiempo ya está corriendo en Mi Jornada.`,
      actions:[
        {label:"Ver mi jornada",sub:"Cronómetro, evidencia y cierre",icon:"◷",action:"my-day",tone:"primary"},
        {label:"Abrir módulo Jornada",sub:"Ver detalle completo",icon:"→",action:"navigate",module:"workforce"}
      ]
    });
    replaceTyping(answer);
    speakText(`Listo. Inicié ${title}.`);
    setFace("success");
    requestSnapshotSoon(2_000);
  }catch(error){
    replaceTyping(message({
      text:"No pude iniciar esa actividad.",
      alert:{title:"PACO",text:error.message||"El CRM rechazó la operación.",severity:2},
      actions:[{label:"Actualizar Mi jornada",icon:"↻",action:"my-day"},{label:"Abrir Jornada",icon:"→",action:"navigate",module:"workforce"}]
    }));
    setFace("idle");
  }finally{
    setBusy(false);
  }
}

async function mutateActivity(action,executionId){
  if(!executionId)return;
  setBusy(true);
  typing();
  try{
    let result;
    let text;
    if(action==="activity-pause"){
      result=await api.workPause(executionId,"OTHER","Pausa registrada desde PACO");
      text="Actividad pausada. Cuando estés listo, puedo reanudarla desde aquí.";
    }else if(action==="activity-resume"){
      result=await api.workResume(executionId);
      text="Actividad reanudada. El cronómetro volvió a correr.";
    }else{
      result=await api.workFinish(executionId,{resultNote:"Finalizada desde PACO"});
      const status=String(result?.status||"").toUpperCase();
      if(status==="WAITING_EVIDENCE"){
        text="El trabajo quedó terminado, pero falta la evidencia fotográfica. Abre Mi Jornada para adjuntarla y cerrar correctamente.";
      }else if(status==="SUBMITTED"){
        text="Actividad terminada y enviada a revisión.";
      }else{
        text="Actividad terminada correctamente.";
      }
    }

    paco.workCache=null;
    const context=await loadWorkContext(true).catch(()=>null);
    replaceTyping(message({
      type:"success",
      text,
      actions:context?.active?activityControlActions(context.active):[
        {label:"Registrar otra actividad",icon:"+",action:"activity-search",tone:"primary"},
        {label:"Abrir Mi jornada",icon:"→",action:"navigate",module:"workforce"}
      ]
    }));
    speakText(text);
    setFace("success");
    requestSnapshotSoon(1_500);
  }catch(error){
    const evidence=/evidencia|foto|fotograf/i.test(String(error?.message||""));
    replaceTyping(message({
      text:evidence
        ?"Para cerrar esa actividad debes completar la evidencia requerida en Mi Jornada."
        :"No pude completar esa acción desde PACO.",
      alert:{title:"Validación del CRM",text:error.message||"Operación no disponible.",severity:2},
      actions:[{label:"Abrir Mi jornada",icon:"→",action:"navigate",module:"workforce",tone:"primary"}]
    }));
    setFace("idle");
  }finally{
    setBusy(false);
  }
}

async function myDayMessage(){
  const context=await loadWorkContext(true);
  if(context?.active){
    const active=context.active;
    const metrics=active.metrics||{};
    return message({
      text:`Tu actividad actual es “${active.title||active.catalogName||"Actividad"}”.`,
      card:[
        ["Estado",fmt.label(active.status)],
        ["Tiempo activo",formatDuration(metrics.activeSeconds||active.activeSeconds||0)],
        ["Pausas",formatDuration(metrics.pauseSeconds||metrics.pausedSeconds||0)],
        ["Evidencia",activityEvidenceLabel(active.evidencePolicy)]
      ],
      actions:activityControlActions(active)
    });
  }

  const today=Array.isArray(context?.today)?context.today:[];
  return message({
    text:today.length
      ? `No tienes una actividad corriendo. Tienes ${today.length} actividad${today.length===1?"":"es"} pendiente${today.length===1?"":"s"} para hoy.`
      :"No tienes una actividad corriendo ni actividades pendientes para hoy.",
    actions:[
      {label:"Registrar actividad",sub:"Elegir del catálogo",icon:"+",action:"activity-search",tone:"primary"},
      {label:"Abrir Mi jornada",sub:"Ver cronograma y evidencia",icon:"→",action:"navigate",module:"workforce"}
    ]
  });
}

async function diagnoseOrder(term){
  if(!term){
    return message({
      text:"Dime el número del pedido y te digo exactamente dónde está, quién lo tiene y si existe una novedad.",
      actions:[{label:"Escribir número",sub:"Ejemplo: 45832",icon:"⌕",action:"prompt",prompt:"¿Dónde va el pedido "}]
    });
  }

  const list=await api.listOrders({search:term,page:1,pageSize:8,includeHistory:true,assignment:"ALL"});
  const rows=Array.isArray(list?.items)?list.items:Array.isArray(list)?list:[];
  if(!rows.length){
    return message({
      text:`No encontré un pedido visible para “${term}”.`,
      actions:[{label:"Abrir Pedidos",icon:"→",action:"navigate",module:"orders"}]
    });
  }

  if(rows.length>1){
    return message({
      text:`Encontré ${rows.length} coincidencias. ¿Cuál quieres revisar?`,
      actions:rows.slice(0,6).map(row=>({
        label:`${row.orderNumber||row.order_number||"Pedido"} · ${row.clientName||row.client_name||"Cliente"}`,
        sub:row.stepName||fmt.step(row.currentStep||row.current_step_code||""),
        icon:"⌕",
        action:"diagnose-order-id",
        orderId:row.id
      }))
    });
  }

  return diagnoseOrderRow(rows[0]);
}

async function diagnoseOrderId(id){
  const detail=await api.getOrder(id);
  return diagnoseOrderRow(detail?.order||detail||{id});
}

async function diagnoseOrderRow(row){
  const id=row.id||row.orderId;
  const [actionsResult,issuesResult,detailResult]=await Promise.allSettled([
    id?api.getActions(id):Promise.resolve([]),
    id?api.orderIssues(id):Promise.resolve([]),
    id?api.getOrder(id):Promise.resolve(row)
  ]);

  const detail=detailResult.status==="fulfilled"?(detailResult.value?.order||detailResult.value||row):row;
  const actions=actionsResult.status==="fulfilled"?(Array.isArray(actionsResult.value)?actionsResult.value:actionsResult.value?.items||[]):[];
  const issues=issuesResult.status==="fulfilled"?(Array.isArray(issuesResult.value)?issuesResult.value:issuesResult.value?.items||issuesResult.value?.issues||[]):[];
  const openIssues=issues.filter(issue=>!["RESOLVED","CLOSED","CANCELLED"].includes(String(issue.status||"").toUpperCase()));
  const step=detail.currentStep||detail.current_step_code||row.currentStep||row.current_step_code||"";
  const status=detail.status||row.status||"";
  const assignee=detail.assigneeName||detail.assignedToName||row.assigneeName||row.assigned_to_name||"En cola / sin asignar";
  const number=detail.orderNumber||detail.order_number||row.orderNumber||row.order_number||"Pedido";
  const moduleId=STEP_MODULE[String(step).toUpperCase()]||"orders";
  const age=row.ageBusinessSeconds||row.age_business_seconds||detail.ageBusinessSeconds||0;

  return message({
    text:`El pedido ${number} está en ${fmt.step(step)||step||"una etapa operativa"} con estado ${fmt.label(status)||"activo"}.`,
    card:[
      ["Cliente",detail.clientName||detail.client_name||row.clientName||row.client_name||"—"],
      ["Responsable",assignee],
      ...(age?[["Tiempo en etapa",formatDuration(age)]]:[]),
      ["Novedades abiertas",String(openIssues.length)],
      ["Acciones disponibles",String(actions.length)]
    ],
    alert:openIssues.length?{
      title:"Hay una novedad abierta",
      text:openIssues[0]?.title||openIssues[0]?.detail||"El pedido requiere atención antes de continuar.",
      severity:openIssues.some(issue=>issue.blocking)?3:2
    }:null,
    actions:[
      ...(id?[{label:"Abrir expediente",sub:"Ver pedido completo",icon:"→",action:"open-order",orderId:id,tone:"primary"}]:[]),
      ...(moduleId!=="orders"?[{label:`Ir a ${MODULES[moduleId]?.label||"etapa actual"}`,sub:"Continuar el proceso",icon:"↗",action:"navigate",module:moduleId}]:[]),
      ...(openIssues.length?[{label:"Ver novedades",sub:"Excepciones y bloqueos",icon:"!",action:"navigate",module:"approvals",tone:"warning"}]:[])
    ]
  });
}

function alertPresentation(alert){
  const kind=String(alert?.kind||"");
  const severity=Math.max(1,Number(alert?.severity||1));
  const order=alert?.orderNumber||"";
  const person=alert?.personName||"";
  const age=formatDuration(alert?.ageSeconds||0);

  if(kind==="ORDER_QUEUE_LONG"){
    return {
      text:`Atención: el pedido ${order} lleva ${age} en cola de ${fmt.step(alert.stepCode)||fmt.label(alert.stepCode)||"su etapa actual"}.`,
      title:"Pedido demorado",
      module:alert.module||STEP_MODULE[String(alert.stepCode||"").toUpperCase()]||"orders",
      orderId:alert.orderId,
      severity
    };
  }

  if(kind==="AUX_IDLE"){
    return {
      text:`Atención: ${person||"un auxiliar"} lleva ${age} sin actividad registrada.`,
      title:"Auxiliar desocupado",
      module:"workforce",
      severity
    };
  }

  if(kind==="ACTIVITY_LONG"){
    return {
      text:`Atención: ${person||"una persona"} lleva ${age} en “${alert.activityTitle||"su actividad"}”, por encima del tiempo esperado.`,
      title:"Actividad demorada",
      module:"workforce",
      severity
    };
  }

  if(kind==="ACTIVITY_DONE"){
    return {
      text:`${person||"Un auxiliar"} terminó la actividad “${alert.activityTitle||"Actividad"}”.`,
      title:"Actividad terminada",
      module:"workforce",
      severity:1
    };
  }

  if(kind==="ORDER_DISPATCHED"){
    return {
      text:`El pedido ${order} fue despachado. Ya puedes consultar su seguimiento en Despachos y entregas.`,
      title:"Pedido despachado",
      module:"shipping",
      orderId:alert.orderId,
      severity:1
    };
  }

  if(kind==="ORDER_ISSUE"){
    return {
      text:`Hay una novedad en el pedido ${order}: ${alert.issueTitle||"requiere atención"}.`,
      title:"Novedad del pedido",
      detail:alert.issueDetail||"",
      module:"approvals",
      orderId:alert.orderId,
      severity
    };
  }

  return null;
}

function alertActions(alert,presentation){
  const actions=[];
  if(presentation.orderId){
    actions.push({label:"Ver pedido",sub:"Abrir expediente",icon:"⌕",action:"open-order",orderId:presentation.orderId,tone:"primary"});
  }
  if(presentation.module&&allowed(presentation.module)){
    actions.push({label:`Abrir ${MODULES[presentation.module]?.label||"módulo"}`,icon:"→",action:"navigate",module:presentation.module});
  }
  if(alert.kind==="AUX_IDLE"&&allowed("workforce")){
    actions.unshift({label:"Registrar actividad",sub:"Ayudar a clasificar trabajo",icon:"+",action:"activity-search",tone:"primary"});
  }
  return actions.slice(0,3);
}

function seenStorageKey(){return `paco.seen.${state.profile?.id||state.profile?.profileId||"session"}`}

function loadSeen(){
  paco.seen.clear();
  try{
    const rows=JSON.parse(sessionStorage.getItem(seenStorageKey())||"[]");
    const cutoff=Date.now()-8*60*60*1000;
    for(const row of rows){
      if(row?.key&&Number(row.at)>cutoff)paco.seen.set(row.key,Number(row.at));
    }
  }catch{}
}

function saveSeen(){
  try{
    const rows=[...paco.seen.entries()].slice(-120).map(([key,at])=>({key,at}));
    sessionStorage.setItem(seenStorageKey(),JSON.stringify(rows));
  }catch{}
}

function markSeen(key){
  if(!key)return;
  paco.seen.set(String(key),Date.now());
  if(paco.seen.size>120){
    const oldest=[...paco.seen.entries()].sort((a,b)=>a[1]-b[1]).slice(0,paco.seen.size-100);
    oldest.forEach(([value])=>paco.seen.delete(value));
  }
  saveSeen();
}

function processAlerts(alerts,{speak=true}={}){
  const fresh=(Array.isArray(alerts)?alerts:[]).filter(alert=>alert?.key&&!paco.seen.has(String(alert.key)));
  if(!fresh.length)return;

  const speakable=[];
  for(const alert of fresh){
    markSeen(alert.key);
    const view=alertPresentation(alert);
    if(!view)continue;

    pushMessage(message({
      type:"operational",
      text:view.text,
      alert:{
        title:view.title,
        text:view.detail||"",
        severity:view.severity
      },
      actions:alertActions(alert,view),
      meta:{alertKind:alert.kind,alertKey:alert.key}
    }),{unread:true});

    speakable.push(view.text);
  }

  if(!speak||!speakable.length)return;
  if(speakable.length<=3){
    speakable.forEach((text,index)=>setTimeout(()=>speakText(text),index*450));
  }else{
    speakText(`PACO tiene ${speakable.length} novedades operativas. Abre el asistente para revisarlas.`,{interrupt:false});
  }
}

async function pollSnapshot({manual=false}={}){
  if(!state.profile||paco.watcherRunning)return null;
  paco.watcherRunning=true;
  try{
    const since=paco.snapshotCursor||new Date().toISOString();
    const data=await api.pacoSnapshot(since,SNAPSHOT_LIMIT);
    paco.snapshotCursor=data?.serverTime||new Date().toISOString();
    processAlerts(data?.alerts,{speak:!manual});
    return data;
  }catch(error){
    console.warn("[PACO] Snapshot operativo no disponible",error);
    if(manual)throw error;
    return null;
  }finally{
    paco.watcherRunning=false;
    scheduleWatcher();
  }
}

function clearWatcher(){
  if(paco.watcherTimer){
    clearTimeout(paco.watcherTimer);
    paco.watcherTimer=null;
  }
}

function scheduleWatcher(seconds=null){
  clearWatcher();
  if(!state.profile)return;
  const wait=Number(seconds||(document.hidden?HIDDEN_POLL_SECONDS:DEFAULT_POLL_SECONDS));
  paco.watcherTimer=setTimeout(()=>pollSnapshot(),Math.max(15,wait)*1000);
}

function requestSnapshotSoon(delay=1_500){
  clearWatcher();
  paco.watcherTimer=setTimeout(()=>pollSnapshot(),delay);
}

async function delaysMessage(){
  const data=await pollSnapshot({manual:true});
  const alerts=Array.isArray(data?.alerts)?data.alerts:[];
  const relevant=alerts.filter(item=>["ORDER_QUEUE_LONG","AUX_IDLE","ACTIVITY_LONG","ORDER_ISSUE"].includes(item.kind));
  if(!relevant.length){
    return message({
      text:"No veo demoras o novedades operativas por encima de los umbrales actuales en tu ámbito visible.",
      actions:[{label:"Centro de operaciones",icon:"→",action:"navigate",module:"dashboard"}]
    });
  }

  const top=relevant.slice(0,6);
  return message({
    text:`Encontré ${relevant.length} señal${relevant.length===1?"":"es"} que requieren atención. Te muestro las más importantes.`,
    actions:top.map(alert=>{
      const view=alertPresentation(alert);
      return {
        label:view?.title||"Alerta operativa",
        sub:view?.text||"",
        icon:Number(alert.severity)>=3?"!":"→",
        action:view?.orderId?"open-order":"navigate",
        orderId:view?.orderId||null,
        module:view?.module||"workforce",
        tone:Number(alert.severity)>=3?"warning":"default"
      };
    })
  });
}

function capabilityMessage(){
  return message({
    text:"Puedo trabajar contigo dentro del CRM: consultar pedidos, explicar en qué etapa están, avisar demoras y novedades, vigilar auxiliares y actividades, y registrar o controlar tu actividad usando los mismos flujos del sistema.",
    actions:[
      {label:"Registrar actividad",icon:"+",action:"activity-search",tone:"primary"},
      {label:"Buscar pedido",icon:"⌕",action:"prompt",prompt:"¿Dónde va el pedido "},
      {label:"Revisar demoras",icon:"!",action:"delays"},
      {label:"Mi jornada",icon:"◷",action:"my-day"}
    ]
  });
}

function contextualHelp(input){
  const module=moduleFor(input)||MODULES[currentModule()]&&{id:currentModule(),...MODULES[currentModule()]};
  if(!module)return capabilityMessage();
  return message({
    text:`${module.label}: ${module.help}`,
    actions:[
      {label:`Abrir ${module.label}`,icon:"→",action:"navigate",module:module.id,tone:"primary"},
      {label:"Buscar pedido",icon:"⌕",action:"prompt",prompt:"¿Dónde va el pedido "}
    ]
  });
}

async function resolveQuery(input){
  const text=String(input||"").trim();
  const normalized=norm(text);

  if(!normalized)return capabilityMessage();

  if(paco.pendingIntent==="ACTIVITY_QUERY"){
    return activitySearch(text);
  }

  const term=orderTerm(text);
  if(term&&(isIntent(text,"order",.58)||normalized.includes("pedido")||normalized.includes("orden"))){
    return diagnoseOrder(term);
  }

  if(isIntent(text,"activity"))return activitySearch("");
  if(isIntent(text,"delays"))return delaysMessage();
  if(isIntent(text,"myDay"))return myDayMessage();
  if(isIntent(text,"capabilities"))return capabilityMessage();

  if((normalized.includes("pedido")||normalized.includes("orden"))&&!term){
    return diagnoseOrder("");
  }

  const module=moduleFor(text);
  if(module)return contextualHelp(text);

  return message({
    text:"Puedo ayudarte, pero necesito ubicar mejor la acción. Puedes decirme el número de un pedido, escribir la actividad que vas a realizar o preguntarme qué está demorado.",
    actions:[
      {label:"Registrar actividad",icon:"+",action:"activity-search",tone:"primary"},
      {label:"Buscar pedido",icon:"⌕",action:"prompt",prompt:"¿Dónde va el pedido "},
      {label:"Revisar alertas",icon:"!",action:"delays"}
    ]
  });
}

async function submit(input){
  const text=String(input||"").trim();
  if(!text||paco.busy)return;
  armVoice();
  pushMessage(message({role:"user",text}));
  setBusy(true);
  typing();
  try{
    const answer=await resolveQuery(text);
    replaceTyping(answer);
    setFace(answer?.type==="success"?"success":"talking");
    setTimeout(()=>isOpen()&&setFace("listening"),700);
  }catch(error){
    console.error("[PACO V11.37]",error);
    replaceTyping(message({
      text:"No pude completar esa consulta con los datos o permisos actuales.",
      alert:{title:"Detalle",text:error.message||"Error inesperado",severity:2},
      actions:[
        {label:"Reintentar",icon:"↻",action:"prompt",prompt:text},
        {label:"Abrir módulo actual",icon:"→",action:"navigate",module:currentModule()}
      ]
    }));
    setFace("idle");
  }finally{
    setBusy(false);
  }
}

function route(moduleId){
  if(!allowed(moduleId)){
    pushMessage(message({text:`Tu usuario no tiene lectura habilitada para ${MODULES[moduleId]?.label||moduleId}. PACO no saltará ese permiso.`}));
    return;
  }
  navigate(moduleId);
  setOpen(false);
}

async function handleAction(button){
  const action=button.dataset.pacoAction;
  armVoice();

  if(action==="navigate"){route(button.dataset.module||"dashboard");return;}
  if(action==="open-order"){
    window.dispatchEvent(new CustomEvent("erp:open-order",{detail:button.dataset.orderId}));
    setOpen(false);
    return;
  }
  if(action==="prompt"){
    const input=paco.root?.querySelector("[data-paco-input]");
    if(input){
      input.value=button.dataset.prompt||"";
      input.focus();
      input.setSelectionRange(input.value.length,input.value.length);
    }
    return;
  }
  if(action==="activity-search"){
    setBusy(true);typing();
    try{replaceTyping(await activitySearch(""));}catch(error){replaceTyping(message({text:error.message||"No pude cargar las actividades."}));}
    finally{setBusy(false);}
    return;
  }
  if(action==="activity-select"){
    setBusy(true);typing();
    try{replaceTyping(await activitySelection(button.dataset.catalogId,button.dataset.assignmentId||null));}
    catch(error){replaceTyping(message({text:error.message||"No pude abrir esa actividad."}));}
    finally{setBusy(false);}
    return;
  }
  if(action==="activity-start"){
    await startActivity(button.dataset.catalogId,button.dataset.assignmentId||null);
    return;
  }
  if(["activity-pause","activity-resume","activity-finish"].includes(action)){
    await mutateActivity(action,button.dataset.executionId);
    return;
  }
  if(action==="my-day"){
    setBusy(true);typing();
    try{replaceTyping(await myDayMessage());}
    catch(error){replaceTyping(message({text:error.message||"No pude consultar tu jornada."}));}
    finally{setBusy(false);}
    return;
  }
  if(action==="delays"){
    setBusy(true);typing();
    try{replaceTyping(await delaysMessage());}
    catch(error){replaceTyping(message({text:error.message||"No pude consultar las alertas operativas."}));}
    finally{setBusy(false);}
    return;
  }
  if(action==="diagnose-order-id"){
    setBusy(true);typing();
    try{replaceTyping(await diagnoseOrderId(button.dataset.orderId));}
    catch(error){replaceTyping(message({text:error.message||"No pude revisar ese pedido."}));}
    finally{setBusy(false);}
  }
}

function bindRoot(){
  const root=paco.root;
  if(!root||root.dataset.pacoBound==="1")return;
  root.dataset.pacoBound="1";

  root.querySelector("[data-paco-toggle]")?.addEventListener("click",()=>{armVoice();toggleOpen();});
  root.querySelector("[data-paco-close]")?.addEventListener("click",()=>setOpen(false));
  root.querySelector("[data-paco-voice]")?.addEventListener("click",toggleVoice);

  root.querySelector("[data-paco-form]")?.addEventListener("submit",event=>{
    event.preventDefault();
    const input=root.querySelector("[data-paco-input]");
    const text=input?.value||"";
    if(input)input.value="";
    submit(text);
  });

  root.querySelector("[data-paco-input]")?.addEventListener("keydown",event=>{
    if(event.key==="Enter"&&!event.shiftKey){
      event.preventDefault();
      root.querySelector("[data-paco-form]")?.requestSubmit();
    }
  });

  root.addEventListener("click",event=>{
    const button=event.target.closest?.("[data-paco-action]");
    if(button)handleAction(button);
  });
}

function bindGlobal(){
  if(paco.globalBound)return;
  paco.globalBound=true;

  document.addEventListener("click",event=>{
    if(event.target.closest?.(".nav-item"))setTimeout(updateContext,40);
  });

  document.addEventListener("visibilitychange",()=>scheduleWatcher());

  window.addEventListener("erp:rpc-error",event=>{
    paco.lastRpcError=event.detail||null;
  });

  window.addEventListener("erp:work-changed",()=>{
    paco.workCache=null;
    requestSnapshotSoon(1_500);
  });

  window.addEventListener("paco:open",event=>{
    if(!state.profile)return;
    setOpen(true);
    const prompt=event.detail?.prompt;
    if(prompt){
      const input=paco.root?.querySelector("[data-paco-input]");
      if(input){input.value=prompt;input.focus();}
    }
  });

  window.addEventListener("paco:close",()=>setOpen(false));
}

function resetSession(){
  clearWatcher();
  paco.messages=[];
  paco.pendingIntent=null;
  paco.selectedActivity=null;
  paco.workCache=null;
  paco.workCacheAt=0;
  paco.snapshotCursor=new Date().toISOString();
  paco.unread=0;
  loadSeen();
}

function syncProfile(next=state){
  if(!paco.root)return;
  const active=Boolean(next.profile);
  paco.root.hidden=!active;

  if(!active){
    setOpen(false);
    resetSession();
    renderMessages();
    return;
  }

  updateContext();
  syncLauncher();

  if(!paco.snapshotCursor){
    paco.snapshotCursor=new Date().toISOString();
    loadSeen();
  }

  requestSnapshotSoon(1_000);
}

export function installPacoAssistant(){
  const existing=document.querySelector("#paco-bot");
  if(existing&&!existing.classList.contains("paco2-root"))existing.remove();

  let root=document.querySelector("#paco-bot.paco2-root");
  if(root)root.remove();

  const template=document.createElement("template");
  template.innerHTML=renderRoot().trim();
  root=template.content.firstElementChild;
  document.body.append(root);

  paco.root=root;
  paco.voiceEnabled=localStorage.getItem("paco.voice.enabled")!=="0";
  paco.snapshotCursor=new Date().toISOString();

  bindRoot();
  bindGlobal();
  syncProfile();
  renderMessages();
  syncLauncher();

  if(!paco.unsubscribe)paco.unsubscribe=subscribe(syncProfile);

  Object.values(ASSETS).forEach(src=>{
    const image=new Image();
    image.decoding="async";
    image.src=src;
  });

  return root;
}
