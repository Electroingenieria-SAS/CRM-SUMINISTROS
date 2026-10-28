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
        <path d="M7 17 