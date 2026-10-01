import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import {fileURLToPath} from "node:url";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../..");
const migrationName="20261001205000_shipping_carrier_persistence_v11_43_1.sql";
const migrationPath=path.join(root,"supabase/migrations",migrationName);
const migration=fs.readFileSync(migrationPath,"utf8");
const ledger=JSON.parse(fs.readFileSync(path.join(root,"supabase/production-migration-ledger.json"),"utf8"));
const required=fs.readFileSync(path.join(root,"scripts/database/required-migration-contracts.mjs"),"utf8");
const runbook=fs.readFileSync(path.join(root,"docs/runbooks/shipping-migration-v11-43-1-cutover.md"),"utf8");

const carrierFields=[
  "carrier",
  "tracking_number",
  "carrier_invoice_number",
  "carrier_cost",
  "carrier_cost_currency"
];

function normalizeText(value){
  if(value===undefined)return undefined;
  const text=String(value??"").trim();
  return text||null;
}

function normalizeCost(value){
  if(value===undefined)return undefined;
  const text=String(value??"").trim();
  if(!text)return null;
  const numeric=Number(text);
  return Number.isFinite(numeric)?numeric:null;
}

function resolveState(existing,payload,{insert=false,actor="profile-new",at="2026-10-01T12:00:00Z"}={}){
  const has=key=>Object.prototype.hasOwnProperty.call(payload,key);
  const next={
    trackingNumber:insert?normalizeText(payload.trackingNumber):(has("trackingNumber")?normalizeText(payload.trackingNumber):existing.trackingNumber),
    carrier:insert?normalizeText(payload.carrier):(has("carrier")?normalizeText(payload.carrier):existing.carrier),
    carrierInvoiceNumber:insert?normalizeText(payload.carrierInvoiceNumber):(has("carrierInvoiceNumber")?normalizeText(payload.carrierInvoiceNumber):existing.carrierInvoiceNumber),
    carrierCost:insert?normalizeCost(payload.carrierCost):(has("carrierCost")?normalizeCost(payload.carrierCost):existing.carrierCost),
    carrierCostCurrency:insert
      ?(normalizeText(payload.carrierCostCurrency)||"COP")
      :(has("carrierCostCurrency")?normalizeText(payload.carrierCostCurrency)?.toUpperCase():existing.carrierCostCurrency),
    guideFileId:insert
      ?normalizeText(payload.guideFileId)
      :(has("guideFileId")?normalizeText(payload.guideFileId):existing.guideFileId),
    carrierCostRecordedBy:insert
      ?actor
      :(has("carrierCost")?actor:existing.carrierCostRecordedBy),
    carrierCostRecordedAt:insert
      ?at
      :(has("carrierCost")?at:existing.carrierCostRecordedAt),
    unrelatedMetadata:{...(existing.unrelatedMetadata||{})}
  };
  if(!next.trackingNumber)throw new Error("Número de guía requerido");
  if(!next.carrier)throw new Error("Transportadora requerida");
  if(!next.carrierInvoiceNumber)throw new Error("Factura de transportadora requerida");
  if(!(next.carrierCost>0))throw new Error("Costo de flete debe ser mayor que 0");
  if(next.carrierCostCurrency!=="COP")throw new Error("La moneda del flete debe ser COP");
  return next;
}

test("preflight source contract keeps stable RPC signature, hardening and grants",()=>{
  assert.match(migration,/create or replace function public\.erp_x_shipping_save_guide\(p_order_id uuid, p_payload jsonb\)/i);
  assert.match(migration,/returns jsonb/i);
  assert.match(migration,/security definer/i);
  assert.match(migration,/set search_path = erp_supply, public, auth, pg_catalog/i);
  assert.match(migration,/revoke all on function public\.erp_x_shipping_save_guide\(uuid,jsonb\) from public,anon/i);
  assert.match(migration,/grant execute on function public\.erp_x_shipping_save_guide\(uuid,jsonb\) to authenticated,service_role/i);
  assert.match(migration,/erp_supply\.can_access_module\('shipping','update'\)/);
  assert.match(migration,/erp_supply\.has_role\('super_admin'\)/);
  assert.match(migration,/erp_supply\.has_role\('jefe_logistica'\)/);
  assert.match(migration,/v_task\.assigned_profile_id is distinct from v_actor/);
});

test("preflight requires canonical columns without schema DDL or destructive operations",()=>{
  const insert=migration.match(/insert into erp_supply\.deliveries\(([\s\S]*?)\) values/i);
  assert.ok(insert,"deliveries INSERT missing");
  for(const field of carrierFields)assert.match(insert[1],new RegExp(`\\b${field}\\b`),field);
  assert.doesNotMatch(migration,/\balter\s+table\b/i);
  assert.doesNotMatch(migration,/\bcreate\s+table\b/i);
  assert.doesNotMatch(migration,/\bdrop\s+(?:table|column)\b/i);
  assert.doesNotMatch(migration,/\btruncate\b/i);
  assert.doesNotMatch(migration,/\bdelete\s+from\b/i);
});

test("target migration is the latest repository migration and required by repository contracts",()=>{
  const migrations=fs.readdirSync(path.join(root,"supabase/migrations"))
    .filter(name=>name.endsWith(".sql"))
    .sort();
  const index=migrations.indexOf(migrationName);
  assert.ok(index>=0,"Shipping migration missing");
  assert.deepEqual(migrations.slice(index+1),[],"a later migration may supersede the cutover patch");
  assert.match(required,/20261001205000_shipping_carrier_persistence_v11_43_1\.sql/);
  assert.match(required,/shipping-guide-persistence-contract\.test\.mjs/);
});

test("ledger provenance remains inside the frozen historical debt budget",()=>{
  const debt=ledger.knownDatabaseOnly||[];
  assert.equal(debt.length,Number(ledger.debtBudget));
  assert.equal(new Set(debt).size,debt.length);
  assert.equal(ledger.projectId,"hezjxcxxcjlpmyalftam");
  assert.ok(!ledger.verifiedApplied?.some(row=>String(row.repositoryFile||"").endsWith(migrationName)),
    "Shipping V11.43.1 must not be predeclared as applied in repository ledger");
});

test("INSERT rehearsal persists all five canonical carrier values",()=>{
  const inserted=resolveState({},{
    trackingNumber:"TRACK-1",
    carrier:"TCC",
    carrierInvoiceNumber:"INV-1",
    carrierCost:"25000",
    carrierCostCurrency:"COP",
    guideFileId:"file-1"
  },{insert:true,actor:"profile-1",at:"2026-10-01T10:00:00Z"});
  assert.deepEqual(inserted,{
    trackingNumber:"TRACK-1",
    carrier:"TCC",
    carrierInvoiceNumber:"INV-1",
    carrierCost:25000,
    carrierCostCurrency:"COP",
    guideFileId:"file-1",
    carrierCostRecordedBy:"profile-1",
    carrierCostRecordedAt:"2026-10-01T10:00:00Z",
    unrelatedMetadata:{}
  });
});

test("single-field UPDATE preserves tracking, invoice, currency, guideFileId and unrelated metadata",()=>{
  const existing={
    trackingNumber:"TRACK-OLD",
    carrier:"TCC",
    carrierInvoiceNumber:"INV-OLD",
    carrierCost:25000,
    carrierCostCurrency:"COP",
    guideFileId:"file-old",
    carrierCostRecordedBy:"profile-old",
    carrierCostRecordedAt:"2026-09-30T10:00:00Z",
    unrelatedMetadata:{destination:{city:"Cali"},custom:"keep-me"}
  };
  const updated=resolveState(existing,{carrierCost:"31000"},{actor:"profile-new",at:"2026-10-01T11:00:00Z"});
  assert.equal(updated.trackingNumber,"TRACK-OLD");
  assert.equal(updated.carrier,"TCC");
  assert.equal(updated.carrierInvoiceNumber,"INV-OLD");
  assert.equal(updated.carrierCost,31000);
  assert.equal(updated.carrierCostCurrency,"COP");
  assert.equal(updated.guideFileId,"file-old");
  assert.equal(updated.carrierCostRecordedBy,"profile-new");
  assert.equal(updated.carrierCostRecordedAt,"2026-10-01T11:00:00Z");
  assert.deepEqual(updated.unrelatedMetadata,existing.unrelatedMetadata);
});

test("five-field UPDATE replaces only the explicit carrier state",()=>{
  const existing={
    trackingNumber:"TRACK-OLD",carrier:"TCC",carrierInvoiceNumber:"INV-OLD",carrierCost:25000,
    carrierCostCurrency:"COP",guideFileId:"file-old",carrierCostRecordedBy:"profile-old",
    carrierCostRecordedAt:"2026-09-30T10:00:00Z",unrelatedMetadata:{custom:"keep"}
  };
  const updated=resolveState(existing,{
    trackingNumber:"TRACK-NEW",
    carrier:"Coordinadora",
    carrierInvoiceNumber:"INV-NEW",
    carrierCost:"42000",
    carrierCostCurrency:"COP"
  },{actor:"profile-new",at:"2026-10-01T12:00:00Z"});
  assert.equal(updated.trackingNumber,"TRACK-NEW");
  assert.equal(updated.carrier,"Coordinadora");
  assert.equal(updated.carrierInvoiceNumber,"INV-NEW");
  assert.equal(updated.carrierCost,42000);
  assert.equal(updated.carrierCostCurrency,"COP");
  assert.equal(updated.guideFileId,"file-old");
  assert.deepEqual(updated.unrelatedMetadata,{custom:"keep"});
});

test("omitted carrier fields preserve prior values and audit actor/time",()=>{
  const existing={
    trackingNumber:"TRACK",carrier:"TCC",carrierInvoiceNumber:"INV",carrierCost:20000,
    carrierCostCurrency:"COP",guideFileId:"file-1",carrierCostRecordedBy:"profile-old",
    carrierCostRecordedAt:"2026-09-30T10:00:00Z",unrelatedMetadata:{x:1}
  };
  const updated=resolveState(existing,{guideFileId:"file-2"},{actor:"profile-new",at:"2026-10-01T12:00:00Z"});
  assert.equal(updated.trackingNumber,"TRACK");
  assert.equal(updated.carrierCost,20000);
  assert.equal(updated.carrierCostRecordedBy,"profile-old");
  assert.equal(updated.carrierCostRecordedAt,"2026-09-30T10:00:00Z");
  assert.equal(updated.guideFileId,"file-2");
});

test("explicit null/empty and non-COP values follow current rejection semantics",()=>{
  const existing={
    trackingNumber:"TRACK",carrier:"TCC",carrierInvoiceNumber:"INV",carrierCost:20000,
    carrierCostCurrency:"COP",guideFileId:"file-1",carrierCostRecordedBy:"profile-old",
    carrierCostRecordedAt:"2026-09-30T10:00:00Z",unrelatedMetadata:{}
  };
  assert.throws(()=>resolveState(existing,{trackingNumber:""}),/Número de guía/);
  assert.throws(()=>resolveState(existing,{carrier:null}),/Transportadora/);
  assert.throws(()=>resolveState(existing,{carrierInvoiceNumber:""}),/Factura/);
  assert.throws(()=>resolveState(existing,{carrierCost:null}),/Costo/);
  assert.throws(()=>resolveState(existing,{carrierCostCurrency:"USD"}),/COP/);
});

test("migration DDL is re-applicable without destructive schema changes",()=>{
  const creates=(migration.match(/create or replace function public\.erp_x_shipping_save_guide/gi)||[]).length;
  assert.equal(creates,1);
  assert.match(migration,/revoke all on function/i);
  assert.match(migration,/grant execute on function/i);
  assert.match(migration,/select pg_notify\('pgrst','reload schema'\)/i);
  assert.doesNotMatch(migration,/drop function/i);
});

test("corrected carrier billing fields persist in columns, not delivery metadata fallback",()=>{
  const deliveryInsert=migration.match(/insert into erp_supply\.deliveries\(([\s\S]*?)\) values\(([\s\S]*?)\) returning/i);
  const deliveryUpdate=migration.match(/update erp_supply\.deliveries([\s\S]*?)where id=v_delivery\.id/i);
  assert.ok(deliveryInsert&&deliveryUpdate);
  for(const assignment of [
    "carrier_invoice_number=v_carrier_invoice",
    "carrier_cost=v_carrier_cost",
    "carrier_cost_currency=v_carrier_cost_currency"
  ])assert.ok(deliveryUpdate[1].includes(assignment),assignment);
  const metadataWrites=[...migration.matchAll(/(?:metadata\s*=|jsonb_build_object\()([\s\S]{0,500})/gi)]
    .map(match=>match[1])
    .filter(block=>/shippingVersion|guideFileId|destination/.test(block));
  for(const block of metadataWrites){
    assert.doesNotMatch(block,/'carrierInvoiceNumber'|'carrierCost'|'carrierCostCurrency'/);
  }
});

test("runbook contains preflight, postflight, rollback, smoke and no destructive down migration",()=>{
  for(const heading of ["PREFLIGHT","APLICACIÓN CONTROLADA","POSTFLIGHT","ROLLBACK / RECOVERY","SMOKE DE NEGOCIO"]){
    assert.ok(runbook.includes(heading),heading);
  }
  assert.match(runbook,/pg_get_functiondef/i);
  assert.match(runbook,/schema_migrations/i);
  assert.match(runbook,/forward-fix/i);
  assert.match(runbook,/NO borrar columnas/i);
  assert.match(runbook,/NO ejecutar en producción desde este runbook/i);
  assert.match(runbook,/carrier_invoice_number/i);
  assert.match(runbook,/carrier_cost_currency/i);
});
