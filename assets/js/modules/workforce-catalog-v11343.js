import {fmt} from "../core/format.js";

export function catalogTaxonomy(catalog=[]){
  const activities=(Array.isArray(catalog)?catalog:[]).filter(item=>item.activityKind==="ACTIVITY");
  const categories=new Map();
  for(const item of activities){
    const key=item.uiCategory||item.activityGroup||"GENERAL";
    const label=item.uiCategoryLabel||fmt.label(key)||"General";
    const sub=item.uiSubcategory||"Otras actividades";
    if(!categories.has(key))categories.set(key,{key,label,subcategories:new Map()});
    const cat=categories.get(key);
    if(!cat.subcategories.has(sub))cat.subcategories.set(sub,{label:sub,activities:[]});
    cat.subcategories.get(sub).activities.push(item);
  }
  return [...categories.values()].map(cat=>({
    key:cat.key,
    label:cat.label,
    subcategories:[...cat.subcategories.values()].map(sub=>({...sub,activities:sub.activities.sort((a,b)=>a.name.localeCompare(b.name,"es"))}))
      .sort((a,b)=>a.label.localeCompare(b.label,"es"))
  })).sort((a,b)=>a.label.localeCompare(b.label,"es"));
}

export function catalogBrowserHtml(catalog,disabled=false){
  const tree=catalogTaxonomy(catalog);
  if(!tree.length)return `<div class="empty-state"><strong>Sin actividades habilitadas</strong><span>Solicita al administrador revisar el catálogo de tu rol.</span></div>`;
  return `<div class="work-catalog-browser" data-work-catalog-browser>
    <section class="work-catalog-level">
      <header><span>1</span><div><strong>Categorías</strong><small>Elige el proceso donde vas a trabajar</small></div></header>
      <div class="work-catalog-category-grid">${tree.map(cat=>`<button type="button" class="work-catalog-category" data-work-category="${fmt.escape(cat.key)}" ${disabled?"disabled":""}><strong>${fmt.escape(cat.label)}</strong><small>${cat.subcategories.length} subcategoría(s)</small><b>›</b></button>`).join("")}</div>
    </section>
    <section class="work-catalog-level" data-work-subcategory-panel hidden>
      <header><span>2</span><div><strong>Subcategorías</strong><small>Afina el tipo de actividad</small></div></header>
      <div class="work-catalog-subcategory-grid" data-work-subcategory-list></div>
    </section>
    <section class="work-catalog-level" data-work-activity-panel hidden>
      <header><span>3</span><div><strong>Actividad específica</strong><small>Selecciona; todavía no inicia el cronómetro</small></div></header>
      <div class="work-catalog-activity-list" data-work-activity-list></div>
    </section>
    <div data-work-selected></div>
  </div>`;
}

export function subcategoryHtml(category){
  return category.subcategories.map(sub=>`<button type="button" class="work-catalog-subcategory" data-work-subcategory="${fmt.escape(sub.label)}"><strong>${fmt.escape(sub.label)}</strong><small>${sub.activities.length} actividad(es)</small><b>›</b></button>`).join("");
}

export function activityListHtml(subcategory){
  return subcategory.activities.map(item=>`<button type="button" class="work-catalog-activity" data-work-activity-select="${fmt.escape(item.id)}"><span></span><div><strong>${fmt.escape(item.name)}</strong><small>Seleccionar actividad</small></div><b>›</b></button>`).join("");
}

export function selectedActivityHtml(item){
  if(!item)return "";
  return `<section class="work-start-confirm">
    <div class="work-start-confirm-copy"><span>Confirmar inicio</span><strong>${fmt.escape(item.name)}</strong><small>${fmt.escape(item.uiCategoryLabel||fmt.label(item.uiCategory||item.activityGroup||""))} · ${fmt.escape(item.uiSubcategory||"Actividad")}</small><p>El cronómetro comenzará únicamente cuando pulses “Iniciar actividad”.</p></div>
    <div class="work-start-confirm-actions"><button type="button" class="btn btn-ghost" data-work-selection-cancel>Cancelar</button><button type="button" class="btn btn-primary" data-work-start-confirmed="${fmt.escape(item.id)}">Iniciar actividad</button></div>
  </section>`;
}
