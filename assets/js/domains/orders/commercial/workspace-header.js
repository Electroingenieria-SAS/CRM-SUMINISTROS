import { icon } from "../../../core/icons.js";

export function upgradePageHead(root,{kicker,title,description,primarySource,primaryLabel,primaryIcon}){
  const head=root.querySelector(".page-head");
  if(!head||head.dataset.commercialHead)return;
  head.dataset.commercialHead="1";
  head.classList.add("commercial-page-head");
  const copy=head.firstElementChild;
  if(copy){
    const oldTitle=copy.querySelector("h2");
    const oldDescription=copy.querySelector("p");
    if(!copy.querySelector(".commercial-kicker")){
      const span=document.createElement("span");
      span.className="commercial-kicker";
      span.textContent=kicker;
      copy.insertBefore(span,oldTitle||copy.firstChild);
    }
    if(oldTitle)oldTitle.textContent=title;
    if(oldDescription)oldDescription.textContent=description;
  }
  const source=root.querySelector(primarySource);
  const actions=head.querySelector(".page-actions")||head.appendChild(document.createElement("div"));
  actions.classList.add("page-actions","commercial-page-actions");
  if(source&&!actions.querySelector("[data-commercial-primary]")){
    const button=document.createElement("button");
    button.type="button";
    button.className="btn btn-create commercial-primary-action";
    button.dataset.commercialPrimary="1";
    button.innerHTML=`${icon(primaryIcon)}<span>${primaryLabel}</span>`;
    button.addEventListener("click",()=>source.click());
    actions.prepend(button);
  }
}

export function upgradeActionIcon(root,selector,iconName,label){
  const card=root.querySelector(selector);
  if(!card)return;
  card.classList.add("commercial-action-card");
  card.setAttribute("aria-label",label);
  const holder=card.querySelector(".guided-action-icon");
  if(holder){
    holder.innerHTML=icon(iconName,"commercial-action-svg");
    holder.dataset.commercialIcon="1";
  }
}

export function insertJourney(workspace,steps,title){
  if(!workspace||workspace.nextElementSibling?.classList.contains("commercial-journey"))return;
  const section=document.createElement("section");
  section.className="commercial-journey";
  section.innerHTML=`<header><span>RUTA SIMPLE</span><strong>${title}</strong></header><div class="commercial-journey-steps">${steps.map(([number,name,detail])=>`<div class="commercial-journey-step"><b>${number}</b><span><strong>${name}</strong><small>${detail}</small></span></div>`).join("")}</div>`;
  workspace.after(section);
}
