import { fmt } from "../format.js";

function normalizedPagination(pagination){
  const totalPages=Math.max(1,Math.trunc(Number(pagination?.totalPages)||1));
  const requestedPage=Math.trunc(Number(pagination?.page)||1);
  const page=Math.min(totalPages,Math.max(1,requestedPage));
  return {page,totalPages,totalItems:pagination?.totalItems??0};
}

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

function pageButton(value,current){
  const active=value===current;
  return `<button type="button" class="pagination-page${active?" active":""}" data-page="${value}" aria-label="${active?`Página ${value}, actual`:`Ir a la página ${value}`}" ${active?'aria-current="page" disabled':""}>${value}</button>`;
}

export function paginationHtml(pagination){
  if(!pagination)return"";
  const {page,totalPages,totalItems}=normalizedPagination(pagination);
  const pages=pageSequence(page,totalPages).map(value=>value==="…"
    ?'<span class="pagination-ellipsis" aria-hidden="true">…</span>'
    :pageButton(value,page)
  ).join("");
  return `<div class="pagination pagination-commerce" aria-label="Paginación. Página ${page} de ${totalPages}">
    <span class="pagination-summary"><strong>${fmt.number(totalItems)}</strong><span>registros · Página ${page} de ${totalPages}</span></span>
    <div class="pagination-actions">
      <button type="button" class="btn btn-ghost pagination-direction pagination-previous" data-page="${page-1}" aria-label="Ir a la página anterior" ${page<=1?"disabled":""}>Anterior</button>
      <nav class="pagination-pages" aria-label="Páginas. Página ${page} de ${totalPages}">${pages}</nav>
      <button type="button" class="btn btn-ghost pagination-direction pagination-next" data-page="${page+1}" aria-label="Ir a la página siguiente" ${page>=totalPages?"disabled":""}>Siguiente</button>
    </div>
  </div>`;
}
