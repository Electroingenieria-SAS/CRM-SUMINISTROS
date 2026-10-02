import { fmt } from "../../../core/format.js";
import { indicatorEmpty } from "./team-now.js";

export function customerRankingHtml(data={}){
  const rows=data.rows||[];
  if(!rows.length)return indicatorEmpty("Aún no hay clientes para comparar","El ranking aparecerá cuando existan pedidos reales.");
  const max=Math.max(...rows.map(row=>Number(row.score||0)),1);
  return `<div class="work-customer-ranking-v11390">${rows.map((row,index)=>{
    const score=Math.max(0,Number(row.score||0));
    const width=Math.max(4,100*score/max);
    const segment=String(row.segment||"NORMAL").toLowerCase();
    const amount=row.rankingValue??row.paidAmount??0;
    return `<article><span class="work-customer-rank-v11390">${String(index+1).padStart(2,"0")}</span><div class="work-customer-copy-v11390"><div><strong>${fmt.escape(row.customerName||"Cliente")}</strong><span class="work-customer-segment-v11390 tone-${segment}">${fmt.escape(customerSegmentAnalyticsLabel(row.segment))}</span></div><small>${fmt.number(row.orderCount||0)} pedido${Number(row.orderCount||0)===1?"":"s"} · ${customerMoney(amount)} · ${customerValueSourceAnalyticsLabel(row.valueSource)} · confianza ${customerConfidenceAnalyticsLabel(row.confidence)}</small><div class="work-customer-track-v11390"><span style="--customer-score:${width}%"></span></div></div><b>${fmt.number(score,1)}</b></article>`;
  }).join("")}</div>`;
}

export function customerMoney(value){
  try{return new Intl.NumberFormat("es-CO",{style:"currency",currency:"COP",maximumFractionDigits:0}).format(Number(value||0))}
  catch{return fmt.number(value||0)}
}

export function customerSegmentAnalyticsLabel(value){return ({URGENT:"Urgente",PREMIUM:"Premium",NORMAL:"Normal",BASIC:"Básico"})[String(value||"NORMAL").toUpperCase()]||"Normal"}

export function customerConfidenceAnalyticsLabel(value){return ({HIGH:"alta",MEDIUM:"media",LOW:"baja",LEARNING:"aprendiendo"})[String(value||"LEARNING").toUpperCase()]||"aprendiendo"}

export function customerValueSourceAnalyticsLabel(value){return ({PAYMENT_AMOUNT:"pago confirmado",PAYMENT_WITH_INVOICE_FALLBACK:"pago + respaldo de factura",INVOICE_AMOUNT_FALLBACK:"factura como respaldo",NONE:"sin valor confirmado"})[String(value||"NONE").toUpperCase()]||"valor documentado"}
