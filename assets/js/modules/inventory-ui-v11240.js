import {fmt} from "../core/format.js";

const esc=v=>fmt.escape(v??"");

export function inventoryKpi(label,value,detail,{tone="neutral",raw=false}={}){
  return `<article class="inventory-summary-item-v11109 ${tone}"><span></span><div><strong>${raw?esc(value):fmt.number(value)}</strong><b>${esc(label)}</b><small>${esc(detail||"")}</small></div></article>`;
}

export function inventoryListHeader({eyebrow,title,detail,count}={}){
  return `<header class="inventory-results-head-v11109"><div><span>${esc(eyebrow||"")}</span><strong>${esc(title||"")}</strong><small>${esc(detail||"")}${count!=null?` · ${fmt.number(count)} registro(s)`:""}</small></div></header>`;
}

export function inventoryToolbar({title="Listado",detail="",searchId="",searchPlaceholder="Buscar referencia o descripción",filters=[]}={}){
  const search=searchId?`<input class="control" id="${esc(searchId)}" autocomplete="off" placeholder="${esc(searchPlaceholder)}">`:"";
  const filterHtml=filters.map(f=>`<select class="control" id="${esc(f.id)}"><option value="">${esc(f.allLabel||f.label||"Todos")}</option>${(f.options||[]).map(o=>`<option value="${esc(o.value)}">${esc(o.label)}</option>`).join("")}</select>`).join("");
  return `<section class="v115-list-toolbar"><div><span>VISTA OPERATIVA</span><strong>${esc(title)}</strong><small>${esc(detail)}</small></div><div class="v115-list-filters">${search}${filterHtml}</div></section>`;
}

export function inventoryEnterpriseRow({eyebrow="",reference="",description="",subline="",meta=[],statusLabel="",statusDetail="",statusTone="standalone",actions=""}={}){
  return `<article class="v115-goods-row"><div class="v115-goods-id"><span>${esc(eyebrow)}</span><strong>${esc(reference)}</strong><small>${esc(description)}</small>${subline?`<small>${esc(subline)}</small>`:""}</div><div class="v115-goods-meta">${meta.slice(0,4).map(m=>`<span><small>${esc(m.label)}</small><b title="${esc(m.value)}">${esc(m.value)}</b>${m.detail?`<small>${esc(m.detail)}</small>`:""}</span>`).join("")}</div><div class="v115-goods-link ${statusTone}"><small>ESTADO</small><strong>${esc(statusLabel||"—")}</strong>${statusDetail?`<em>${esc(statusDetail)}</em>`:""}</div><div class="page-actions">${actions}</div></article>`;
}

export function inventoryParetoCards(rows=[]){
  return `<section class="v115-detail-grid">${rows.map(row=>`<article><small>Banda ${esc(row.band)}</small><strong>${fmt.number(row.materials||0)} referencias</strong><span>${fmt.number(row.pending||0)} pendientes · score ${fmt.number(row.avgScore||0,1)}</span></article>`).join("")}</section>`;
}

export function bindListFilter(root,{rows,render,searchId,filters=[],hostId,countId}={}){
  const host=root.querySelector(`#${hostId}`),count=root.querySelector(`#${countId}`);
  if(!host)return;
  const apply=()=>{
    const q=(root.querySelector(`#${searchId}`)?.value||"").trim().toLowerCase();
    const values=Object.fromEntries(filters.map(f=>[f.key,root.querySelector(`#${f.id}`)?.value||""]));
    const filtered=(rows||[]).filter(row=>{
      const hay=[row.reference,row.description,row.reportCode,row.submittedBy,(row.warehouses||[]).join(" ")].filter(Boolean).join(" ").toLowerCase();
      if(q&&!hay.includes(q))return false;
      return filters.every(f=>!values[f.key]||String(f.get(row)||"")===values[f.key]);
    });
    host.innerHTML=filtered.length?filtered.map(render).join(""):`<div class="empty-state"><strong>Sin coincidencias</strong><span>Ajusta la búsqueda o los filtros.</span></div>`;
    if(count)count.textContent=`${fmt.number(filtered.length)} de ${fmt.number((rows||[]).length)} registro(s)`;
  };
  root.querySelector(`#${searchId}`)?.addEventListener("input",apply);
  filters.forEach(f=>root.querySelector(`#${f.id}`)?.addEventListener("change",apply));
  apply();
  return apply;
}
