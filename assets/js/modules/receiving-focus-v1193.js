import {icon} from "../core/icons.js";

let observer=null;
let scheduled=false;

const STAGE_COPY={
  TAKE:{title:"Antes de empezar",text:"Revisa el contexto del pedido. Al tomarlo quedará asignado a tu usuario y podrás avanzar paso a paso.",icon:"play"},
  REVIEW:{title:"Revisa y decide",text:"Si la información coincide, continúa. Si no, revisa el PDF.",icon:"check"},
  PDF:{title:"Selecciona el PDF",text:"El CRM detectará las líneas automáticamente.",icon:"imports"},
  EDIT:{title:"Corrige solo lo necesario",text:"Ajusta únicamente las líneas que no coincidan y confirma.",icon:"picking"},
  ASSIGN:{title:"Asigna y finaliza",text:"Elige quién continúa con el pedido y confirma la recepción.",icon:"admin"},
  STATUS:{title:"Estado de la recepción",text:"Consulta quién tiene el pedido y su estado actual.",icon:"receiving"}
};

function stageOf(modal){
  if(modal.querySelector("[data-take-order]"))return "TAKE";
  if(modal.querySelector("[data-picking-profile]"))return "ASSIGN";
  if(modal.querySelector("[data-lines-editor]"))return "EDIT";
  if(modal.querySelector("[data-source-pdf],[data-read-drive-pdf],[data-local-pdf]"))return "PDF";
  if(modal.querySelector("[data-info-correct],[data-info-assign]"))return "REVIEW";
  return "STATUS";
}

function schedule(){
  if(scheduled)return;
  scheduled=true;
  requestAnimationFrame(()=>{
    scheduled=false;
    enhanceAll();
  });
}

function enhanceAll(){
  document.querySelectorAll("#modal-root .reception-process-modal").forEach(enhanceModal);
}

function enhanceModal(modal){
  const stage=stageOf(modal);
  modal.classList.add("receiving-focus-v1193");
  modal.dataset.receivingFocusStage=stage;
  simplifyHeader(modal);
  simplifyProgress(modal);
  if(stage==="TAKE")enhanceTake(modal);
  else enhanceWorkingStage(modal,stage);
  simplifyStageCopy(modal,stage);
  enhancePrimaryActions(modal,stage);
}

function simplifyHeader(modal){
  const kicker=modal.querySelector(".reception-process-head .wizard-kicker");
  if(kicker)kicker.textContent="RECEPCIÓN DE PEDIDOS";
  const paragraph=modal.querySelector(".reception-process-head p");
  if(paragraph)paragraph.classList.add("reception-header-context-v1193");
}

function simplifyProgress(modal){
  const progress=modal.querySelector(".reception-progress");
  if(!progress||progress.dataset.v1193)return;
  progress.dataset.v1193="1";
  progress.classList.add("reception-stepper-v1193");
  const labels=["Tomar","Revisar","Corregir","Asignar"];
  [...progress.children].forEach((item,index)=>{
    const label=item.querySelector("small");
    if(label)label.textContent=labels[index]||label.textContent;
  });
}

function summaryValues(modal){
  const values={};
  modal.querySelectorAll(".reception-order-strip>div").forEach(item=>{
    const key=(item.querySelector("small")?.textContent||"").trim();
    const value=(item.querySelector("strong")?.textContent||"").trim();
    if(key)values[key]=value;
  });
  return values;
}

function enhanceTake(modal){
  modal.querySelector(".reception-now-v1192")?.classList.add("reception-hide-v1193");
  const strip=modal.querySelector(".reception-order-strip");
  if(strip)strip.classList.add("reception-hide-v1193");
  if(modal.querySelector(".reception-take-focus-v1193"))return;

  const headTitle=(modal.querySelector(".reception-process-head h3")?.textContent||"Pedido").trim();
  const headContext=(modal.querySelector(".reception-process-head p")?.textContent||"").trim();
  const values=summaryValues(modal);
  const takeCard=modal.querySelector(".reception-take-card");
  if(!takeCard)return;

  const focus=document.createElement("section");
  focus.className="reception-take-focus-v1193";
  focus.innerHTML=`
    <div class="reception-take-main-v1193">
      <span class="reception-take-icon-v1193" aria-hidden="true">${icon("receiving")}</span>
      <div class="reception-take-copy-v1193">
        <small>PEDIDO A RECIBIR</small>
        <h4>${escapeHtml(headTitle)}</h4>
        <p>${escapeHtml(headContext)}</p>
      </div>
      <div class="reception-take-facts-v1193">
        ${fact("Pago",values["Pago"]||"—")}
        ${fact("Entrega",values["Entrega"]||"—")}
        ${fact("Responsable",values["Responsable actual"]||"—")}
        ${fact("Soportes",values["Archivos del asesor"]||"0")}
      </div>
    </div>
    <aside class="reception-take-route-v1193">
      <small>LO QUE HARÁS</small>
      <ol>
        <li><span>1</span><div><strong>Revisar</strong><p>Confirma que la información coincida.</p></div></li>
        <li><span>2</span><div><strong>Corregir si hace falta</strong><p>Usa el PDF solo cuando sea necesario.</p></div></li>
        <li><span>3</span><div><strong>Asignar</strong><p>Envía el pedido al siguiente responsable.</p></div></li>
      </ol>
    </aside>`;
  takeCard.before(focus);

  const title=takeCard.querySelector("h4");
  const text=takeCard.querySelector("p");
  if(title)title.textContent="¿Listo para iniciar?";
  if(text)text.textContent="Al tomar el pedido quedará reservado para tu gestión.";
}

function fact(label,value){
  return `<span><small>${escapeHtml(label)}</small><strong>${escapeHtml(value)}</strong></span>`;
}

function enhanceWorkingStage(modal,stage){
  const now=modal.querySelector(".reception-now-v1192");
  if(now)now.classList.add("reception-hide-v1193");
  moveSummaryToDisclosure(modal);
  reduceReviewSummary(modal,stage);
}

function moveSummaryToDisclosure(modal){
  const strip=modal.querySelector(".reception-order-strip");
  if(!strip||strip.closest(".reception-summary-disclosure-v1193"))return;
  const details=document.createElement("details");
  details.className="reception-summary-disclosure-v1193";
  details.innerHTML=`<summary><span aria-hidden="true">${icon("orders")}</span><div><strong>Ver resumen del pedido</strong><small>Pago, entrega, responsable y soportes</small></div><b>+</b></summary>`;
  strip.before(details);
  details.append(strip);
  strip.classList.remove("reception-hide-v1193");
  details.addEventListener("toggle",()=>{
    const marker=details.querySelector("summary>b");
    if(marker)marker.textContent=details.open?"−":"+";
  });
}

function reduceReviewSummary(modal,stage){
  if(stage!=="REVIEW")return;
  const advisor=modal.querySelector(".reception-advisor-grid");
  if(!advisor)return;
  [...advisor.children].forEach(article=>{
    const label=(article.querySelector("small")?.textContent||"").trim();
    const value=(article.querySelector("strong")?.textContent||"").trim();
    if(label==="Cliente")article.hidden=true;
    if(label==="Referencia externa"&&(!value||value==="—"))article.hidden=true;
  });
}

function simplifyStageCopy(modal,stage){
  if(stage==="TAKE")return;
  const copy=STAGE_COPY[stage]||STAGE_COPY.STATUS;
  const heading=modal.querySelector(".reception-stage-card .reception-stage-heading h4");
  const paragraph=modal.querySelector(".reception-stage-card .reception-stage-heading p");
  if(heading)heading.textContent=copy.title;
  if(paragraph)paragraph.textContent=copy.text;
  const stepTag=modal.querySelector(".reception-stage-card .reception-step-tag");
  if(stepTag){
    const labels={REVIEW:"Paso 2",PDF:"Paso 2",EDIT:"Paso 3",ASSIGN:"Paso 4",STATUS:"Estado"};
    stepTag.textContent=labels[stage]||stepTag.textContent;
  }
}

function enhancePrimaryActions(modal,stage){
  const actions=[];
  if(stage==="TAKE")actions.push([modal.querySelector("[data-take-order]"),"play"]);
  if(stage==="PDF")actions.push([modal.querySelector("[data-read-drive-pdf]"),"imports"]);
  if(stage==="EDIT")actions.push([modal.querySelector("[data-confirm-lines]"),"check"]);
  if(stage==="ASSIGN")actions.push([modal.querySelector("[data-confirm-reception]"),"check"]);
  actions.forEach(([button,iconName])=>decorateButton(button,iconName));

  if(stage==="ASSIGN"){
    const button=modal.querySelector("[data-confirm-reception]");
    if(button){
      const span=button.querySelector("span[data-button-label-v1193]");
      if(span)span.textContent="Confirmar y enviar a alistamiento";
    }
  }
}

function decorateButton(button,iconName){
  if(!button||button.dataset.v1193)return;
  button.dataset.v1193="1";
  const label=button.textContent.trim();
  button.classList.add("reception-primary-v1193");
  button.innerHTML=`<span class="reception-button-icon-v1193" aria-hidden="true">${icon(iconName)}</span><span data-button-label-v1193>${escapeHtml(label)}</span>`;
}

function escapeHtml(value=""){
  return String(value).replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));
}

function install(){
  enhanceAll();
  observer=new MutationObserver(schedule);
  observer.observe(document.body,{childList:true,subtree:true});
}

if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",install,{once:true});else install();
