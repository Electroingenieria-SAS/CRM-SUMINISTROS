import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=path=>readFileSync(new URL("../../"+path,import.meta.url),"utf8");
const cut=read("assets/js/modules/cutting-flow.js");
const api=read("assets/js/services/api.js");
const rec=read("assets/js/domains/receiving/order/stages/assignment.js");
const pick=read("assets/js/domains/picking/picking-controller.js");
const pickStage=read("assets/js/domains/picking/pickup/cut-pickup-stage.js");
const core=read("supabase/migrations/20261105150000_cutting_polivalent_occupation.sql");
const scope=read("supabase/migrations/20261105150500_cutting_polivalent_pickup_scope.sql");
const timeline=read("supabase/migrations/20261105151000_cutting_polivalent_workforce_timeline.sql");

const receptionPool=read("assets/js/domains/receiving/order/assignment/assignment-pool.js");
const confirm=read("assets/js/domains/receiving/order/actions/confirm-reception.js");
const draft=read("assets/js/domains/receiving/order/draft/reception-draft.js");
const received=read("supabase/migrations/20261105180000_reception_cut_pickup_polivalent.sql");

test("La tercera asignación aparece obligatoriamente en Recepción, no en el inicio habitual de Corte",()=>{
 assert.match(rec,/Auxiliar de alistamiento general/);
 assert.match(rec,/Auxiliar de corte/);
 assert.match(rec,/Auxiliar de alistamiento de Corte \(polivalente\) \*/);
 assert.match(rec,/data-cut-pickup-profile required/);
 assert.match(receptionPool,/logisticIds=new Set/);
 assert.match(receptionPool,/polyvalentPool=cutPool.filter/);
 assert.match(receptionPool,/cutPickupProfileId=helper\.value/);
 assert.match(receptionPool,/draft\.cutPickupProfileId===draft\.pickingProfileId/);
 assert.match(draft,/cutPickupProfileId:""/);
 assert.match(confirm,/cutPickupProfileId:draft\.lines\.some/);
 assert.match(api,/erp_x_confirm_order_reception_with_cut_pickup/);
 assert.match(api,/erp_x_cutting_assigned_pickup/);
 assert.match(cut,/const isAssigned=assignment\.status==="ASSIGNED"/);
 assert.match(cut,/No necesitas volver a asignarlo/);
 assert.match(cut,/api\.cuttingStart\(group\.groupKey,helperId\)/);
 assert.match(api,/erp_x_cutting_start_with_helper/);
});

test("La validación en Supabase guarda el tercer perfil sin reasignar los otros dos",()=>{
 assert.match(received,/role_code='aux_logistica'/);
 assert.match(received,/role_code='auxiliar_corte'/);
 assert.match(received,/v_helper=v_picking/);
 assert.match(received,/v_helper=v_cutter/);
 assert.match(received,/public\.erp_x_confirm_order_reception\(p_order_id,p_payload\)/);
 assert.match(received,/receptionAssignment,cutPickupProfileId/);
 assert.match(received,/update erp_supply\.cut_requirements/);
 assert.match(received,/REVOKE EXECUTE ON FUNCTION public\.erp_x_confirm_order_reception/);
 assert.match(received,/Los cortes de esta referencia tienen un ayudante diferente/);
 assert.match(received,/status','CONFLICT/);
});

test("El servidor exige los dos roles, bloqueo concurrente y asignación por referencia",()=>{
 assert.match(core,/role_code='aux_logistica'/);
 assert.match(core,/role_code='auxiliar_corte'/);
 assert.match(core,/p_helper_profile_id=v_actor/);
 assert.match(core,/cutPickupProfileId/);
 assert.match(core,/cut_execution_requirements/);
 assert.match(core,/REVOKE EXECUTE ON FUNCTION public.erp_x_cutting_start\(text\)/);
 assert.match(core,/status in\('IN_PROGRESS','PAUSED','WAITING_EVIDENCE'\)/);
 assert.match(core,/task_sessions/);
});

test("Solo el ayudante asignado recoge nuevos cortes, pero los históricos se respetan",()=>{
 assert.match(scope,/v_helper_allowed/);
 assert.match(scope,/v_legacy_allowed/);
 assert.match(scope,/metadata->>'cutPickupProfileId'=v_actor::text/);
 assert.match(scope,/metadata->>'cutPickupProfileId' is null and v_legacy_allowed/);
 assert.match(scope,/rr.metadata->>'cutPickupProfileId'=v_actor::text/);
 assert.match(pick,/Recogida de Corte a cargo del auxiliar polivalente/);
 assert.match(pickStage,/data.cutRequirements|pendingCutPickups/);
 assert.match(pickStage,/cutPickupProfileId===actorId/);
});

test("Cortador y ayudante ocupados simultáneamente en PACO y Jornada",()=>{
 assert.match(core,/work_source_business_seconds/);
 assert.match(core,/work_classified_business_seconds/);
 assert.match(core,/erp_x_paco_snapshot/);
 assert.match(timeline,/work_my_day_core/);
 assert.match(timeline,/erp_x_work_planner/);
 assert.match(timeline,/erp_x_work_start/);
 assert.match(timeline,/cp.profile_id/);
 assert.match(timeline,/Apoyo en Corte/);
});

test("La cola identifica al ayudante y mantiene los saldos de cada responsable",()=>{
 const migration=read("supabase/migrations/20261105151500_cutting_polivalent_pickup_metrics.sql");
 assert.match(migration,/cutPickupProfileName/);
 assert.match(migration,/v_remaining_person/);
 assert.match(migration,/remainingOrder/);
 const standalone=read("assets/js/domains/picking/pickup/open-cut-pickup.js");
 assert.match(standalone,/Number\(result.remaining\)===0/);
 assert.match(pickStage,/Number\(result.remaining\)===0/);
});
