import { fmt } from "../../../core/format.js";
import { moneyCop, customerConfidenceLabel } from "../shared/order-formatters.js";
import { freightBasisLabel } from "./freight-display.js";

export function displayLocalFreight(assistant,{card},data,city){
if(!data?.available){
          card.querySelector("[data-freight-estimate-value]").textContent="Sin histórico específico para esta modalidad";
          card.querySelector("[data-freight-estimate-copy]").textContent=`La base cargada de 749 despachos corresponde a transporte nacional. Para ${city}, esta modalidad se medirá con sus propios costos reales para no mezclar tarifas nacionales con entregas locales o recogidas.`;
          card.querySelector("[data-freight-confidence]").textContent="Base nacional disponible · modalidad local separada";
          assistant.root.dataset.freightEstimateLabel="Sin histórico específico de modalidad";
          return;
        }
const low=moneyCop(data.estimateLow||0),high=moneyCop(data.estimateHigh||0);
const basis=freightBasisLabel(data.basis);
const distance=data.estimatedDistanceKm!=null?` · ~${fmt.number(data.estimatedDistanceKm,1)} km`:"";
const transit=data.estimatedTransitHours!=null?` · ~${fmt.number(data.estimatedTransitHours,1)} h`:"";
const label=low===high?low:`${low} – ${high}`;
card.querySelector("[data-freight-estimate-value]").textContent=label;
card.querySelector("[data-freight-estimate-copy]").textContent=`${data.samples||0} caso${Number(data.samples||0)===1?"":"s"} comparable${Number(data.samples||0)===1?"":"s"} · patrón principal: ${basis}${distance}${transit}.`;
card.querySelector("[data-freight-confidence]").textContent=`Confianza: ${customerConfidenceLabel(data.confidence)} · ${String(data.scope||"ROUTE").toLowerCase()}`;
assistant.root.dataset.freightEstimateLabel=`${label} · ${basis}`;
}
