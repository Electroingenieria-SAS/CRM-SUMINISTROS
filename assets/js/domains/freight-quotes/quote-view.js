import {referenceCardHtml} from "./quote-reference-view.js";
// Preserve the existing Orders freight module graph without rendering the
// redundant historical comparison section on the quote page.
import {freightPredictionsHtml} from "../orders/freight/freight-display.js";
import {freightPredictionSnapshot} from "../orders/freight/freight-prediction.js";
import {fmt} from '../../core/format.js';
export {quoteHistoryHtml} from './quote-history-view.js';
const esc=fmt.escape;
export function quoteView(){return `<section class="freight-quotes">
<header class="page-head freight-page-head"><div><p class="freight-overline">LOGÍSTICA / COTIZADOR</p><h1>Cotización de fletes</h1><p>Elige el destino, registra la mercancía y compara TCC con ENVÍA.</p></div><div class="freight-head-detail" aria-label="Módulo de logística"><span class="freight-head-icon" aria-hidden="true">↗</span><span>COTIZACIONES<br>LOGÍSTICAS</span></div></header>
<nav class="freight-view-nav" role="tablist" aria-label="Vistas de cotización"><button class="freight-view-tab" type="button" role="tab" id="freight-tab-new" aria-controls="freight-panel-new" aria-selected="true" data-view-tab="quote">Nueva cotización</button><button class="freight-view-tab" type="button" role="tab" id="freight-tab-history" aria-controls="freight-panel-history" aria-selected="false" data-view-tab="history">Historial <span data-history-tab-count aria-hidden="true">0</span></button></nav><div data-quote-workspace role="tabpanel" id="freight-panel-new" aria-labelledby="freight-tab-new">
<div class="freight-notice" role="note"><strong>Precios orientativos.</strong> Las transportadoras conservan sus propios datos. El valor se confirma al despachar.</div>
<form data-quote-form class="freight-quote-form">
<section class="freight-panel freight-step-panel"><div class="freight-step-heading"><span class="freight-step-number" aria-hidden="true">1</span><div><h2>¿A dónde enviaremos?</h2><p>Selecciona el recorrido real del envío.</p></div><span class="freight-step-tag">Ruta</span></div>
<div class="freight-route-grid"><label>Origen<select class="control" name="origin" aria-label="Origen efectivo" required></select></label><label>Departamento<select class="control" name="department" aria-label="Departamento" required><option value="">Selecciona</option></select></label>
<div class="freight-destination-field"><label for="freight-destination-search">Municipio de destino</label>
<div class="freight-city-combobox"><input id="freight-destination-search" class="control" type="search" data-destination-search role="combobox" aria-label="Buscar municipio o centro operativo" aria-controls="freight-city-options" aria-autocomplete="list" aria-expanded="false" placeholder="Busca y selecciona un municipio" autocomplete="off" disabled required>
<span class="freight-city-magnifier" aria-hidden="true">⌕</span><div id="freight-city-options" class="freight-city-results" data-destination-options role="listbox" hidden></div></div>
<select id="freight-destination-select" class="freight-native-select" name="destinationKey" aria-label="Municipio / localidad y centro operativo" tabindex="-1" disabled><option value="">Selecciona</option></select>
<small class="freight-field-note" data-destination-feedback>Selecciona un departamento para comenzar.</small></div></div>
</section>
<section class="freight-panel freight-preference-panel" aria-labelledby="freight-preference-heading">
<div class="freight-step-heading freight-preference-header"><span class="freight-step-number" aria-hidden="true">2</span><div><h2 id="freight-preference-heading">Elige tu transportadora</h2><p>Podrás comparar ambas y guardar la que prefieras.</p></div></div>
<div class="freight-preferences-grid">
<div class="freight-carrier-choice"><span class="freight-main-label">TRANSPORTADORA PREFERIDA</span><div class="freight-carrier-segment" role="group" aria-label="Transportadora para guardar"><button type="button" data-carrier-choice="TCC" aria-pressed="true"><span class="freight-carrier-symbol" aria-hidden="true">T</span><span>TCC</span><small>Elegir</small></button><button type="button" data-carrier-choice="ENVIA" aria-pressed="false"><span class="freight-carrier-symbol" aria-hidden="true">E</span><span>ENVÍA</span><small>Elegir</small></button></div>
<select class="freight-native-select" name="carrier" aria-label="Transportadora"><option value="TCC">TCC</option><option value="ENVIA">ENVÍA</option></select></div>
<label class="freight-declared-field"><span class="freight-main-label">VALOR DECLARADO DE LA MERCANCÍA</span><span class="freight-money-input"><span aria-hidden="true">$</span><input class="control" name="declaredValue" aria-label="Valor declarado (COP)" type="number" min="0" step="any" inputmode="decimal" placeholder="0"><span class="freight-money-currency">COP</span></span><small>Usado para declarar el valor de la mercancía, cuando corresponda.</small></label>
</div>
</section>
<section class="freight-panel freight-step-panel"><div class="freight-step-heading"><span class="freight-step-number" aria-hidden="true">3</span><div><h2>¿Qué vamos a enviar?</h2><p>Ingresa cada material y su peso o volumen. Puedes registrar ambas medidas.</p></div><span class="freight-unit-badge">kg / m³</span></div>
<div class="freight-material-summary" role="status" aria-live="polite"><span><small>Materiales</small><strong data-material-count>0</strong></span><span><small>Peso registrado</small><strong data-material-weight>0 kg</strong></span><span><small>Volumen registrado</small><strong data-material-volume>0 m³</strong></span></div>
<div data-quote-materials class="freight-material-list"></div><button type="button" class="btn freight-add-material" data-add-material>+ Agregar material</button></section>
<div class="freight-action-bar"><div class="freight-action-caption"><strong>4. Compara los fletes</strong><small>El cálculo no crea ni modifica pedidos.</small></div><div class="freight-actions"><button class="btn btn-primary freight-calculate" type="submit">Calcular</button><button class="btn" type="button" data-save-quote disabled>Guardar cotización</button><button class="btn" type="button" data-save-draft>Guardar borrador</button></div></div>
<p data-quote-message role="status" aria-live="polite" class="freight-message"></p></form>
<div data-quote-result class="freight-result-host" aria-live="polite"></div></div>
<section class="freight-panel freight-history-panel" data-history-workspace role="tabpanel" id="freight-panel-history" aria-labelledby="freight-tab-history" hidden><div class="freight-step-heading freight-history-heading"><span class="freight-history-icon" aria-hidden="true">◷</span><div><h2>Historial de cotizaciones</h2><p>Consulta, duplica o vincula cotizaciones anteriores.</p></div></div>
<div class="freight-history-overview" data-history-overview role="status" aria-live="polite"><div><span>Cotizaciones visibles</span><strong data-history-count>0</strong></div><div><span>Con estimación</span><strong data-history-priced>0</strong></div><div><span>Con costo real</span><strong data-history-actual>0</strong></div></div>
<div class="freight-history-toolbar"><div class="freight-history-toolbar-top"><label>Buscar cotización <input class="control" type="search" data-history-search placeholder="Folio, origen, destino o pedido" autocomplete="off"></label><div class="freight-history-toolbar-actions"><button type="button" class="btn" data-history-clear>Limpiar filtros</button><button type="button" class="btn" data-history-export disabled>Exportar CSV</button></div></div>
<div class="freight-history-tools"><label>Transportadora<select class="control" data-history-carrier><option value="">Todas</option><option value="TCC">TCC</option><option value="ENVIA">ENVÍA</option></select></label>
<label>Estado<select class="control" data-history-status><option value="">Todos los estados</option><option value="CALCULATED">Calculadas</option><option value="DRAFT">Borradores</option><option value="EXPIRED">Vencidas</option></select></label>
<label>Orden<select class="control" data-history-sort><option value="newest">Más recientes</option><option value="oldest">Más antiguas</option><option value="highest">Mayor estimado</option><option value="lowest">Menor estimado</option></select></label></div>
<div class="freight-history-filter-note"><small>Los filtros y la exportación corresponden únicamente a esta página del historial.</small><strong data-history-visible-count></strong></div></div>
<div data-quote-history></div><div class="freight-actions freight-pagination"><button class="btn" data-history-prev>Anterior</button><span data-history-page></span><button class="btn" data-history-next>Siguiente</button></div></section></section>`;}
export function options(rows,label=x=>x,value=x=>x){return '<option value="">Selecciona</option>'+rows.map(r=>`<option value="${esc(value(r))}">${esc(label(r))}</option>`).join('');}
export function quoteResultHtml(result,{selectable=true,selectedCarrier=result.carrier}={}){
 const cards=result.comparison?.length?result.comparison:[result];
 const valued=cards.filter(card=>card.commercialEstimate?.available&&Number(card.commercialEstimate.totalCop)>0);
 const cheapest=valued.length===2?valued.reduce((a,b)=>Number(a.commercialEstimate.totalCop)<Number(b.commercialEstimate.totalCop)?a:b).carrier:null;
 const offers=cards.map(card=>{
  const selected=selectedCarrier===card.carrier;
  const choice=card.commercialEstimate?.available===true;
  const reference={...card,cheapestCommercial:card.carrier===cheapest};
  const choiceButton=selectable?'<div class="freight-offer-choice"><button class="btn freight-offer-select" type="button" data-quote-select-carrier="'+esc(card.carrier)+'" aria-pressed="'+selected+'" '+(!choice?'disabled title="Sin estimación disponible"':'')+'>'+
   (selected?'Seleccionada':'Elegir '+(card.carrier==='ENVIA'?'ENVÍA':'TCC'))+'</button></div>':'';
  return '<div class="freight-offer'+(selected?' freight-offer-selected':'')+'" data-offer-carrier="'+esc(card.carrier)+'">'+referenceCardHtml(reference)+choiceButton+'</div>';
 }).join('');
 return '<section class="freight-results-section" aria-label="Resultados de cotización"><div class="freight-results-heading"><div><p class="freight-overline">COMPARATIVA DE TRANSPORTADORAS</p><h2>Compara tus opciones</h2><p>Compara los rangos y selecciona la empresa antes de guardar.</p></div><span class="freight-results-count">'+esc(valued.length)+' de '+esc(cards.length)+' con estimación</span></div><div class="freight-comparison-grid">'+offers+'</div></section>';
}
