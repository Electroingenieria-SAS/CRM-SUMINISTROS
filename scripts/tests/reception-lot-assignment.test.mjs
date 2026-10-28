import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {fileURLToPath} from "node:url";
import {validateReceptionOriginPlan,receptionOriginCards,assertReceptionOriginCards} from "../../assets/js/domains/receiving/order/assignment/lot-selection.js";

const plan={
  required:8,shortage:0,totalAvailable:14,
  candidates:[
    {lotId:"lot-a",lotNumber:"LOTE-01",warehouseCode:"B01",location:"A1",available:5},
    {lotId:"lot-b",lotNumber:"LOTE-02",warehouseCode:"B02",location:"C3",available:9}
  ],
  suggestedPlan:[{lotId:"lot-b",quantity:8}]
};

test("Logística selecciona varios lotes con suma y stock correctos",()=>{
  assert.equal(validateReceptionOriginPlan(plan,[{lotId:"lot-a",quantity:5},{lotId:"lot-b",quantity:3}],8),true);
  assert.equal(validateReceptionOriginPlan(plan,[{lotId:"lot-a",quantity:5}],8),false);
  assert.equal(validateReceptionOriginPlan(plan,[{lotId:"lot-a",quantity:6},{lotId:"lot-b",quantity:2}],8),false);
  assert.equal(validateReceptionOriginPlan(plan,[{lotId:"lot-a",quantity:4},{lotId:"lot-a",quantity:4}],8),false);
  assert.equal(validateReceptionOriginPlan(plan,[{lotId:"otro",quantity:8}],8),false);
});

test("Un faltante no inventa lotes y Corte no recibe selección de Recepción",()=>{
  assert.equal(validateReceptionOriginPlan({...plan,shortage:2},[],8),true);
  assert.equal(validateReceptionOriginPlan({...plan,shortage:2},[{lotId:"lot-a",quantity:5}],8),false);
  const html=receptionOriginCards([
    {reference:"REF-A",description:"Material A",quantity:8,unit:"UND"},
    {reference:"CABLE",description:"Cable",requiresCut:true,quantity:3,unit:"M"}
  ],[plan,null]);
  assert.match(html,/LOTE-01/);
  assert.match(html,/B01/);
  assert.match(html,/data-reception-origin-index="0"/);
  assert.doesNotMatch(html,/data-reception-origin-index="1"/);
});

test("La confirmación no permite cantidades incompletas",()=>{
  const draft={lines:[{quantity:8,receptionOrigins:[{lotId:"lot-a",quantity:5}]}]};
  assert.throws(()=>assertReceptionOriginCards(null,draft,[plan]),/Revisa los lotes/);
  draft.lines[0].receptionOrigins=[{lotId:"lot-a",quantity:5},{lotId:"lot-b",quantity:3}];
  assert.doesNotThrow(()=>assertReceptionOriginCards(null,draft,[plan]));
});

test("El contrato conserva asignación por línea y Alistamiento lee esa instrucción",()=>{
  const root=new URL("../../assets/js/domains/",import.meta.url);
  const confirm=readFileSync(new URL("receiving/order/actions/confirm-reception.js",root),"utf8");
  const restore=readFileSync(new URL("picking/verification/result-bindings.js",root),"utf8");
  const migration=readFileSync(fileURLToPath(new URL("../../supabase/migrations/20261028120000_reception_lot_origin_assignment.sql",import.meta.url)),"utf8");
  assert.match(confirm,/receptionOrigins:line\.requiresCut\?\[\]/);
  assert.match(restore,/metadata\?\.receptionOrigins/);
  assert.match(migration,/quantity_available/);
  assert.match(migration,/new\.material_master_id/);
  assert.match(migration,/is not distinct from new\.material_variant_id/);
});
