import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {displayNationalFreight} from "../../assets/js/domains/orders/freight/national-freight-display.js";

function harness(city="CALI"){
  const values=new Map();
  const card={
    querySelector(selector){
      if(!values.has(selector))values.set(selector,{textContent:""});
      return values.get(selector);
    }
  };
  const carrierHost={innerHTML:""};
  const materialPanel={innerHTML:"<p>Antiguo</p>"};
  const root={
    dataset:{},__freightPrediction:{old:true},
    querySelector(selector){return selector==='[name="clientCity"]'?{value:city}:null}
  };
  return {assistant:{root},card,carrierHost,materialPanel,value:s=>card.querySelector(s).textContent};
}

const prediction={
  available:true,city:"CALI",mode:"HISTORICAL_BASE_ACTIVE",
  cheapestCarrier:"COLVANES",fastestCarrier:"TCC",mostStableCarrier:"COLVANES",
  historicalBase:{samples:749,cities:85},
  training:{metrics:{medianAbsolutePercentageError:0.121}},
  carriers:[{carrier:"COLVANES",estimateLow:8036,estimateMid:15500,estimateHigh:26284,referenceSamples:14,referenceScope:"CITY_HISTORY",confidence:"MEDIUM",transit:{medianDays:1},risk:{dimensionalUpliftRate:0.2}},
            {carrier:"TCC",estimateLow:10000,estimateMid:17000,estimateHigh:30000,referenceSamples:7,referenceScope:"CITY_HISTORY",confidence:"MEDIUM"}]
};

test("Despacho nacional muestra predicción histórica aun sin peso Siesa",()=>{
  const h=harness();
  assert.doesNotThrow(()=>displayNationalFreight(h.assistant,h,prediction,null));
  assert.match(h.value("[data-freight-estimate-value]"),/COLVANES/);
  assert.match(h.value("[data-freight-estimate-copy]"),/CALI/);
  assert.match(h.carrierHost.innerHTML,/TCC/);
  assert.equal(h.assistant.root.__freightPrediction,prediction);
});

test("Despacho nacional refinado por peso mantiene estimación y transportadoras",()=>{
  const h=harness("ARMENIA");
  const refined={...prediction,city:"ARMENIA",mode:"REFINED_WEIGHT_MODEL"};
  assert.doesNotThrow(()=>displayNationalFreight(h.assistant,h,refined,50));
  assert.match(h.value("[data-freight-estimate-copy]"),/50/);
  assert.match(h.materialPanel.innerHTML,/PREDICCIÓN REFINADA/);
  assert.equal(h.assistant.root.__freightPrediction,refined);
});

test("Predicción no disponible no conserva valores anteriores ni lanza ReferenceError",()=>{
  const h=harness("PALMIRA");
  assert.doesNotThrow(()=>displayNationalFreight(h.assistant,h,{available:false},null));
  assert.match(h.value("[data-freight-estimate-copy]"),/PALMIRA/);
  assert.equal(h.assistant.root.__freightPrediction,null);
  assert.equal(h.carrierHost.innerHTML,"");
  assert.doesNotMatch(h.materialPanel.innerHTML,/Antiguo/);
});

test("Cambio de destino invalida consultas anteriores y limpia el snapshot",()=>{
  const source=readFileSync(new URL("../../assets/js/domains/orders/freight/freight-prediction.js",import.meta.url),"utf8");
  assert.match(source,/const request=\+\+freightRequest;[\s\S]*?assistant\.root\.__freightPrediction=null;[\s\S]*?if\(!route\|\|!city\)/);
  assert.match(source,/if\(request!==freightRequest\)return;/);
});
