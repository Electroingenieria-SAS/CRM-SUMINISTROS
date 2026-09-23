import {fmt} from "../core/format.js";

export function catalogTaxonomy(catalog=[]){
  const activities=(Array.isArray(catalog)?catalog:[]).filter(item=>item.activityKind==="ACTIVITY");
  const categories=new Map();
  for(const item of activities){
    const key=item.uiCategory||item.activityGroup||"GENERAL";
    const label=item.uiCategoryLabel||fmt.label(key)||"General";
    const sub=item.uiSubcategory||"Otras actividades";
    if(!categories.has(key))categories.set(key,{key,label,subcategories:new Map()});
    const category=categories.get(key);
    if(!category.subcategories.has(sub))category.subcategories.set(sub,{label:sub,activities:[]});
    category.subcategories.get(sub).activities.push(item);
  }
  return [...categories.values()].map(category=>({
    key:category.key,
    label:category.label,
    subcategories:[...category.subcategories.values()]
      .map(sub=>({...sub,activities:sub.activities.sort((a,b)=>a.name.localeCompare(b.name,"es"))}))
      .sort((a,b)=>a.label.localeCompare(b.label,"es"))
  })).sort((a,b)=>a.label.localeCompare(b.label,"es"));
}

export function catalogBrowserHtml(catalog,disabled=false){
  const tree=catalogTaxonomy(catalog);
  if(!tree.length)return `<div class="empty-state work-catalog-empty"><strong>Sin actividades habilitadas</strong><span>Solicita al administrador revisar el catálogo disponible para tu rol.</span></div>`;
  return `<div class="work-catalog-browser" data-work-catalog-browser data-level="category">
    <div class="work-catalog-progress" aria-label="Proceso para elegir actividad">
      <span class="active" data-catalog-progress="category"><b>1</b><em>Categoría</em></span>
      <i></i>
      <span data-catalog-progress="subcategory"><b>2</b><em>Subcategoría</em></span>
      <i></i>
      <span data-catalog-progress="activity"><b>3</b><em>Actividad</em></span>
    </div>
    <div class="work-catalog-breadcrumb" data-work-catalog-breadcrumb>
      <strong>Elige una categoría</strong><span>Solo estás navegando; el cronómetro todavía no inicia.</span>
    </div>
    <div class="work-catalog-stage" data-work-catalog-stage>
      ${categoryStageHtml(tree,disabled)}
    </div>
    <div class="work-catalog-selection" data-work-selected></div>
  </div>`;
}

export function categoryStageHtml(tree,disabled=false){
  return `<section class="work-catalog-stage-panel" data-stage="category">
    <header class="work-catalog-stage-head"><div><span>PASO 1</span><h4>¿En qué tipo de trabajo vas a participar?</h4><p>Selecciona una categoría para ver únicamente las opciones relacionadas.</p></div></header>
    <div class="work-catalog-category-grid">${tree.map(category=>`
      <button type="button" class="work-catalog-choice category" data-work-category="${fmt.escape(category.key)}" ${disabled?"disabled":""}>
        <span class="work-catalog-choice-icon">${fmt.escape(categoryInitial(category.label))}</span>
        <span class="work-catalog-choice-copy"><strong>${fmt.escape(category.label)}</strong><small>${category.subcategories.length} subcategoría${category.subcategories.length===1?"":"s"}</small></span>
        <b aria-hidden="true">›</b>
      </button>`).join("")}</div>
  </section>`;
}

export function subcategoryStageHtml(category){
  return `<section class="work-catalog-stage-panel" data-stage="subcategory">
    <header class="work-catalog-stage-head with-back">
      <button type="button" class="work-catalog-back" data-work-level-back="category" aria-label="Volver a categorías">‹</button>
      <div><span>PASO 2 · ${fmt.escape(category.label)}</span><h4>Elige una subcategoría</h4><p>Así reducimos la lista y evitamos seleccionar una actividad por error.</p></div>
    </header>
    <div class="work-catalog-subcategory-grid">${subcategoryHtml(category)}</div>
  </section>`;
}

export function subcategoryHtml(category){
  return category.subcategories.map(sub=>`
    <button type="button" class="work-catalog-choice subcategory" data-work-subcategory="${fmt.escape(sub.label)}">
      <span class="work-catalog-choice-icon">↳</span>
      <span class="work-catalog-choice-copy"><strong>${fmt.escape(sub.label)}</strong><small>${sub.activities.length} actividad${sub.activities.length===1?"":"es"}</small></span>
      <b aria-hidden="true">›</b>
    </button>`).join("");
}

export function activityStageHtml(category,subcategory){
  return `<section class="work-catalog-stage-panel" data-stage="activity">
    <header class="work-catalog-stage-head with-back">
      <button type="button" class="work-catalog-back" data-work-level-back="subcategory" aria-label="Volver a subcategorías">‹</button>
      <div><span>PASO 3 · ${fmt.escape(category.label)}</span><h4>${fmt.escape(subcategory.label)}</h4><p>Selecciona la actividad específica. Después tendrás que confirmar el inicio.</p></div>
    </header>
    <div class="work-catalog-activity-list">${activityListHtml(subcategory)}</div>
  </section>`;
}

export function activityListHtml(subcategory){
  return subcategory.activities.map(item=>`
    <button type="button" class="work-catalog-activity" data-work-activity-select="${fmt.escape(item.id)}">
      <span class="work-catalog-activity-dot"></span>
      <span class="work-catalog-activity-copy"><strong>${fmt.escape(item.name)}</strong><small>Seleccionar para revisar antes de iniciar</small></span>
      <b aria-hidden="true">›</b>
    </button>`).join("");
}

export function selectedActivityHtml(item){
  if(!item)return "";
  return `<section class="work-start-confirm">
    <div class="work-start-confirm-icon">✓</div>
    <div class="work-start-confirm-copy">
      <span>ACTIVIDAD SELECCIONADA</span>
      <strong>${fmt.escape(item.name)}</strong>
      <small>${fmt.escape(item.uiCategoryLabel||fmt.label(item.uiCategory||item.activityGroup||""))} · ${fmt.escape(item.uiSubcategory||"Actividad")}</small>
      <p>Revisa que sea la actividad correcta. El cronómetro comenzará únicamente al pulsar <b>Iniciar actividad</b>.</p>
    </div>
    <div class="work-start-confirm-actions">
      <button type="button" class="btn btn-ghost" data-work-selection-cancel>Cambiar actividad</button>
      <button type="button" class="btn btn-primary" data-work-start-confirmed="${fmt.escape(item.id)}">Iniciar actividad</button>
    </div>
  </section>`;
}

export function catalogBreadcrumbHtml({category=null,subcategory=null}={}){
  if(subcategory)return `<strong>${fmt.escape(category?.label||"Categoría")} → ${fmt.escape(subcategory.label)}</strong><span>Selecciona una actividad específica.</span>`;
  if(category)return `<strong>${fmt.escape(category.label)}</strong><span>Ahora elige una subcategoría.</span>`;
  return `<strong>Elige una categoría</strong><span>Solo estás navegando; el cronómetro todavía no inicia.</span>`;
}

function categoryInitial(label){
  return String(label||"?").trim().charAt(0).toUpperCase()||"?";
}
