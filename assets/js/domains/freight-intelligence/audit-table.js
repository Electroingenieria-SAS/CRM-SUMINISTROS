import {fmt} from "../../core/format.js";

const riskNames=Object.freeze({
  LATE:"Tarde",
  AT_RISK:"En riesgo",
  ON_TIME:"A tiempo",
  ON_TRACK:"En seguimiento",
  NO_DATE:"Sin fecha"
});
const anomalyNames=Object.freeze({
  CRITICAL:"Crítica",
  HIGH:"Alta",
  FAVORABLE:"Favorable",
  NORMAL:"Normal",
  NONE:"Sin evaluación"
});
const anomalyTones=new Set(Object.keys(anomalyNames));
const riskTones=new Set(Object.keys(riskNames));

export function riskLabel(value){
  return riskNames[String(value||"").toUpperCase()]||"—";
}

function anomalyLabel(value){
  return anomalyNames[String(value||"").toUpperCase()]||"—";
}

function statusTone(value,known,fallback){
  const upper=String(value||"").toUpperCase();
  return (known.has(upper)?upper:fallback).toLowerCase();
}

function orderLink(row){
  const label=fmt.escape(row.orderNumber||"Pedido sin número");
  const id=String(row.orderId||"").trim();
  if(!id)return `<span class="freight-order-unlinked-v1141">${label}</span>`;
  return `<button type="button" class="freight-order-action-v1141" data-fi-order="${fmt.escape(id)}"
    aria-label="Abrir pedido ${label}" title="Ver detalle del pedido">
      <span>${label}</span>
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M7 17 17 7M7 7h10v10"/>
      </svg>
    </button>`;
}

export function renderFreightAuditRows(rows,money){
  if(!rows.length)return `<div class="freight-empty-v1141"><span aria-hidden="true">◇</span><div>
    <strong>Sin envíos nacionales en el rango</strong>
    <p>El histórico de evaluación comenzará con los pedidos creados desde V11.40.</p>
  </div></div>`;

  return `<div class="freight-table-wrap-v1141" role="region" tabindex="0"
    aria-label="Tabla de auditoría de envíos">
    <table class="data-table freight-table-v1141">
      <caption class="freight-table-caption-v1141">Auditoría de ${rows.length} envíos: predicho frente a costo real</caption>
      <thead><tr><th scope="col">Pedido</th><th scope="col">Transportadora</th>
        <th scope="col">Predicho</th><th scope="col">Real</th><th scope="col">Desviación</th>
        <th scope="col">Ahorro potencial</th><th scope="col">Riesgo</th></tr></thead>
      <tbody>${rows.map(row=>`<tr>
        <td data-label="Pedido" class="freight-audit-order-cell-v1141">
          ${orderLink(row)}
          <small class="freight-audit-client-v1141">${fmt.escape(row.clientName||"Cliente no registrado")}</small>
        </td>
        <td data-label="Transportadora"><span class="freight-audit-carrier-v1141">${fmt.escape(row.carrier||"No registrada")}</span></td>
        <td data-label="Predicho"><span class="freight-audit-money-v1141">${row.predictedMid!=null?money(row.predictedMid):"—"}</span></td>
        <td data-label="Real">${row.actualCost!=null
          ?`<span class="freight-audit-money-v1141">${money(row.actualCost)}</span>`
          :'<span class="freight-audit-pending-v1141">Pendiente</span>'}</td>
        <td data-label="Desviación">
          <span class="fi-badge-v1141 tone-${statusTone(row.anomalyLevel,anomalyTones,"NONE")}">${fmt.escape(anomalyLabel(row.anomalyLevel))}</span>
          ${row.deviationPct!=null?`<small class="freight-audit-detail-v1141">${fmt.number(row.deviationPct,1)}%</small>`:""}
        </td>
        <td data-label="Ahorro potencial"><span class="freight-audit-money-v1141">${row.potentialSavings!=null?money(row.potentialSavings):"—"}</span></td>
        <td data-label="Riesgo"><span class="fi-badge-v1141 tone-${statusTone(row.deliveryRisk,riskTones,"NO_DATE")}">${fmt.escape(riskLabel(row.deliveryRisk))}</span></td>
      </tr>`).join("")}</tbody>
    </table>
  </div>`;
}

