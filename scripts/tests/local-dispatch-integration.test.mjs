import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { LOCAL_DISPATCH_TARIFFS,calculateLocalDispatch,latestInvoiceDefaults } from "../../assets/js/domains/logistics/local-dispatch/tariffs.js";

const root=new URL("../../",import.meta.url);
const source=path=>readFile(new URL(path,root),"utf8");

test("tarifario local adopta exactamente 54 destinos del CSV y calcula por kilo adicional",()=>{
  assert.equal(LOCAL_DISPATCH_TARIFFS.length,54);
  const armenia=calculateLocalDispatch("ARMENIA",1250,20000,10000);
  assert.equal(armenia.tariffBase,700000);
  assert.equal(armenia.extraKg,250);
  assert.equal(armenia.extraCost,25000);
  assert.equal(armenia.total,755000);
  const urbano=calculateLocalDispatch("URBANO",1600,0,0);
  assert.equal(urbano.extraKg,600);
  assert.equal(urbano.extraCost,28200);
  assert.equal(urbano.total,58200);
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


test("selector local muestra las 54 rutas en buscador agrupado y cotizador contraíble",async()=>{
 const {localRoutePickerHtml,LOCAL_ROUTE_CATEGORIES}=await import("../../assets/js/domains/logistics/local-dispatch/local-route-picker.js");
 const html=localRoutePickerHtml("SAN PEDRO");
 const stage=await source("assets/js/domains/logistics/local-dispatch/local-dispatch-stage.js");
 const css=await source("assets/css/modules/logistics/local-dispatch.css");
 assert.match(html,/data-local-route-query/);
 assert.match(html,/data-local-route-menu/);
 assert.match(html,/data-local-route-trigger/);
 assert.match(html,/SAN PEDRO/);
 assert.equal(LOCAL_ROUTE_CATEGORIES.length,3);
 assert.match(html,/1\. Categoría de ruta/);
 assert.match(html,/2\. Destino tarifario/);
 assert.match(html,/data-local-route-category/);
 assert.match(html,/value="TULUA_CERCANAS" selected/);
 assert.equal((html.match(/<option value=/g)||[]).length,LOCAL_DISPATCH_TARIFFS.filter(row=>row.zone==='TULUA_CERCANAS').length+LOCAL_ROUTE_CATEGORIES.length+2);
 assert.doesNotMatch(html,/value="ARMENIA"/);
 const empty=localRoutePickerHtml();
 assert.match(empty,/Selecciona primero la categoría/);
 assert.doesNotMatch(empty,/value="SAN PEDRO"/);
 const northern=localRoutePickerHtml('ARMENIA');
 assert.match(northern,/value="NORTE_VALLE_IBARRA" selected/);
 assert.match(northern,/value="ARMENIA" selected/);
 assert.doesNotMatch(northern,/value="SAN PEDRO"/);
 assert.match(stage,/dataset\.localQuoteToggle/);
 assert.match(stage,/bindLocalRoutePicker/);
 const drawer=await source("assets/js/domains/logistics/local-dispatch/local-quote-drawer.js");
 assert.match(drawer,/data-local-extra-toggle/);
 assert.match(drawer,/data-local-quote-overlay/);
 assert.match(drawer,/localRoutePickerHtml/);
 assert.match(stage,/latestInvoiceDefaults/);
 assert.match(css,/local-route-menu/);
 const workspace=await source("assets/css/modules/logistics/local-dispatch-workspace.css");
 assert.match(workspace,/local-quote-drawer/);
 assert.doesNotMatch(stage,/class="local-dispatch-quote-entry"/);
});


test("modal de despacho local distribuye seis campos en dos filas rectas",async()=>{
 const stage=await source("assets/js/domains/logistics/local-dispatch/local-dispatch-stage.js");
 const css=await source("assets/css/modules/logistics/local-dispatch-modal-alignment.css");
 const operations=await source("assets/css/operations.css");
 assert.match(stage,/local-dispatch-modal-aligned/);
 assert.equal((stage.match(/data-trip-field-row=/g)||[]).length,2);
 const first=stage.split('data-trip-field-row="primary"')[1].split('</div>')[0];
 const second=stage.split('data-trip-field-row="vehicle"')[1].split('</div>')[0];
 for(const name of ['tripDate','invoiceNumber','branch'])assert.match(first,new RegExp('name="'+name+'"'));
 for(const name of ['weightKg','vehiclePlate','driverName'])assert.match(second,new RegExp('name="'+name+'"'));
 assert.equal((first.match(/<label>/g)||[]).length,3);
 assert.equal((second.match(/<label>/g)||[]).length,3);
 assert.match(stage,/id="local-dispatch-prefill-help"/);
 assert.match(stage,/aria-describedby="local-dispatch-prefill-help"/);
 assert.match(stage,/name="observations"/);
 assert.match(css,/local-dispatch-field-row/);
 assert.match(css,/grid-template-columns: repeat\(3,minmax\(0,1fr\)\)/);
 assert.match(css,/@media\(max-width:540px\)/);
 assert.match(operations,/local-dispatch-modal-alignment\.css/);
});

test("cotizador local abre un drawer fuera del scroll principal y sin CTA duplicada",async()=>{
 const stage=await source("assets/js/domains/logistics/local-dispatch/local-dispatch-stage.js");
 const drawer=await source("assets/js/domains/logistics/local-dispatch/local-quote-drawer.js");
 const entry=await source("assets/js/domains/freight-quotes/quote-order-entry.js");
 const style=await source("assets/css/modules/logistics/local-dispatch-workspace.css");
 assert.match(stage,/insertAdjacentHTML\('beforeend',localQuoteDrawerHtml\(values\)\)/);
 assert.match(stage,/dataset\.localQuoteToggle/);
 assert.match(stage,/preview\(modal\)/);
 assert.match(drawer,/role="dialog" aria-modal="true"/);
 assert.match(drawer,/data-local-quote-dismiss/);
 assert.match(drawer,/localRoutePickerHtml\(values\.city\)/);
 assert.match(drawer,/name="unloadingCost"/);
 assert.match(drawer,/name="diversionCost"/);
 assert.match(entry,/querySelector\('\.local-dispatch-modal-aligned'\)/);
 assert.match(style,/local-quote-overlay\[hidden\]/);
 assert.match(style,/\[data-paco-toast-stack\]/);
});
