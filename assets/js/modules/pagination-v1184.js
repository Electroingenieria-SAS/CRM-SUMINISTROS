/* CRM Suministros V11.8.4 · Paginación visual reutilizable */

function pageSequence(current,total){
  if(total<=7)return Array.from({length:total},(_,index)=>index+1);
  const values=[1];
  const start=Math.max(2,current-2);
  const end=Math.min(total-1,current+2);
  if(start>2)values.push("…");
  for(let page=start;page<=end;page++)values.push(page);
  if(end<total-1)values.push("…");
  values.push(total);
  return values;
}

function enhancePagination(pagination){
  if(!(pagination instanceof HTMLElement)||pagination.dataset.paginationEnhanced==="1")return;
  const summary=pagination.querySelector(":scope > span");
  const actions=pagination.querySelector(".pagination-actions");
  if(!summary||!actions)return;

  const match=summary.textContent.trim().match(/Página\s+(\d+)\s+de\s+(\d+)\s+·\s+(.+?)\s+registros/i);
  if(!match)return;

  const current=Number(match[1]);
  const total=Math.max(1,Number(match[2]));
  const totalItems=match[3].trim();
  const buttons=[...actions.querySelectorAll("button[data-page]")];
  const previous=buttons[0];
  const next=buttons.at(-1);
  if(!previous||!next)return;

  pagination.dataset.paginationEnhanced="1";
  pagination.classList.add("pagination-commerce");
  summary.classList.add("pagination-summary");
  summary.innerHTML=`<strong>${totalItems}</strong><span>registros · Página ${current} de ${total}</span>`;

  previous.classList.add("pagination-direction","pagination-previous");
  next.classList.add("pagination-direction","pagination-next");

  const pages=document.createElement("nav");
  pages.className="pagination-pages";
  pages.setAttribute("aria-label",`Páginas. Página ${current} de ${total}`);

  pageSequence(current,total).forEach(value=>{
    if(value==="…"){
      const ellipsis=document.createElement("span");
      ellipsis.className="pagination-ellipsis";
      ellipsis.textContent="…";
      ellipsis.setAttribute("aria-hidden","true");
      pages.append(ellipsis);
      return;
    }
    const marker=document.createElement("button");
    marker.type="button";
    marker.className=`pagination-page${value===current?" active":""}`;
    marker.textContent=String(value);
    marker.dataset.pageMarker=String(value);
    marker.setAttribute("aria-label",value===current?`Página ${value}, actual`:`Ir a la página ${value}`);
    if(value===current){
      marker.setAttribute("aria-current","page");
      marker.disabled=true;
    }else{
      marker.addEventListener("click",()=>{
        const direction=value<current?previous:next;
        if(!direction||direction.disabled)return;
        direction.dataset.page=String(value);
        direction.click();
      });
    }
    pages.append(marker);
  });

  actions.insertBefore(pages,next);
}

function enhanceWithin(node){
  if(!(node instanceof Element))return;
  if(node.matches(".pagination"))enhancePagination(node);
  node.querySelectorAll?.(".pagination").forEach(enhancePagination);
}

function install(){
  document.querySelectorAll(".pagination").forEach(enhancePagination);
  const observer=new MutationObserver(mutations=>{
    mutations.forEach(mutation=>mutation.addedNodes.forEach(node=>enhanceWithin(node)));
  });
  observer.observe(document.body,{childList:true,subtree:true});
}

if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",install,{once:true});
else install();
