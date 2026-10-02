import { fmt } from "../../../core/format.js";

export function fillCatalogSelect(select,catalog,kind){
  const rows=catalog.filter(c=>c.activityKind===kind);
  select.innerHTML=rows.length?rows.map(c=>`<option value="${fmt.escape(c.id)}">${c.custom?"★ ":""}${fmt.escape(c.name)} · ${fmt.number(c.medianMinutes&&c.samples>=5?c.medianMinutes:c.standardMinutes||0)} min</option>`).join(""):'<option value="">Sin actividades disponibles</option>';
}

export function fillNewCatalogGroups(select,kind){
  const rows=kind==="DELIVERABLE"?[["MANAGEMENT","Gestión"],["COMMERCIAL","Comercial"],["FINANCE","Financiera"],["PURCHASING","Compras"],["GENERAL","General"],["IMPROVEMENT","Mejora continua"]]:[["LOGISTICS","Operación logística"],["GENERAL","General"],["IMPROVEMENT","Mejora continua"]];
  const current=select.value;select.innerHTML=rows.map(([v,l])=>`<option value="${v}">${l}</option>`).join("");if(rows.some(([v])=>v===current))select.value=current;
}

export function assignmentCatalogStep(assignment){return {title:"Qué se necesita",description:"Selecciona una actividad existente o crea una nueva para incorporarla al catálogo oficial.",content:`
      <div class="work-catalog-mode" role="radiogroup" aria-label="Origen de la actividad">
        <label class="status-choice"><input type="radio" name="catalogMode" value="EXISTING" ${assignment.initialMode==="EXISTING"?"checked":""}><span><strong>Usar catálogo</strong><small>Selecciona una actividad ya definida y conserva sus parámetros estándar.</small></span></label>
        <label class="status-choice"><input type="radio" name="catalogMode" value="NEW" ${assignment.initialMode==="NEW"?"checked":""}><span><strong>Crear nueva actividad</strong><small>La nueva actividad se guarda automáticamente en el catálogo para reutilizarla.</small></span></label>
      </div>
      <div class="form-grid" data-existing-catalog>
        <div class="field full"><label>Actividad / plantilla *</label><select class="control" name="catalogId"></select></div>
      </div>
      <div class="form-grid work-new-catalog-fields" data-new-catalog hidden>
        <div class="field"><label>Nombre de la nueva actividad *</label><input class="control" name="newCatalogName" maxlength="120" placeholder="Ej. Conteo cíclico extraordinario"></div>
        <div class="field"><label>Categoría *</label><select class="control" name="newCatalogGroup"></select></div>
        <div class="field full"><div class="work-catalog-persistence"><strong>Se incorporará al catálogo</strong><span>Después de publicarla podrá seleccionarse nuevamente sin tener que crearla otra vez. El CRM evita duplicados por nombre.</span></div></div>
      </div>
      <div class="form-grid">
        <div class="field full"><label>Título de esta asignación *</label><input class="control" name="title" required placeholder="Ej. Organizar zona de cables o entregar análisis de cartera"></div>
        <div class="field full"><label>Descripción / resultado esperado</label><textarea class="control" name="description" rows="3"></textarea></div>
      </div>`,onEnter:({form,panel})=>{
        const existing=panel.querySelector('[data-existing-catalog]');
        const custom=panel.querySelector('[data-new-catalog]');
        const syncKind=()=>{
          fillCatalogSelect(form.catalogId,assignment.catalog,form.kind?.value||assignment.defaultKind);
          fillNewCatalogGroups(form.newCatalogGroup,form.kind?.value||assignment.defaultKind);
        };
        const syncMode=()=>{
          const mode=form.querySelector('[name="catalogMode"]:checked')?.value||"EXISTING";
          existing.hidden=mode!=="EXISTING";custom.hidden=mode!=="NEW";
          form.catalogId.required=mode==="EXISTING";
          form.newCatalogName.required=mode==="NEW";
          form.newCatalogGroup.required=mode==="NEW";
          if(mode==="NEW"&&form.newCatalogName.value&&!form.title.value)form.title.value=form.newCatalogName.value;
        };
        // El selector de tipo vive en este mismo paso para que catálogo y alcance nunca se contradigan.
        if(!form.kind){
          const type=document.createElement('div');type.className='field';type.innerHTML=`<label>Tipo *</label><select class="control" name="kind" required>${assignment.kinds.map(([v,l])=>`<option value="${v}">${l}</option>`).join("")}</select>`;
          const grid=existing.previousElementSibling?.classList?.contains('form-grid')?existing.previousElementSibling:null;
          (grid||panel.querySelector('.work-catalog-mode')).insertAdjacentElement('beforebegin',type);
        }
        syncKind();syncMode();
        form.querySelectorAll('[name="catalogMode"]').forEach(r=>r.onchange=syncMode);
        form.kind.onchange=()=>{syncKind();syncMode();};
        form.catalogId.onchange=()=>{const c=assignment.catalog.find(x=>x.id===form.catalogId.value);if(c){form.title.value=c.name;if(form.description&&!form.description.value&&c.description)form.description.value=c.description;}};
        form.newCatalogName.oninput=()=>{if((form.querySelector('[name="catalogMode"]:checked')?.value||"")==="NEW")form.title.value=form.newCatalogName.value;};
        if(assignment.initialMode==="EXISTING"&&!form.title.value){const c=assignment.catalog.find(x=>x.id===form.catalogId.value);if(c)form.title.value=c.name;}
      },validate:({form})=>{
        const mode=form.querySelector('[name="catalogMode"]:checked')?.value||"EXISTING";
        if(mode==="EXISTING"&&!form.catalogId.value)throw new Error("Selecciona una actividad del catálogo.");
        if(mode==="NEW"&&String(form.newCatalogName.value||"").trim().length<3)throw new Error("Escribe el nombre de la nueva actividad.");
        return true;
      }};}
