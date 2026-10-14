import {fmt} from '../../../core/format.js';
import {LOCAL_DISPATCH_TARIFFS,normalizeDestination,tariffFor,currencyCOP} from './tariffs.js';

const zoneLabels={
 TULUA_CERCANAS:'Tuluá y poblaciones cercanas',
 NORTE_VALLE_IBARRA:'Ruta norte del Valle',
 SUR_VALLE_IBARRA:'Ruta sur del Valle'
};

export function localRoutePickerHtml(current='',field='cityDestination',prefix='local-route'){
 const selected=tariffFor(current);
 return `<div class="local-route-picker" data-local-route-picker>
  <div class="local-route-picker-title"><label id="${fmt.escape(prefix)}-title">Destino tarifario *</label><small>Busca por municipio, corregimiento o ruta.</small></div>
  <button type="button" class="local-route-trigger" data-local-route-trigger aria-expanded="false" aria-haspopup="dialog" aria-controls="${fmt.escape(prefix)}-menu" aria-labelledby="${fmt.escape(prefix)}-title ${fmt.escape(prefix)}-selected">
   <span class="local-route-trigger-icon" aria-hidden="true">⌕</span><span id="${fmt.escape(prefix)}-selected" data-local-route-selected>${fmt.escape(selected?.code||'Buscar y seleccionar destino')}</span><strong data-local-route-rate>${selected?currencyCOP(selected.base):''}</strong><span aria-hidden="true">⌄</span>
  </button>
  <select class="local-route-native" name="${fmt.escape(field)}" aria-label="${field==='localDestinationCode'?'Destino de transporte local':'Destino tarifario'}" tabindex="-1" required>
   <option value="">Selecciona destino</option>
   ${LOCAL_DISPATCH_TARIFFS.map(row=>`<option value="${fmt.escape(row.code)}" ${selected?.code===row.code?'selected':''}>${fmt.escape(row.code)}</option>`).join('')}
  </select>
  <div id="${fmt.escape(prefix)}-menu" class="local-route-menu" data-local-route-menu role="dialog" aria-label="Seleccionar destino tarifario" hidden>
   <label for="${fmt.escape(prefix)}-query">Buscar destino</label>
   <input id="${fmt.escape(prefix)}-query" class="control" data-local-route-query type="search" autocomplete="off" placeholder="Escribe el municipio o la zona…">
   <div class="local-route-results" data-local-route-results></div>
  </div>
 </div>`;
}
export function bindLocalRoutePicker(root){
 const picker=root.querySelector('[data-local-route-picker]');
 if(!picker)return;
 const trigger=picker.querySelector('[data-local-route-trigger]');
 const menu=picker.querySelector('[data-local-route-menu]');
 const input=picker.querySelector('[data-local-route-query]');
 const results=picker.querySelector('[data-local-route-results]');
 const select=picker.querySelector('.local-route-native');
 const label=picker.querySelector('[data-local-route-selected]');
 const price=picker.querySelector('[data-local-route-rate]');
 const setLabel=()=>{
  const row=tariffFor(select.value);
  label.textContent=row?.code||'Buscar y seleccionar destino';
  price.textContent=row?currencyCOP(row.base):'';
 };
 const render=()=>{
  const term=normalizeDestination(input.value);
  const visible=LOCAL_DISPATCH_TARIFFS.filter(row=>normalizeDestination(row.code+' '+row.category).includes(term));
  const groups=new Map();
  visible.forEach(row=>{if(!groups.has(row.zone))groups.set(row.zone,[]);groups.get(row.zone).push(row)});
  results.innerHTML=visible.length?[...groups].map(([zone,rows])=>
   `<section class="local-route-group"><h6>${fmt.escape(zoneLabels[zone]||zone)} <span>${rows.length}</span></h6>${rows.map(row=>
    `<button type="button" class="local-route-item" data-local-route-choice="${fmt.escape(row.code)}" aria-current="${select.value===row.code?'true':'false'}"><span>${fmt.escape(row.code)}</span><strong>${currencyCOP(row.base)}</strong></button>`).join('')}</section>`).join('')
   :'<p class="local-route-empty">No encontramos ese destino en las 54 rutas. Prueba otro nombre.</p>';
 };
 const toggle=open=>{
  menu.hidden=!open;
  trigger.setAttribute('aria-expanded',String(open));
  if(open){input.value='';render();input.focus();}
 };
 trigger.addEventListener('click',()=>toggle(menu.hidden));
 results.addEventListener('click',event=>{
  const item=event.target.closest('[data-local-route-choice]');
  if(!item)return;
  select.value=item.dataset.localRouteChoice;
  setLabel();toggle(false);
  select.dispatchEvent(new Event('input',{bubbles:true}));
  trigger.focus();
 });
 input.addEventListener('input',render);
 picker.addEventListener('keydown',event=>{
  if(event.key==='Escape'&&!menu.hidden){event.preventDefault();toggle(false);trigger.focus();return;}
  if(menu.hidden)return;
  const options=[...results.querySelectorAll('[data-local-route-choice]')];
  if(event.key==='ArrowDown'||event.key==='ArrowUp'){
   event.preventDefault();
   const index=options.indexOf(document.activeElement);
   const next=event.key==='ArrowDown'?Math.min(index+1,options.length-1):Math.max(index-1,0);
   (options[next]||input).focus();
  }
 });
 root.addEventListener('pointerdown',event=>{if(!menu.hidden&&!picker.contains(event.target))toggle(false)});
 setLabel();
 return {select,sync:setLabel,close:()=>toggle(false)};
}
