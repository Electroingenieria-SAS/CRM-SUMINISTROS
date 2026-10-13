import {fmt} from '../../core/format.js';
import {measurementSummary} from './material-measurements.js';
export function addMaterial(host,initial={}){
 const row=document.createElement('article');row.className='freight-line';
 let mode=initial.measurementMode==='VOLUME'?'VOLUME':'WEIGHT';
 const values={WEIGHT:initial.weightKg??'',VOLUME:initial.volumeM3??''};
 row.innerHTML=`<label>Nombre del material<input class="control" data-material-name value="${fmt.escape(initial.description||'')}" required maxlength="240" placeholder="Ej. cable, tubería, tablero"></label><fieldset class="freight-mode"><legend>Calcular con</legend><div role="group" aria-label="Medida del material"><button type="button" data-mode="WEIGHT">Peso</button><button type="button" data-mode="VOLUME">Volumen</button></div></fieldset><label><span data-measure-label></span><input class="control" data-measure-value type="number" min="0.000001" step="any" required></label><button type="button" class="btn" data-remove-line aria-label="Eliminar material">Eliminar</button><small data-saved-measure></small>`;
 const input=row.querySelector('[data-measure-value]');
 const render=()=>{
  row.dataset.mode=mode;input.value=values[mode];
  row.querySelector('[data-measure-label]').textContent=mode==='WEIGHT'?'Peso del material (kg)':'Volumen del material (m³)';
  row.querySelectorAll('[data-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.mode===mode)));
  const other=mode==='WEIGHT'?'VOLUME':'WEIGHT';
  row.querySelector('[data-saved-measure]').textContent=values[other]!==''?`También registrado: ${values[other]} ${other==='WEIGHT'?'kg':'m³'}`:'Puedes alternar para registrar la otra medida del mismo material.';
 };
 input.oninput=()=>{values[mode]=input.value;};
 row.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>{values[mode]=input.value;mode=b.dataset.mode;render();host.dispatchEvent(new Event('change',{bubbles:true}));});
 row.readMaterial=()=>({description:row.querySelector('[data-material-name]').value.trim(),manual:true,quantity:1,unit:'UND',measurementMode:mode,weightKg:values.WEIGHT===''?null:Number(values.WEIGHT),volumeM3:values.VOLUME===''?null:Number(values.VOLUME)});
 row.querySelector('[data-remove-line]').onclick=()=>{row.remove();host.dispatchEvent(new Event('change',{bubbles:true}));};
 host.append(row);render();
}
export function readQuote(form,{strict=false}={}){
 const materials=[...form.querySelector('[data-quote-materials]').children].map(row=>row.readMaterial());
 measurementSummary(materials);
 if(strict&&(!materials.length||materials.some(m=>!m.description||!(m[m.measurementMode==='VOLUME'?'volumeM3':'weightKg']>0))))throw Error('Completa el nombre y la medida elegida de cada material.');
 return {measurementVersion:2,origin:form.elements.origin.value,department:form.elements.department.value,destinationKey:form.elements.destinationKey.value,carrier:form.elements.carrier.value,declaredValue:form.elements.declaredValue.value===''?null:Number(form.elements.declaredValue.value),materials};
}
