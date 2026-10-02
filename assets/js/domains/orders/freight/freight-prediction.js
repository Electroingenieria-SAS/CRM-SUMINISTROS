import { api } from "../../../services/api.js";
import { estimatedSalesWeight } from "./material-weight.js";
import { displayNationalFreight } from "./national-freight-display.js";
import { displayLocalFreight } from "./local-freight-display.js";

export function freightPredictionSnapshot(data){
  if(!data?.available)return null;
  return {
    version:data.version||"11.40.0",
    mode:data.mode||null,
    weightKg:data.weightKg??null,
    cheapestCarrier:data.cheapestCarrier||null,
    fastestCarrier:data.fastestCarrier||null,
    mostStableCarrier:data.mostStableCarrier||null,
    carriers:(Array.isArray(data.carriers)?data.carriers:[]).slice(0,3).map(row=>({
      carrier:row.carrier,
      estimateLow:row.estimateLow,
      estimateMid:row.estimateMid,
      estimateHigh:row.estimateHigh,
      uncertaintyPct:row.uncertaintyPct,
      confidence:row.confidence,
      routeSamples:row.routeSamples,
      referenceSamples:row.referenceSamples,
      referenceScope:row.referenceScope||null,
      historicalBaseSamples:row.historicalBaseSamples,
      source:row.source||null,
      transit:row.transit||null,
      risk:row.risk||null
    }))
  };
}

export function bindFreightPrediction(assistant){
const routeControl=assistant.root.querySelector('[name="deliveryRoute"]');
let freightRequest=0;
let freightTimer=null;
const scheduleFreightEstimate=()=>{
    clearTimeout(freightTimer);
    freightTimer=setTimeout(refreshFreightEstimate,260);
  };
const refreshFreightEstimate=async()=>{
    const route=routeControl?.value||"";
    const department=assistant.root.querySelector('[name="clientDepartment"]')?.value.trim()||"";
    const city=assistant.root.querySelector('[name="clientCity"]')?.value.trim()||"";
    const card=assistant.root.querySelector("[data-freight-estimate]");
    const carrierHost=assistant.root.querySelector("[data-freight-carriers]");
    const materialPanel=assistant.root.querySelector("[data-material-freight-prediction]");
    if(!card)return;
    if(!route||!city){
      card.querySelector("[data-freight-estimate-value]").textContent="Selecciona modalidad y destino";
      card.querySelector("[data-freight-estimate-copy]").textContent="El CRM mostrará un rango cuando conozca la ruta y la ciudad.";
      card.querySelector("[data-freight-confidence]").textContent="Esperando ubicación";
      if(carrierHost)carrierHost.innerHTML="";
      if(materialPanel)materialPanel.innerHTML='<span>PREDICCIÓN LOGÍSTICA</span><div><strong>Selecciona destino y materiales</strong><p>La comparación se activa para despacho nacional.</p></div>';
      assistant.root.dataset.freightEstimateLabel="Base histórica nacional disponible";
      assistant.root.__freightPrediction=null;
      return;
    }
    const request=++freightRequest;
    card.classList.add("is-loading");
    try{
      const weightInfo=estimatedSalesWeight(assistant.root);
      if(route==="NATIONAL_DISPATCH"){
const weightKg=weightInfo.complete&&weightInfo.weightKg>0?weightInfo.weightKg:null;
const data=await api.freightPredictions({department,city,weightKg});
if(request!==freightRequest)return;
displayNationalFreight(assistant,{card,carrierHost,materialPanel},data,weightKg);
}else{
assistant.root.__freightPrediction=null;
if(carrierHost)carrierHost.innerHTML="";
const data=await api.freightEstimate({route,department,city});
if(request!==freightRequest)return;
displayLocalFreight(assistant,{card},data,city);
}
    }catch(error){
      if(request!==freightRequest)return;
      assistant.root.__freightPrediction=null;
      if(carrierHost)carrierHost.innerHTML="";
      card.querySelector("[data-freight-estimate-value]").textContent="Estimación temporalmente no disponible";
      card.querySelector("[data-freight-estimate-copy]").textContent="El destino quedó registrado; el pedido puede continuar normalmente.";
      card.querySelector("[data-freight-confidence]").textContent="Se reintentará con nuevos históricos";
      assistant.root.dataset.freightEstimateLabel="Estimación no disponible";
    }finally{
      if(request===freightRequest)card.classList.remove("is-loading");
    }
  };
routeControl?.addEventListener("change",scheduleFreightEstimate);
refreshFreightEstimate();
return scheduleFreightEstimate;
}
