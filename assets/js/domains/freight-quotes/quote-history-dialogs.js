import {fmt} from '../../core/format.js';
const esc=fmt.escape;
const money=value=>value==null||!Number.isFinite(Number(value))?'—':fmt.money(value);
const focusables='button:not([disabled]),input:not([disabled]),select:not([disabled]),a[href],[tabindex]:not([tabindex="-1"])';
function quoteDetail(q){
 const input=q.input||{},snapshot=q.snapshot||{},estimate=snapshot.commercialEstimate||{};
 const estimated=estimate.available?estimate.totalCop:(snapshot.reference?.subtotalCop??snapshot.reference?.totalCop);
 const actual=q.actual_cost_cop,delta=actual!=null&&estimated!=null?Number(actual)-Number(estimated):null;
 const materials=(input.materials||[]).map(item=>
  '<li><strong>'+esc(item.description||'Material')+'</strong> · '+esc(item.weightKg??'—')+' kg · '+esc(item.volumeM3??'—')+' m³</li>').join('');
 return '<div class="freight-detail-route">'+esc(snapshot.origin||input.origin||'—')+' <span aria-hidden="true">→</span> '+esc(snapshot.destination||input.destinationKey||'—')+'</div>'+
  '<dl class="freight-detail-data"><div><dt>Transportadora</dt><dd>'+esc(q.carrier==='ENVIA'?'ENVÍA':q.carrier||'—')+'</dd></div>'+
  '<div><dt>Estado</dt><dd>'+esc(q.status||'—')+'</dd></div>'+
  '<div><dt>Estimado</dt><dd>'+money(estimated)+'</dd></div>'+
  '<div><dt>Valor cobrado</dt><dd>'+money(actual)+'</dd></div>'+
  (delta!=null?'<div><dt>Desviación</dt><dd>'+money(delta)+'</dd></div>':'')+
  '<div><dt>Pedido vinculado</dt><dd>'+esc(q.order_number||'Sin vincular')+'</dd></div></dl>'+
  '<h3>Mercancía registrada</h3><ul class="freight-detail-materials">'+(materials||'<li>Sin materiales registrados.</li>')+'</ul>'+
  '<details class="freight-detail-support"><summary>Referencia y trazabilidad</summary>'+
  '<p>'+esc(snapshot.tariffVersion||'Sin versión documentada')+'</p>'+
  '<p>'+esc(snapshot.warning||'La estimación no sustituye la cotización oficial.')+'</p></details>';
}
export function createFreightHistoryDialogs(root,{onDuplicate,onLink,canLink=true}){
 const host=root.querySelector('[data-history-dialog-host]');
 let previous=null,closeKey=null,scroll='',open=false,observer=null;
 const close=()=>{
  if(!open)return;open=false;
  document.removeEventListener('keydown',closeKey,true);closeKey=null;
  observer?.disconnect();observer=null;
  host.replaceChildren();document.body.style.overflow=scroll;
  if(previous?.isConnected)previous.focus();previous=null;
 };
 const present=(markup,firstSelector)=>{
  close();previous=document.activeElement;scroll=document.body.style.overflow;
  host.innerHTML=markup;open=true;document.body.style.overflow='hidden';
  observer=new MutationObserver(()=>{if(!host.isConnected)close();});observer.observe(root,{childList:true});
  const dialog=host.querySelector('[role="dialog"]');
  host.querySelectorAll('[data-close-dialog]').forEach(b=>b.addEventListener('click',close));
  host.querySelector('[data-dialog-scrim]')?.addEventListener('click',close);
  closeKey=e=>{
   if(e.key==='Escape'){e.preventDefault();close();return;}
   if(e.key!=='Tab')return;
   const nodes=[...dialog.querySelectorAll(focusables)].filter(n=>n.getClientRects().length);
   if(!nodes.length){e.preventDefault();return;}
   const first=nodes[0],last=nodes.at(-1);
   if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}
   if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
  };
  document.addEventListener('keydown',closeKey,true);
  (dialog.querySelector(firstSelector)||dialog.querySelector('button')||dialog).focus();
  return dialog;
 };
 const shell=(content,type='sheet')=>
  '<div class="freight-dialog-layer"><div class="freight-dialog-scrim" data-dialog-scrim></div>'+
  '<div class="freight-dialog-'+type+'" role="dialog" aria-modal="true" aria-labelledby="freight-dialog-title" tabindex="-1">'+content+'</div></div>';
 const openDetail=q=>{
  const folio='CF-'+q.folio;
  const dialog=present(shell(
   '<header class="freight-dialog-head"><div><span class="freight-overline">COTIZACIÓN REGISTRADA</span><h2 id="freight-dialog-title">'+esc(folio)+'</h2></div><button type="button" class="btn" data-close-dialog aria-label="Cerrar detalle">Cerrar</button></header>'+
   '<div class="freight-dialog-body">'+quoteDetail(q)+'</div>'+
   '<footer class="freight-dialog-actions"><button type="button" class="btn" data-detail-copy>Copiar folio</button>'+
   '<button type="button" class="btn" data-detail-duplicate>Duplicar</button>'+
   '<button type="button" class="btn" data-detail-link '+(canLink?'':'disabled')+'>Vincular pedido</button></footer><p role="status" data-detail-notice></p>'
  ),'[data-close-dialog]');
  dialog.querySelector('[data-detail-copy]').onclick=async()=>{
   const status=dialog.querySelector('[data-detail-notice]');
   try{await navigator.clipboard.writeText(folio);status.textContent='Folio copiado al portapapeles.';}
   catch{status.textContent='No se pudo copiar. Selecciona el folio del encabezado.';}
  };
  dialog.querySelector('[data-detail-duplicate]').onclick=()=>{close();onDuplicate(q);};
  dialog.querySelector('[data-detail-link]').onclick=()=>{if(!dialog.querySelector('[data-detail-link]').disabled)openLink(q);};
 };
 const openLink=q=>{
  const dialog=present(shell(
   '<header class="freight-dialog-head"><div><span class="freight-overline">VINCULACIÓN CONTROLADA</span><h2 id="freight-dialog-title">Vincular pedido a CF-'+esc(q.folio)+'</h2></div><button type="button" class="btn" data-close-dialog>Cerrar</button></header>'+
   '<form data-history-link-form class="freight-link-form"><p>Indica el número exacto del pedido. Esta acción no modifica los datos del pedido.</p>'+
   '<label>Número de pedido<input class="control" name="orderNumber" maxlength="60" required autocomplete="off" placeholder="Ej. PED-1024"></label>'+
   '<p role="alert" data-link-message></p><div class="freight-dialog-actions"><button class="btn" type="button" data-close-dialog>Cancelar</button>'+
   '<button class="btn btn-primary" type="submit" data-link-submit>Confirmar vínculo</button></div></form>'
  ,'modal'),'input[name="orderNumber"]');
  const form=dialog.querySelector('[data-history-link-form]'),message=dialog.querySelector('[data-link-message]');
  form.onsubmit=async event=>{
   event.preventDefault();if(!form.reportValidity())return;
   const value=form.elements.orderNumber.value.trim();
   if(!value){message.textContent='Escribe un número de pedido válido.';return;}
   const save=dialog.querySelector('[data-link-submit]');save.disabled=true;save.textContent='Vinculando…';message.textContent='';
   try{await onLink(q,value);close();}
   catch(error){message.textContent=error.message||'No se pudo vincular el pedido.';}
   finally{save.disabled=false;save.textContent='Confirmar vínculo';}
  };
 };
 return {openDetail,openLink,close};
}
