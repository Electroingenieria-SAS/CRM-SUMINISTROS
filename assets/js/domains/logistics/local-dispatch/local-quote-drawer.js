import {fmt} from '../../../core/format.js';
import {localRoutePickerHtml} from './local-route-picker.js';

export function localQuoteDrawerHtml(values){
 const hasExtras=values.unloadingCost+values.diversionCost>0;
 return `<div class="local-quote-overlay" data-local-quote-overlay hidden>
   <button type="button" class="local-quote-backdrop" data-local-quote-dismiss aria-label="Cerrar cotización"></button>
   <aside class="local-quote-drawer" data-local-quote-panel role="dialog" aria-modal="true"
     aria-labelledby="local-quote-drawer-title" tabindex="-1">
    <header class="local-quote-drawer-head">
      <div><span>TRANSPORTE LOCAL · TULUÁ</span>
        <h3 id="local-quote-drawer-title">Cotizar flete local</h3>
        <p>Elige categoría y destino para calcular con las tarifas internas.</p></div>
      <button type="button" class="local-quote-close" data-local-quote-dismiss aria-label="Cerrar cotizador">×</button>
    </header>
    <div class="local-quote-drawer-scroll">
      <section class="local-quote-drawer-section">
        <div class="local-quote-section-label"><strong>01</strong><span>Ruta de entrega</span></div>
        ${localRoutePickerHtml(values.city)}
        <div class="local-quote-weight"><small>Peso del pedido, desde Facturación</small>
          <strong data-local-quote-weight>— kg</strong><span>Se modifica desde Datos del viaje</span></div>
      </section>
      <section class="local-quote-drawer-section">
        <div class="local-quote-section-label"><strong>02</strong><span>Recargos opcionales</span></div>
        <div class="local-dispatch-extra-heading">
          <div><strong>Auxiliar o subruta urgente</strong><small>Solo cuando aplique, con observación del motivo</small></div>
          <button type="button" class="btn" data-local-extra-toggle
            aria-controls="local-dispatch-extra-fields" aria-expanded="${hasExtras}">
            ${hasExtras?'Ocultar recargos':'+ Agregar recargo'}</button>
        </div>
        <div class="local-dispatch-initial-costs-v1146" id="local-dispatch-extra-fields"
          data-local-extra-panel ${hasExtras?'':'hidden'}>
          <label><span>Auxiliar / descargue inicial (COP)</span>
            <input class="control" type="number" min="0" step="1" name="unloadingCost" value="${values.unloadingCost}">
            <small>Solo si se conoce antes del despacho.</small></label>
          <label><span>Desvío / subruta urgente (COP)</span>
            <input class="control" type="number" min="0" step="1" name="diversionCost" value="${values.diversionCost}">
            <small>Justifícalo en las observaciones del viaje.</small></label>
        </div>
      </section>
      <section class="local-quote-drawer-section local-quote-breakdown">
        <div class="local-quote-section-label"><strong>03</strong><span>Liquidación inicial</span></div>
        <div class="local-dispatch-liquidation-v1145" aria-live="polite">
          <article><small>Tarifa base · hasta 1.000 kg</small><strong data-trip-base>$0</strong></article>
          <article><small>Kilos adicionales</small><strong data-trip-extra-kg>0 kg</strong></article>
          <article><small>Costo del peso adicional</small><strong data-trip-extra-cost>$0</strong></article>
          <article class="total"><small>Total del flete</small><strong data-trip-total>$0</strong></article>
        </div>
        <p data-local-matrix-warning class="local-dispatch-matrix-warning" role="status" hidden></p>
        <p class="local-quote-provenance">Matriz interna Luis Ibarra: tarifa base hasta 1.000 kg,
         adicional hasta 2.500 kg. Los costos posteriores se gestionan con ajustes auditados,
         sin duplicar lo registrado inicialmente.</p>
      </section>
    </div>
    <footer class="local-quote-drawer-footer">
      <span>Este cálculo forma parte del despacho local.</span>
      <button type="button" class="btn btn-primary" data-local-quote-dismiss>Volver al despacho</button>
    </footer>
   </aside>
  </div>`;
}

export function bindLocalQuoteDrawer(modal){
 const overlay=modal.querySelector('[data-local-quote-overlay]');
 const openButton=modal.querySelector('[data-local-quote-toggle]');
 const closeButtons=[...overlay.querySelectorAll('[data-local-quote-dismiss]')];
 const panel=overlay.querySelector('[data-local-quote-panel]');
 const extraButton=overlay.querySelector('[data-local-extra-toggle]');
 const extraPanel=overlay.querySelector('[data-local-extra-panel]');
 const main=[modal.querySelector('.shipping-process-head'),
  modal.querySelector('.shipping-process-body'),modal.querySelector('.shipping-core-footer-v11107')].filter(Boolean);
 let previousFocus=null;
 const setOpen=open=>{
  if(open===!overlay.hidden)return;
  if(open){
   previousFocus=document.activeElement;
   overlay.hidden=false;
   modal.classList.add('local-quote-is-open');
   openButton.setAttribute('aria-expanded','true');
   main.forEach(node=>node.inert=true);
   panel.querySelector('[data-local-quote-dismiss]').focus();
  }else{
   overlay.hidden=true;
   modal.classList.remove('local-quote-is-open');
   main.forEach(node=>node.inert=false);
   openButton.setAttribute('aria-expanded','false');
   if(previousFocus?.isConnected)previousFocus.focus();
   previousFocus=null;
  }
 };
 const keydown=event=>{
  if(event.key==='Escape'){
   if(!overlay.querySelector('[data-local-route-menu]')?.hidden)return;
   event.preventDefault();event.stopPropagation();setOpen(false);
  }
  if(event.key!=='Tab')return;
  const controls=[...panel.querySelectorAll('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled)')]
   .filter(item=>item.getClientRects().length && item.getAttribute('tabindex')!=='-1');
  if(!controls.length){event.preventDefault();panel.focus();return;}
  const first=controls[0],last=controls.at(-1);
  if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
  else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
 };
 overlay.addEventListener('keydown',keydown,true);
 closeButtons.forEach(button=>button.addEventListener('click',()=>setOpen(false)));
 openButton.addEventListener('click',()=>setOpen(true));
 extraButton.addEventListener('click',()=>{
  extraPanel.hidden=!extraPanel.hidden;
  extraButton.setAttribute('aria-expanded',String(!extraPanel.hidden));
  extraButton.textContent=extraPanel.hidden?'+ Agregar recargo':'Ocultar recargos';
 });
 return {open:()=>setOpen(true),close:()=>setOpen(false),isOpen:()=>!overlay.hidden};
}
