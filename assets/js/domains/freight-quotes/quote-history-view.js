import {fmt} from '../../core/format.js';
const escape=fmt.escape;
const statuses=Object.freeze({DRAFT:'Borrador',CALCULATED:'Calculada',EXPIRED:'Vencida'});
const number=new Intl.NumberFormat('es-CO',{maximumFractionDigits:0});
const money=value=>value==null||value===''||!Number.isFinite(Number(value))?'—':fmt.money(value);
const normalized=value=>String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
const calendarDate=value=>{
 const parsed=value?new Date(value):null;
 return parsed&&!Number.isNaN(parsed.getTime())?parsed:null;
};
const centralValue=q=>{
 const snapshot=q.snapshot||{},commercial=snapshot.commercialEstimate||{};
 return commercial.available?Number(commercial.totalCop):(snapshot.reference?.subtotalCop??snapshot.reference?.totalCop??null);
};
export function filterHistoryItems(items,{search='',carrier='',status='',sort='newest'}={}){
 const term=normalized(search);
 const filtered=(items||[]).filter(item=>
   (!carrier||item.carrier===carrier)&&(!status||item.status===status)&&
   (!term||normalized([item.folio,item.carrier,item.snapshot?.origin,item.snapshot?.destination,item.order_number,statuses[item.status]].join(' ')).includes(term))
 );
 return [...filtered].sort((a,b)=>{
  const dateA=calendarDate(a.created_at)?.getTime()||0,dateB=calendarDate(b.created_at)?.getTime()||0;
  if(sort==='oldest')return dateA-dateB||String(a.id).localeCompare(String(b.id));
  if(sort==='highest'||sort==='lowest'){
   const amountA=centralValue(a),amountB=centralValue(b);
   if(amountA==null&&amountB!=null)return 1;
   if(amountB==null&&amountA!=null)return -1;
   return (sort==='highest'?(amountB-amountA):(amountA-amountB))||dateB-dateA;
  }
  return dateB-dateA||String(a.id).localeCompare(String(b.id));
 });
}
export function historySummary(items){
 const priced=items.filter(q=>centralValue(q)!=null);
 const withActual=items.filter(q=>q.actual_cost_cop!=null);
 return {count:items.length,priced:priced.length,withActual:withActual.length};
}
export function historyExportRows(items){
 return [
  ['Folio','Fecha','Estado','Transportadora','Origen','Destino','Pedido','Estimado COP','Valor real COP','Desviación COP'],
  ...items.map(q=>{
   const estimated=centralValue(q),actual=q.actual_cost_cop;
   return ['CF-'+q.folio,calendarDate(q.created_at)?.toISOString()||'',statuses[q.status]||q.status||'',q.carrier||'',q.snapshot?.origin||'',q.snapshot?.destination||'',q.order_number||'',
    estimated==null?'':String(estimated),actual==null?'':String(actual),estimated!=null&&actual!=null?String(Number(actual)-estimated):''];
  })
 ];
}
export function historyCsv(items){
 // Quote every field, protecting spreadsheet programs from CSV formula injection.
 return '\uFEFF'+historyExportRows(items).map(row=>row.map(value=>{
  let cell=String(value??'');
  if(/^[\s]*[=+\-@\t\r]/.test(cell))cell="'"+cell;
  return '"'+cell.replace(/"/g,'""')+'"';
 }).join(';')).join('\r\n');
}
export function quoteHistoryHtml(items,{filtered=false}={}){
 if(!items.length)return '<div class="freight-history-empty" role="status"><span class="freight-empty-symbol" aria-hidden="true">◎</span><strong>'+
   (filtered?'Sin resultados para estos filtros':'Tu historial comienza aquí')+'</strong><p>'+
   (filtered?'Prueba otros criterios o limpia los filtros de esta página.':'Cuando guardes una cotización, podrás consultarla y utilizarla nuevamente desde esta sección.')+'</p></div>';
 const rows=items.map(q=>{
  const snapshot=q.snapshot||{},estimated=centralValue(q),actual=q.actual_cost_cop;
  const deviation=actual!=null&&estimated!=null?Number(actual)-Number(estimated):null;
  const date=calendarDate(q.created_at),formatted=date?date.toLocaleDateString('es-CO',{day:'2-digit',month:'short',year:'numeric'}):'Sin fecha';
  const label=q.carrier==='ENVIA'?'ENVÍA':q.carrier==='TCC'?'TCC':'Sin operador';
  const folio='CF-'+q.folio,route=(snapshot.origin||'—')+' → '+(snapshot.destination||'—');
  const notes=q.order_number?'Pedido '+q.order_number:'Sin pedido vinculado';
  return '<tr data-history-carrier="'+escape(q.carrier||'')+'">'+
   '<td data-label="Cotización"><div class="freight-history-identity"><strong>'+escape(folio)+'</strong><small>'+escape(formatted)+'</small></div></td>'+
   '<td data-label="Recorrido"><strong class="freight-history-route">'+escape(route)+'</strong><small class="freight-history-order">'+escape(notes)+'</small></td>'+
   '<td data-label="Transportadora"><span class="freight-history-carrier" data-carrier="'+escape(q.carrier||'')+'">'+escape(label)+'</span></td>'+
   '<td data-label="Estado"><span class="freight-history-status" data-quote-status="'+escape(q.status||'')+'">'+escape(statuses[q.status]||q.status||'—')+'</span></td>'+
   '<td data-label="Estimado"><strong class="freight-history-price">'+money(estimated)+'</strong></td>'+
   '<td data-label="Valor real"><strong class="freight-history-price">'+money(actual)+'</strong>'+(deviation!=null?'<small class="freight-history-delta" data-direction="'+(deviation>0?'up':deviation<0?'down':'equal')+'">Dif. '+(deviation>0?'+':'')+money(deviation)+'</small>':'')+'</td>'+
   '<td data-label="Acciones"><div class="freight-history-buttons"><button type="button" class="btn freight-history-view" data-quote-view="'+escape(q.id)+'">Ver</button><button type="button" class="btn" data-quote-duplicate="'+escape(q.id)+'">Duplicar</button><button type="button" class="btn" data-quote-link="'+escape(q.id)+'">Vincular pedido</button></div></td></tr>';
 }).join('');
 return '<div class="freight-history-table-scroll"><table class="freight-history-table"><caption class="freight-sr-only">Cotizaciones guardadas en la página actual</caption><thead><tr><th scope="col">Cotización</th><th scope="col">Recorrido</th><th scope="col">Empresa</th><th scope="col">Estado</th><th scope="col">Estimado</th><th scope="col">Valor real</th><th scope="col">Acciones</th></tr></thead><tbody>'+rows+'</tbody></table></div>';
}
