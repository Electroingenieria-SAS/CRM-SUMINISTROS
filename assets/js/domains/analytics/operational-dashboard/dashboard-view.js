import { empty } from "../../../core/ui.js";
import { fmt } from "../../../core/format.js";
import { escapeText, money } from "../../../core/layout/operational/operational-values.js";
import { billingTable, shippingTable, deliveryHours, receivingTable } from "./record-tables.js";

export function dashboardHtml(module,data){
  const rows=data.rows||[],summary=data.summary||{};
  if(module==="billing"){
    const duplicates=countDuplicates(rows,"invoiceNumber");
    return `${summaryStrip([["Facturas",summary.records||rows.length,"registros del rango"],["Valor facturado",money(summary.totalAmount||0),"acumulado"],["Peso total",`${fmt.number(summary.totalWeightKg||0,3)} kg`,"registrado"],["Consecutivos repetidos",duplicates,"revisar antes de cierre"]])}
      <section class="v1139-invoice-browser">
        <div><span>ARCHIVO DE FACTURAS</span><strong>Buscar y abrir soporte institucional</strong><small data-v1139-billing-count>${rows.length} factura${rows.length===1?"":"s"}</small></div>
        <input class="control" data-v1139-billing-filter placeholder="Filtrar por factura, pedido o cliente">
      </section>
      ${rows.length?billingTable(rows):empty("Sin facturas","No hay facturas registradas en el rango seleccionado.")}`;
  }
  if(module==="shipping"){
    const duplicates=countDuplicates(rows,"carrierInvoiceNumber"),missing=rows.filter(r=>r.carrierCost!=null&&!r.carrierInvoiceNumber).length;
    return `${summaryStrip([["Despachos",summary.records||rows.length,"registros del rango"],["Costo transportadoras",money(summary.totalCarrierCost||0),"acumulado"],["Distancia promedio",summary.avgDistanceKm==null?"—":`${fmt.number(summary.avgDistanceKm,1)} km`,"real/estimada"],["Tiempo entrega",summary.avgTransitHours==null?"—":deliveryHours(summary.avgTransitHours),"promedio"],["Facturas repetidas",duplicates,"por número de factura"],["Costos sin factura",missing,"deben quedar en cero"]])}${rows.length?shippingTable(rows):empty("Sin despachos","No hay datos de transportadora en el rango seleccionado.")}`;
  }
  const gaps=receiptSequenceGaps(rows);
  return `${summaryStrip([["Recepciones",summary.records||rows.length,"registros del rango"],["Novedades abiertas",summary.openNovelties||0,"requieren seguimiento"],["Consecutivos con salto",gaps,"por prefijo"],["Verificadas",rows.filter(r=>r.verifiedAt).length,"con usuario y fecha"]])}${rows.length?receivingTable(rows):empty("Sin recepciones","No hay recepciones registradas en el rango seleccionado.")}`;
}

export function summaryStrip(items){return `<section class="v112-summary-strip">${items.map(([label,value,detail])=>`<article><small>${escapeText(label)}</small><strong>${escapeText(value)}</strong><span>${escapeText(detail)}</span></article>`).join("")}</section>`}

export function countDuplicates(rows,key){const counts=new Map();for(const row of rows){const value=String(row[key]||"").trim();if(value)counts.set(value,(counts.get(value)||0)+1)}return [...counts.values()].filter(n=>n>1).reduce((sum,n)=>sum+n-1,0)}

export function receiptSequenceGaps(rows){let gaps=0;const groups=new Map();for(const row of rows){const prefix=String(row.documentPrefix||"");const n=Number(row.consecutiveNo);if(!prefix||!Number.isFinite(n))continue;(groups.get(prefix)||groups.set(prefix,[]).get(prefix)).push(n)}for(const nums of groups.values()){const sorted=[...new Set(nums)].sort((a,b)=>a-b);for(let i=1;i<sorted.length;i++)gaps+=Math.max(0,sorted[i]-sorted[i-1]-1)}return gaps}
