import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { LOCAL_DISPATCH_TARIFFS,calculateLocalDispatch,latestInvoiceDefaults } from "../../assets/js/domains/logistics/local-dispatch/tariffs.js";

const root=new URL("../../",import.meta.url);
const source=path=>readFile(new URL(path,root),"utf8");

test("tarifario local conserva los 60 destinos y cálculo original por sobrepeso",()=>{
  assert.equal(LOCAL_DISPATCH_TARIFFS.length,60);
  const armenia=calculateLocalDispatch("ARMENIA",1250,20000,10000);
  assert.equal(armenia.tariffBase,400000);
  assert.equal(armenia.extraKg,250);
  assert.equal(armenia.extraCost,150000);
  assert.equal(armenia.total,580000);
  const urbano=calculateLocalDispatch("URBANO",1600,0,0);
  assert.equal(urbano.extraKg,600);
  assert.equal(urbano.extraCost,0);
  assert.equal(urbano.total,30000);
});

test("facturación alimenta factura y peso del despacho sin duplicar captura",()=>{
  const defaults=latestInvoiceDefaults([
    {invoice_number:"FV-1",package_weight_kg:600,created_at:"2026-10-01T10:00:00Z"},
    {invoice_number:"FV-2",package_weight_kg:450,created_at:"2026-10-02T10:00:00Z"}
  ]);
  assert.equal(defaults.invoiceNumber,"FV-2, FV-1");
  assert.equal(defaults.weightKg,1050);
});

test("LOCAL_DISPATCH usa cargue/liquidación y nacional conserva guía",async()=>{
  const dispatch=await source("assets/js/domains/logistics/shipping/dispatch/dispatch-stage.js");
  const routes=await source("assets/js/domains/logistics/shipping/routes/shipping-routes.js");
  assert.match(dispatch,/current_step_code==="LOCAL_DISPATCH"/);
  assert.match(dispatch,/renderLocalDispatchStage/);
  assert.match(dispatch,/openGuideDialog/);
  assert.match(routes,/Cargue y despacho del vehículo/);
  assert.match(routes,/Registrar guía del despacho nacional/);
});

test("persistencia local queda ligada al CRM y cerrada al acceso directo",async()=>{
  const sql=await source("supabase/migrations/134_local_dispatch_trip_control_v11_45_0.sql");
  assert.match(sql,/create table if not exists public\.viajes_despacho/i);
  assert.match(sql,/organization_id uuid not null references erp_supply\.organizations/i);
  assert.match(sql,/task_id uuid not null references erp_supply\.order_tasks/i);
  assert.match(sql,/default 'PENDIENTE'/i);
  assert.match(sql,/alter table public\.viajes_despacho enable row level security/i);
  assert.match(sql,/revoke all on table public\.viajes_despacho from anon,authenticated/i);
  assert.doesNotMatch(sql,/using\s*\(\s*true\s*\)/i);
  assert.match(sql,/grant execute on function public\.erp_x_local_dispatch_save\(uuid,jsonb\) to authenticated/i);
  assert.match(sql,/case when estado_entrega='ENTREGADO' then total_viaje else 0 end/i);
});

test("historial conserva retorno, cierre, Excel y PDF dentro de Despachos",async()=>{
  const ledger=await source("assets/js/domains/logistics/local-dispatch/local-dispatch-ledger.js");
  const queue=await source("assets/js/modules/queue.js");
  const index=await source("index.html");
  assert.match(ledger,/NO ENTREGADOS/);
  assert.match(ledger,/localDispatchReturn/);
  assert.match(ledger,/window\.XLSX/);
  assert.match(ledger,/window\.jspdf/);
  assert.match(queue,/renderLocalDispatchLedger/);
  assert.match(index,/jspdf\/2\.5\.1/);
  assert.match(index,/jspdf-autotable\/3\.5\.31/);
});

test("API expone únicamente RPC autenticados del nuevo dominio",async()=>{
  const api=await source("assets/js/services/api.js");
  for(const token of ["erp_x_local_dispatch_save","erp_x_local_dispatch_trips","erp_x_local_dispatch_return"])assert.match(api,new RegExp(token));
});
