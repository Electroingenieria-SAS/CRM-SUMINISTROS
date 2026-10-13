import {freightPredictionsHtml} from "../orders/freight/freight-display.js";
import {freightPredictionSnapshot} from "../orders/freight/freight-prediction.js";
import {fmt} from '../../core/format.js';
const esc=fmt.escape;
export function quoteView(){return `<section class="freight-quotes"><header class="page-head"><div><h1>Cotización de fletes</h1><p>Cotiza sin crear un pedido. Guarda referencias y compara con guías reales.</p></div></header>
<div class="freight-notice">TCC · referencia documental 2023–2024. ENVÍA se incorporará al recibir sus tarifas y reglas.</div>
<form data-quote-form class="freight-quote-form"><section class="freight-panel"><h2>Ruta y servicio</h2><div class="freight-grid">
<label>Origen efectivo<select class="control" name="origin" required></select></label>
<label>Departamento<select class="control" name="department" required><option value="">Selecciona</option></select></label>
<label>Municipio / localidad y centro operativo<select class="control" name="destinationKey" required disabled><option value="">Selecciona departamento</option></select></label>
<label>Transportadora<select class="control" name="carrier"><option value="TCC">TCC</option></select></label>
<label>Servicio<select class="control"><option>Paquetería</option></select></label>
<label>Valor declarado (COP)<input class="control" name="declaredValue" type="number" min="0" step="any" placeholder="Valor del envío"></label></div>
<p>El origen del modelo se usa como selección inicial. Las localidades del documento se conservan con su centro operativo, sin asignar códigos DANE por suposición.</p></section>
<section class="freight-panel"><h2>Materiales</h2><p>Selecciona Siesa o agrega una descripción manual. El peso de los bultos se confirma aparte para evitar duplicarlo.</p><div data-quote-materials></div><button type="button" class="btn" data-add-material>Agregar material</button><button type="button" class="btn" data-add-manual>Material manual</button></section>
<section class="freight-panel"><h2>Bultos y medidas</h2><p>Peso real y volumen por bulto. Usa dimensiones en metros o volumen en m³. La cantidad indica bultos iguales.</p><div data-quote-packages></div><button type="button" class="btn" data-add-package>Agregar bulto</button></section>
<div class="freight-actions"><button class="btn btn-primary" type="submit">Calcular</button><button class="btn" type="button" data-save-quote disabled>Guardar cotización</button><button class="btn" type="button" data-save-draft>Guardar borrador</button></div>
<p data-quote-message role="status" aria-live="polite"></p></form>
<div data-quote-result></div><section class="freight-panel"><h2>Historial de cotizaciones</h2><div data-quote-history></div><div class="freight-actions"><button class="btn" data-history-prev>Anterior</button><span data-history-page></span><button class="btn" data-history-next>Siguiente</button></div></section></section>`;}
export function options(rows,label=x=>x,value=x=>x){return '<option value="">Selecciona</option>'+rows.map(r=>`<option value="${esc(value(r))}">${esc(label(r))}</option>`).join('');}
export function quoteResultHtml(result){
 const ref=result.reference,rows=ref.packages||[],pred=result.prediction;
 const modelSnapshot=freightPredictionSnapshot(pred);
 const money=v=>v===null||v===undefined?'—':fmt.money(v);
 return `<section class="freight-panel"><h2>Referencia histórica TCC</h2><p>${esc(result.origin)} → ${esc(result.destination)} · C.O ${esc(result.center)} · ${esc(result.tariffVersion)}</p><p>${esc(result.warning)}</p>
 ${ref.status==='HISTORICAL_REFERENCE'?`<div class="freight-breakdown">${rows.map((p,i)=>`<article><h3>Bulto ${i+1} × ${esc(p.quantity)}</h3><p>Real: ${fmt.number(p.weightKg,3)} kg · Volumen: ${fmt.number(p.volumeM3,4)} m³</p><p>Volumétrico: ${fmt.number(p.volumeWeightKg,3)} kg · Cobrable: ${fmt.number(p.billableKg,3)} kg</p><p>Tarifa/kg: ${money(result.rateCopKg)} · Recargo/kg: ${money(p.surchargeCopKg)}</p><strong>${money(p.baseCop)}</strong></article>`).join('')}</div><p>Flete fijo: ${money(ref.baseCop)} · Manejo: ${money(ref.handlingCop)}</p><h3>Subtotal de referencia: ${money(ref.subtotalCop)}</h3>`:`<p>${ref.reason==='ORIGIN_ROUTE_UNAVAILABLE'?'No existe esta ruta/origen en el tarifario documental.':ref.reason==='RATE_UNAVAILABLE'?'Tarifa documental no disponible.':'Completa peso, volumen y valor declarado.'}</p>`}
 <h2>Predicción del CRM desde guías reales</h2>${pred?.available?`<div class="freight-breakdown">${freightPredictionsHtml(pred)}</div><p>Versión ${esc(modelSnapshot?.version||pred.version)}. Otras transportadoras son predicciones estadísticas, sin tarifario oficial aportado.</p>`:'<p>Sin predicción compatible con el origen y el peso ingresados.</p>'}</section>`;
}
export function quoteHistoryHtml(items){return items.length?items.map(q=>`<article class="freight-history-row"><div><strong>CF-${esc(q.folio)}</strong><p>${esc(q.snapshot.origin)} → ${esc(q.snapshot.destination)} · ${esc(q.status)}</p><small>${esc(new Date(q.created_at).toLocaleString('es-CO'))} · Pedido ${esc(q.order_number||'sin vincular')}</small><p>Referencia: ${q.snapshot.reference.subtotalCop!=null?fmt.money(q.snapshot.reference.subtotalCop):'no disponible'} · Real de guía: ${q.actual_cost_cop!=null?fmt.money(q.actual_cost_cop):'pendiente'} ${esc(q.actual_carrier||'')}</p></div><div class="freight-actions"><button type="button" class="btn" data-quote-view="${esc(q.id)}">Ver</button><button type="button" class="btn" data-quote-duplicate="${esc(q.id)}">Duplicar</button><button type="button" class="btn" data-quote-link="${esc(q.id)}">Vincular pedido</button></div></article>`).join(''):'<p>Aún no hay cotizaciones guardadas.</p>';}
