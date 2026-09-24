import {state,subscribe,hasRole,can} from "../core/state.js";
import {navigate} from "../core/router.js";
import {api} from "../services/api.js";
import {fmt} from "../core/format.js";
import {toast} from "../core/ui.js";

const VERSION="11.37.1";
const STYLE_ID="paco-operational-v11370-style";
const MONITOR_MS=60000;
const DIGEST_INTERVAL_MS=30*60*1000;
const ORDER_WARN_SECONDS=3600;
const IDLE_WARN_SECONDS=20*60;
const LONG_ACTIVITY_SECONDS=5400;
const ALERT_COOLDOWN_MS=30*60*1000;
const DIGEST_ORDER_LIMIT=12;
const MANAGER_ROLES=new Set(["super_admin","gerencia","jefe_logistica","lider_logistica","coordinador_logistico"]);
const AUX_ROLES=new Set(["aux_logistica","auxiliar_corte"]);
const ACTIVE_ORDER_STATUSES=new Set(["OPEN","QUEUED","ASSIGNED","IN_PROGRESS","WAITING","BLOCKED","READY","PENDING"]);
const SHIPPING_STEPS=new Set(["CLIENT_POINT","CLIENT_PICKUP","LOCAL_DISPATCH","NATIONAL_DISPATCH","CLOSURE","CLOSED"]);

const ASSETS=Object.freeze({
  idle:"./assets/img/paco/paco-idle-v11183.svg",
  listening:"./assets/img/paco/paco-listening-v11183.svg",
  thinking:"./assets/img/paco/paco-thinking-v11183.svg",
  talking:"./assets/img/paco/paco-talking-v11183.svg",
  success:"./assets/img/paco/paco-success-v11183.svg"
});

const MODULES={
  dashboard:"Centro de operaciones",orders:"Pedidos",sales:"Ventas",credit:"Crédito",cartera:"Cartera",caja:"Caja",
  purchasing:"Compras",receiving:"Recepción",picking:"Alistamiento",cutting:"Centro de corte",billing:"Facturación",
  shipping:"Despachos y entregas",inventory:"Inventario",workforce:"Jornada y actividades",approvals:"Excepciones",
  vsm:"Flujo y tiempos",reports:"Analítica",imports:"Histórico",audit:"Auditoría",admin:"Administración"
};

const STEP_MODULE={
  CARTERA:"cartera",CAJA:"caja",CAJA_FACTURACION:"caja",COMPRAS:"purchasing",RECEPCION_MERCANCIA:"receiving",
  RECEPCION_PEDIDO:"receiving",ALISTAMIENTO:"picking",CORTE:"cutting",FACTURACION:"billing",
  CLIENT_POINT:"shipping",CLIENT_PICKUP:"shipping",LOCAL_DISPATCH:"shipping",NATIONAL_DISPATCH:"shipping",
  CLOSURE:"shipping",CLOSED:"orders"
};

const paco={
  root:null,
  messages:[],
  busy:false,
  face:"idle",
  voiceEnabled:readVoicePreference(),
  monitorTimer:null,
  monitorBusy:false,
  previous:null,
  catalog:null,
  catalogLoadedAt:0,
  flow:null,
  unsubscribe:null,
  globalBound:false,
  alertMemory:new Map(),
  lastDigestAt:0
};

function ensureStyles(){
  if(document.getElementById(STYLE_ID))return;
  const link=document.createElement("link");
  link.id=STYLE_ID;
  link.rel="stylesheet";
  link.href="./assets/runtime-css/paco-operational-v11370.css?v=11.37.1";
  document.head.appendChild(link);
}

function readVoicePreference(){
  try{return localStorage.getItem("paco_voice_v11370")!=="0"}catch{return true}
}
function saveVoicePreference(){
  try{localStorage.setItem("paco_voice_v11370",paco.voiceEnabled?"1":"0")}catch{}
}

function digestStorageKey(){return `paco_digest_v11371_${profileId()||"anonymous"}`}
function readLastDigest(){
  try{return Number(sessionStorage.getItem(digestStorageKey())||0)}catch{return 0}
}
function saveLastDigest(){
  try{sessionStorage.setItem(digestStorageKey(),String(paco.lastDigestAt||0))}catch{}
}

function esc(value){return fmt.escape(String(value??""))}
function norm(value){return String(value||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9\s-]/g," ").replace(/\s+/g," ").trim()}
function currentModule(){return state.currentModule||document.querySelector(".nav-item.active")?.dataset?.module||"dashboard"}
function moduleLabel(id=currentModule()){return MODULES[id]||"CRM Suministros"}
function roles(){return state.profile?.roles||[]}
function isManager(){return roles().some(role=>MANAGER_ROLES.has(role))}
function allowed(moduleId){return !moduleId||can(moduleId,"canRead")||moduleId===currentModule()}
function profileId(){return state.profile?.id||state.profile?.profileId||state.profile?.profile_id||null}
function displayName(){return state.profile?.displayName||state.profile?.display_name||state.profile?.name||""}
function uid(){return globalThis.crypto?.randomUUID?.()||`paco-${Date.now()}-${Math.random().toString(36).slice(2)}`}
function now(){return new Date()}
function todayIso(){return new Intl.DateTimeFormat("en-CA",{timeZone:"America/Bogota",year:"numeric",month:"2-digit",day:"2-digit"}).format(now())}
function timeLabel(value){if(!value)return "—";return new Intl.DateTimeFormat("es-CO",{timeZone:"America/Bogota",hour:"2-digit",minute:"2-digit",hour12:false}).format(new Date(value))}
function duration(seconds){
  const total=Math.max(0,Math.round(Number(seconds||0)));
  if(total<60)return `${total} s`;
  const minutes=Math.floor(total/60);
  if(minutes<60)return `${minutes} min`;
  const hours=Math.floor(minutes/60),rest=minutes%60;
  return `${hours} h${rest?` ${rest} min`:""}`;
}
function orderNumber(row){return row?.orderNumber||row?.order_number||row?.number||"Pedido"}
function orderStep(row){return String(row?.currentStep||row?.current_step_code||row?.stepCode||row?.step_code||"").toUpperCase()}
function orderStatus(row){return String(row?.status||row?.taskStatus||row?.task_status||"").toUpperCase()}
function orderAge(row){return Number(row?.ageBusinessSeconds||row?.age_business_seconds||0)}
function orderAssignee(row){return row?.assigneeName||row?.assignedToName||row?.assigned_to_name||row?.assignedTo||row?.assigned_to||""}
function activeOrder(row){const status=orderStatus(row);return !status||ACTIVE_ORDER_STATUSES.has(status)}
function itemArray(value){return Array.isArray(value)?value:Array.isArray(value?.items)?value.items:[]}

function stepName(row){return row?.stepName||row?.currentStepName||orderStep(row)||"En proceso"}
function stageBreakdown(snapshot){
  const counts=new Map();
  (snapshot?.orders||[]).filter(activeOrder).forEach(row=>{
    const label=stepName(row);
    counts.set(label,(counts.get(label)||0)+1);
  });
  return [...counts.entries()].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0],"es"));
}
function businessClockLabel(){return timeLabel(new Date())}

function editDistance(a,b){
  const x=norm(a),y=norm(b);
  if(x===y)return 0;
  if(!x)return y.length;if(!y)return x.length;
  const row=Array.from({length:y.length+1},(_,i)=>i);
  for(let i=1;i<=x.length;i++){
    let prev=row[0];row[0]=i;
    for(let j=1;j<=y.length;j++){
      const old=row[j];
      row[j]=Math.min(row[j]+1,row[j-1]+1,prev+(x[i-1]===y[j-1]?0:1));
      prev=old;
    }
  }
  return row[y.length];
}
function fuzzyWord(word,target){
  const a=norm(word),b=norm(target);
  if(!a||!b)return false;
  if(a.includes(b)||b.includes(a))return true;
  if(Math.min(a.length,b.length)<5)return false;
  return editDistance(a,b)<=Math.max(1,Math.floor(Math.max(a.length,b.length)*.28));
}
function fuzzyPhrase(text,phrase){
  const a=norm(text),b=norm(phrase);
  if(a.includes(b))return true;
  const words=a.split(" "),targets=b.split(" ");
  return targets.every(target=>words.some(word=>fuzzyWord(word,target)));
}
function matchesAny(text,aliases){return aliases.some(alias=>fuzzyPhrase(text,alias))}

const INTENTS={
  activity:["registrar actividad","registrar actvidad","registar actividad","crear actividad","iniciar actividad","anotar actividad","hacer actividad","actividad nueva"],
  delayed:["pedidos demorados","pedido demorado","pedidos atrasados","pedido atrasado","mucho en cola","cola larga","que esta demorado","qué está demorado"],
  idle:["quien esta desocupado","quién está desocupado","auxiliar desocupado","tiempo muerto","ociosos","sin actividad"],
  recentWork:["quien termino","quién terminó","actividades terminadas","actividad finalizada","que terminaron"],
  shipped:["que se despacho","qué se despachó","pedidos despachados","despachos recientes","que salio","qué salió"],
  novelties:["novedades","que novedades hay","qué novedades hay","excepciones","bloqueos"],
  operation:["estado de la operacion","estado operación","como va la operacion","cómo va la operación","resumen operativo"],
  myDay:["mi jornada","que estoy haciendo","qué estoy haciendo","mi actividad"],
  team:["que esta haciendo","qué está haciendo","quien esta trabajando","quién está trabajando","equipo trabajando","estado del equipo","actividad del equipo"],
  unassigned:["pedidos sin responsable","pedido sin responsable","sin asignar","pedidos sin asignar","cola sin responsable"],
  longWork:["actividades largas","actividad larga","actividad prolongada","quien lleva mucho tiempo","quién lleva mucho tiempo","mucho tiempo en actividad"],
  capabilities:["que puedes hacer","qué puedes hacer","como me ayudas","cómo me ayudas","funciones paco","ayuda paco"],
  order:["buscar pedido","consultar pedido","ver pedido","estado pedido","en que parte va","en qué parte va","donde va el pedido","dónde va el pedido","pedido"]
};

function orderTerm(text){
  const raw=String(text||"");
  const explicit=raw.match(/(?:pedido|orden)\s*(?:#|numero|número|no\.?|nro\.?|:)?\s*([A-Za-z0-9][A-Za-z0-9._/-]{2,})/i)?.[1];
  if(explicit&&!/^(demorado|atrasado|bloqueado|que|como|donde)$/i.test(explicit))return explicit;
  return raw.match(/\b[A-Za-z]{1,8}[-_]\d{2,}[A-Za-z0-9-]*\b/)?.[0]||raw.match(/\b\d{4,}\b/)?.[0]||"";
}

function renderRoot(){
  return `<div id="paco-bot" class="paco2-root paco-op-root" data-paco-version="${VERSION}" hidden>
    <button type="button" class="paco2-launcher paco-op-launcher" aria-label="Abrir PACO" aria-expanded="false" data-paco-toggle>
      <span class="paco-op-launcher-glyph" aria-hidden="true">⚡</span>
      <span class="paco-op-badge" data-paco-badge hidden>0</span>
      <span class="paco2-launcher-dot" aria-hidden="true"></span>
    </button>
    <section class="paco2-panel paco-op-panel" role="dialog" aria-label="PACO, asistente operativo del CRM">
      <header class="paco2-head paco-op-head">
        <div class="paco-op-avatar-wrap">
          <img class="paco2-head-face" src="${ASSETS.idle}" alt="" aria-hidden="true" data-paco-face>
          <span class="paco-op-presence" aria-hidden="true"></span>
        </div>
        <div class="paco2-head-copy">
          <span>Asistente operativo</span>
          <strong>PACO</strong>
          <small><span class="paco-op-online-text">Activo ahora</span> · <span data-paco-context>${esc(moduleLabel())}</span></small>
        </div>
        <button type="button" class="paco-op-voice ${paco.voiceEnabled?"is-on":""}" data-paco-voice aria-label="Activar o silenciar voz" title="Voz en español latino"><span data-paco-voice-icon>${paco.voiceEnabled?"🔊":"🔇"}</span></button>
        <button type="button" class="paco2-close" data-paco-close aria-label="Cerrar PACO">×</button>
      </header>
      <div class="paco-op-status">
        <div class="paco-op-status-copy">
          <span class="paco2-online"></span>
          <strong>Conectado al CRM</strong>
          <span data-paco-monitor-status>Monitoreo activo · resumen cada 30 min</span>
        </div>
        <div class="paco-op-status-actions">
          <button type="button" data-paco-test-voice>Probar voz</button>
          <button type="button" data-paco-summary-now>Resumen ahora</button>
        </div>
      </div>
      <div class="paco2-messages paco-op-messages" data-paco-messages aria-live="polite"></div>
      <div class="paco2-quick paco-op-quick" data-paco-quick></div>
      <form class="paco2-composer paco-op-composer" data-paco-form>
        <div class="paco-op-input-shell">
          <textarea rows="1" maxlength="500" data-paco-input aria-label="Escribe a PACO" placeholder="Mensaje a PACO…"></textarea>
        </div>
        <button type="submit" class="paco2-send" data-paco-send aria-label="Enviar mensaje">➜</button>
      </form>
      <div class="paco2-safe-note">PACO usa los datos y permisos reales de tu sesión.</div>
    </section>
    <div class="paco-op-toast-stack" data-paco-toast-stack aria-live="assertive"></div>
  </div>`;
}

function message({role="assistant",text="",actions=[],card=null,alert=null,orderRows=[],type="normal",time=Date.now()}={}){return {id:uid(),role,text,actions,card,alert,orderRows,type,time}}
function actionHtml(action){
  return `<button type="button" class="paco2-action ${esc(action.kind||"")}" data-paco-action="${esc(action.action||"")}"${action.value!=null?` data-value="${esc(action.value)}"`:""}${action.module?` data-module="${esc(action.module)}"`:""}${action.orderId?` data-order-id="${esc(action.orderId)}"`:""}${action.prompt?` data-prompt="${esc(action.prompt)}"`:""}>
    <span class="paco2-action-icon">${esc(action.icon||"→")}</span>
    <span class="paco2-action-copy"><b>${esc(action.label||"Continuar")}</b>${action.sub?`<small>${esc(action.sub)}</small>`:""}</span>
    <span class="paco2-action-arrow">›</span>
  </button>`;
}
function orderRowsHtml(rows=[]){
  if(!rows.length)return "";
  return `<div class="paco-op-order-list">${rows.map(row=>`<button type="button" class="paco-op-order-row" data-paco-action="diagnose-order-id" data-order-id="${esc(row.id||row.orderId||"")}">
    <span class="paco-op-order-main"><b>${esc(orderNumber(row))}</b><small>${esc(stepName(row))}</small></span>
    <span class="paco-op-order-meta"><b>${esc(duration(orderAge(row)))}</b><small>${esc(orderAssignee(row)||"Sin responsable")}</small></span>
    <span class="paco-op-order-arrow">›</span>
  </button>`).join("")}</div>`;
}
function messageHtml(item){
  const stamp=timeLabel(item.time||Date.now());
  if(item.role==="user")return `<article class="paco2-message user"><div class="paco2-bubble"><div class="paco2-text">${esc(item.text)}</div><small class="paco-op-message-time">${esc(stamp)}</small></div></article>`;
  if(item.type==="typing")return `<article class="paco2-message assistant"><img class="paco2-mini" src="${ASSETS.thinking}" alt=""><div class="paco2-bubble"><span class="paco2-typing"><i></i><i></i><i></i></span></div></article>`;
  const card=item.card?.length?`<div class="paco2-data-card">${item.card.map(row=>`<div><small>${esc(row[0])}</small><b>${esc(row[1])}</b></div>`).join("")}</div>`:"";
  const alert=item.alert?`<div class="paco2-alert ${esc(item.alert.tone||"")}"><strong>${esc(item.alert.title||"Atención")}</strong><span>${esc(item.alert.text||"")}</span></div>`:"";
  const actions=(item.actions||[]).filter(action=>allowed(action.module));
  return `<article class="paco2-message assistant ${item.type==="proactive"?"paco-op-proactive":""}">
    <img class="paco2-mini" src="${item.type==="success"?ASSETS.success:ASSETS.idle}" alt="">
    <div class="paco-op-message-stack"><span class="paco-op-sender">PACO</span><div class="paco2-bubble"><div class="paco2-text">${esc(item.text)}</div>${card}${alert}${orderRowsHtml(item.orderRows||[])}${actions.length?`<div class="paco2-actions">${actions.map(actionHtml).join("")}</div>`:""}<small class="paco-op-message-time">${esc(stamp)}</small></div></div>
  </article>`;
}
function renderMessages(){
  const box=paco.root?.querySelector("[data-paco-messages]");
  if(!box)return;
  box.innerHTML=paco.messages.map(messageHtml).join("");
  box.scrollTop=box.scrollHeight;
}
function add(item){paco.messages.push(item);if(paco.messages.length>80)paco.messages=paco.messages.slice(-80);renderMessages()}
function typing(){paco.messages=paco.messages.filter(item=>item.type!=="typing");paco.messages.push(message({type:"typing"}));renderMessages();setFace("thinking")}
function replaceTyping(item){paco.messages=paco.messages.filter(row=>row.type!=="typing");if(item)paco.messages.push(item);renderMessages()}
function setBusy(value){paco.busy=Boolean(value);const send=paco.root?.querySelector("[data-paco-send]");if(send)send.disabled=paco.busy}

function setFace(name="idle"){
  paco.face=name;
  const src=ASSETS[name]||ASSETS.idle;
  paco.root?.querySelectorAll("[data-paco-face],.paco2-launcher-face").forEach(img=>{if(img.getAttribute("src")!==src)img.src=src});
}
function isOpen(){return Boolean(paco.root?.classList.contains("is-open"))}
function setOpen(open){
  if(!paco.root)return;
  paco.root.classList.toggle("is-open",Boolean(open));
  paco.root.querySelector("[data-paco-toggle]")?.setAttribute("aria-expanded",String(Boolean(open)));
  if(open){
    ensureWelcome();
    clearBadge();
    setFace("listening");
    setTimeout(()=>paco.root?.querySelector("[data-paco-input]")?.focus(),80);
  }else setFace("idle");
}
function toggleOpen(){setOpen(!isOpen())}

function quickPrompts(){
  const base=["Registrar actividad","Pedidos demorados","Mi jornada","Novedades"];
  if(isManager())base.splice(1,0,"Resumen operativo","Estado del equipo","¿Quién está desocupado?");
  return base;
}
function renderQuick(){
  const row=paco.root?.querySelector("[data-paco-quick]");
  if(row)row.innerHTML=quickPrompts().map(text=>`<button type="button" data-paco-quick="${esc(text)}">${esc(text)}</button>`).join("");
}
function updateContext(){
  paco.root?.querySelector("[data-paco-context]")?.replaceChildren(document.createTextNode(moduleLabel()));
  renderQuick();
}

function ensureWelcome(){
  if(paco.messages.length)return;
  add(message({
    text:`${displayName()?`Hola, ${displayName()}. `:""}Soy PACO. Estoy pendiente de la operación y también puedo ayudarte a trabajar dentro del CRM.`,
    actions:[
      {label:"Registrar actividad",sub:"Te guío desde aquí",icon:"◷",kind:"primary",action:"activity-begin"},
      {label:"Pedidos demorados",sub:"Revisar cola y SLA",icon:"!",action:"delayed"},
      ...(isManager()?[{label:"Equipo disponible",sub:"Auxiliares sin actividad",icon:"◎",action:"idle"}]:[]),
      {label:"Resumen operativo",sub:"Etapas, demoras y responsables",icon:"↗",action:"operation"},
      {label:"Probar voz",sub:"Escuchar PACO en español latino",icon:"🔊",action:"test-voice"}
    ]
  }));
}

function setBadge(count=1){
  const badge=paco.root?.querySelector("[data-paco-badge]");
  if(!badge)return;
  const current=Number(badge.textContent||0);
  const next=Math.min(99,current+count);
  badge.textContent=String(next);
  badge.hidden=false;
  paco.root.classList.add("has-alert");
}
function clearBadge(){
  const badge=paco.root?.querySelector("[data-paco-badge]");
  if(badge){badge.hidden=true;badge.textContent="0"}
  paco.root?.classList.remove("has-alert");
}

function latinVoice(){
  const voices=speechSynthesis?.getVoices?.()||[];
  return voices.find(v=>/^es-CO/i.test(v.lang))
    ||voices.find(v=>/^es-(MX|US|419)/i.test(v.lang))
    ||voices.find(v=>/^es/i.test(v.lang))
    ||null;
}
function updateVoiceButton(){
  const button=paco.root?.querySelector("[data-paco-voice]");
  button?.classList.toggle("is-on",paco.voiceEnabled);
  const icon=button?.querySelector("[data-paco-voice-icon]");
  if(icon)icon.textContent=paco.voiceEnabled?"🔊":"🔇";
  if(button)button.title=paco.voiceEnabled?"Voz activa · clic para silenciar":"Voz silenciada · clic para activar";
}
function speak(text,{force=false}={}){
  if((!paco.voiceEnabled&&!force)||!("speechSynthesis" in window)||!text)return false;
  try{
    speechSynthesis.cancel();
    const utterance=new SpeechSynthesisUtterance(String(text).slice(0,420));
    const voice=latinVoice();
    utterance.lang=voice?.lang||"es-CO";
    if(voice)utterance.voice=voice;
    utterance.rate=.96;utterance.pitch=1;utterance.volume=.95;
    speechSynthesis.speak(utterance);
    return true;
  }catch{return false}
}
function toggleVoice(){
  paco.voiceEnabled=!paco.voiceEnabled;
  saveVoicePreference();
  updateVoiceButton();
  toast(paco.voiceEnabled?"PACO hablará en español latino.":"Voz de PACO silenciada.");
  if(paco.voiceEnabled)speak("Listo. Mi voz está activa y te avisaré sobre la operación.");
}
function testVoice(){
  paco.voiceEnabled=true;
  saveVoicePreference();
  updateVoiceButton();
  const voice=latinVoice();
  const voiceLabel=voice?[voice.name,voice.lang].filter(Boolean).join(" · "):"español latino del dispositivo";
  const ok=speak("Hola. Soy PACO. Esta es una prueba de voz. Te avisaré cuando haya pedidos demorados, personas sin actividad y cambios importantes en la operación.",{force:true});
  add(message({
    type:ok?"success":"normal",
    text:ok?`Prueba de voz enviada. Estoy usando ${voiceLabel}.`:"El navegador no permitió reproducir voz. Revisa el volumen del equipo y vuelve a pulsar Probar voz.",
    actions:[{label:"Resumen ahora",action:"summary-now",icon:"↗"}]
  }));
}

function showProactive({text,title="PACO",tone="warning",actions=[],voice=true,voiceText=null,card=null,orderRows=[]}){
  const item=message({text,actions,card,orderRows,alert:{title,text:"",tone},type:"proactive"});
  add(item);
  if(!isOpen()){
    setBadge(1);
    const stack=paco.root?.querySelector("[data-paco-toast-stack]");
    if(stack){
      const note=document.createElement("button");
      note.type="button";
      note.className=`paco-op-toast ${tone}`;
      note.innerHTML=`<span>⚡</span><div><strong>${esc(title)}</strong><p>${esc(text)}</p></div>`;
      note.onclick=()=>{note.remove();setOpen(true)};
      stack.prepend(note);
      while(stack.children.length>3)stack.lastElementChild?.remove();
      setTimeout(()=>note.remove(),18000);
    }
  }
  if(voice)speak(voiceText||text);
}

function alertAllowed(key){
  const last=paco.alertMemory.get(key)||0;
  if(Date.now()-last<ALERT_COOLDOWN_MS)return false;
  paco.alertMemory.set(key,Date.now());
  return true;
}

async function catalog(){
  if(paco.catalog&&Date.now()-paco.catalogLoadedAt<30*60*1000)return paco.catalog;
  paco.catalog=itemArray(await api.workCatalog());
  paco.catalogLoadedAt=Date.now();
  return paco.catalog;
}
function catalogScore(item,query){
  const q=norm(query);
  if(!q)return 1;
  const fields=[item.name,item.uiCategoryLabel,item.uiSubcategory,item.description,item.code].filter(Boolean).map(norm);
  let score=0;
  for(const field of fields){
    if(field.includes(q))score+=10;
    for(const word of q.split(" "))if(field.split(" ").some(candidate=>fuzzyWord(word,candidate)))score+=2;
  }
  return score;
}
async function activitySuggestions(query=""){
  const rows=await catalog();
  return rows.map(item=>({item,score:catalogScore(item,query)})).filter(x=>query?x.score>0:true).sort((a,b)=>b.score-a.score||Number(a.item.sortOrder||0)-Number(b.item.sortOrder||0)).slice(0,8).map(x=>x.item);
}
function activityActions(rows){
  return rows.map(item=>({
    label:item.name,
    sub:[item.uiCategoryLabel,item.uiSubcategory,item.standardMinutes?`${item.standardMinutes} min`:null].filter(Boolean).join(" · "),
    icon:"◷",action:"activity-select",value:item.id
  }));
}
async function beginActivityFlow(query=""){
  paco.flow={type:"activity",step:"search"};
  if(!query){
    const rows=await catalog();
    const categories=[...new Set(rows.map(x=>x.uiCategoryLabel).filter(Boolean))].slice(0,6);
    return message({
      text:"¿Qué actividad vas a realizar? Puedes escribir el nombre aunque no lo recuerdes exacto, o escoger una categoría.",
      actions:[
        ...categories.map(name=>({label:name,sub:"Ver actividades",icon:"▦",action:"activity-category",value:name})),
        {label:"Escribir actividad",sub:"Ejemplo: alistar pedido",icon:"⌕",action:"focus-input"}
      ]
    });
  }
  const rows=await activitySuggestions(query);
  if(!rows.length)return message({text:`No encontré una actividad parecida a “${query}”. Prueba con menos palabras o dime la categoría.`,actions:[{label:"Ver categorías",icon:"▦",action:"activity-begin"}]});
  return message({text:`Encontré ${rows.length} opción${rows.length===1?"":"es"} que pueden corresponder. ¿Cuál vas a realizar?`,actions:activityActions(rows)});
}
async function categoryActivities(categoryName){
  const rows=(await catalog()).filter(item=>norm(item.uiCategoryLabel)===norm(categoryName)).slice(0,10);
  paco.flow={type:"activity",step:"search"};
  return message({text:`Estas son las actividades de ${categoryName}. Elige una.`,actions:activityActions(rows)});
}
async function selectActivity(catalogId){
  const item=(await catalog()).find(row=>String(row.id)===String(catalogId));
  if(!item)return message({text:"Esa actividad ya no está disponible en el catálogo."});
  paco.flow={type:"activity",step:"confirm",catalogId:item.id,item};
  return message({
    text:`Voy a registrar “${item.name}” como tu actividad actual. ¿La inicio ahora?`,
    card:[["Categoría",item.uiCategoryLabel||"—"],["Subcategoría",item.uiSubcategory||"—"],["Tiempo estándar",item.standardMinutes?`${item.standardMinutes} min`:"Sin tiempo estándar"]],
    actions:[
      {label:"Sí, iniciar ahora",sub:"Empieza el cronómetro",icon:"▶",kind:"primary",action:"activity-start",value:item.id},
      {label:"Elegir otra",sub:"Volver al catálogo",icon:"↩",action:"activity-begin"}
    ]
  });
}
async function startActivity(catalogId){
  const item=(await catalog()).find(row=>String(row.id)===String(catalogId));
  if(!item)throw new Error("La actividad seleccionada ya no está disponible.");
  await api.workStart(item.id,null,{source:"PACO_ASSISTANT",assistantVersion:VERSION});
  paco.flow=null;
  setTimeout(()=>refreshMonitor(true),900);
  speak(`Listo. Inicié ${item.name}.`);
  return message({
    type:"success",
    text:`Listo. Inicié “${item.name}” y ya queda registrada en Mi jornada y en el cronograma.`,
    actions:[{label:"Abrir Mi jornada",sub:"Ver cronómetro y evidencia",icon:"◷",kind:"primary",action:"navigate",module:"workforce"}]
  });
}

function snapshotExecutions(snapshot){return Array.isArray(snapshot?.executions)?snapshot.executions:[]}
function snapshotTeam(snapshot){return Array.isArray(snapshot?.team)?snapshot.team:[]}

function idleAuxiliaries(snapshot){
  if(!isManager())return [];
  return snapshotTeam(snapshot)
    .filter(person=>(person.roles||[]).some(role=>AUX_ROLES.has(role)))
    .filter(person=>!person.activeTitle&&Number(person.idleBusinessSeconds||0)>=IDLE_WARN_SECONDS)
    .map(person=>({...person,idleSeconds:Number(person.idleBusinessSeconds||0)}))
    .sort((a,b)=>b.idleSeconds-a.idleSeconds);
}

function delayedOrders(snapshot){
  return (snapshot.orders||[])
    .filter(row=>activeOrder(row)&&(Boolean(row.slaExceeded||row.sla_exceeded)||orderAge(row)>=ORDER_WARN_SECONDS))
    .sort((a,b)=>(Number(Boolean(b.slaExceeded||b.sla_exceeded))-Number(Boolean(a.slaExceeded||a.sla_exceeded)))||orderAge(b)-orderAge(a));
}

function longActivities(snapshot){
  if(!isManager())return [];
  return snapshotTeam(snapshot)
    .filter(person=>person.activeTitle&&Number(person.activeBusinessSeconds||0)>=LONG_ACTIVITY_SECONDS)
    .map(person=>({...person,activeSeconds:Number(person.activeBusinessSeconds||0)}))
    .sort((a,b)=>b.activeSeconds-a.activeSeconds);
}

function unassignedOrders(snapshot){
  return (snapshot?.orders||[])
    .filter(row=>activeOrder(row)&&!orderAssignee(row))
    .sort((a,b)=>orderAge(b)-orderAge(a));
}
function activeOrdersForDigest(snapshot){
  return (snapshot?.orders||[])
    .filter(activeOrder)
    .slice()
    .sort((a,b)=>{
      const bd=Number(Boolean(b.slaExceeded||b.sla_exceeded)),ad=Number(Boolean(a.slaExceeded||a.sla_exceeded));
      return (bd-ad)||orderAge(b)-orderAge(a);
    });
}
function digestVoiceText(snapshot){
  const active=activeOrdersForDigest(snapshot);
  const delayed=delayedOrders(snapshot);
  const unassigned=unassignedOrders(snapshot);
  const idle=isManager()?idleAuxiliaries(snapshot):[];
  const top=delayed.slice(0,3).map(row=>orderNumber(row)).join(", ");
  return [
    `Resumen de operación. Hay ${active.length} pedidos visibles`,
    `${delayed.length} demorados`,
    `${unassigned.length} sin responsable`,
    isManager()?`${idle.length} auxiliares con más de 20 minutos sin actividad`:"",
    top?`Los más demorados son ${top}`:"No hay pedidos con demora crítica"
  ].filter(Boolean).join(". ")+".";
}
function buildOperationalDigest(snapshot,{automatic=false}={}){
  const active=activeOrdersForDigest(snapshot);
  const delayed=delayedOrders(snapshot);
  const unassigned=unassignedOrders(snapshot);
  const idle=isManager()?idleAuxiliaries(snapshot):[];
  const long=isManager()?longActivities(snapshot):[];
  const stages=stageBreakdown(snapshot);
  const stageText=stages.length?stages.slice(0,6).map(([label,count])=>`${label}: ${count}`).join(" · "):"Sin pedidos activos";
  const rows=active.slice(0,DIGEST_ORDER_LIMIT);
  return message({
    type:automatic?"proactive":"normal",
    text:`${automatic?"Resumen automático":"Resumen operativo"} · ${businessClockLabel()}. Así está la operación en este momento.`,
    alert:automatic?{title:"Parte de operación · cada 30 min",text:"",tone:delayed.length?"warning":"info"}:null,
    card:[
      ["Pedidos visibles",String(active.length)],
      ["Pedidos demorados",String(delayed.length)],
      ["Sin responsable",String(unassigned.length)],
      ...(isManager()?[["Sin actividad >20 min",String(idle.length)],["Actividades >90 min",String(long.length)]]:[]),
      ["Distribución por etapa",stageText]
    ],
    orderRows:rows,
    actions:[
      {label:"Pedidos demorados",sub:delayed.length?`${delayed.length} requieren revisión`:"Sin demoras críticas",action:"delayed",icon:"!"},
      {label:"Sin responsable",sub:unassigned.length?`${unassigned.length} en cola`:"Todos tienen responsable",action:"unassigned",icon:"◎"},
      ...(isManager()?[{label:"Estado del equipo",sub:idle.length?`${idle.length} auxiliares disponibles`:"Sin inactividad >20 min",action:"team",icon:"◷"}]:[]),
      {label:"Abrir todos los pedidos",action:"navigate",module:"orders",icon:"→"}
    ]
  });
}
function digestDue(){
  return isManager()&&(!paco.lastDigestAt||Date.now()-paco.lastDigestAt>=DIGEST_INTERVAL_MS);
}
function deliverDigest(snapshot,{automatic=true,force=false}={}){
  if(!isManager()&&!force)return;
  const digest=buildOperationalDigest(snapshot,{automatic});
  if(automatic){
    paco.lastDigestAt=Date.now();
    saveLastDigest();
    showProactive({
      title:"Resumen de operación · 30 min",
      text:digest.text,
      tone:delayedOrders(snapshot).length?"warning":"info",
      voice:true,
      voiceText:digestVoiceText(snapshot),
      card:digest.card,
      orderRows:digest.orderRows,
      actions:digest.actions
    });
  }else{
    add(digest);
    speak(digestVoiceText(snapshot));
  }
}

async function loadSnapshot(){
  const data=await api.pacoSnapshot();
  return {
    at:Date.now(),
    orders:Array.isArray(data?.orders)?data.orders:[],
    team:Array.isArray(data?.team)?data.team:[],
    executions:Array.isArray(data?.executions)?data.executions:[],
    managerScope:Boolean(data?.managerScope),
    serverTime:data?.serverTime||null
  };
}

function executionMap(snapshot){
  return new Map(snapshotExecutions(snapshot).map(row=>[String(row.id),row]));
}
function orderMap(snapshot){
  return new Map((snapshot?.orders||[]).map(row=>[String(row.id||row.orderId),row]));
}

function monitorTransitions(previous,current){
  if(!previous)return;
  const prevExec=executionMap(previous);
  for(const execution of snapshotExecutions(current)){
    const before=prevExec.get(String(execution.id));
    if(before&&!before.endedAt&&execution.endedAt){
      const mine=String(execution.profileId)===String(profileId());
      const text=`${execution.profileName||"Un auxiliar"} terminó “${execution.title||"una actividad"}” a las ${timeLabel(execution.endedAt)}.`;
      if(mine||isManager())showProactive({title:"Actividad terminada",text,tone:"success",voice:true,actions:[{label:"Ver jornada",action:"navigate",module:"workforce"}]});
    }
  }

  const prevOrders=orderMap(previous);
  for(const row of current.orders){
    const id=String(row.id||row.orderId||"");if(!id)continue;
    const before=prevOrders.get(id);if(!before)continue;
    const oldStep=orderStep(before),newStep=orderStep(row),oldStatus=orderStatus(before),newStatus=orderStatus(row);
    if((oldStep!==newStep||oldStatus!==newStatus)&&SHIPPING_STEPS.has(newStep)){
      showProactive({title:"Movimiento de pedido",text:`${orderNumber(row)} pasó a ${newStep==="CLOSED"?"cerrado":"Despachos y entregas"}.`,tone:"success",voice:true,actions:[{label:"Abrir pedido",action:"open-order",orderId:id,module:"orders"}]});
    }
    const newlyBlocked=!/BLOCK|WAIT|HOLD/.test(oldStatus)&&/BLOCK|WAIT|HOLD/.test(newStatus);
    if(newlyBlocked)showProactive({title:"Novedad operativa",text:`${orderNumber(row)} quedó en estado ${newStatus}. Conviene revisarlo.`,tone:"warning",voice:true,actions:[{label:"Revisar pedido",action:"open-order",orderId:id,module:"orders"}]});
  }
}

function monitorThresholds(snapshot,initial=false){
  const delayed=delayedOrders(snapshot);
  delayed.slice(0,initial?2:5).forEach(row=>{
    const key=`order-delay:${row.id||row.orderId}`;
    if(!alertAllowed(key))return;
    const text=`${orderNumber(row)} lleva ${duration(orderAge(row))} en ${stepName(row)}${orderAssignee(row)?` con ${orderAssignee(row)}`:" sin responsable"}.`;
    showProactive({title:"Pedido demorado",text,tone:"warning",voice:!initial,actions:[{label:"Diagnosticar",action:"diagnose-order-id",orderId:row.id||row.orderId}]});
  });

  if(isManager()){
    idleAuxiliaries(snapshot).slice(0,initial?2:6).forEach(person=>{
      const key=`idle:${person.id}`;
      if(!alertAllowed(key))return;
      showProactive({
        title:"20 min sin actividad",
        text:`${person.name} lleva ${duration(person.idleSeconds)} sin actividad registrada. Está disponible para nueva asignación.`,
        tone:"info",
        voice:!initial,
        actions:[{label:"Ver estado del equipo",action:"team",icon:"◷"},{label:"Abrir Jornada",action:"navigate",module:"workforce"}]
      });
    });

    longActivities(snapshot).slice(0,3).forEach(person=>{
      const key=`long-work:${person.id}`;
      if(!alertAllowed(key))return;
      showProactive({title:"Actividad prolongada",text:`${person.name} lleva ${duration(person.activeSeconds)} en “${person.activeTitle}”.`,tone:"warning",voice:!initial,actions:[{label:"Ver cronograma",action:"navigate",module:"workforce"}]});
    });
  }
}

async function refreshMonitor(force=false){
  if(paco.monitorBusy||!state.profile)return;
  paco.monitorBusy=true;
  const status=paco.root?.querySelector("[data-paco-monitor-status]");
  if(status&&force)status.textContent="Actualizando…";
  try{
    const snapshot=await loadSnapshot();
    const initial=!paco.previous;
    monitorTransitions(paco.previous,snapshot);
    monitorThresholds(snapshot,initial);
    paco.previous=snapshot;
    if(digestDue())deliverDigest(snapshot,{automatic:true});
    if(status)status.textContent=`Actualizado ${timeLabel(new Date())} · resumen cada 30 min`;
  }catch(error){
    if(status)status.textContent="Monitoreo con datos parciales";
    console.warn("[PACO MONITOR]",error);
  }finally{paco.monitorBusy=false}
}
function startMonitor(){
  clearInterval(paco.monitorTimer);
  paco.lastDigestAt=readLastDigest();
  setTimeout(()=>refreshMonitor(false),3500);
  paco.monitorTimer=setInterval(()=>refreshMonitor(false),MONITOR_MS);
}

async function delayedMessage(){
  const snapshot=paco.previous||await loadSnapshot();
  const rows=delayedOrders(snapshot).slice(0,6);
  if(!rows.length)return message({text:"No veo pedidos visibles con demora significativa o SLA excedido en este momento."});
  return message({
    text:`Encontré ${rows.length} pedido${rows.length===1?"":"s"} que necesitan atención.`,
    actions:rows.map(row=>({label:`${orderNumber(row)} · ${duration(orderAge(row))}`,sub:row.stepName||row.currentStepName||orderStep(row)||"En proceso",icon:"!",action:"diagnose-order-id",orderId:row.id||row.orderId}))
  });
}
async function idleMessage(){
  if(!isManager())return message({text:"La disponibilidad del equipo solo se muestra a liderazgo y coordinación autorizados."});
  const snapshot=paco.previous||await loadSnapshot();
  const rows=idleAuxiliaries(snapshot).slice(0,8);
  if(!rows.length)return message({text:"No veo auxiliares de logística o corte con inactividad superior a 20 minutos laborales."});
  return message({text:`Hay ${rows.length} auxiliar${rows.length===1?"":"es"} con tiempo disponible.`,card:rows.map(row=>[row.name,duration(row.idleSeconds)]),actions:[{label:"Abrir cronograma",action:"navigate",module:"workforce",icon:"◷"}]});
}
async function teamActivityMessage(input=""){
  if(!isManager())return myDayMessage();
  const snapshot=paco.previous||await loadSnapshot();
  const rows=snapshotTeam(snapshot);
  if(!rows.length)return message({text:"No veo auxiliares de logística o corte en tu ámbito actual."});
  const query=norm(input).replace(/que|esta|haciendo|quien|trabajando|estado|del|equipo|actividad/g," ").replace(/\s+/g," ").trim();
  const filtered=query?rows.filter(row=>norm(row.name).includes(query)||query.split(" ").some(word=>word.length>2&&norm(row.name).includes(word))):rows;
  if(query&&!filtered.length)return message({text:`No encontré un auxiliar visible que coincida con “${input}”.`,actions:[{label:"Ver equipo",action:"navigate",module:"workforce",icon:"◷"}]});
  return message({
    text:query?"Esto es lo que veo de esa persona.":"Así está el equipo auxiliar en este momento.",
    card:filtered.slice(0,10).map(row=>[
      row.name||"Auxiliar",
      row.activeTitle?`${row.activeTitle} · ${duration(Number(row.activeBusinessSeconds||0))}`:`Disponible · ${duration(Number(row.idleBusinessSeconds||0))}`
    ]),
    actions:[{label:"Abrir cronograma",action:"navigate",module:"workforce",icon:"◷"}]
  });
}
async function unassignedOrdersMessage(){
  const snapshot=paco.previous||await loadSnapshot();
  const rows=unassignedOrders(snapshot).slice(0,8);
  if(!rows.length)return message({text:"No veo pedidos activos visibles sin responsable en este momento."});
  return message({
    text:`Hay ${rows.length} pedido${rows.length===1?"":"s"} activo${rows.length===1?"":"s"} sin responsable visible.`,
    actions:rows.map(row=>({label:`${orderNumber(row)} · ${duration(orderAge(row))}`,sub:row.stepName||row.currentStepName||orderStep(row)||"En cola",icon:"!",action:"diagnose-order-id",orderId:row.id||row.orderId}))
  });
}
async function longWorkMessage(){
  if(!isManager())return message({text:"El seguimiento de actividades prolongadas está disponible para liderazgo y coordinación autorizados."});
  const snapshot=paco.previous||await loadSnapshot();
  const rows=longActivities(snapshot).slice(0,8);
  if(!rows.length)return message({text:"No veo actividades auxiliares que superen 90 minutos laborales en este momento."});
  return message({
    text:`Hay ${rows.length} actividad${rows.length===1?"":"es"} prolongada${rows.length===1?"":"s"} para revisar.`,
    card:rows.map(row=>[row.name||"Auxiliar",`${row.activeTitle||"Actividad"} · ${duration(row.activeSeconds)}`]),
    actions:[{label:"Abrir cronograma",action:"navigate",module:"workforce",icon:"◷"}]
  });
}
function capabilitiesMessage(){
  return message({
    text:"Puedo consultar la operación y ayudarte a ejecutar acciones permitidas por tu sesión: ubicación y etapa de pedidos, demoras, pedidos sin responsable, novedades, despachos, jornada, actividades terminadas, estado del equipo, alertas desde 20 minutos sin actividad, resúmenes automáticos cada 30 minutos y registro guiado de actividades.",
    actions:[
      {label:"Registrar actividad",action:"activity-begin",kind:"primary",icon:"▶"},
      {label:"Resumen operativo",action:"operation",icon:"↗"},
      {label:"Probar voz",action:"test-voice",icon:"🔊"},
      {label:"Pedidos demorados",action:"delayed",icon:"!"}
    ]
  });
}

async function recentWorkMessage(){
  const snapshot=paco.previous||await loadSnapshot();
  const rows=snapshotExecutions(snapshot).filter(x=>x.endedAt).sort((a,b)=>new Date(b.endedAt)-new Date(a.endedAt)).slice(0,8);
  if(!rows.length)return message({text:"No veo actividades finalizadas hoy en tu ámbito visible."});
  return message({text:"Estas son las últimas actividades terminadas que puedo ver.",card:rows.map(row=>[`${row.profileName||"Usuario"} · ${timeLabel(row.endedAt)}`,row.title||"Actividad"])});
}
async function shippedMessage(){
  const data=await api.listOrders({page:1,pageSize:80,includeHistory:true,assignment:isManager()?"ALL":"MINE"}).catch(()=>({items:[]}));
  const rows=itemArray(data).filter(row=>SHIPPING_STEPS.has(orderStep(row))||["CLOSED","DELIVERED","SHIPPED"].includes(orderStatus(row))).slice(0,8);
  if(!rows.length)return message({text:"No encontré despachos recientes visibles para tu sesión."});
  return message({text:"Estos son los pedidos más recientes en despacho, entrega o cierre.",actions:rows.map(row=>({label:orderNumber(row),sub:row.stepName||row.currentStepName||orderStep(row)||orderStatus(row),icon:"→",action:"open-order",orderId:row.id||row.orderId,module:"orders"}))});
}
async function noveltyMessage(){
  try{
    const data=await api.exceptionCenter(null,"OPEN",1,20);
    const rows=itemArray(data);
    if(!rows.length)return message({text:"No veo novedades abiertas en tu ámbito de permisos."});
    return message({text:`Hay ${rows.length} novedad${rows.length===1?"":"es"} abierta${rows.length===1?"":"s"} visibles.`,card:rows.slice(0,8).map(row=>[row.title||row.subtype||row.kind||"Novedad",row.status||row.state||"Abierta"]),actions:[{label:"Abrir Excepciones",action:"navigate",module:"approvals",icon:"!"}]});
  }catch{return message({text:"No tengo permiso para leer el Centro de Excepciones con esta sesión.",actions:[{label:"Abrir módulo disponible",action:"navigate",module:"approvals"}]})}
}
async function myDayMessage(){
  const data=await api.workMyDay();
  if(data?.active){
    const active=data.active;
    return message({text:`Ahora tienes activa “${active.title||active.catalogName||"Actividad"}”.`,card:[["Inicio",timeLabel(active.startedAt||active.started_at)],["Estado",active.status||"En curso"]],actions:[{label:"Abrir Mi jornada",action:"navigate",module:"workforce",icon:"◷"}]});
  }
  return message({text:"No tienes una actividad activa en este momento.",actions:[{label:"Registrar actividad",action:"activity-begin",kind:"primary",icon:"▶"}]});
}
async function operationMessage(){
  const snapshot=paco.previous||await loadSnapshot();
  paco.previous=snapshot;
  return buildOperationalDigest(snapshot,{automatic:false});
}

async function diagnoseOrder(term){
  if(!term)return message({text:"Dime el número del pedido y te digo dónde va, quién lo tiene y qué puede estarlo demorando.",actions:[{label:"Escribir número",action:"focus-input",icon:"⌕"}]});
  const result=await api.listOrders({search:term,page:1,pageSize:8,includeHistory:true,assignment:"ALL"});
  const rows=itemArray(result);
  if(!rows.length)return message({text:`No encontré un pedido visible con “${term}”.`});
  if(rows.length>1)return message({text:"Encontré varias coincidencias. Elige el pedido.",actions:rows.slice(0,6).map(row=>({label:orderNumber(row),sub:row.clientName||row.client_name||"Cliente",action:"diagnose-order-id",orderId:row.id||row.orderId,icon:"⌕"}))});
  return diagnoseOrderById(rows[0].id||rows[0].orderId);
}
async function diagnoseOrderById(id){
  const [detailResult,issuesResult]=await Promise.allSettled([api.getOrder(id),api.orderIssues(id)]);
  const detail=detailResult.status==="fulfilled"?(detailResult.value?.order||detailResult.value||{}):{};
  const issues=issuesResult.status==="fulfilled"?itemArray(issuesResult.value):[];
  const openIssues=issues.filter(row=>!["RESOLVED","CLOSED","CANCELLED"].includes(String(row.status||"").toUpperCase()));
  const step=detail.currentStep||detail.current_step_code||"";
  const moduleId=STEP_MODULE[String(step).toUpperCase()]||"orders";
  const age=Number(detail.ageBusinessSeconds||detail.age_business_seconds||0);
  return message({
    text:`${orderNumber(detail)} está en ${detail.stepName||detail.currentStepName||step||"proceso"} con estado ${detail.status||"activo"}.`,
    card:[["Responsable",detail.assigneeName||detail.assignedToName||"En cola / sin asignar"],["Tiempo en etapa",age?duration(age):"—"],["Novedades abiertas",String(openIssues.length)]],
    alert:age>=ORDER_WARN_SECONDS||detail.slaExceeded||detail.sla_exceeded?{title:"Atención",text:"Este pedido lleva un tiempo considerable en su etapa actual.",tone:"warning"}:null,
    actions:[{label:"Abrir pedido",action:"open-order",orderId:id,module:"orders",icon:"→"},...(moduleId!=="orders"?[{label:`Ir a ${moduleLabel(moduleId)}`,action:"navigate",module:moduleId,icon:"↗"}]:[])]
  });
}

async function resolveQuery(input){
  const text=norm(input);
  if(!text)return message({text:"Dime qué necesitas. Puedo revisar pedidos, jornada, novedades o registrar una actividad."});

  if(paco.flow?.type==="activity"){
    if(matchesAny(text,["cancelar","salir","olvidalo","olvídalo"])){
      paco.flow=null;
      return message({text:"Listo. Cancelé el registro guiado de actividad."});
    }
    if(paco.flow.step==="confirm"){
      if(matchesAny(text,["si","sí","dale","iniciar","empieza","comenzar"]))return startActivity(paco.flow.catalogId);
      if(matchesAny(text,["no","otra","cambiar","elegir otra"]))return beginActivityFlow();
    }
    if(paco.flow.step==="search")return beginActivityFlow(input);
  }

  if(matchesAny(text,["hola","buenas","paco","ayuda"]))return message({text:"Aquí estoy. Estoy pendiente del CRM y también puedo ayudarte a ejecutar tareas.",actions:[{label:"Registrar actividad",action:"activity-begin",kind:"primary",icon:"▶"},{label:"Estado operativo",action:"operation",icon:"↗"}]});
  if(matchesAny(text,INTENTS.activity)){
    const cleaned=text.replace(/registrar|registar|crear|iniciar|anotar|hacer|actividad|actvidad|nueva/g," ").replace(/\s+/g," ").trim();
    return beginActivityFlow(cleaned);
  }
  if(matchesAny(text,INTENTS.capabilities))return capabilitiesMessage();
  if(matchesAny(text,INTENTS.delayed))return delayedMessage();
  if(matchesAny(text,INTENTS.unassigned))return unassignedOrdersMessage();
  if(matchesAny(text,INTENTS.idle))return idleMessage();
  if(matchesAny(text,INTENTS.longWork))return longWorkMessage();
  if(matchesAny(text,INTENTS.team))return teamActivityMessage(input);
  if(matchesAny(text,INTENTS.recentWork))return recentWorkMessage();
  if(matchesAny(text,INTENTS.shipped))return shippedMessage();
  if(matchesAny(text,INTENTS.novelties))return noveltyMessage();
  if(matchesAny(text,INTENTS.operation))return operationMessage();
  if(matchesAny(text,INTENTS.myDay))return myDayMessage();

  const term=orderTerm(input);
  if(term||matchesAny(text,INTENTS.order))return diagnoseOrder(term);

  const moduleHit=Object.entries(MODULES).find(([id,label])=>norm(label).split(" ").some(word=>word.length>4&&text.includes(word))&&allowed(id));
  if(moduleHit)return message({text:`Puedo llevarte a ${moduleHit[1]} y seguir ayudándote desde allí.`,actions:[{label:`Abrir ${moduleHit[1]}`,action:"navigate",module:moduleHit[0],kind:"primary",icon:"→"}]});

  return message({text:"No encontré una acción exacta, pero puedo entender frases aproximadas. Prueba con “registrar actividad”, “en qué parte va el pedido 12345”, “qué está demorado” o “quién está desocupado”.",actions:[{label:"Registrar actividad",action:"activity-begin",icon:"▶"},{label:"Estado operativo",action:"operation",icon:"↗"}]});
}

async function submit(input){
  const text=String(input||"").trim();
  if(!text||paco.busy)return;
  add(message({role:"user",text}));
  setBusy(true);typing();
  try{
    const answer=await resolveQuery(text);
    replaceTyping(answer);
    setFace(answer?.type==="success"?"success":"talking");
    setTimeout(()=>isOpen()&&setFace("listening"),700);
  }catch(error){
    console.error("[PACO V11.37]",error);
    replaceTyping(message({text:"No pude completar esa consulta con los datos o permisos actuales.",alert:{title:"Detalle",text:error.message||"Error inesperado",tone:"warning"}}));
    setFace("idle");
  }finally{setBusy(false)}
}

async function handleAction(button){
  const action=button.dataset.pacoAction,value=button.dataset.value;
  if(action==="navigate"){if(allowed(button.dataset.module)){navigate(button.dataset.module);setOpen(false)}return}
  if(action==="open-order"){window.dispatchEvent(new CustomEvent("erp:open-order",{detail:button.dataset.orderId}));setOpen(false);return}
  if(action==="focus-input"){const input=paco.root?.querySelector("[data-paco-input]");input?.focus();return}
  if(action==="test-voice"){testVoice();return}
  if(action==="summary-now"){
    const snapshot=await loadSnapshot();
    paco.previous=snapshot;
    deliverDigest(snapshot,{automatic:false,force:true});
    return;
  }
  if(action==="activity-begin"){add(await beginActivityFlow());return}
  if(action==="activity-category"){add(await categoryActivities(value));return}
  if(action==="activity-select"){add(await selectActivity(value));return}
  if(action==="activity-start"){setBusy(true);typing();try{replaceTyping(await startActivity(value))}catch(error){replaceTyping(message({text:"No pude iniciar esa actividad.",alert:{title:"Actividad",text:error.message||"Error",tone:"warning"}}))}finally{setBusy(false)}return}
  if(action==="delayed"){add(await delayedMessage());return}
  if(action==="unassigned"){add(await unassignedOrdersMessage());return}
  if(action==="idle"){add(await idleMessage());return}
  if(action==="team"){add(await teamActivityMessage());return}
  if(action==="long-work"){add(await longWorkMessage());return}
  if(action==="recent-work"){add(await recentWorkMessage());return}
  if(action==="shipped"){add(await shippedMessage());return}
  if(action==="novelties"){add(await noveltyMessage());return}
  if(action==="capabilities"){add(capabilitiesMessage());return}
  if(action==="operation"){add(await operationMessage());return}
  if(action==="diagnose-order-id"){setBusy(true);typing();try{replaceTyping(await diagnoseOrderById(button.dataset.orderId))}catch(error){replaceTyping(message({text:error.message}))}finally{setBusy(false)}return}
}

function bindRoot(){
  const root=paco.root;if(!root||root.dataset.pacoBound==="1")return;
  root.dataset.pacoBound="1";
  root.querySelector("[data-paco-toggle]")?.addEventListener("click",toggleOpen);
  root.querySelector("[data-paco-close]")?.addEventListener("click",()=>setOpen(false));
  root.querySelector("[data-paco-voice]")?.addEventListener("click",toggleVoice);
  root.querySelector("[data-paco-test-voice]")?.addEventListener("click",testVoice);
  root.querySelector("[data-paco-summary-now]")?.addEventListener("click",async()=>{
    const snapshot=await loadSnapshot();
    paco.previous=snapshot;
    deliverDigest(snapshot,{automatic:false,force:true});
  });
  root.querySelector("[data-paco-form]")?.addEventListener("submit",event=>{event.preventDefault();const input=root.querySelector("[data-paco-input]");const value=input.value;input.value="";submit(value)});
  root.querySelector("[data-paco-input]")?.addEventListener("keydown",event=>{if(event.key==="Enter"&&!event.shiftKey){event.preventDefault();root.querySelector("[data-paco-form]")?.requestSubmit()}});
  root.addEventListener("click",event=>{
    const action=event.target.closest?.("[data-paco-action]");if(action){handleAction(action);return}
    const quick=event.target.closest?.("[data-paco-quick]");if(quick)submit(quick.dataset.pacoQuick);
  });
}

function bindGlobal(){
  if(paco.globalBound)return;paco.globalBound=true;
  document.addEventListener("click",event=>{if(event.target.closest?.(".nav-item"))setTimeout(updateContext,40)});
  window.addEventListener("erp:work-changed",()=>setTimeout(()=>refreshMonitor(true),1200));
  window.addEventListener("erp:refresh",()=>setTimeout(()=>refreshMonitor(true),600));
  window.addEventListener("paco:open",event=>{if(!state.profile)return;setOpen(true);const prompt=event.detail?.prompt;if(prompt){const input=paco.root?.querySelector("[data-paco-input]");if(input){input.value=prompt;input.focus()}}});
  window.addEventListener("paco:close",()=>setOpen(false));
}

function syncProfile(next=state){
  if(!paco.root)return;
  const active=Boolean(next.profile);
  paco.root.hidden=!active;
  if(active){
    updateContext();
    updateVoiceButton();
    paco.lastDigestAt=readLastDigest();
    startMonitor();
  }else{
    clearInterval(paco.monitorTimer);paco.monitorTimer=null;paco.previous=null;paco.messages=[];paco.flow=null;paco.lastDigestAt=0;renderMessages();setOpen(false);
  }
}

export function installPacoAssistant(){
  ensureStyles();
  const legacy=document.querySelector("#paco-bot");
  if(legacy)legacy.remove();
  const template=document.createElement("template");
  template.innerHTML=renderRoot().trim();
  const root=template.content.firstElementChild;
  document.body.append(root);
  paco.root=root;
  bindRoot();bindGlobal();renderQuick();syncProfile();
  if(!paco.unsubscribe)paco.unsubscribe=subscribe(syncProfile);
  Object.values(ASSETS).forEach(src=>{const image=new Image();image.decoding="async";image.src=src});
  return root;
}
