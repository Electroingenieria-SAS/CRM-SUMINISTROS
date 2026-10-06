import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root=new URL("../../",import.meta.url);
const source=path=>readFile(new URL(path,root),"utf8");

test("V11.46.0 conserva costo original y limita revisiones a tres",async()=>{
  const sql=await source("supabase/migrations/20261006145000_local_dispatch_cost_adjustments_v11_46_0.sql");
  assert.match(sql,/viajes_despacho_ajustes_costo/);
  assert.match(sql,/revision_number smallint not null check\(revision_number between 1 and 3\)/i);
  assert.match(sql,/unique\(trip_id,revision_number\)/i);
  assert.match(sql,/for update/i);
  assert.match(sql,/if v_used>=3 then/i);
  assert.match(sql,/Se alcanzó el máximo de 3 modificaciones permitidas/);
  assert.match(sql,/char_length\(v_justification\)<15/i);
  assert.match(sql,/LOCAL_DISPATCH_COST_ADJUSTED/);
});

test("el servidor calcula el total y valida conceptos de costos",async()=>{
  const sql=await source("supabase/migrations/20261006145000_local_dispatch_cost_adjustments_v11_46_0.sql");
  assert.match(sql,/v_new_total:=v_trip\.costo_original\+v_adjustment_total/i);
  assert.match(sql,/v_concept not in \('AYUDANTE','PARADA_ADICIONAL','PEAJE','DESCARGUE','DESVIO','PARQUEADERO','TIEMPO_ESPERA','OTRO'\)/i);
  assert.match(sql,/v_value is null or v_value<=0/i);
  assert.match(sql,/v_concept='OTRO'/i);
  assert.match(sql,/carrier_cost=v_new_total/i);
  assert.match(sql,/'costRevisionCount',v_next/i);
});

test("retorno ya no puede reescribir costos por fuera del ledger",async()=>{
  const sql=await source("supabase/migrations/20261006145000_local_dispatch_cost_adjustments_v11_46_0.sql");
  const start=sql.indexOf("create or replace function public.erp_x_local_dispatch_return");
  const end=sql.indexOf("revoke all on function public.erp_x_local_dispatch_cost_detail",start);
  const fn=sql.slice(start,end);
  assert.ok(start>0&&end>start);
  assert.doesNotMatch(fn,/p_payload->>'costoDescargue'/);
  assert.doesNotMatch(fn,/p_payload->>'costoDesvio'/);
  assert.doesNotMatch(fn,/costo_descargue\s*=/i);
  assert.doesNotMatch(fn,/costo_desvio\s*=/i);
  assert.match(fn,/carrier_cost=v_trip\.total_viaje/i);
});

test("frontend expone detalle y ajuste mediante RPC dedicados",async()=>{
  const api=await source("assets/js/services/api.js");
  const editor=await source("assets/js/domains/logistics/local-dispatch/cost-adjustments.js");
  assert.match(api,/erp_x_local_dispatch_cost_detail/);
  assert.match(api,/erp_x_local_dispatch_cost_adjust/);
  assert.match(editor,/Modificaciones utilizadas/);
  assert.match(editor,/Guardar ajuste/);
  assert.match(editor,/Justificación del cambio/);
  assert.match(editor,/Historial de modificaciones/);
});

test("historial de despachos separa original, ajustes y total definitivo",async()=>{
  const ledger=await source("assets/js/domains/logistics/local-dispatch/local-dispatch-ledger.js");
  assert.match(ledger,/Costo original/);
  assert.match(ledger,/Ajustes/);
  assert.match(ledger,/Total definitivo/);
  assert.match(ledger,/Gestionar costos/);
  assert.match(ledger,/localDispatchCostManager/);
  assert.doesNotMatch(ledger,/name="unloadingCost"/);
  assert.doesNotMatch(ledger,/name="diversionCost"/);
});

test("registro inicial del flete diferencia datos operativos y liquidación",async()=>{
  const stage=await source("assets/js/domains/logistics/local-dispatch/local-dispatch-stage.js");
  assert.match(stage,/DATOS DEL VIAJE/i);
  assert.match(stage,/COSTOS INICIALES DEL VIAJE/i);
  assert.match(stage,/Total inicial del flete/);
  assert.match(stage,/posteriores al despacho/);
});
