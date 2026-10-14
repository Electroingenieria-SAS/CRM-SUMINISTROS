import {fmt} from '../../core/format.js';
import {currencyCOP} from '../logistics/local-dispatch/tariffs.js';

export function localFreightCardHtml(snapshot){
 const esc=fmt.escape;
 const e=snapshot.commercialEstimate||{},ref=snapshot.reference||{};
 const available=e.available===true&&Number(e.totalCop)>0;
 const reason=ref.reason==='PESO_FUERA_DE_RANGO'
  ?'La matriz solo cubre de 0 a 2.500 kg. Consulta una liquidación especial.'
  :'Indica el peso real de todos los materiales para calcular el flete local.';
 const extras=snapshot.localExtras||{};
 return '<section class="freight-panel freight-local-card" data-carrier-reference="LOCAL">'+
  '<div class="freight-carrier-heading"><span class="freight-company-symbol" aria-hidden="true">L</span>'+
  '<div class="freight-company-name"><small>ENTREGAS Y DOMICILIOS</small><h2>Transporte local</h2></div>'+
  '<span class="freight-company-meta">MATRIZ INTERNA</span></div>'+
  '<p class="freight-carrier-route">TULUÁ → '+esc(snapshot.destination||'Selecciona una ruta')+'</p>'+
  (available?'<div class="freight-price-hero"><span class="freight-price-eyebrow">PRECIO DEL FLETE · COP</span>'+
    '<strong>'+currencyCOP(e.totalCop)+'</strong><small>Tarifa fija según ruta y peso declarado</small>'+
    '<div class="freight-market-breakdown"><span>Tarifa base<b>'+currencyCOP(ref.baseCop)+'</b></span>'+
    '<span>Kilos adicionales<b>'+fmt.number(Number(ref.extraKg||0))+' kg · '+currencyCOP(Number(ref.extraKg||0)*Number(ref.extraPerKgCop||0))+'</b></span>'+
    '<span>Auxiliar / descargue<b>'+currencyCOP(extras.unloadingCop||0)+'</b></span>'+
    '<span>Desvío urgente<b>'+currencyCOP(extras.diversionCop||0)+'</b></span></div>'+
   '</div>':'<div class="freight-price-unavailable"><strong>Sin liquidación disponible</strong><p>'+esc(reason)+'</p></div>')+
  '<p class="freight-local-card-note">Tarifas de la matriz interna aportada (Luis Ibarra). Costos adicionales identificados por separado. No es una tarifa contractual externa.</p>'+
  (extras.reason?'<p class="freight-local-card-note">Justificación: '+esc(extras.reason)+'</p>':'')+
  '</section>';
}
