import { api } from "../../../services/api.js";
import { normalizePacoText as norm } from "../language/index.js";
import { VERSION } from "../paco-config.js";
import { paco } from "../paco-state.js";
import { itemArray } from "../context/order-context.js";
import { message } from "../ui/messages.js";
import { setFlow, choiceControls } from "./conversation-flow.js";
import { speak } from "../voice/speech.js";
import { refreshMonitor } from "../alerts/monitor.js";

export async function catalog(){
  if(paco.catalog&&Date.now()-paco.catalogLoadedAt<30*60*1000)return paco.catalog;
  paco.catalog=itemArray(await api.workCatalog());
  paco.catalogLoadedAt=Date.now();
  return paco.catalog;
}

export function catalogScore(item,query){
  const q=norm(query);
  if(!q)return 1;
  const fields=[item.name,item.uiCategoryLabel,item.uiSubcategory,item.description,item.code].filter(Boolean).map(norm);
  let score=0;
  for(const field of fields){
    if(field.includes(q))score+=10;
    for(const word of q.split(" "))if(field.split(" ").some(candidate=>fuzzyWord(word,candidate)))score+=2;
  }
  return score;
}

export async function activitySuggestions(query=""){
  const rows=await catalog();
  return rows.map(item=>({item,score:catalogScore(item,query)})).filter(x=>query?x.score>0:true).sort((a,b)=>b.score-a.score||Number(a.item.sortOrder||0)-Number(b.item.sortOrder||0)).slice(0,8).map(x=>x.item);
}

export function activityActions(rows){
  return rows.map(item=>({
    label:item.name,
    sub:[item.uiCategoryLabel,item.uiSubcategory,item.standardMinutes?`${item.standardMinutes} min`:null].filter(Boolean).join(" · "),
    icon:"◷",action:"activity-select",value:item.id
  }));
}

export async function beginActivityFlow(query=""){
  setFlow({type:"activity",step:"search"});
  if(!query){
    const rows=await catalog();
    const categories=[...new Set(rows.map(x=>x.uiCategoryLabel).filter(Boolean))].slice(0,6);
    return message({
      text:"¿Qué actividad vas a realizar? Puedes escribir el nombre aunque no lo recuerdes exacto, o escoger una categoría.",
      actions:[
        ...categories.map(name=>({label:name,sub:"Ver actividades",icon:"▦",action:"activity-category",value:name})),
        {label:"Escribir actividad",sub:"Ejemplo: alistar pedido",icon:"⌕",action:"focus-input"},
        ...choiceControls()
      ]
    });
  }
  const rows=await activitySuggestions(query);
  if(!rows.length)return message({text:`No encontré una actividad parecida a “${query}”. Prueba con menos palabras o dime la categoría.`,actions:[{label:"Ver categorías",icon:"▦",action:"activity-begin"},...choiceControls()]});
  return message({text:`Encontré ${rows.length} opción${rows.length===1?"":"es"} que pueden corresponder. ¿Cuál vas a realizar?`,actions:[...activityActions(rows),...choiceControls()]});
}

export async function categoryActivities(categoryName){
  const rows=(await catalog()).filter(item=>norm(item.uiCategoryLabel)===norm(categoryName)).slice(0,10);
  setFlow({type:"activity",step:"search"});
  return message({text:`Estas son las actividades de ${categoryName}. Elige una.`,actions:[...activityActions(rows),...choiceControls()]});
}

export async function selectActivity(catalogId){
  const item=(await catalog()).find(row=>String(row.id)===String(catalogId));
  if(!item)return message({text:"Esa actividad ya no está disponible en el catálogo."});
  setFlow({type:"activity",step:"confirm",catalogId:item.id,item});
  return message({
    text:`Voy a registrar “${item.name}” como tu actividad actual. ¿La inicio ahora?`,
    card:[["Categoría",item.uiCategoryLabel||"—"],["Subcategoría",item.uiSubcategory||"—"],["Tiempo estándar",item.standardMinutes?`${item.standardMinutes} min`:"Sin tiempo estándar"]],
    actions:[
      {label:"Sí, iniciar ahora",sub:"Empieza el cronómetro",icon:"▶",kind:"primary",action:"activity-start",value:item.id},
      {label:"Elegir otra",sub:"Volver al catálogo",icon:"↩",action:"activity-begin"},
      ...choiceControls()
    ]
  });
}

export async function startActivity(catalogId){
  const item=(await catalog()).find(row=>String(row.id)===String(catalogId));
  if(!item)throw new Error("La actividad seleccionada ya no está disponible.");
  await api.workStart(item.id,null,{source:"PACO_ASSISTANT",assistantVersion:VERSION});
  setFlow(null);
  setTimeout(()=>refreshMonitor(true),900);
  speak(`Listo. Inicié ${item.name}.`);
  return message({
    type:"success",
    text:`Listo. Inicié “${item.name}” y ya queda registrada en Mi jornada y en el cronograma.`,
    actions:[{label:"Abrir Mi jornada",sub:"Ver cronómetro y evidencia",icon:"◷",kind:"primary",action:"navigate",module:"workforce"}]
  });
}
