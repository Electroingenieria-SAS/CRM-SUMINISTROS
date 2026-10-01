import { fmt } from "../format.js";

export function loading(message="Cargando información operativa…"){
  return `<div class="loading" role="status" aria-live="polite"><span class="spinner" aria-hidden="true"></span>${fmt.escape(message)}</div>`;
}
