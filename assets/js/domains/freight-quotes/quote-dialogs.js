import {fmt} from '../../core/format.js';
const money=value=>value==null||!Number.isFinite(Number(value))?'—':fmt.money(value);
const value=(target,text)=>{target.textContent=String(text??'—');};
const field=(label,text)=>{
 const item=document.createElement('div'),dt=document.createElement('dt'),dd=document.createElement('dd');
 dt.textContent=label;dd.textContent=String(text??'—');item.append(dt,dd);return item;
};
export function createFreightDialogs(root,{duplicate,link,canLink,notice}){
 const dialog=document.createElement('dialog');
 dialog.className='freight-detail-sheet';
 dialog.setAttribute('aria-label','Detalle de la cotización');
 dialog.innerHTML='<div class="freight-sheet-layout"><header class="freight-sheet-head"><div><small>DETALLE DE COTIZACIÓN</small><h2 data-sheet-title></h2></div><button type="button" class="btn" data-sheet-close aria-label="Cerrar detalles">Cerrar ×</button></header><div class="freight-sheet-body"><dl data-sheet-data class="freight-sheet-data"></dl><details class="freight-sheet-breakdown"><summary>Consultar desglose y mercancía</summary><dl data-sheet-breakdown></dl></details></div><footer class="freight-sheet-footer"><button type="button" class="btn" data-sheet-copy>Copiar folio</button><button type="button" class="btn" data-sheet-duplicate>Duplicar</button><button type="button" class="btn btn-primary" data-sheet-link>Vincular pedido</button><small data-sheet-status role="status" aria-live="polite"></small></footer></div>';
 root.append(dialog);
 const linkDialog=document.createElement('dialog');
 linkDialog.className='freight-link-dialog';
 linkDialog.setAttribute('aria-label','Vincular cotización a pedido');
 linkDialog.innerHTML='<form class="freight-link-form"><h2>Vincular a un pedido</h2><p>Ingresa el número exacto del pedido. No se modificarán los datos del pedido.</p><label>Número de pedido<input class="control" name="orderNumber" required maxlength="80" autocomplete="off" placeholder="Ej. PED-001"></label><p data-link-error role="alert"></p><div class="freight-dialog-actions"><button type="button" class="btn" data-link-cancel>Cancelar</button><button type="submit" class="btn btn-primary" data-link-submit>Confirmar vínculo</button></div></form>';
 root.append(linkDialog);
 let current=null,lastFocus=null,pending=false;
 const status=dialog.querySelector('[data-sheet-status]');
 const closeDetails=()=>{if(dialog.open)dialog.close();};
 const closeLink=()=>{if(linkDialog.open&&!pending)linkDialog.close();};
 dialog.querySelector('[data-sheet-close]').onclick=closeDetails;
 linkDialog.querySelector('[data-link-cancel]').onclick=closeLink;
 const restoreFocus=()=>{if(lastFocus?.isConnected)lastFocus.focus();lastFocus=null;};
 dialog.addEventListener('close',restoreFocus);
 linkDialog.addEventListener('close',()=>{if(!dialog.open)restoreFocus();});
 function showDetails(quote,initiator){
  current=quote;lastFocus=initiator||document.activeElement;
  const snapshot=quote.snapshot||{},estimate=snapshot.commercialEstimate||{},ref=snapshot.reference||{};
  value(dialog.querySelector('[data-sheet-title]'),'CF-'+quote.folio);
  const details=dialog.querySelector('[data-sheet-data]');details.replaceChildren(
   field('Transportadora',quote.carrier==='ENVIA'?'ENVÍA':quote.carrier),
   field('Recorrido',(snapshot.origin||'—')+' → '+(snapshot.destination||'—')),
   field('Estado',quote.status==='DRAFT'?'Borrador':quote.status==='CALCULATED'?'Calculada':quote.status),
   field('Cotización estimada',estimate.available?money(estimate.totalCop):money(ref.subtotalCop??ref.totalCop)),
   field('Valor cobrado',money(quote.actual_cost_cop)),
   field('Pedido vinculado',quote.order_number||'Sin vincular'));
  const delta=estimate.available&&quote.actual_cost_cop!=null?Number(quote.actual_cost_cop)-Number(estimate.totalCop):null;
  if(delta!=null)details.append(field('Desviación',money(delta)));
  const materials=Array.isArray(quote.input?.materials)?quote.input.materials:[];
  const breakdown=dialog.querySelector('[data-sheet-breakdown]');
  breakdown.replaceChildren(field('Fuente',estimate.source||'Sin referencia'),
   field('Flete base',money(estimate.baseCop)),field('Componente variable',money(estimate.variableCop)),
   field('Rango mínimo',money(estimate.rangeLowCop)),field('Rango máximo',money(estimate.rangeHighCop)),
   field('Mercancía',materials.length?materials.map(m=>(m.description||'Material')+' ('+(m.weightKg??'—')+' kg; '+(m.volumeM3??'—')+' m³)').join(' · '):'Sin detalle de materiales'));
  dialog.querySelector('[data-sheet-link]').disabled=!canLink();
  status.textContent='';if(!dialog.open)dialog.showModal();
  dialog.querySelector('[data-sheet-close]').focus();
 }
 function showLink(quote,initiator){
  if(!canLink())return;
  current=quote;lastFocus=initiator||document.activeElement;
  linkDialog.querySelector('.freight-link-form').reset();
  linkDialog.querySelector('[data-link-error]').textContent='';
  if(!linkDialog.open)linkDialog.showModal();
  linkDialog.querySelector('[name=orderNumber]').focus();
 }
 dialog.querySelector('[data-sheet-copy]').onclick=async()=>{
  if(!current)return;
  try{await navigator.clipboard.writeText('CF-'+current.folio);status.textContent='Folio copiado.';}
  catch{status.textContent='No se pudo copiar el folio.';}
 };
 dialog.querySelector('[data-sheet-duplicate]').onclick=()=>{const q=current;closeDetails();if(q)duplicate(q);};
 dialog.querySelector('[data-sheet-link]').onclick=()=>{const q=current;closeDetails();if(q)showLink(q,lastFocus);};
 linkDialog.querySelector('form').onsubmit=async event=>{
  event.preventDefault();
  if(pending||!current||!canLink())return;
  const number=linkDialog.querySelector('[name=orderNumber]').value.trim();
  if(!number)return;
  pending=true;
  const submit=linkDialog.querySelector('[data-link-submit]');
  submit.disabled=true;submit.textContent='Vinculando…';
  try{await link(current.id,number);linkDialog.close();notice('Vínculo guardado. El pedido conserva sus datos.');}
  catch(error){linkDialog.querySelector('[data-link-error]').textContent=error.message||'No se pudo vincular.';}
  finally{pending=false;submit.disabled=false;submit.textContent='Confirmar vínculo';}
 };
 return {showDetails,showLink};
}
