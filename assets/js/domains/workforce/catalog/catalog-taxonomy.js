import { fmt } from "../../../core/format.js";

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

export function categoryInitial(label){
  return String(label||"?").trim().charAt(0).toUpperCase()||"?";
}
