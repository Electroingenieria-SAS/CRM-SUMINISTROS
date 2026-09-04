import {icon} from "../core/icons.js";

let observer=null;
let scheduled=false;

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

function stageOf(modal){
  if(modal.querySelector("[data-take-order]"))return "TAKE";
  if(modal.querySelector("[data-picking-profile]"))return "ASSIGN";
  if(modal.querySelector("[data-lines-editor]"))return "EDIT";
  if(modal.querySelector("[data-source-pdf],[data-read-drive-pdf],[data-local-pdf]"))return "PDF";
  if(modal.querySelector("[data-info-correct],[data-info-assign]"))return "REVIEW";
  return "STATUS";
}

const STAGES={
  TAKE:{label:"1 · Tomar pedido",title:"Empieza la recepción",text:"Toma el pedido para trabajar con él. El CRM lo bloqueará para evitar que otra persona lo modifique al mismo tiempo.",icon:"play"},
  REVIEW:{label:"2 · Revisar",title:"Verifica la información",text:"Mira solo lo necesario. Si todo coincide, continúa. Si necesitas corregir materiales, utiliza el PDF.",icon:"check"},
  PDF:{label:"2 · Corregir con PDF",title:"Selecciona el documento",text:"Elige el PDF y deja que el CRM detecte las líneas. Después podrás corregir únicamente lo necesario.",icon:"imports"},
  EDIT:{label:"3 · Validar líneas",title:"Revisa lo detectado",text:"Corrige referencias, cantidades o cortes únicamente cuando sea necesario. No vuelvas a escribir lo que ya está correcto.",icon:"picking"},
  ASSIGN:{label:"4 · Asignar",title:"Elige quién continúa",text:"Selecciona el auxiliar de alistamiento y, solo si existen cortes, el auxiliar de corte. Después confirma la recepción.",icon:"admin"},
  STATUS:{label:"Recepción de pedidos",title:"Estado de la recepción",text:"Consulta el estado actual del pedido y la persona responsable.",icon:"receiving"}
};

function enhanceModal(modal){
  modal.classList.add("receiving-guided-v1192");
  const stage=stageOf(modal);
  modal.dataset.receivingStage=stage;
  simplifyHeader(modal);
  installNowCard(modal,stage);
  simplifySummary(modal);
  if(stage==="REVIEW")enhanceReview(modal);
  if(stage==="PDF")enhancePdf(modal);
  if(stage==="EDIT")enhanceEdit(modal);
  if(stage==="ASSIGN")enhanceAssign(modal);
  if(stage==="TAKE")enhanceTake(modal);
  enhanceButtons(modal);
}

function simplifyHeader(modal){
  const kicker=modal.querySelector(".reception-process-head .wizard-kicker");
  if(kicker)kicker.textContent="RECEPCIÓN DE PEDIDOS";
}

function installNowCard(modal,stage){
  const definition=STAGES[stage]||STAGES.STATUS;
  let card=modal.querySelector(".reception-now-v1192");
  if(!card){
    card=document.createElement("section");
    card.className="reception-now-v1192";
    const progress=modal.querySelector(".reception-progress");
    const strip=modal.querySelector(".reception-order-strip");
    if(progress)progress.after(card);else if(strip)strip.after(card);else modal.querySelector(".reception-process-body")?.prepend(card);
  }
  card.innerHTML=`<span class="reception-now-icon-v1192" aria-hidden="true">${icon(definition.icon)}</span><div><small>${definition.label}</small><strong>${definition.title}</strong><p>${definition.text}</p></div>`;
}

function simplifySummary(modal){
  const strip=modal.querySelector(".reception-order-strip");
  if(!strip)return;
  strip.classList.add("reception-summary-v1192");
  [...strip.children].forEach(item=>{
    const label=item.querySelector("small")?.textContent?.trim()||"";
    item.dataset.summaryKey=label.toLowerCase().replace(/\s+/g,"-");
  });
}

function enhanceReview(modal){
  const stage=modal.querySelector(".reception-stage-card");
  if(!stage)return;
  const heading=stage.querySelector(".reception-stage-heading h4");
  const paragraph=stage.querySelector(".reception-stage-heading p");
  if(heading)heading.textContent="¿La información del pedido está correcta?";
  if(paragraph)paragraph.textContent="Revisa el resumen y elige una de las dos opciones. Los soportes y materiales están disponibles si necesitas consultarlos.";

  const advisor=stage.querySelector(".reception-advisor-grid");
  if(advisor){
    advisor.classList.add("reception-advisor-summary-v1192");
    [...advisor.children].forEach(article=>{
      const label=article.querySelector("small")?.textContent?.trim();
      const value=article.querySelector("strong")?.textContent?.trim();
      if(label==="Referencia externa"&&(!value||value==="—"))article.hidden=true;
    });
  }

  wrapDetails(stage.querySelector(".reception-files"),"Soportes del asesor","Abrir archivos", "imports");
  wrapDetails(stage.querySelector(".reception-current-lines"),"Materiales del pedido","Ver materiales", "inventory");

  const correct=stage.querySelector("[data-info-correct]");
  if(correct){
    correct.classList.add("reception-choice-v1192","success");
    const figure=correct.querySelector("span");
    if(figure)figure.innerHTML=icon("check");
    const title=correct.querySelector("strong");
    const text=correct.querySelector("small");
    if(title)title.textContent="Todo está correcto";
    if(text)text.textContent="Continuar sin modificar materiales.";
  }
  const pdf=stage.querySelector("[data-info-assign]");
  if(pdf){
    pdf.classList.add("reception-choice-v1192","secondary");
    const figure=pdf.querySelector("span");
    if(figure)figure.innerHTML=icon("imports");
    const title=pdf.querySelector("strong");
    const text=pdf.querySelector("small");
    if(title)title.textContent="Revisar con PDF";
    if(text)text.textContent="Leer el documento y corregir solo lo necesario.";
  }
}

function wrapDetails(node,title,action,iconName){
  if(!node||node.closest(".reception-disclosure-v1192"))return;
  const details=document.createElement("details");
  details.className="reception-disclosure-v1192";
  const summary=document.createElement("summary");
  summary.innerHTML=`<span aria-hidden="true">${icon(iconName)}</span><div><strong>${title}</strong><small>${action}</small></div><b>+</b>`;
  node.before(details);
  details.append(summary,node);
  details.addEventListener("toggle",()=>{summary.querySelector("b").textContent=details.open?"−":"+"});
}

function enhancePdf(modal){
  const stage=modal.querySelector(".reception-stage-card");
  if(!stage)return;
  const heading=stage.querySelector(".reception-stage-heading h4");
  const paragraph=stage.querySelector(".reception-stage-heading p");
  if(heading)heading.textContent="Selecciona el PDF del pedido";
  if(paragraph)paragraph.textContent="El CRM leerá el documento y preparará las líneas para revisión.";
  stage.querySelector("[data-read-drive-pdf]")?.classList.add("reception-main-action-v1192");
  const picker=stage.querySelector(".reception-file-picker");
  if(picker){
    picker.classList.add("reception-alt-action-v1192");
    const text=[...picker.childNodes].find(node=>node.nodeType===Node.TEXT_NODE);
    if(text)text.textContent="Usar otro PDF";
  }
}

function enhanceEdit(modal){
  const stage=modal.querySelector(".reception-stage-card");
  if(!stage)return;
  const heading=stage.querySelector(".reception-stage-heading h4");
  const paragraph=stage.querySelector(".reception-stage-heading p");
  if(heading)heading.textContent="Confirma las líneas del pedido";
  if(paragraph)paragraph.textContent="Corrige únicamente las líneas que lo necesiten y continúa.";
  stage.querySelector("[data-confirm-lines]")?.classList.add("reception-main-action-v1192");
}

function enhanceAssign(modal){
  const stage=modal.querySelector(".reception-stage-card");
  if(!stage)return;
  const heading=stage.querySelector(".reception-stage-heading h4");
  const paragraph=stage.querySelector(".reception-stage-heading p");
  if(heading)heading.textContent="Asigna el siguiente responsable";
  if(paragraph)paragraph.textContent="Elige quién realizará el alistamiento. El auxiliar de corte solo aparece cuando realmente se necesita.";
  const noCut=stage.querySelector(".reception-no-cut > span");
  if(noCut)noCut.innerHTML=icon("check");
  stage.querySelector("[data-confirm-reception]")?.classList.add("reception-main-action-v1192");
}

function enhanceTake(modal){
  const card=modal.querySelector(".reception-take-card");
  if(!card)return;
  card.classList.add("reception-take-v1192");
  const button=card.querySelector("[data-take-order]");
  if(button)button.classList.add("reception-main-action-v1192");
}

function enhanceButtons(modal){
  modal.querySelectorAll(".reception-stage-heading .btn-ghost").forEach(button=>button.classList.add("reception-back-v1192"));
}

function install(){
  enhanceAll();
  observer=new MutationObserver(schedule);
  observer.observe(document.body,{childList:true,subtree:true});
}

if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",install,{once:true});else install();
