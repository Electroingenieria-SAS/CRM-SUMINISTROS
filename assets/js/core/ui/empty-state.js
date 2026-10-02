import { fmt } from "../format.js";

export function empty(title="Sin registros",detail="No hay información para los filtros seleccionados."){
  return `<div class="empty"><strong>${fmt.escape(title)}</strong><div>${fmt.escape(detail)}</div></div>`;
}
