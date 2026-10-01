import { fmt } from "../../../core/format.js";
import { colombianMunicipalities } from "../../../services/location.js";

export function bindOrderLocation(assistant,departments,scheduleFreightEstimate){
const departmentSelect=assistant.root.querySelector('[name="clientDepartmentCode"]');
const departmentName=assistant.root.querySelector('[name="clientDepartment"]');
const municipalitySelect=assistant.root.querySelector('[name="clientCity"]');
const municipalityHelp=assistant.root.querySelector('[data-municipality-help]');
const loadMunicipalities=async()=>{
    const code=departmentSelect?.value||"";
    const selected=departments.find(item=>item.code===code);
    if(departmentName)departmentName.value=selected?.name||"";
    if(!municipalitySelect)return;
    municipalitySelect.disabled=true;
    municipalitySelect.innerHTML='<option value="">Cargando municipios…</option>';
    if(municipalityHelp)municipalityHelp.textContent="Consultando la lista oficial…";
    if(!code){municipalitySelect.innerHTML='<option value="">Primero selecciona el departamento</option>';if(municipalityHelp)municipalityHelp.textContent="La lista se cargará según el departamento.";return;}
    try{
      const rows=await colombianMunicipalities(code);
      municipalitySelect.innerHTML=`<option value="">Selecciona el municipio o ciudad</option>${rows.map(item=>`<option value="${fmt.escape(item.name)}">${fmt.escape(item.name)}${item.type&&item.type!=="Municipio"?` · ${fmt.escape(item.type)}`:""}</option>`).join("")}`;
      municipalitySelect.disabled=false;
      if(municipalityHelp)municipalityHelp.textContent=`${rows.length} municipios y distritos disponibles.`;
    }catch(error){
      municipalitySelect.innerHTML='<option value="">No fue posible cargar la lista</option>';
      if(municipalityHelp)municipalityHelp.innerHTML=`${fmt.escape(error.message)} <button type="button" class="location-inline-link" data-retry-municipalities>Reintentar</button>`;
      municipalityHelp?.querySelector('[data-retry-municipalities]')?.addEventListener("click",loadMunicipalities,{once:true});
    }
  };
departmentSelect?.addEventListener("change",async()=>{await loadMunicipalities();scheduleFreightEstimate()});
municipalitySelect?.addEventListener("change",scheduleFreightEstimate);
}
