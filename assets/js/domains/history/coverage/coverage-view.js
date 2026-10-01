import { fmt } from "../../../core/format.js";
import { state } from "../history-state.js";
import { safe, n, date, label } from "../shared/history-values.js";

export function renderCoverage(){
  const s=state.data.summary||{},f=state.data.facets||{};
  const deliveryPct=s.total?n(s.withDelivery)/n(s.total)*100:0,invoicePct=s.total?n(s.withInvoice)/n(s.total)*100:0,importedPct=s.total?n(s.imported)/n(s.total)*100:0;
  return `<section class="history-section-v11150">
    <div class="history-coverage-grid-v11150">
      <article class="history-panel-v11150"><header><div><h3>Integridad documental</h3><p>Qué tan completo está el archivo para consultas posteriores.</p></div></header>
        ${coverageRow("Con entrega confirmada",deliveryPct,`${fmt.number(s.withDelivery)} de ${fmt.number(s.total)}`)}
        ${coverageRow("Con factura registrada",invoicePct,`${fmt.number(s.withInvoice)} de ${fmt.number(s.total)}`)}
        ${coverageRow("Procedencia importada",importedPct,`${fmt.number(s.imported)} importados`)}
      </article>
      <article class="history-panel-v11150"><header><div><h3>Ventana temporal</h3><p>Alcance cronológico del archivo disponible.</p></div></header>
        <div class="history-window-v11150"><span>Registro más antiguo<strong>${date(s.oldest)}</strong></span><i></i><span>Registro más reciente<strong>${date(s.newest)}</strong></span></div>
        <div class="history-years-v11150">${(f.years||[]).map(row=>`<div><strong>${safe(row.label)}</strong><span>${fmt.number(row.value)} registros</span></div>`).join("")||'<p class="muted">Sin series anuales todavía.</p>'}</div>
      </article>
    </div>
    <div class="history-coverage-grid-v11150">
      ${distributionPanel("Estados",f.status)}${distributionPanel("Tipos de pedido",f.types)}
    </div>
    <div class="history-integrity-note-v11150"><strong>Regla de integridad V11.15.0</strong><p>Una importación nunca puede transformar un pedido operativo existente en histórico. Si el número ya existe como pedido nativo, esa fila se rechaza y queda registrada en el lote de errores.</p></div>
  </section>`;
}

export function coverageRow(title,value,detail){return `<div class="history-coverage-row-v11150"><div><strong>${safe(title)}</strong><span>${safe(detail)}</span></div><div class="history-coverage-track-v11150"><i style="width:${Math.max(0,Math.min(100,value))}%"></i></div><b>${fmt.number(value,1)}%</b></div>`}

export function distributionPanel(title,rows=[]){const max=Math.max(1,...(rows||[]).map(r=>n(r.value)));return `<article class="history-panel-v11150"><header><div><h3>${safe(title)}</h3><p>Distribución del archivo filtrado.</p></div></header><div class="history-distribution-v11150">${(rows||[]).map(row=>`<div><span>${safe(label(row.label))}</span><i><b style="width:${n(row.value)/max*100}%"></b></i><strong>${fmt.number(row.value)}</strong></div>`).join("")||'<p class="muted">Sin datos.</p>'}</div></article>`}
