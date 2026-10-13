import {referenceCardHtml} from "./quote-reference-view.js";
import {freightPredictionsHtml} from "../orders/freight/freight-display.js";
import {freightPredictionSnapshot} from "../orders/freight/freight-prediction.js";
import {fmt} from '../../core/format.js';
const esc=fmt.escape;
export function quoteView(){return `<section class="freight-quotes"><header class="page-head"><div><h1>Cotización de fletes</h1><p>Cotiza sin crear un pedido. Guarda referencias y compara con guías reales.</p></div></header>
<div class="freight-notice">TCC: referencia histórica 2023–2024. ENVÍA: estimación interna. Cada transportadora conserva sus propias reglas.</div>
<form data-quote-form class="freight-quote-form"><section class="freight-panel"><h2>Ruta y servicio</h2><div class="freight-grid">
<label>Origen efectivo<select class="control" name="origin" aria-label="Origen efectivo" required></select></label>
<label>Departamento<select class="control" name="department" aria-label="Departamento" required><option value="">Selecciona</option></select></label>
<label>Municipio / localidad y centro operativo<select class="control" name="destinationKey" aria-label="Municipio / localidad y centro operativo" required disabled><option value="">Selecciona departamento</option></select></label>
<label>Transportadora<select class="control" name="carrier" aria-label="Transportadora"><option value="TCC">TCC</option><option value="ENVIA">ENVÍA</option></select></label>
<label>Servicio<select class="control"><option>Paquetería</option></select></label>
<label>Valor declarado (COP)<input class="control" name="declaredValue" type="number" min="0" step="any" placeholder="Valor del envío"></label></div>
<p>Confirma el lugar real de salida del envío. Si una localidad tiene varios centros operativos, selecciona el que corresponde.</p></section>
<section class="freight-panel"><div class="freight-material-heading"><div><h2>Materiales a cotizar</h2><p>Escribe el nombre, elige Peso o Volumen e ingresa el dato. Cada material conserva ambas medidas si alternas los botones.</p></div><span class="freight-unit-badge">kg / m³</span></div><div data-quote-materials></div><button type="button" class="btn" data-add-material>+ Agregar material</button></section>
<div class="freight-actions"><button class="btn btn-primary" type="submit">Calcular</button><button class="btn" type="button" data-save-quote disabled>Guardar cotización</button><button class="btn" type="button" data-save-draft>Guardar borrador</button></div>
<p data-quote-message role="status" aria-live="polite"></p></form>
<div data-quote-result></div><section class="freight-panel"><h2>Historial de cotizaciones</h2><div data-quote-history></div><div class="freight-actions"><button class="btn" data-history-prev>Anterior</button><span data-history-page></span><button class="btn" data-history-next>Siguiente</button></div></section></section>`;}
export function options(rows,label=x=>x,value=x=>x){return '<option value="">Selecciona</option>'+rows.map(r=>`<option value="${esc(value(r))}">${esc(label(r))}</option>`).join('');}
export function quoteResultHtml(result){
 const pred=result.prediction,modelSnapshot=freightPredictionSnapshot(pred);
 const cards=result.comparison?.length?result.comparison:[result];
 const presented=pred?{...pred,carriers:(pred.carriers||[]).map(row=>({...row,carrier:result.carrierAliases?.[row.carrier]?`${result.carrierAliases[row.carrier]} (${row.carrier})`:row.carrier})),cheapestCarrier:result.carrierAliases?.[pred.cheapestCarrier]?`${result.carrierAliases[pred.cheapestCarrier]} (${pred.cheapestCarrier})`:pred.cheapestCarrier}:pred;
 return `<div class="freight-comparison-grid">${cards.map(referenceCardHtml).join('')}</div><section class="freight-panel"><h2>Predicción del CRM desde guías reales</h2>${pred?.available?`<div class="freight-breakdown">${freightPredictionsHtml(presented)}</div><p>Versión ${esc(modelSnapshot?.version||pred.version)}. Predicciones separadas de las referencias documentales y del importe real pagado.</p>`:'<p>Sin predicción compatible con el origen y el peso ingresados.</p>'}</section>`;
}
export function quoteHistoryHtml(items){return items.length?items.map(q=>`<article class="freight-history-row"><div><strong>CF-${esc(q.folio)}</strong><p>${esc(q.carrier==='ENVIA'?'ENVÍA':'TCC')} · ${esc(q.snapshot.origin)} → ${esc(q.snapshot.destination)} · ${esc(({DRAFT:'Borrador',CALCULATED:'Calculada',EXPIRED:'Vencida'})[q.status]||q.status)}</p><small>${esc(new Date(q.created_at).toLocaleString('es-CO'))} · Pedido ${esc(q.order_number||'sin vincular')}</small><p>Referencia: ${(q.snapshot.reference.subtotalCop??q.snapshot.reference.totalCop)!=null?fmt.money(q.snapshot.reference.subtotalCop??q.snapshot.reference.totalCop):'no disponible'} · Real de guía: ${q.actual_cost_cop!=null?fmt.money(q.actual_cost_cop):'pendiente'} ${esc(q.actual_carrier||'')}</p></div><div class="freight-actions"><button type="button" class="btn" data-quote-view="${esc(q.id)}">Ver</button><button type="button" class="btn" data-quote-duplicate="${esc(q.id)}">Duplicar</button><button type="button" class="btn" data-quote-link="${esc(q.id)}">Vincular pedido</button></div></article>`).join(''):'<p>Aún no hay cotizaciones guardadas.</p>';}
