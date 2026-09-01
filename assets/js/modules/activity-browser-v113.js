import {api} from "../services/api.js";
import {fmt} from "../core/format.js";
import {modal,empty} from "../core/ui.js";
import {state} from "../core/state.js";

const ORDER=["GENERAL","CORTE","RECEPCION","ALISTAMIENTO","DESPACHO_LOCAL","DESPACHO_NACIONAL","ADMINISTRATIVE"];
const META={
 GENERAL:["Generales","◎","Actividades transversales de toda Logística."],
 CORTE:["Corte","✂","Preparación, corte, identificación y traslado."],
 RECEPCION:["Recepción","▣","Recibo, verificación, devoluciones y almacenamiento."],
 ALISTAMIENTO:["Alistamiento","✓","Picking, consolidación y preparación."],
 DESPACHO_LOCAL:["Despacho local","⌂","Preparación, entrega y cargue local."],
 DESPACHO_NACIONAL:["Despacho nacional","↗","Embalaje, cargue y operación nacional."],
 ADMINISTRATIVE:["Administrativas","▤","Gestiones de mayor peso administrativo según el área."]
};
let installed=false,timer=null,token=0;

export function installActivityBrowserV113(){
 if(installed)return;installed=true;
 const page=document.querySelector("#page-content");
 if(page)new MutationObserver(schedule).observe(page,{childList:true,subtree:true});
 schedule();
}

export async function enhanceActivityBrowserV113(root=document.querySelector("#page-content")){
 if(state.currentModule!=="workforce"||!root)return;
 const body=root.querySelector(".workforce-quick-card .card-body");
 if(!body||body.dataset.v113Browser==="loading")return;
 body.dataset.v113Browser="loading";const current=++token;
 try{
  const data=await api.workMyDay();if(current!==token||!body.isConnected)return;
  const catalog=(data.catalog||[]).filter(x=>x.activityKind==="ACTIVITY"&&x.metadata?.taxonomyVersion==="11.3.0");
  if(!catalog.length){delete body.dataset.v113Browser;return;}
  const grouped=group(catalog,x=>x.uiCategory||x.metadata.uiCategory||"GENERAL");
  body.dataset.v113Browser="ready";
  body.innerHTML=`<section class="v113-activity-entry"><header><div><span>Catálogo organizado</span><strong>¿Qué tipo de actividad vas a realizar?</strong><p>Elige una categoría y después una subcategoría.</p></div><b>${catalog.length}<small>disponibles</small></b></header><div class="v113-category-grid">${ORDER.filter(c=>grouped[c]?.length).map(c=>categoryCard(c,grouped[c])).join("")}</div>${data.active?'<p class="v113-active-note">Puedes explorar, pero primero debes finalizar el cronómetro activo.</p>':""}</section>`;
  body.querySelectorAll("[data-v113-category]").forEach(b=>b.onclick=()=>openCategory(b.dataset.v113Category,grouped[b.dataset.v113Category]||[],Boolean(data.active)));
 }catch(error){delete body.dataset.v113Browser;console.warn("[V11.3 catalog]",error)}
}

function schedule(){clearTimeout(timer);timer=setTimeout(()=>enhanceActivityBrowserV113().catch(()=>{}),80)}
function categoryCard(code,items){const [label,icon,detail]=META[code]||[fmt.label(code),"•","Actividades disponibles."];const subs=new Set(items.map(x=>x.uiSubcategory||x.metadata?.uiSubcategory||"General")).size;return `<button class="v113-category-card" data-v113-category="${fmt.escape(code)}"><span>${icon}</span><div><strong>${fmt.escape(label)}</strong><small>${fmt.escape(detail)}</small><b>${subs} subcategoría${subs===1?"":"s"} · ${items.length} actividades</b></div><i>›</i></button>`}

function openCategory(code,items,active){
 const [label,,detail]=META[code]||[fmt.label(code),"","Actividades disponibles."];
 const view=modal({title:`Actividades · ${label}`,confirmLabel:"Cerrar",cancelLabel:"Volver",size:"wide",body:`<section class="v113-browser"><header><div><span>Categoría</span><strong>${fmt.escape(label)}</strong><p>${fmt.escape(detail)}</p></div><input class="control" type="search" placeholder="Buscar actividad…" data-v113-search></header><div data-v113-content></div></section>`,onConfirm:async()=>{}});
 const content=view.root.querySelector("[data-v113-content]"),search=view.root.querySelector("[data-v113-search]");
 const showSubs=()=>{const subs=group(items,x=>x.uiSubcategory||x.metadata?.uiSubcategory||"General");content.innerHTML=`<div class="v113-browser-caption"><strong>Selecciona una subcategoría</strong></div><div class="v113-subcategory-list">${Object.entries(subs).sort(([a],[b])=>a.localeCompare(b,"es")).map(([name,rows])=>`<button class="v113-subcategory-card" data-sub="${fmt.escape(name)}"><div><strong>${fmt.escape(name)}</strong><small>${fmt.escape(rows.slice(0,2).map(x=>x.name).join(" · "))}${rows.length>2?"…":""}</small></div><b>${rows.length}</b><i>›</i></button>`).join("")}</div>`;content.querySelectorAll("[data-sub]").forEach(b=>b.onclick=()=>showActivities(b.dataset.sub,subs[b.dataset.sub]||[]));};
 const showActivities=(name,rows)=>{content.innerHTML=`<div class="v113-browser-caption back"><button class="btn btn-ghost btn-compact" data-back>← Subcategorías</button><div><strong>${fmt.escape(name)}</strong><span>${rows.length} actividades</span></div></div><div class="v113-activity-list">${rows.map(x=>activityCard(x,active)).join("")}</div>`;content.querySelector("[data-back]")?.addEventListener("click",showSubs);};
 search.oninput=()=>{const q=norm(search.value);if(!q)return showSubs();const rows=items.filter(x=>norm(`${x.name} ${x.uiSubcategory||""} ${x.description||""}`).includes(q));content.innerHTML=rows.length?`<div class="v113-activity-list">${rows.map(x=>activityCard(x,active)).join("")}</div>`:empty("Sin coincidencias","Prueba con otra palabra.");};
 showSubs();
}

function activityCard(x,active){const evidence=x.evidenceHint||x.metadata?.evidenceHint||fmt.label(x.evidencePolicy);const procedure=x.procedureHint||x.metadata?.procedureHint||"Registra la actividad y su evidencia.";return `<article class="v113-activity-card"><div><span>${x.operationalLevel==="ADMINISTRATIVE"?"Gestión administrativa":"Actividad operativa"}</span><strong>${fmt.escape(x.name)}</strong><p>${fmt.escape(procedure)}</p><small><b>Evidencia:</b> ${fmt.escape(evidence)}</small></div><button class="btn btn-primary" data-start-catalog="${fmt.escape(x.id)}" ${active?"disabled":""}>Seleccionar</button></article>`}
function group(rows,key){return rows.reduce((a,x)=>{const k=key(x);(a[k]??=[]).push(x);return a},{})}
function norm(v){return String(v||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase()}
