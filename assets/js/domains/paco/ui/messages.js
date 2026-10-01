import { ASSETS } from "../paco-config.js";
import { paco } from "../paco-state.js";
import { esc, allowed, uid, timeLabel, duration } from "../context/profile-context.js";
import { orderNumber, orderAge, orderAssignee, stepName } from "../context/order-context.js";

export function message({role="assistant",text="",actions=[],card=null,alert=null,orderRows=[],type="normal",time=Date.now()}={}){return {id:uid(),role,text,actions,card,alert,orderRows,type,time}}

export function actionHtml(action){
  return `<button type="button" class="paco2-action ${esc(action.kind||"")}" data-paco-action="${esc(action.action||"")}"${action.value!=null?` data-value="${esc(action.value)}"`:""}${action.module?` data-module="${esc(action.module)}"`:""}${action.orderId?` data-order-id="${esc(action.orderId)}"`:""}${action.prompt?` data-prompt="${esc(action.prompt)}"`:""}>
    <span class="paco2-action-icon">${esc(action.icon||"→")}</span>
    <span class="paco2-action-copy"><b>${esc(action.label||"Continuar")}</b>${action.sub?`<small>${esc(action.sub)}</small>`:""}</span>
    <span class="paco2-action-arrow">›</span>
  </button>`;
}

export function orderRowsHtml(rows=[]){
  if(!rows.length)return "";
  return `<div class="paco-op-order-list">${rows.map(row=>`<button type="button" class="paco-op-order-row" data-paco-action="diagnose-order-id" data-order-id="${esc(row.id||row.orderId||"")}">
    <span class="paco-op-order-main"><b>${esc(orderNumber(row))}</b><small>${esc(stepName(row))}</small></span>
    <span class="paco-op-order-meta"><b>${esc(duration(orderAge(row)))}</b><small>${esc(orderAssignee(row)||"Sin responsable")}</small></span>
    <span class="paco-op-order-arrow">›</span>
  </button>`).join("")}</div>`;
}

export function messageHtml(item){
  const stamp=timeLabel(item.time||Date.now());
  if(item.role==="user")return `<article class="paco2-message user"><div class="paco2-bubble"><div class="paco2-text">${esc(item.text)}</div><small class="paco-op-message-time">${esc(stamp)}</small></div></article>`;
  if(item.type==="typing")return `<article class="paco2-message assistant"><img class="paco2-mini" src="${ASSETS.thinking}" alt=""><div class="paco2-bubble"><span class="paco2-typing"><i></i><i></i><i></i></span></div></article>`;
  const card=item.card?.length?`<div class="paco2-data-card">${item.card.map(row=>`<div><small>${esc(row[0])}</small><b>${esc(row[1])}</b></div>`).join("")}</div>`:"";
  const alert=item.alert?`<div class="paco2-alert ${esc(item.alert.tone||"")}"><strong>${esc(item.alert.title||"Atención")}</strong><span>${esc(item.alert.text||"")}</span></div>`:"";
  let actions=(item.actions||[]).filter(action=>allowed(action.module));
  const isChoice=item.type!=="proactive"&&(actions.length>1||Boolean(paco.flow));
  if(isChoice){
    if(!actions.some(action=>action.action==="cancel-flow"))actions=[...actions,{label:"Cancelar consulta",sub:"Corregir o salir de esta consulta",icon:"×",action:"cancel-flow"}];
    if(!actions.some(action=>action.action==="restart"))actions=[...actions,{label:"Reiniciar PACO",sub:"Volver al inicio",icon:"↻",action:"restart"}];
  }
  return `<article class="paco2-message assistant ${item.type==="proactive"?"paco-op-proactive":""}">
    <img class="paco2-mini" src="${item.type==="success"?ASSETS.success:ASSETS.idle}" alt="">
    <div class="paco-op-message-stack"><span class="paco-op-sender">PACO</span><div class="paco2-bubble"><div class="paco2-text">${esc(item.text)}</div>${card}${alert}${orderRowsHtml(item.orderRows||[])}${actions.length?`<div class="paco2-actions">${actions.map(actionHtml).join("")}</div>`:""}<small class="paco-op-message-time">${esc(stamp)}</small></div></div>
  </article>`;
}

export function renderMessages(){
  const box=paco.root?.querySelector("[data-paco-messages]");
  if(!box)return;
  box.innerHTML=paco.messages.map(messageHtml).join("");
  box.scrollTop=box.scrollHeight;
}

export function add(item){paco.messages.push(item);if(paco.messages.length>80)paco.messages=paco.messages.slice(-80);renderMessages()}

export function typing(){paco.messages=paco.messages.filter(item=>item.type!=="typing");paco.messages.push(message({type:"typing"}));renderMessages();setFace("thinking")}

export function replaceTyping(item){paco.messages=paco.messages.filter(row=>row.type!=="typing");if(item)paco.messages.push(item);renderMessages()}

export function setBusy(value){paco.busy=Boolean(value);const send=paco.root?.querySelector("[data-paco-send]");if(send)send.disabled=paco.busy}

export function setFace(name="idle"){
  paco.face=name;
  const src=ASSETS[name]||ASSETS.idle;
  paco.root?.querySelectorAll("[data-paco-face],.paco2-launcher-face").forEach(img=>{if(img.getAttribute("src")!==src)img.src=src});
}
