import {fmt} from '../../core/format.js';
import {measurementSummary} from './material-measurements.js';
function numberMaterials(host){
 [...host.querySelectorAll('.freight-line')].forEach((row,index)=>{
  const label=row.querySelector('[data-material-number]');
  if(label)label.textContent='Material '+(index+1);
 });
}
export function addMaterial(host,initial={}){
 const row=document.createElement('article');row.className='freight-line';
 let mode=initial.measurementMode==='VOLUME'?'VOLUME':'WEIGHT';
 const values={WEIGHT:initial.weightKg??'',VOLUME:initial.volumeM3??''};
 row.innerHTML='<div class="freight-line-header"><span data-material-number>Material</span><div class="freight-line-tools"><button type="button" class="btn" data-duplicate-line aria-label="Duplicar material">Duplicar</button><button type="button" class="btn" data-remove-line aria-label="Eliminar material">Eliminar</button></div></div>'+
  '<label class="freight-line-name">Nombre del material<input class="control" data-material-name value="'+fmt.escape(initial.description||'')+'" required maxlength="240" placeholder="Ej. cable, tubería, tablero"></label>'+
  '<fieldset class="freight-mode"><legend>Calcular con</legend><div role="group" aria-label="Medida del material"><button type="button" data-mode="WEIGHT">Peso</button><button type="button" data-mode="VOLUME">Volumen</button></div></fieldset>'+
  '<label class="freight-measure-field"><span data-measure-label></span><input class="control" data-measure-value type="number" inputmode="decimal" min="0.000001" step="any" required></label>'+
  '<small data-saved-measure class="freight-measure-hint"></small>';
 const input=row.querySelector('[data-measure-value]');
 const render=()=>{
  row.dataset.mode=mode;input.value=values[mode];
  row.querySelector('[data-measure-label]').textContent=mode==='WEIGHT'?'Peso del material (kg)':'Volumen del material (m³)';
  row.querySelectorAll('[data-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.mode===mode)));
  const other=mode==='WEIGHT'?'VOLUME':'WEIGHT';
  row.querySelector('[data-saved-measure]').textContent=values[other]!==''?'También registrado: '+values[other]+' '+(other==='WEIGHT'?'kg':'m³'):'Alterna para agregar la otra medida sin perder la actual.';
 };
 input.oninput=()=>{values[mode]=input.value;};
 row.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>{values[mode]=input.value;mode=b.dataset.mode;render();host.dispatchEvent(new Event('change',{bubbles:true}));});
 row.readMaterial=()=>({description:row.querySelector('[data-material-name]').value.trim(),manual:true,quantity:1,unit:'UND',measurementMode:mode,weightKg:values.WEIGHT===''?null:Number(values.WEIGHT),volumeM3:values.VOLUME===''?null:Number(values.VOLUME)});
 row.querySelector('[data-duplicate-line]').onclick=()=>{
  const copy=addMaterial(host,row.readMaterial());
  host.dispatchEvent(new Event('change',{bubbles:true}));
  copy.querySelector('[data-material-name]').focus();
 };
 row.querySelector('[data-remove-line]').onclick=()=>{row.remove();numberMaterials(host);host.dispatchEvent(new Event('change',{bubbles:true}));};
 host.append(row);numberMaterials(host);render();return row;
}
export function readQuote(form,{strict=false}={}){
 const materials=[...form.querySelector('[data-quote-materials]').children].map(row=>row.readMaterial());
 measurementSummary(materials);
 if(strict&&(!materials.length||materials.some(m=>!m.description||!(m[m.measurementMode==='VOLUME'?'volumeM3':'weightKg']>0))))throw Error('Completa el nombre y la medida elegida de cada material.');
 return {measurementVersion:2,origin:form.elements.origin.value,department:form.elements.department.value,destinationKey:form.elements.destinationKey.value,carrier:form.elements.carrier.value,declaredValue:form.elements.declaredValue.value===''?null:Number(form.elements.declaredValue.value),materials};
}
