import {materialPickerHtml,bindMaterialPicker,readMaterialPicker} from '../../services/materials.js';
import {fmt} from '../../core/format.js';
export function addMaterial(host,initial={},manual=false){
 const row=document.createElement('article');row.className='freight-line';row.dataset.manual=String(manual);
 row.innerHTML=manual?`<label>Descripción manual<input class="control" data-manual-description value="${fmt.escape(initial.description||'')}" required maxlength="240"></label>`:materialPickerHtml(initial);
 row.insertAdjacentHTML('beforeend',`<label>Cantidad<input class="control" data-material-qty type="number" min="0.0001" step="any" value="${Number(initial.quantity)||1}" required></label><label>Unidad<input class="control" data-material-unit value="${fmt.escape(initial.unit||'UND')}" ${manual?'':'readonly'} required maxlength="20"></label><button type="button" class="btn" data-remove-line>Eliminar material</button>`);
 host.append(row);
 if(!manual)bindMaterialPicker(row.querySelector('[data-material-picker]'),{onChange:()=>{row.querySelector('[data-material-unit]').value=readMaterialPicker(row.querySelector('[data-material-picker]'),false).unit;host.dispatchEvent(new Event('change',{bubbles:true}));}});
 row.querySelector('[data-remove-line]').onclick=()=>{row.remove();host.dispatchEvent(new Event('change',{bubbles:true}));};
}
export function addPackage(host,initial={}){
 const row=document.createElement('article');row.className='freight-package';
 const fields=[['quantity','Cantidad de bultos',1],['weightKg','Peso real por bulto (kg)',''],['lengthM','Largo (m)',''],['widthM','Ancho (m)',''],['heightM','Alto (m)',''],['volumeM3','O volumen por bulto (m³)','']];
 row.innerHTML=fields.map(([name,label,def])=>`<label>${label}<input class="control" data-package-field="${name}" type="number" min="${name==='quantity'?1:0.000001}" step="${name==='quantity'?1:'any'}" value="${fmt.escape(String(initial[name]??def))}"></label>`).join('')+'<button type="button" class="btn" data-remove-line>Eliminar bulto</button>';
 host.append(row);row.querySelector('[data-remove-line]').onclick=()=>{row.remove();host.dispatchEvent(new Event('change',{bubbles:true}));};
}
export function readQuote(form,{strict=false}={}){
 const nullable=input=>input.value===''?null:Number(input.value);
 const materials=[...form.querySelector('[data-quote-materials]').children].map(row=>{
  const manual=row.dataset.manual==='true';const material=manual?{description:row.querySelector('[data-manual-description]').value.trim(),unit:row.querySelector('[data-material-unit]').value.trim(),manual:true}:readMaterialPicker(row.querySelector('[data-material-picker]'),strict);
  const quantity=Number(row.querySelector('[data-material-qty]').value);
  if(strict&&(!material.description||quantity<=0||!Number.isFinite(quantity)))throw Error('Completa los materiales y cantidades.');
  return {...material,quantity};
 });
 const packages=[...form.querySelector('[data-quote-packages]').children].map(row=>Object.fromEntries([...row.querySelectorAll('[data-package-field]')].map(input=>[input.dataset.packageField,nullable(input)])));
 if(strict&&(!packages.length||!materials.length))throw Error('Agrega al menos un material y un bulto.');
 return {origin:form.elements.origin.value,department:form.elements.department.value,destinationKey:form.elements.destinationKey.value,carrier:form.elements.carrier.value,declaredValue:nullable(form.elements.declaredValue),materials,packages};
}
