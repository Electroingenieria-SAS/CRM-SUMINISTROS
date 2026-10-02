import { fmt } from "../../../core/format.js";
import { moneyCop } from "../shared/order-formatters.js";
import { freightReferenceScopeLabel, freightPredictionsHtml } from "./freight-display.js";

export function displayNationalFreight(assistant,{card,carrierHost,materialPanel},data,weightKg){
assistant.root.__freightPrediction=data;
const carriers=Array.isArray(data?.carriers)?data.carriers:[];
const cheapest=carriers.find(row=>row.carrier===data?.cheapestCarrier)||carriers[0]||null;
if(!data?.available||!cheapest){
          card.querySelector("[data-freight-estimate-value]").textContent="Base histórica temporalmente no disponible";
          card.querySelector("[data-freight-estimate-copy]").textContent="El archivo histórico sigue cargado, pero no fue posible obtener una lectura para "+city+" en este momento.";
          card.querySelector("[data-freight-confidence]").textContent="Base histórica integrada · reintento disponible";
          if(carrierHost)carrierHost.innerHTML="";
          assistant.root.dataset.freightEstimateLabel="Base histórica no consultable";
          return;
        }
const low=moneyCop(cheapest.estimateLow||0),high=moneyCop(cheapest.estimateHigh||0),mid=moneyCop(cheapest.estimateMid||0);
const range=low===high?mid:`${low} – ${high}`;
const refined=String(data.mode||"")==="REFINED_WEIGHT_MODEL";
const baseSamples=Number(data?.historicalBase?.samples||data?.training?.samples||749);
const referenceSamples=Number(cheapest.referenceSamples??cheapest.routeSamples??0);
const referenceScope=freightReferenceScopeLabel(cheapest.referenceScope);
card.querySelector("[data-freight-estimate-value]").textContent=`${cheapest.carrier} · ${range}`;
card.querySelector("[data-freight-estimate-copy]").textContent=refined
          ? `Predicción refinada con ${fmt.number(weightKg,2)} kg calculados desde Siesa. Usa los 749 despachos históricos cargados y compara las tres transportadoras.`
          : `Base histórica activa desde ahora: ${fmt.number(baseSamples)} despachos cargados. Para ${city}, la referencia actual usa ${fmt.number(referenceSamples)} muestra${referenceSamples===1?"":"s"} de ${referenceScope}; el peso solo refinará el cálculo.`;
const modelError=Number(data?.training?.metrics?.medianAbsolutePercentageError||0)*100;
card.querySelector("[data-freight-confidence]").textContent=refined
          ? `Modelo validado fuera de muestra · error mediano ${fmt.number(modelError||12.1,1)}%`
          : `Base histórica cargada · ${fmt.number(baseSamples)} despachos · ${fmt.number(data?.historicalBase?.cities||85)} ciudades`;
if(carrierHost)carrierHost.innerHTML=freightPredictionsHtml(data);
if(materialPanel){
          materialPanel.innerHTML=refined
            ? `<span>PREDICCIÓN REFINADA</span><div><strong>${fmt.escape(data.cheapestCarrier||cheapest.carrier)} desde ${fmt.escape(mid)}</strong><p>Peso estimado: ${fmt.number(weightKg,2)} kg · ${carriers.length} transportadoras comparadas · ${data.fastestCarrier?`más rápida histórica: ${fmt.escape(data.fastestCarrier)}`:"ETA no disponible para esta transportadora"}.</p></div>`
            : `<span>BASE HISTÓRICA ACTIVA</span><div><strong>${fmt.number(baseSamples)} despachos ya están siendo usados</strong><p>El costo mostrado ya sale del archivo integrado. Completa cantidades y materiales únicamente para afinar la estimación por peso.</p></div>`;
        }
assistant.root.dataset.freightEstimateLabel=`${cheapest.carrier} · ${range}${refined?` · ${fmt.number(weightKg,2)} kg`:" · preliminar"}`;
}
