import { fmt } from "../../../core/format.js";
import { moneyCop, customerConfidenceLabel } from "../shared/order-formatters.js";

export function freightBasisLabel(value){
  return ({WEIGHT:"peso",PACKAGE_COUNT:"cantidad de paquetes",VOLUME:"volumen",ROUTE_HISTORY:"histórico de ruta",HISTORICAL_BASE:"base histórica cargada",WEIGHT_MODEL:"modelo por peso"})[String(value||"ROUTE_HISTORY").toUpperCase()]||"histórico de ruta";
}

export function freightReferenceScopeLabel(value){
  return ({CITY_HISTORY:"histórico de ciudad",DEPARTMENT_HISTORY:"histórico departamental",NATIONAL_BASELINE:"base nacional de la transportadora"})[String(value||"").toUpperCase()]||"base histórica";
}

export function freightPredictionsHtml(data={}){
  const rows=Array.isArray(data.carriers)?data.carriers:[];
  if(!rows.length)return "";
  return rows.map(row=>{
    const eta=Number(row?.transit?.medianDays);
    const uplift=Number(row?.risk?.dimensionalUpliftRate);
    const referenceSamples=Number(row.referenceSamples??row.routeSamples??0);
    const referenceScope=freightReferenceScopeLabel(row.referenceScope);
    const confidence=customerConfidenceLabel(row.confidence);
    const low=moneyCop(row.estimateLow||0);
    const high=moneyCop(row.estimateHigh||0);
    const mid=moneyCop(row.estimateMid||0);
    const range=low===high?mid:`${low} – ${high}`;
    const tags=[];
    if(row.carrier===data.cheapestCarrier)tags.push("Más económico");
    if(row.carrier===data.fastestCarrier)tags.push("Más rápido");
    if(row.carrier===data.mostStableCarrier)tags.push("Más estable");
    const best=row.carrier===data.cheapestCarrier;
    return `<article class="sales-freight-carrier-v1140 ${best?"is-recommended":""}">
      <header class="sales-freight-carrier-head-v1143">
        <div class="sales-freight-carrier-title-v1143">
          <strong>${fmt.escape(row.carrier||"Transportadora")}</strong>
          <small>${fmt.number(referenceSamples)} muestra${referenceSamples===1?"":"s"} · ${fmt.escape(referenceScope)}</small>
        </div>
        <div class="sales-freight-carrier-price-v1143">
          <span>Rango estimado</span>
          <b>${fmt.escape(range)}</b>
        </div>
      </header>
      <div class="sales-freight-carrier-metrics-v1143">
        <div class="sales-freight-metric-v1143"><span>Valor central</span><b>${fmt.escape(mid)}</b></div>
        <div class="sales-freight-metric-v1143"><span>ETA histórico</span><b>${eta>0?`${fmt.number(eta,1)} días`:"No disponible"}</b></div>
        <div class="sales-freight-metric-v1143"><span>Confianza</span><b>${fmt.escape(confidence)}</b></div>
        <div class="sales-freight-metric-v1143"><span>Riesgo peso cobrado</span><b>${Number.isFinite(uplift)&&uplift>0?`${fmt.number(uplift*100,0)}%`:"No disponible"}</b></div>
      </div>
      ${tags.length?`<footer class="sales-freight-carrier-tags-v1143">${tags.map(tag=>`<span>${fmt.escape(tag)}</span>`).join("")}</footer>`:""}
    </article>`;
  }).join("");
}
