import {fmt} from '../../../core/format.js';
import {LOCAL_DISPATCH_TARIFFS,normalizeDestination,tariffFor,currencyCOP} from './tariffs.js';

// Categories come from the same canonical 54-route matrix as the destination prices.
export const LOCAL_ROUTE_CATEGORIES=Object.freeze([...new Map(
 LOCAL_DISPATCH_TARIFFS.map(row=>[row.zone,{code:row.zone,name:row.category}])
).values()]);
const routesIn=zone=>LOCAL_DISPATCH_TARIFFS.filter(row=>row.zone===zone);

export function localRoutePickerHtml(current='',field='cityDestination',prefix='local-route'){
 const selected=tariffFor(current),zone=selected?.zone||'';
 const key=fmt.escape(prefix),isQuote=field==='localDestinationCode';
 return `<div class="local-route-picker" data-local-route-picker>
  <div class="local-route-cascade">
   <div class="local-route-category-field">
    <label for="${key}-category">1. Categoría de ruta *</label>
    <select class="control local-route-category" id="${key}-category" data-local-route-category required ${isQuote?'disabled':''}>
     <option value="">Selecciona una categoría</option>
     ${LOCAL_ROUTE_CATEGORIES.map(item=>`<option value="${fmt.escape(item.code)}" ${item.code===zone?'selected':''}>${fmt.escape(item.name)}</option>`).join('')}
    </select>
    <small>Primero define la zona de transporte.</small>
   </div>
   <div class="local-route-destination-field">
    <label id="${key}-title">2. Destino tarifario *</label>
    <button type="button" class="local-route-trigger" data-local-route-trigger aria-expanded="false" aria-haspopup="dialog" aria-controls="${key}-menu" aria-labelledby="${key}-title ${key}-selected" ${!zone||isQuote?'disabled':''}>
     <span class="local-route-trigger-icon" aria-hidden="true">⌕</span>
     <span id="${key}-selected" data-local-route-selected>${fmt.escape(selected?.code||'Selecciona primero la categoría')}</span>
     <strong data-local-route-rate>${selected?currencyCOP(selected.base):''}</strong><span aria-hidden="true">⌄</span>
    </button>
    <select class="local-route-native" name="${fmt.escape(field)}" aria-label="${isQuote?'Destino de transporte local':'Destino tarifario'}" tabindex="-1" required ${isQuote?'disabled':''}>
     <option value="">Selecciona el destino</option>
     ${routesIn(zone).map(row=>`<option value="${fmt.escape(row.code)}" ${row.code===selected?.code?'selected':''}>${fmt.escape(row.code)}</option>`).join('')}
    </select>
    <div id="${key}-menu" class="local-route-menu" data-local-route-menu role="dialog" aria-label="Seleccionar destino de la categoría" hidden>
     <label for="${key}-query">Buscar destino de esta categoría</label>
     <input id="${key}-query" class="control" data-local-route-query type="search" autocomplete="off" placeholder="Escribe el destino…">
     <div class="local-route-results" data-local-route-results></div>
    </div>
   </div>
  </div>
  <p class="local-route-feedback" data-local-route-feedback aria-live="polite">${zone?routesIn(zone).length+' destinos disponibles en esta categoría.':'Selecciona una categoría para habilitar los destinos.'}</p>
 </div>`;
}

export function bindLocalRoutePicker(root){
 const picker=root.querySelector('[data-local-route-picker]');
 if(!picker)return;
 const category=picker.querySelector('[data-local-route-category]');
 const select=picker.querySelector('.local-route-native');
 const trigger=picker.querySelector('[data-local-route-trigger]');
 const menu=picker.querySelector('[data-local-route-menu]');
 const input=picker.querySelector('[data-local-route-query]');
 const results=picker.querySelector('[data-local-route-results]');
 const label=picker.querySelector('[data-local-route-selected]');
 const price=picker.querySelector('[data-local-route-rate]');
 const feedback=picker.querySelector('[data-local-route-feedback]');
 let enabled=select.name!=='localDestinationCode';
 const available=()=>routesIn(category.value);
 const populate=(selectedCode='')=>{
  const rows=available();
  select.innerHTML='<option value="">Selecciona el destino</option>'+rows.map(row=>
   `<option value="${fmt.escape(row.code)}">${fmt.escape(row.code)}</option>`).join('');
  select.value=rows.some(row=>row.code===selectedCode)?selectedCode:'';
 };
 const updateUI=()=>{
  const route=available().find(row=>row.code===select.value);
  label.textContent=route?.code||(category.value?'Busca y selecciona un destino':'Selecciona primero la categoría');
  price.textContent=route?currencyCOP(route.base):'';
  trigger.disabled=!enabled||!category.value;
  feedback.textContent=category.value?`${available().length} destinos disponibles · ${route?'Tarifa base '+currencyCOP(route.base):'elige el lugar de entrega'}`:'Selecciona una categoría para habilitar los destinos.';
 };
 const render=()=>{
  const term=normalizeDestination(input.value);
  const rows=available().filter(row=>normalizeDestination(row.code).includes(term));
  results.innerHTML=rows.length?rows.map(row=>
   `<button type="button" class="local-route-item" data-local-route-choice="${fmt.escape(row.code)}" aria-current="${select.value===row.code?'true':'false'}"><span>${fmt.escape(row.code)}</span><strong>${currencyCOP(row.base)}</strong></button>`).join('')
   :'<p class="local-route-empty">No hay destinos que coincidan en esta categoría.</p>';
 };
 const toggle=open=>{
  menu.hidden=!open;trigger.setAttribute('aria-expanded',String(open));
  if(open){input.value='';render();input.focus();}
 };
 const setValue=value=>{
  const route=tariffFor(value);
  category.value=route?.zone||'';populate(route?.code||'');updateUI();toggle(false);
 };
 const setEnabled=active=>{
  enabled=Boolean(active);category.disabled=!enabled;select.disabled=!enabled;
  updateUI();if(!enabled)toggle(false);
 };
 category.addEventListener('change',()=>{
  populate();updateUI();toggle(false);
  select.dispatchEvent(new Event('input',{bubbles:true}));
  select.dispatchEvent(new Event('change',{bubbles:true}));
 });
 trigger.addEventListener('click',()=>{if(!trigger.disabled)toggle(menu.hidden);});
 results.addEventListener('click',event=>{
  const item=event.target.closest('[data-local-route-choice]');
  if(!item)return;
  select.value=item.dataset.localRouteChoice;updateUI();toggle(false);
  select.dispatchEvent(new Event('input',{bubbles:true}));trigger.focus();
 });
 input.addEventListener('input',render);
 picker.addEventListener('keydown',event=>{
  if(event.key==='Escape'&&!menu.hidden){event.preventDefault();toggle(false);trigger.focus();return;}
  if(menu.hidden)return;
  const options=[...results.querySelectorAll('[data-local-route-choice]')];
  if(event.key==='ArrowDown'||event.key==='ArrowUp'){
   event.preventDefault();
   const index=options.indexOf(document.activeElement);
   (options[event.key==='ArrowDown'?Math.min(index+1,options.length-1):Math.max(index-1,0)]||input).focus();
  }
 });
 root.addEventListener('pointerdown',event=>{if(!menu.hidden&&!picker.contains(event.target))toggle(false);});
 updateUI();return {select,sync:()=>setValue(select.value),setValue,setEnabled,close:()=>toggle(false)};
}
