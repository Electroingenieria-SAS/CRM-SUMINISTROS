import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const migrationPath=new URL("../../supabase/migrations/20261001205000_shipping_carrier_persistence_v11_43_1.sql",import.meta.url);
const sql=fs.readFileSync(migrationPath,"utf8");

test("shipping persistence migration stores all five guide fields without a schema change",()=>{
  for(const token of [
    "tracking_number=v_tracking",
    "carrier=v_carrier",
    "'carrierInvoiceNumber',v_carrier_invoice",
    "'carrierCost',v_carrier_cost",
    "'carrierCostCurrency',v_carrier_cost_currency"
  ])assert.ok(sql.includes(token),`missing ${token}`);
  assert.doesNotMatch(sql,/alter\s+table/i);
  assert.doesNotMatch(sql,/create\s+table/i);
});

test("shipping persistence keeps security definer, search path and grants",()=>{
  assert.match(sql,/security definer/i);
  assert.match(sql,/set search_path = erp_supply, public, auth, pg_catalog/i);
  assert.match(sql,/revoke all on function public\.erp_x_shipping_save_guide\(uuid,jsonb\) from public,anon/i);
  assert.match(sql,/grant execute on function public\.erp_x_shipping_save_guide\(uuid,jsonb\) to authenticated,service_role/i);
});

test("shipping persistence validates invoice, positive cost and COP",()=>{
  assert.match(sql,/Factura de transportadora requerida/);
  assert.match(sql,/Costo de flete debe ser mayor que 0/);
  assert.match(sql,/La moneda del flete debe ser COP/);
  assert.match(sql,/Shipping guide persistence contract incomplete/);
});
