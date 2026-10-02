import { safe, dateTime, label, sourceLabel } from "../shared/history-values.js";

export function overviewPanel(o,batch,issues){
  const meta=o.metadata||{};
  return `<div class="history-detail-grid-v11150">
    <article><h3>Identificación</h3>${kv("Pedido",o.order_number)}${kv("Cliente",o.client_name)}${kv("Documento",o.client_document)}${kv("Ciudad",o.client_city)}${kv("Dirección",o.client_address)}${kv("Teléfono",o.client_phone)}</article>
    <article><h3>Ciclo histórico</h3>${kv("Creado",dateTime(o.created_at))}${kv("Actualizado",dateTime(o.updated_at))}${kv("Cerrado",dateTime(o.closed_at))}${kv("Cancelado",dateTime(o.cancelled_at))}${kv("Origen",sourceLabel(o.history_source))}${kv("Sistema fuente",o.source)}</article>
    ${batch?`<article><h3>Lote de importación</h3>${kv("Archivo",batch.file_name)}${kv("Estado",label(batch.status))}${kv("Responsable",batch.imported_by)}${kv("Procesado",dateTime(batch.completed_at||batch.created_at))}${kv("Insertadas",batch.inserted_rows)}${kv("Rechazadas",batch.rejected_rows)}</article>`:`<article><h3>Registro nativo</h3><p>Este pedido proviene del flujo operativo del CRM y conserva su expediente funcional original.</p></article>`}
    <article><h3>Incidencias</h3>${issues.length?issues.map(i=>`<div class="history-issue-v11150"><strong>${safe(i.title||label(i.issue_type))}</strong><span>${safe(label(i.status))}${i.blocking?" · Bloqueante":""}</span><p>${safe(i.detail||i.resolution||"")}</p></div>`).join(""):"<p>Sin incidencias registradas.</p>"}</article>
  </div><details class="history-raw-v11150"><summary>Metadatos históricos</summary><pre>${safe(JSON.stringify(meta,null,2))}</pre></details>`;
}

export function kv(key,value){return `<div class="history-kv-v11150"><span>${safe(key)}</span><strong>${safe(value??"—")}</strong></div>`}
