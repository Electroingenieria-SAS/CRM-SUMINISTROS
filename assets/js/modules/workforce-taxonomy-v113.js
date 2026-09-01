import {api} from "../services/api.js";
import {state} from "../core/state.js";
import {fmt} from "../core/format.js";

const ORDER=["GENERAL","CORTE","RECEPCION","ALISTAMIENTO","DESPACHO_LOCAL","DESPACHO_NACIONAL","ADMINISTRATIVE"];
const META={
 GENERAL:{label:"Generales",icon:"◎",tone:"general"},
 CORTE:{label:"Corte",icon:"✂",tone:"cut"},
 RECEPCION:{label:"Recepción",icon:"▣",tone:"receive"},
 ALISTAMIENTO:{label:"Alistamiento",icon:"✓",tone:"pick"},
 DESPACHO_LOCAL:{label:"Despacho local",icon:"⌂",tone:"local"},
 DESPACHO_NACIONAL:{label:"Despacho nacional",icon:"↗",tone:"national"},
 ADMINISTRATIVE:{label:"Administrativas",icon:"▤",tone:"admin"}
};
let installed=false;
let agendaToken=0;
let plannerToken=0;
let observer;

export function installWorkforceTaxonomyV113(){
 if(installed)return;
 installed=true;
 const page=document.querySelector("#page-content");
 if(!page)return;
 observer=new MutationObserver(schedule);
 observer.observe(page,{childList:true,subtree:true});
 schedule();
}

function schedule(){
 clearTimeout(schedule.t);
 schedule.t=setTimeout(()=>{
   if(state.currentModule!=="workforce")return;
   enhanceAgenda().catch(()=>{});
   enhancePlanner().catch(()=>{});
   enhancePlannerWizard().catch(()=>{});
 },90);
}

async function catalogContext(){
 const data=await api.workMyDay();
 const catalog=data.catalog||[];
 const map=new Map(catalog.map(item=>[String(item.id),item]));
 return {data,catalog,map};
}

function taxonomy(item){
 const code=item?.uiCategory||item?.metadata?.uiCategory||"GENERAL";
 return {code,...(META[code]||{label:fmt.label(code),icon:"•",tone:"general"}),sub:item?.uiSubcategory||item?.metadata?.uiSubcategory||"General"};
}

async function enhanceAgenda(){
 const host=document.querySelector(".workforce-agenda-list");
 if(!host||host.dataset.v113Grouped==="loading")return;
 const rows=[...host.querySelectorAll(".agenda-row")].filter(row=>row.querySelector("[data-start-assignment]"));
 if(!rows.length)return;
 host.dataset.v113Grouped="loading";
 const token=++agendaToken;
 const {map}=await catalogContext();
 if(token!==agendaToken||!host.isConnected)return;
 const groups=new Map();
 for(const row of rows){
   const button=row.querySelector("[data-start-assignment]");
   const item=map.get(String(button?.dataset.catalogId||""));
   const tx=taxonomy(item);
   row.dataset.v113Category=tx.code;
   row.classList.add(`v113-tone-${tx.tone}`);
   const main=row.querySelector(".agenda-main");
   if(main&&!main.querySelector(".v113-agenda-taxonomy")){
     const chip=document.createElement("div");
     chip.className="v113-agenda-taxonomy";
     chip.innerHTML=`<span>${tx.icon}</span><strong>${fmt.escape(tx.label)}</strong><i>›</i><small>${fmt.escape(tx.sub)}</small>`;
     main.prepend(chip);
   }
   if(!groups.has(tx.code))groups.set(tx.code,[]);
   groups.get(tx.code).push(row);
 }
 if(!groups.size){host.dataset.v113Grouped="ready";return;}
 const fragment=document.createDocumentFragment();
 for(const code of ORDER){
   const bucket=groups.get(code);if(!bucket?.length)continue;
   const tx=taxonomy({uiCategory:code});
   const section=document.createElement("section");
   section.className=`v113-agenda-group v113-tone-${tx.tone}`;
   section.innerHTML=`<header><div><span class="v113-agenda-group-icon">${tx.icon}</span><div><strong>${fmt.escape(tx.label)}</strong><small>${bucket.length} actividad${bucket.length===1?"":"es"} programada${bucket.length===1?"":"s"}</small></div></div><b>${bucket.length}</b></header><div class="v113-agenda-group-body"></div>`;
   const body=section.querySelector(".v113-agenda-group-body");
   bucket.forEach(row=>body.append(row));
   fragment.append(section);
 }
 const upcoming=[...host.querySelectorAll(".agenda-section.upcoming")];
 host.querySelectorAll(".agenda-section").forEach(section=>{if(!section.classList.contains("upcoming")&&!section.querySelector(".agenda-row"))section.remove()});
 const anchor=host.firstChild;
 host.insertBefore(fragment,anchor);
 upcoming.forEach(section=>host.append(section));
 host.dataset.v113Grouped="ready";
}

async function enhancePlanner(){
 const board=document.querySelector(".work-week-board,.work-month-board");
 if(!board||board.dataset.v113Planner==="loading")return;
 const ids=[...board.querySelectorAll("[data-assignment-cancel]")].map(b=>b.dataset.assignmentCancel).filter(Boolean);
 if(!ids.length){board.dataset.v113Planner="ready";return}
 board.dataset.v113Planner="loading";
 const token=++plannerToken;
 const dates=[...document.querySelectorAll("[data-plan-day]")].map(x=>x.dataset.planDay).filter(Boolean).sort();
 const from=dates[0]||new Date().toISOString().slice(0,10);
 const to=dates.at(-1)||from;
 const [planner,{map}]=await Promise.all([api.workPlanner(from,to),catalogContext()]);
 if(token!==plannerToken||!board.isConnected)return;
 const assignments=new Map((planner.assignments||[]).map(a=>[String(a.id),a]));
 board.querySelectorAll(".work-assignment-block").forEach(card=>{
   const id=card.querySelector("[data-assignment-cancel]")?.dataset.assignmentCancel;
   const assignment=assignments.get(String(id||""));
   const item=map.get(String(assignment?.catalogId||""));
   const tx=taxonomy(item);
   card.classList.add("v113-planner-card",`v113-tone-${tx.tone}`);
   if(!card.querySelector(".v113-planner-chip")){
     const chip=document.createElement("span");
     chip.className="v113-planner-chip";
     chip.innerHTML=`<b>${tx.icon}</b>${fmt.escape(tx.label)}${tx.sub!=="General"?`<i>· ${fmt.escape(tx.sub)}</i>`:""}`;
     card.prepend(chip);
   }
 });
 board.querySelectorAll(".work-week-cell").forEach(cell=>{
   const cards=[...cell.querySelectorAll(".work-assignment-block")];
   cards.sort((a,b)=>ORDER.indexOf(a.dataset.v113Category||"GENERAL")-ORDER.indexOf(b.dataset.v113Category||"GENERAL"));
   cards.forEach(card=>cell.append(card));
 });
 board.dataset.v113Planner="ready";
}

async function enhancePlannerWizard(){
 const select=document.querySelector('#modal-root select[name="catalogId"]');
 if(!select||select.dataset.v113Taxonomy==="loading"||select.dataset.v113Taxonomy==="ready")return;
 select.dataset.v113Taxonomy="loading";
 const {catalog}=await catalogContext();
 if(!select.isConnected)return;
 const allowed=new Set([...select.options].map(o=>o.value).filter(Boolean));
 const rows=catalog.filter(x=>allowed.has(String(x.id))&&x.activityKind==="ACTIVITY");
 if(!rows.length){select.dataset.v113Taxonomy="ready";return}
 const current=select.value;
 select.innerHTML='<option value="">Selecciona una actividad…</option>';
 for(const code of ORDER){
   const items=rows.filter(x=>(x.uiCategory||x.metadata?.uiCategory||"GENERAL")===code);
   if(!items.length)continue;
   const tx=taxonomy({uiCategory:code});
   const bySub=items.reduce((acc,x)=>{const k=x.uiSubcategory||x.metadata?.uiSubcategory||"General";(acc[k]??=[]).push(x);return acc},{});
   for(const [sub,subRows] of Object.entries(bySub).sort(([a],[b])=>a.localeCompare(b,"es"))){
     const group=document.createElement("optgroup");
     group.label=`${tx.label} · ${sub}`;
     subRows.sort((a,b)=>a.name.localeCompare(b.name,"es")).forEach(item=>{const opt=document.createElement("option");opt.value=item.id;opt.textContent=item.name;group.append(opt)});
     select.append(group);
   }
 }
 if([...select.options].some(o=>o.value===current))select.value=current;
 const field=select.closest(".field");
 if(field&&!field.querySelector(".v113-planner-selector-help")){
   const help=document.createElement("small");help.className="v113-planner-selector-help";help.textContent="Catálogo organizado por categoría y subcategoría del proceso logístico.";field.append(help);
 }
 select.dataset.v113Taxonomy="ready";
}
