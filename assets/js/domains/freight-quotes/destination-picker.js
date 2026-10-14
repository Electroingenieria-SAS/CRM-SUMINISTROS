// One accessible, searchable city field backed by the existing destinationKey contract.
export function setupFreightDestinationPicker(form,{onSelected=()=>{}}={}){
 const input=form.querySelector('[data-destination-search]');
 const select=form.elements.destinationKey;
 const list=form.querySelector('[data-destination-options]');
 const feedback=form.querySelector('[data-destination-feedback]');
 const normalize=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
 let rows=[],opened=false,activeIndex=-1,displayed=[];
 const label=row=>row.name+' · C.O. '+row.center;
 const selectedRow=()=>rows.find(row=>row.key===select.value);
 function close(){
  opened=false;list.hidden=true;input.setAttribute('aria-expanded','false');
  input.removeAttribute('aria-activedescendant');activeIndex=-1;
 }
 function sync(){
  const chosen=selectedRow();
  input.value=chosen?label(chosen):'';
  input.setCustomValidity(chosen?'':'Selecciona un municipio válido de la lista.');
  feedback.textContent=chosen?'Destino seleccionado · '+chosen.name:rows.length+' destinos disponibles. Escribe para buscar.';
  close();
 }
 function choose(row){
  if(!row)return;
  const old=select.value;
  select.value=row.key;
  sync();
  if(old!==row.key){select.dispatchEvent(new Event('change',{bubbles:true}));onSelected(row);}
 }
 function render(){
  const query=normalize(input.value);
  displayed=rows.filter(row=>normalize(label(row)).includes(query)).slice(0,9);
  list.replaceChildren();
  activeIndex=-1;
  displayed.forEach((row,i)=>{
   const option=document.createElement('button');
   option.type='button';option.className='freight-city-option';
   option.id='freight-city-option-'+i;
   option.setAttribute('role','option');
   option.setAttribute('aria-selected',String(select.value===row.key));
   const name=document.createElement('strong'),detail=document.createElement('small');
   name.textContent=row.name;detail.textContent='Centro operativo: '+row.center;
   option.append(name,detail);
   option.addEventListener('pointerdown',e=>e.preventDefault());
   option.addEventListener('click',()=>{choose(row);input.focus();});
   list.append(option);
  });
  opened=true;list.hidden=false;input.setAttribute('aria-expanded','true');
  const all=rows.filter(row=>normalize(label(row)).includes(query));
  feedback.textContent=all.length?all.length+' destinos coincidentes. Elige uno.':'Sin coincidencias. Prueba otro municipio.';
  if(!displayed.length){const empty=document.createElement('p');empty.className='freight-city-empty';empty.textContent='No encontramos ese municipio.';list.append(empty);}
 }
 function highlight(next){
  if(!displayed.length)return;
  activeIndex=(next+displayed.length)%displayed.length;
  [...list.querySelectorAll('[role=option]')].forEach((node,i)=>{
   const active=i===activeIndex;
   node.dataset.active=String(active);
   node.setAttribute('aria-selected',String(active));
  });
  const chosen=list.querySelectorAll('[role=option]')[activeIndex];
  if(chosen){input.setAttribute('aria-activedescendant',chosen.id);chosen.scrollIntoView({block:'nearest'});}
 }
 input.addEventListener('input',()=>{
  const match=selectedRow();
  if(!match||input.value!==label(match)){
   if(select.value){select.value='';select.dispatchEvent(new Event('change',{bubbles:true}));}
   input.setCustomValidity('Selecciona un municipio válido de la lista.');
  }
  render();
 });
 input.addEventListener('focus',()=>{if(!input.disabled)render();});
 input.addEventListener('keydown',event=>{
  if(event.key==='Escape'){close();if(selectedRow())sync();return;}
  if(event.key==='ArrowDown'||event.key==='ArrowUp'){
   event.preventDefault();if(!opened)render();
   highlight(activeIndex+(event.key==='ArrowDown'?1:-1));return;
  }
  if(event.key==='Enter'&&opened){
   event.preventDefault();choose(displayed[activeIndex>=0?activeIndex:0]);return;
  }
  if(event.key==='Tab'){close();if(!selectedRow())input.setCustomValidity('Selecciona un destino de la lista.');}
 });
 input.addEventListener('blur',()=>{
  // Allow click handlers to commit before closing while avoiding stale open menus.
  queueMicrotask(()=>{if(!list.contains(document.activeElement))close();});
 });
 document.addEventListener('pointerdown',e=>{if(!input.contains(e.target)&&!list.contains(e.target))close();},{signal:form.__freightSignal});
 select.addEventListener('change',sync);
 function setDestinations(next,selected=''){
  rows=Array.isArray(next)?next:[];
  select.replaceChildren(new Option('Selecciona',''),...rows.map(row=>new Option(label(row),row.key)));
  select.disabled=!rows.length;
  input.disabled=!rows.length;
  select.value=rows.some(row=>row.key===selected)?selected:'';
  sync();
 }
 function reset(text='Selecciona el departamento primero.'){
  rows=[];select.replaceChildren(new Option('Selecciona',''));select.disabled=true;
  input.value='';input.disabled=true;input.setCustomValidity('');
  feedback.textContent=text;close();
 }
 reset();
 return {setDestinations,reset,sync,close};
}
