import { fmt } from "../format.js";

export function paginationHtml(pagination){
  if(!pagination)return"";
  return `<div class="pagination"><span>Página ${pagination.page} de ${Math.max(pagination.totalPages,1)} · ${fmt.number(pagination.totalItems)} registros</span><div class="pagination-actions"><button class="btn btn-ghost" data-page="${pagination.page-1}" ${pagination.page<=1?"disabled":""}>Anterior</button><button class="btn btn-ghost" data-page="${pagination.page+1}" ${pagination.page>=pagination.totalPages?"disabled":""}>Siguiente</button></div></div>`;
}
