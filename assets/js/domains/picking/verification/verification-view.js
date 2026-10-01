import { shell, bindClose } from "../ui/picking-shell.js";
import { itemRow } from "./material-row.js";
import { hasCutHistory } from "../shared/picking-status.js";
import { pickingProgress } from "../ui/picking-progress.js";
import { partialBanner, roundHistory } from "../partial/round-history.js";

export function renderVerificationView(verification){
verification.host.innerHTML=shell(verification.data,`
    ${pickingProgress(verification.data,"VERIFY")}
    ${partialBanner(verification.data)}
    ${verification.parallel?`<section class="picking-parallel-cut-banner"><span>CORTE EN PARALELO</span><div><strong>${verification.cutsPending.length} referencia(s) siguen en Corte</strong><p>Alista ahora la mercancía que no requiere corte. El avance se guarda y el pedido no podrá pasar a Facturación hasta recoger y verificar los cortes pendientes.</p></div></section>`:""}
    <section class="picking-verification-card">
      <header class="picking-stage-head">
        <div><span class="picking-step-tag">Ronda ${verification.roundNo}</span><h4>Verificación de mercancía</h4><p>${verification.parallel?"Trabaja únicamente las líneas disponibles mientras Corte avanza al mismo tiempo.":verification.previous?"Solo aparecen los elementos pendientes de la salida anterior.":"Marca Encontrado o No encontrado en cada línea."}</p></div>
        <div class="picking-counter"><strong data-picking-verified>0</strong><span>de ${verification.processable.length} verificadas</span></div>
      </header>
      ${verification.processable.length?`<div class="picking-items" data-picking-items>${verification.processable.map((item,index)=>itemRow(item,index,verification.draft[item.id])).join("")}</div>`:`<div class="picking-waiting-cuts"><strong>No hay líneas disponibles para alistar todavía.</strong><p>Todas las referencias pendientes están actualmente en Corte. Puedes cerrar este popup y atender otro pedido.</p></div>`}
      <section class="picking-result-summary" data-picking-summary></section>
      ${verification.processable.length?`<button type="button" class="btn btn-primary picking-send-button" data-picking-send disabled>${verification.parallel?"Guardar avance y esperar cortes":"Enviar a facturación"}</button>`:""}
      <small class="picking-route-note">${verification.parallel?"Corte y Alistamiento están trabajando sobre el mismo pedido en paralelo, sin duplicarlo.":hasCutHistory(verification.data)?"Los cortes ya fueron procesados y recogidos. Al finalizar esta verificación, el pedido continuará al proceso de facturación correspondiente.":"El pedido continuará directamente al proceso de facturación correspondiente."}</small>
    </section>
    ${roundHistory(verification.data)}
  `);
bindClose(verification.host);
}
