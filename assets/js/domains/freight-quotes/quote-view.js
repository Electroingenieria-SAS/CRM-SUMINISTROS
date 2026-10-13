import {referenceCardHtml} from "./quote-reference-view.js";
// Preserve the existing Orders freight module graph without rendering the
// redundant historical comparison section on the quote page.
import {freightPredictionsHtml} from "../orders/freight/freight-display.js";
import {freightPredictionSnapshot} from "../orders/freight/freight-prediction.js";
import {fmt} from '../../core/format.js';
const esc=fmt.escape;
export function quoteView(){return `<section class="freight-quotes">
<header class="page-head freight-page-head"><div><p class="freight-overline">LOGÍSTICA / COTIZADOR</p><h1>Cotización de fletes</h1><p>Elige el destino, registra la mercancía y compara TCC con ENVÍA.</p></div><span class="freight-head-icon" aria-hidden="true">↗</span></header>
<div class="freight-notice" role="note"><strong>Precios orientativos.</strong> Las transportadoras conservan sus propios datos. El valor se confirma al despachar.</div>
<form data-quote-form class="freight-quote-form">
<section class="freight-panel freight-step-panel"><div class="freight-step-heading"><span class="freight-step-number" aria-hidden="true">1</span><div><h2>¿A dónde enviaremos?</h2><p>Selecciona el recorrido real del envío.</p></div><span class="freight-step-tag">Ruta</span></div>
<div class="freight-route-grid"><label>Origen<select class="control" name="origin" aria-label="Origen efectivo" required></select></label><label>Departamento<select class="control" name="department" aria-label="Departamento" required><option value="">Selecciona</option></select></label>
<div class="freight-destination-field"><label for="freight-destination-search">Buscar municipio o centro operativo</label><input id="freight-destination-search" class="control" type="search" data-destination-search aria-label="Buscar municipio o centro operativo" placeholder="Escribe para encontrar un destino" autocomplete="off" disabled>
<label for="freight-destination-select" class="freight-field-secondary">Municipio de destino</label><select id="freight-destination-select" class="control" name="destinationKey" aria-label="Municipio / localidad y centro operativo" required disabled><option value="">Selecciona departamento</option></select><small class="freight-field-note" data-destination-feedback>Selecciona un departamento para comenzar.</small></div></div>
<details class="freight-route-extras"><summary>Opciones adicionales</summary><div class="freight-grid freight-extra-fields"><label>Transportadora para guardar<select class="control" name="carrier" aria-label="Transportadora"><option value="TCC">TCC</option><option value="ENVIA">ENVÍA</option></select></label><label>Valor declarado (COP)<input class="control" name="declaredValue" aria-label="Valor declarado (COP)" type="number" min="0" step="any" inputmode="decimal" placeholder="Valor del envío"></label></div><p>El cálculo muestra ambas empresas. La selección se usa al guardar la cotización.</p></details>
</section>
<section class="freight-panel freight-step-panel"><div class="freight-step-heading"><span class="freight-step-number" aria-hidden="true">2</span><div><h2>¿Qué vamos a enviar?</h2><p>Ingresa cada material y su peso o volumen. Puedes registrar ambas medidas.</p></div><span class="freight-unit-badge">kg / m³</span></div>
<div class="freight-material-summary" role="status" aria-live="polite"><span><small>Materiales</small><strong data-material-count>0</strong></span><span><small>Peso registrado</small><strong data-material-weight>0 kg</strong></span><span><small>Volumen registrado</small><strong data-material-volume>0 m³</strong></span></div>
<div data-quote-materials class="freight-material-list"></div><button type="button" class="btn freight-add-material" data-add-material>+ Agregar material</button></section>
<div class="freight-action-bar"><div class="freight-action-caption"><strong>3. Compara los fletes</strong><small>El cálculo no crea ni modifica pedidos.</small></div><div class="freight-actions"><button class="btn btn-primary freight-calculate" type="submit">Calcular</button><button class="btn" type="button" data-save-quote disabled>Guardar cotización</button><button class="btn" type="button" data-save-draft>Guardar borrador</button></div></div>
<p data-quote-message role="status" aria-live="polite" class="freight-message"></p></form>
<div data-quote-result class="freight-result-host" aria-live="polite"></div>
<section class="freight-panel freight-history-panel"><div class="freight-step-heading freight-history-heading"><span class="freight-history-icon" aria-hidden="true">◷</span><div><h2>Historial de cotizaciones</h2><p>Consulta, duplica o vincula cotizaciones anteriores.</p></div></div>
<div class="freight-history-tools"><label>Buscar en esta página<input class="control" type="search" data-history-search placeholder="Folio, ruta o transportadora" autocomplete="off"></label><label>Transportadora<select class="control" data-history-carrier><option value="">Todas</option><option value="TCC">TCC</option><option value="ENVIA">ENVÍA</option></select></label></div>
<div data-quote-history></div><div class="freight-actions freight-pagination"><button class="btn" data-history-prev>Anterior</button><span data-history-page></span><button class="btn" data-history-next>Siguiente</button></div></section></section>`;}
export function options(rows,label=x=>x,value=x=>x){return '<option value="">Selecciona</option>'+rows.map(r=>`<option value="${esc(value(r))}">${esc(label(r))}</option>`).join('');}
export function quoteResultHtml(result){
 const cards=result.comparison?.length?result.comparison:[result];
 const valued=cards.filter(card=>card.commercialEstimate?.available&&Number(card.commercialEstimate.totalCop)>0);
 const cheapest=valued.length===2?valued.reduce((a,b)=>Number(a.commercialEstimate.totalCop)<Number(b.commercialEstimate.totalCop)?a:b).carrier:null;
 const quoteCards=cards.map(card=>({...card,cheapestCommercial:card.carrier===cheapest}));
 return '<section class="freight-results-section" aria-label="Resultados de cotización"><div class="freight-results-heading"><div><p class="freight-overline">RESULTADOS</p><h2>Compara tus opciones</h2><p>Valores orientativos para la mercancía y ruta registradas.</p></div><span class="freight-results-count">'+esc(valued.length)+' de '+esc(cards.length)+' con estimación</span></div><div class="freight-comparison-grid">'+quoteCards.map(referenceCardHtml).join('')+'</div></section>';
}
const historyStatus=Object.freeze({DRAFT:'Borrador',CALCULATED:'Calculada',EXPIRED:'Vencida'});
const quoteMoney=value=>value===null||value===undefined||!Number.isFinite(Number(value))?'—':fmt.money(value);
export function quoteHistoryHtml(items,{filtered=false}={}){
 if(!items.length)return '<p class="freight-history-empty">'+(filtered?'No hay coincidencias en esta página. Prueba otra búsqueda.':'Aún no hay cotizaciones guardadas.')+'</p>';
 return items.map(q=>{
  const snapshot=q.snapshot||{},reference=snapshot.reference||{},estimate=snapshot.commercialEstimate||{};
  const amount=estimate.available?estimate.totalCop:reference.subtotalCop??reference.totalCop;
  const actual=q.actual_cost_cop,carrier=q.carrier==='ENVIA'?'ENVÍA':'TCC';
  const deviation=actual!==null&&actual!==undefined&&estimate.available?Number(actual)-Number(estimate.totalCop):null;
  const date=q.created_at?new Date(q.created_at):null;
  const formattedDate=date&&!Number.isNaN(date.getTime())?date.toLocaleString('es-CO'):'Sin fecha';
  return '<article class="freight-history-row" data-history-carrier="'+esc(q.carrier||'')+'">'+
   '<div class="freight-history-main"><div class="freight-history-topline"><strong>CF-'+esc(q.folio)+'</strong><span class="freight-history-status" data-quote-status="'+esc(q.status||'')+'">'+esc(historyStatus[q.status]||q.status||'')+'</span><span class="freight-history-carrier">'+carrier+'</span></div>'+
   '<p class="freight-history-route">'+esc(snapshot.origin||'—')+' <span aria-hidden="true">→</span> '+esc(snapshot.destination||'—')+'</p><small>'+esc(formattedDate)+' · Pedido '+esc(q.order_number||'sin vincular')+'</small></div>'+
   '<div class="freight-history-prices"><span><small>Estimado</small><strong>'+quoteMoney(amount)+'</strong></span><span><small>Valor cobrado</small><strong>'+quoteMoney(actual)+'</strong></span>'+
   (deviation!==null?'<span><small>Desviación</small><strong>'+quoteMoney(deviation)+'</strong></span>':'')+'</div>'+
   '<div class="freight-actions freight-history-buttons"><button type="button" class="btn" data-quote-view="'+esc(q.id)+'">Ver</button><button type="button" class="btn" data-quote-duplicate="'+esc(q.id)+'">Duplicar</button><button type="button" class="btn" data-quote-link="'+esc(q.id)+'">Vincular pedido</button></div></article>';
 }).join('');
}
