import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const read = path => readFileSync(new URL("../../"+path,import.meta.url),"utf8");
const ui = read("assets/js/modules/cutting-flow.js");
const api = read("assets/js/services/api.js");
const css = read("assets/css/modules/approvals/exceptions-order-support-zone.css");
const migration = read("supabase/migrations/20261104225000_cutting_no_remainder_approval.sql");

test("Corte confirma carretos sin solicitar autorización por remanentes",()=>{
  assert.match(ui,/if\(!p\.canExecute\)/);
  assert.match(ui,/button\.disabled=false/);
  assert.match(ui,/data-execute-batch/);
  assert.match(ui,/reelRemaining/);
  for(const legacy of ["approvalRequired","approvalReady","requestRemainderApproval","data-request-remainder-approval","Autorizar remanente crítico"]){
    assert.equal(ui.includes(legacy),false,legacy);
  }
  assert.equal(api.includes("requestCutRemainderApproval"),false);
  assert.equal(css.includes(".cutting-approval-warning"),false);
  assert.equal(css.includes(".cutting-approval-dialog"),false);
});

test("La migración elimina exclusivamente el flujo de aprobación y conserva seguridad física",()=>{
  assert.match(migration,/DROP FUNCTION IF EXISTS public\.erp_x_request_cut_remainder_approval\(text,jsonb\)/);
  assert.match(migration,/CREATE OR REPLACE FUNCTION erp_supply\.execute_cut_group_core/);
  assert.match(migration,/CREATE OR REPLACE FUNCTION public\.erp_x_cutting_batch_plan/);
  assert.match(migration,/CREATE OR REPLACE FUNCTION public\.erp_x_cutting_optimizer/);
  assert.match(migration,/v_reel_remaining<0/);
  assert.match(migration,/v_expected_planned/);
  assert.match(migration,/source_active/);
  assert.doesNotMatch(migration,/LOW_REEL_REMAINDER|APROBACION_REQUERIDA|approvalRequired|approvalReady|criticalRemainderMeters/);
});
