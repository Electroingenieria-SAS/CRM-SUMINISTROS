import {fmt} from '../../core/format.js';
const esc=fmt.escape;
const labels={
 TCC_2024_IPC_2026:'Estimación con tarifas TCC actualizadas a 2026',
 TCC_REAL_GUIDE_MODEL:'Estimación con historial de TCC',
 ENVIA_REAL_GUIDE_MODEL:'Estimación con historial de ENVÍA',
 ENVIA_REFERENCE:'Estimación con referencias de ENVÍA'
};
function commercialHtml(snapshot){
 const estimate=snapshot.commercialEstimate||{};
 if(!estimate.available)return '<div class="freight-price-unavailable"><span class="freight-unavailable-symbol" aria-hidden="true">!</span><div><strong>Estimación todavía no disponible</strong><p>Faltan referencias suficientes para este recorrido. Puedes consultar el detalle de la tarifa original.</p></div></div>';
 const hasRange=estimate.statisticalRange&&estimate.rangeLowCop!=null&&estimate.rangeHighCop!=null;
 const numbers=hasRange?
   '<strong>'+fmt.money(estimate.rangeLowCop)+' – '+fmt.money(estimate.rangeHighCop)+'</strong>':
   '<strong>≈ '+fmt.money(estimate.totalCop)+'</strong>';
 const breakdown=estimate.baseCop!=null?'<div class="freight-market-breakdown"><span>Flete base estimado <b>'+fmt.money(estimate.baseCop)+'</b></span><span>Componente variable / manejo <b>'+fmt.money(estimate.variableCop||0)+'</b></span><span>Total central <b>'+fmt.money(estimate.totalCop)+'</b></span></div>':
   '<p class="freight-market-warning">El histórico permite estimar un total, pero no desglosar el flete base y los recargos sin inventar valores.</p>';
 return '<div class="freight-price-hero" data-carrier-price="'+esc(snapshot.carrier)+'">'+
   (snapshot.cheapestCommercial?'<span class="freight-cheaper-label">Menor estimación orientativa</span>':'')+
   '<div class="freight-price-eyebrow">RANGO ESTIMADO DEL FLETE · '+(esc(snapshot.carrier==='ENVIA'?'ENVÍA':'TCC'))+' <button type="button" class="freight-help-button" aria-label="¿Qué significa precio estimado?" data-freight-help="Es un valor orientativo basado en referencias disponibles. El precio final lo confirma la transportadora.">?</button></div>'+
   numbers+
   '<p class="freight-price-central">Valor central estimado: <b>'+fmt.money(estimate.totalCop)+'</b> COP</p>'+
   breakdown+
   '<p class="freight-market-source">'+esc(labels[estimate.source]||'Estimación interna')+'</p>'+
   '<small>Valor estimado, no tarifa oficial.</small>'+
   '</div>';
}
export function measurementCardHtml(snapshot){
 const envia=snapshot.carrier==='ENVIA',scenarios=snapshot.measurementScenarios;
 const cards=[['weight','WEIGHT','Por peso','kg'],['volume','VOLUME','Por volumen','m³']].map(([key,basis,title,unit])=>{
  const ref=scenarios[key],available=['HISTORICAL_REFERENCE','ESTIMATED_REFERENCE'].includes(ref.status),total=ref.subtotalCop??ref.totalCop;
  return '<article class="freight-scenario" data-measurement-basis="'+basis+'" data-greater="'+(snapshot.selectedBasis===basis)+'">'+
   '<h3>'+title+'</h3>'+
   (available?'<p>'+fmt.number(ref.amount,4)+' '+unit+' registrados</p><strong>'+fmt.money(total)+'</strong><p>Referencia original · Base: '+fmt.money(ref.baseCop)+(envia?' · Variable: '+fmt.money(ref.variableCop):' · Manejo: '+fmt.money(ref.handlingCop))+'</p>'+
    (basis==='VOLUME'?'<small>'+fmt.number(ref.conversionFactor,0)+' kg/m³ → '+fmt.number(ref.billableKg,3)+' kg equivalentes'+(envia?' · factor no confirmado para mercancía terrestre':'')+'</small>':''):
    '<p>'+(ref.reason==='ORIGIN_ROUTE_UNAVAILABLE'?'Sin tarifa documental TCC para este origen. Consulta el rango histórico superior si está disponible.':ref.reason==='RATE_UNAVAILABLE'||ref.reason==='ROUTE_UNDOCUMENTED'?'Tarifa documental de la ruta no disponible.':'Ingresa esta medida para compararla.')+'</p>')+
   (ref.warnings?.includes('EXTRAPOLATED_OVER_100_KG')?'<p>Estimación extrapolada: más de 100 kg, linealidad no confirmada.</p>':'')+
   '<small>'+esc(ref.measuredMaterials)+' de '+esc(ref.totalMaterials)+' materiales con esta medida.'+(!ref.complete&&available?' Resultado parcial, no cubre el envío completo.':'')+'</small></article>';
 }).join('');
 const bothComplete=scenarios.weight.complete&&scenarios.volume.complete;
 const basis=snapshot.selectedBasis==='VOLUME'?'volumen':'peso';
 return '<section class="freight-panel" data-carrier-reference="'+esc(snapshot.carrier)+'"><div class="freight-carrier-heading"><span class="freight-company-symbol" aria-hidden="true">'+(envia?'E':'T')+'</span><div class="freight-company-name"><small>TRANSPORTADORA</small><h2>'+esc(envia?'ENVÍA':'TCC')+'</h2></div><span class="freight-company-meta">'+(envia?'ENVÍOS NACIONALES':'TRANSPORTE NACIONAL')+'</span></div><p class="freight-carrier-route"><span aria-hidden="true">↗</span> '+esc(snapshot.origin)+' <span aria-hidden="true">→</span> '+esc(snapshot.destination)+'</p>'+
  commercialHtml(snapshot)+
  '<details class="freight-original-reference"><summary>Consultar referencia original y cálculo por medidas</summary><div class="freight-scenarios">'+cards+'</div><p>'+(snapshot.selectedBasis?(bothComplete?'Base de mayor cobro':'Base disponible')+': '+basis+'.':'Completa la medida de todos los materiales para guardar.')+'</p><small>'+esc(snapshot.measurementWarning)+'</small><p>'+esc(snapshot.warning)+'</p><small>Fuente: '+esc(snapshot.tariffVersion)+'. La tarifa original se conserva sin cambios.</small>'+
  (snapshot.commercialEstimate?.source==='TCC_2024_IPC_2026'?'<small>Estimación actualizada con IPC DANE hasta septiembre de 2026, no equivale a una tarifa vigente de TCC.</small>':'')+'</details></section>';
}
