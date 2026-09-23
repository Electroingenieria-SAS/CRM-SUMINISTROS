import {fmt} from "../core/format.js";

const e=value=>fmt.escape(String(value??"—"));

export function adminSectionHead(kicker,title,description,actionHtml=""){
  return `<header class="admin-section-head-v11160"><div><span>${e(kicker)}</span><h3>${e(title)}</h3><p>${e(description)}</p></div>${actionHtml}</header>`;
}

export function adminKpi(label,value,detail,tone=""){
  return `<article class="admin-kpi-v11160 ${e(tone)}"><small>${e(label)}</small><strong>${e(value)}</strong><span>${e(detail)}</span></article>`;
}

export function adminPanel(title,subtitle,body,actionHtml=""){
  return `<article class="admin-panel-v11160"><header><div><h4>${e(title)}</h4><span>${e(subtitle)}</span></div>${actionHtml}</header>${body}</article>`;
}

export function adminTable(headers,rows){
  return `<div class="admin-table-scroll-v11160"><table class="admin-table-v11160"><thead><tr>${headers.map(header=>`<th>${e(header)}</th>`).join("")}</tr></thead><tbody>${rows.join("")}</tbody></table></div>`;
}
