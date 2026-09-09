import {fmt} from "../core/format.js";

const esc=v=>fmt.escape(v??"");

function ensureEnterpriseRowStyles(){
  if(typeof document==="undefined"||document.getElementById("inventory-enterprise-row-v11252"))return;
  const style=document.createElement("style");
  style.id="inventory-enterprise-row-v11252";
  style.textContent=`
  .inventory-app-v11251 .inventory-enterprise-row-v11252.no-actions{grid-template-columns:minmax(210px,1.05fr) minmax(320px,1.45fr) minmax(180px,.78fr)}
  .inventory-app-v11251 .inventory-enterprise-row-v11252.no-actions>.page-actions:empty{display:none!important}
  .inventory-app-v11251 .inventory-enterprise-row-v11252.no-meta.no-actions{grid-template-columns:minmax(0,1fr) minmax(180px,.55fr)}
  .inventory-app-v11251 .inventory-enterprise-row-v11252.no-status.no-actions{grid-template-columns:minmax(0,1fr)}
  .inventory-app-v11251 .inventory-enterprise-row-v11252.no-status.has-actions{grid-template-columns:minmax(210px,1.05fr) minmax(320px,1.45fr) minmax(110px,auto)}
  @media(max-width:1180px){
    .inventory-app-v11251 .inventory-enterprise-row-v11252.no-actions{grid-template-columns:minmax(0,1fr) minmax(170px,.45fr)}
    .inventory-app-v11251 .inventory-enterprise-row-v11252.no-actions>.v115-goods-id{grid-column:1;grid-row:1}
    .inventory-app-v11251 .inventory-enterprise-row-v11252.no-actions>.v115-goods-link{grid-column:2;grid-row:1;align-self:stretch}
    .inventory-app-v11251 .inventory-enterprise-row-v11252.no-actions>.v115-goods-meta{grid-column:1/-1;grid-row:2;order:initial}
    .inventory-app-v11251 .inventory-enterprise-row-v11252.no-meta.no-actions>.v115-goods-link{grid-column:2;grid-row:1}
    .inventory-app-v11251 .inventory-enterprise-row-v11252.no-status.no-actions{grid-template-columns:1fr}
    .inventory-app-v11251 .inventory-enterprise-row-v11252.no-status.no-actions>.v115-goods-meta{grid-column:1;grid-row:2}
  }
  @media(max-width:760px){
    .inventory-app-v11251 .inventory-enterprise-row-v11252.no-actions,.inventory-app-v11251 .inventory-enterprise-row-v11252.no-meta.no-actions,.inventory-app-v11251 .inventory-enterprise-row-v11252.no-status.no-actions{grid-template-columns:1fr}
    .inventory-app-v11251 .inventory-enterprise-row-v11252.no-actions>.v115-goods-id,.inventory-app-v11251 .inventory-enterprise-row-v11252.no-actions>.v115-goods-link,.inventory-app-v11251 .inventory-enterprise-row-v11252.no-actions>.v115-goods-meta{grid-column:1;grid-row:auto}
    .inventory-app-v11251 .inventory-enterprise-row-v11252.no-actions>.v115-goods-link{order:2}
    .inventory-app-v11251 .inventory-enterprise-row-v11252.no-actions>.v115-goods-meta{order:3}
  }`;
  document.head.appendChild(style);
}

export function inventoryKpi(label,value,detail,{tone="neutral",raw=false}={}){
  const detailHtml=String(detail??"").trim()?`<small>${esc(detail)}</small>`:"";
  return `<article class="inventory-summary-item-v11109 ${tone}"><span></span><div><strong>${raw?esc(value):fmt.number(value)}</strong><b>${esc(label)}</b>${detailHtml}</div></article>`;
}

export function inventoryListHeader({eyebrow,title,detail,count}={}){
  const detailText=[String(detail??"").trim(),count!=null?`${fmt.number(count)} registro(s)`:""].filter(Boolean).join(" · ");
  return `<header class="inventory-results-head-v11109"><div>${String(eyebrow??"").trim()?`<span>${esc(eyebrow)}</span>`:""}<strong>${esc(title||"")}</strong>${detailText?`<small>${esc(detailText)}</small>`:""}</div></header>`;
}

export function inventoryToolbar({title="Listado",detail="",searchId="",searchPlaceholder="Buscar referencia o descripción",filters=[]}={}){
  const search=searchId?`<input class="control" id="${esc(searchId)}" autocomplete="off" placeholder="${esc(searchPlaceholder)}">`:"";
  const filterHtml=(filters||[]).map(f=>`<select class="control" id="${esc(f.id)}"><option value="">${esc(f.allLabel||f.label||"Todos")}</option>${(f.options||[]).map(o=>`<option value="${esc(o.value)}">${esc(o.label)}</option>`).join("")}</select>`).join("");
  const controls=`${search}${filterHtml}`;
  return `<section class="v115-list-toolbar${controls?" has-controls":" no-controls"}"><div><span>VISTA OPERATIVA</span><strong>${esc(title)}</strong>${String(detail??"").trim()?`<small>${esc(detail)}</small>`:""}</div>${controls?`<div class="v115-list-filters">${controls}</div>`:""}</section>`;
}

export function inventoryEnterpriseRow({eyebrow="",reference="",description="",subline="",meta=[],statusLabel="",statusDetail="",statusTone="standalone",actions=""}={}){
  ensureEnterpriseRowStyles();
  const safeMeta=(Array.isArray(meta)?meta:[]).slice(0,4).filter(m=>m&&[m.label,m.value,m.detail].some(v=>String(v??"").trim()));
  const hasMeta=safeMeta.length>0;
  const hasStatus=Boolean(String(statusLabel??"").trim()||String(statusDetail??"").trim());
  const actionHtml=typeof actions==="string"?actions.trim():"";
  const hasActions=Boolean(actionHtml);
  const classes=["v115-goods-row","inventory-enterprise-row-v11252",hasActions?"has-actions":"no-actions",hasMeta?"has-meta":"no-meta",hasStatus?"has-status":"no-status"].join(" ");
  const metaHtml=hasMeta?`<div class="v115-goods-meta">${safeMeta.map(m=>`<span>${String(m.label??"").trim()?`<small>${esc(m.label)}</small>`:""}<b title="${esc(m.value)}">${esc(m.value)}</b>${String(m.detail??"").trim()?`<small>${esc(m.detail)}</small>`:""}</span>`).join("")}</div>`:"";
  const statusHtml=hasStatus?`<div class="v115-goods-link ${statusTone}"><small>ESTADO</small><strong>${esc(statusLabel||"—")}</strong>${String(statusDetail??"").trim()?`<em>${esc(statusDetail)}</em>`:""}</div>`:"";
  const actionsHtml=hasActions?`<div class="page-actions">${actionHtml}</div>`:"";
  return `<article class="${classes}"><div class="v115-goods-id">${String(eyebrow??"").trim()?`<span>${esc(eyebrow)}</span>`:""}<strong>${esc(reference)}</strong>${String(description??"").trim()?`<small>${esc(description)}</small>`:""}${String(subline??"").trim()?`<small>${esc(subline)}</small>`:""}</div>${metaHtml}${statusHtml}${actionsHtml}</article>`;
}

export function inventoryParetoCards(rows=[]){
  const safeRows=Array.isArray(rows)?rows.filter(Boolean):[];
  if(!safeRows.length)return `<div class="empty-state"><strong>Sin distribución Pareto</strong><span>El motor aún no tiene bandas disponibles para esta lectura.</span></div>`;
  return `<section class="v115-detail-grid">${safeRows.map(row=>`<article><small>Banda ${esc(row.band)}</small><strong>${fmt.number(row.materials||0)} referencias</strong><span>${fmt.number(row.pending||0)} pendientes · score ${fmt.number(row.avgScore||0,1)}</span></article>`).join("")}</section>`;
}

export function bindListFilter(root,{rows,render,searchId,filters=[],hostId,countId,onRendered}={}){
  const host=root.querySelector(`#${hostId}`),count=root.querySelector(`#${countId}`);
  if(!host)return;
  const apply=()=>{
    const q=(root.querySelector(`#${searchId}`)?.value||"").trim().toLowerCase();
    const values=Object.fromEntries((filters||[]).map(f=>[f.key,root.querySelector(`#${f.id}`)?.value||""]));
    const filtered=(rows||[]).filter(row=>{
      const hay=[row.reference,row.description,row.reportCode,row.submittedBy,(row.warehouses||[]).join(" ")].filter(Boolean).join(" ").toLowerCase();
      if(q&&!hay.includes(q))return false;
      return (filters||[]).every(f=>!values[f.key]||String(f.get(row)||"")===values[f.key]);
    });
    host.innerHTML=filtered.length?filtered.map(render).join(""):`<div class="empty-state"><strong>Sin coincidencias</strong><span>Ajusta la búsqueda o los filtros.</span></div>`;
    if(count)count.textContent=`${fmt.number(filtered.length)} de ${fmt.number((rows||[]).length)} registro(s)`;
    onRendered?.(host,filtered);
  };
  if(searchId)root.querySelector(`#${searchId}`)?.addEventListener("input",apply);
  (filters||[]).forEach(f=>root.querySelector(`#${f.id}`)?.addEventListener("change",apply));
  apply();
  return apply;
}
