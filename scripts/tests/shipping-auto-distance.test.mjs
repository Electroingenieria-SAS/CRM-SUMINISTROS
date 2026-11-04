import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { api } from "../../assets/js/services/api.js";
import { estimateShipmentDistance, routeCacheKey } from "../../assets/js/domains/logistics/shipping/actions/shipping-distance.js";

const source=path=>readFile(new URL("../../"+path,import.meta.url),"utf8");

test("la confirmación de satisfacción no muestra campos editables de kilómetros",async()=>{
  const [ui,sql,apiSource]=await Promise.all([
    source("assets/js/domains/logistics/shipping/actions/delivery-confirmation.js"),
    source("supabase/migrations/20261104104500_shipping_auto_distance_routes.sql"),
    source("assets/js/services/api.js")
  ]);
  assert.doesNotMatch(ui,/<input[^>]+name="distanceKm"/);
  assert.doesNotMatch(ui,/<select[^>]+name="distanceSource"/);
  assert.match(ui,/estimateShipmentDistance\(order\.id\)/);
  assert.match(ui,/await distancePromise/);
  assert.match(ui,/data-shipping-distance-estimate/);
  assert.match(ui,/Distancia pendiente/);
  assert.match(sql,/shippingOriginCity/);
  assert.match(sql,/seller_profile_id is distinct from v_actor/);
  assert.match(sql,/grant execute on function public\.erp_x_shipping_distance_context\(uuid\) to authenticated/);
  assert.match(apiSource,/shippingDistanceContext/);
});

test("una estimación usa distancia vial del proveedor y datos municipales oficiales",async()=>{
  const previousFetch=globalThis.fetch;
  const previousContext=api.shippingDistanceContext;
  const requested=[];
  try{
    api.shippingDistanceContext=async()=>({
      route:"LOCAL_DISPATCH",originDepartment:"Valle del Cauca",originCity:"Tuluá",
      destinationDepartment:"Valle del Cauca",destinationCity:"Guadalajara de Buga",
      distanceKm:null
    });
    globalThis.fetch=async url=>{
      const str=String(url);
      requested.push(str);
      if(str.includes("gdxc-w37w.json"))return {ok:true,json:async()=>[
        {cod_mpio:"76834",nom_mpio:"Tuluá",latitud:4.087,longitud:-76.196},
        {cod_mpio:"76111",nom_mpio:"Guadalajara de Buga",latitud:3.901,longitud:-76.299}
      ]};
      if(str.includes("/routed-car/route/v1/driving/"))return {
        ok:true,json:async()=>({code:"Ok",routes:[{distance:25470}]})
      };
      throw new Error("Proveedor inesperado");
    };
    const result=await estimateShipmentDistance("example-id");
    assert.equal(result.distanceKm,25.5);
    assert.equal(result.distanceSource,"ROUTE_ESTIMATE");
    assert.equal(result.estimated,true);
    assert.ok(requested.some(value=>value.includes("gdxc-w37w.json")));
    assert.ok(requested.some(value=>value.includes("routed-car/route")));
    assert.equal(routeCacheKey({code:"76834"},{code:"76111"}),"76834:76111");
    const previousCalls=requested.length;
    const again=await estimateShipmentDistance("example-id");
    assert.equal(again.distanceKm,25.5);
    assert.equal(requested.length,previousCalls,"la segunda consulta debe recuperar la ruta almacenada");
  }finally{
    globalThis.fetch=previousFetch;
    api.shippingDistanceContext=previousContext;
  }
});

test("un envío de retiro o en el mismo municipio no inventa kilometraje",async()=>{
  const previous=api.shippingDistanceContext;
  try{
    api.shippingDistanceContext=async()=>({route:"CLIENT_PICKUP",distanceKm:null});
    assert.equal((await estimateShipmentDistance("example-id")).distanceKm,null);
  }finally{api.shippingDistanceContext=previous}
});
