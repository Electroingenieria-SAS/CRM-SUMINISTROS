import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const root=new URL("../..",import.meta.url);
const migrationPath=new URL("../../supabase/migrations/20261001205000_shipping_carrier_persistence_v11_43_1.sql",import.meta.url);
const migrationContractPath=new URL("../../scripts/database/required-migration-contracts.mjs",import.meta.url);
const sql=fs.readFileSync(migrationPath,"utf8");
const required=fs.readFileSync(migrationContractPath,"utf8");

const carrierColumns=[
  "carrier",
  "tracking_number",
  "carrier_invoice_number",
  "carrier_cost",
  "carrier_cost_currency"
];

test("shipping INSERT persists all five carrier fields in canonical delivery columns",()=>{
  const insert=sql.match(/insert into erp_supply\.deliveries\(([\s\S]*?)\) values\(([\s\S]*?)\) returning/i);
  assert.ok(insert,"delivery INSERT not found");
  for(const column of carrierColumns)assert.match(insert[1],new RegExp(`\\b${column}\\b`),column);
  for(const value of ["v_carrier","v_tracking","v_carrier_invoice","v_carrier_cost","v_carrier_cost_currency"]){
    assert.match(insert[2],new RegExp(`\\b${value}\\b`),value);
  }
});

test("shipping UPDATE modifies all five carrier fields explicitly",()=>{
  const update=sql.match(/update erp_supply\.deliveries([\s\S]*?)where id=v_delivery\.id/i);
  assert.ok(update,"delivery UPDATE not found");
  for(const assignment of [
    "carrier=v_carrier",
    "tracking_number=v_tracking",
    "carrier_invoice_number=v_carrier_invoice",
    "carrier_cost=v_carrier_cost",
    "carrier_cost_currency=v_carrier_cost_currency"
  ])assert.ok(update[1].includes(assignment),assignment);
});

test("partial unrelated UPDATE preserves prior carrier values while explicit empty required values reject",()=>{
  for(const token of [
    "case when v_has_tracking then v_tracking_input else nullif(trim(v_delivery.tracking_number),'') end",
    "case when v_has_carrier then v_carrier_input else nullif(trim(v_delivery.carrier),'') end",
    "case when v_has_invoice then v_invoice_input else nullif(trim(v_delivery.carrier_invoice_number),'') end",
    "case when v_has_cost then v_cost_input else v_delivery.carrier_cost end",
    "else coalesce(nullif(upper(trim(v_delivery.carrier_cost_currency)),''),'COP')"
  ])assert.ok(sql.includes(token),token);

  for(const rejection of [
    "if v_tracking is null then raise exception 'Número de guía requerido'",
    "if v_carrier is null then raise exception 'Transportadora requerida'",
    "if v_carrier_invoice is null then raise exception 'Factura de transportadora requerida'",
    "if v_carrier_cost is null or v_carrier_cost<=0 then raise exception 'Costo de flete debe ser mayor que 0'",
    "if v_carrier_cost_currency<>'COP' then raise exception 'La moneda del flete debe ser COP'"
  ])assert.ok(sql.includes(rejection),rejection);
});

test("guideFileId and carrier audit metadata survive unrelated partial updates",()=>{
  assert.match(sql,/when p_payload \? 'guideFileId' then nullif\(trim\(p_payload->>'guideFileId'\),''\)/);
  assert.match(sql,/else nullif\(trim\(v_delivery\.metadata->>'guideFileId'\),''\)/);
  assert.match(sql,/carrier_cost_recorded_by=case when v_has_cost then v_actor else carrier_cost_recorded_by end/);
  assert.match(sql,/carrier_cost_recorded_at=case when v_has_cost then now\(\) else carrier_cost_recorded_at end/);
});

test("shipping migration is reproducible and does not invent schema",()=>{
  assert.match(sql,/create or replace function public\.erp_x_shipping_save_guide\(p_order_id uuid, p_payload jsonb\)/i);
  assert.doesNotMatch(sql,/alter\s+table/i);
  assert.doesNotMatch(sql,/create\s+table/i);
  assert.match(sql,/security definer/i);
  assert.match(sql,/set search_path = erp_supply, public, auth, pg_catalog/i);
  assert.match(sql,/revoke all on function public\.erp_x_shipping_save_guide\(uuid,jsonb\) from public,anon/i);
  assert.match(sql,/grant execute on function public\.erp_x_shipping_save_guide\(uuid,jsonb\) to authenticated,service_role/i);
  assert.match(sql,/Shipping guide persistence contract incomplete/);
});

test("required migration contract recognizes the Shipping carrier persistence migration",()=>{
  assert.match(required,/20261001205000_shipping_carrier_persistence_v11_43_1\.sql/);
  assert.match(required,/shipping-guide-persistence-contract\.test\.mjs/);
});

test("INSERT and UPDATE rehearsal preserves canonical carrier state semantics",()=>{
  const normalizeText=value=>{
    const text=String(value??"").trim();
    return text||null;
  };
  const normalizeCost=value=>{
    if(value===undefined)return undefined;
    const text=String(value??"").trim();
    if(!text)return null;
    const n=Number(text);
    return Number.isFinite(n)?n:null;
  };
  const resolve=(existing,payload,insert=false)=>{
    const has=key=>Object.prototype.hasOwnProperty.call(payload,key);
    const state={
      trackingNumber:insert?normalizeText(payload.trackingNumber):has("trackingNumber")?normalizeText(payload.trackingNumber):existing.trackingNumber,
      carrier:insert?normalizeText(payload.carrier):has("carrier")?normalizeText(payload.carrier):existing.carrier,
      carrierInvoiceNumber:insert?normalizeText(payload.carrierInvoiceNumber):has("carrierInvoiceNumber")?normalizeText(payload.carrierInvoiceNumber):existing.carrierInvoiceNumber,
      carrierCost:insert?normalizeCost(payload.carrierCost):has("carrierCost")?normalizeCost(payload.carrierCost):existing.carrierCost,
      carrierCostCurrency:insert?(normalizeText(payload.carrierCostCurrency)||"COP"):has("carrierCostCurrency")?normalizeText(payload.carrierCostCurrency)?.toUpperCase():existing.carrierCostCurrency
    };
    if(!state.trackingNumber||!state.carrier||!state.carrierInvoiceNumber||!(state.carrierCost>0)||state.carrierCostCurrency!=="COP")throw new Error("invalid shipping carrier state");
    return state;
  };

  const inserted=resolve({},{
    trackingNumber:"G-1",
    carrier:"TCC",
    carrierInvoiceNumber:"INV-1",
    carrierCost:"25000",
    carrierCostCurrency:"COP"
  },true);
  assert.deepEqual(inserted,{
    trackingNumber:"G-1",
    carrier:"TCC",
    carrierInvoiceNumber:"INV-1",
    carrierCost:25000,
    carrierCostCurrency:"COP"
  });

  const updated=resolve(inserted,{
    trackingNumber:"G-2",
    carrier:"Coordinadora",
    carrierInvoiceNumber:"INV-2",
    carrierCost:"32000",
    carrierCostCurrency:"COP"
  });
  assert.deepEqual(updated,{
    trackingNumber:"G-2",
    carrier:"Coordinadora",
    carrierInvoiceNumber:"INV-2",
    carrierCost:32000,
    carrierCostCurrency:"COP"
  });

  const unrelated=resolve(updated,{guideFileId:"file-2"});
  assert.deepEqual(unrelated,updated);

  assert.throws(()=>resolve(updated,{carrier:""}),/invalid shipping carrier state/);
  assert.throws(()=>resolve(updated,{carrierCostCurrency:"USD"}),/invalid shipping carrier state/);
});
