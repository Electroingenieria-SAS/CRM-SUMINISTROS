import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const read=path=>readFile(new URL("../../"+path,import.meta.url),"utf8");

test("todos los usuarios activos pueden elegir e iniciar cualquier actividad del catálogo",async()=>{
  const [sql,views,selection]=await Promise.all([
    read("supabase/migrations/20261104102500_workforce_universal_activity_self_service.sql"),
    read("assets/js/domains/workforce/catalog/catalog-views.js"),
    read("assets/js/domains/workforce/catalog/catalog-selection.js")
  ]);
  assert.match(sql,/c\.activity_kind='ACTIVITY'\s+or erp_supply\.work_catalog_allowed/);
  assert.match(sql,/public\.erp_x_work_start/);
  assert.doesNotMatch(sql,/raise exception 'Auxiliares deben programar/);
  assert.doesNotMatch(sql,/disponible 15 minutos antes/);
  assert.match(views,/data-work-start-now/);
  assert.match(views,/data-work-schedule-confirmed/);
  assert.match(selection,/api\.workStart\(item\.id,null/);
  assert.match(selection,/Iniciar cronómetro/);
});

test("cambio de actividad conserva continuidad sin cronometrar dos ejecuciones simultáneas",async()=>{
  const [sql,today,agenda]=await Promise.all([
    read("supabase/migrations/20261104102500_workforce_universal_activity_self_service.sql"),
    read("assets/js/domains/workforce/today/today-controller.js"),
    read("assets/js/domains/workforce/today/agenda.js")
  ]);
  assert.match(sql,/uq_work_running_execution_per_profile/);
  assert.match(sql,/public\.erp_x_work_pause\(v_previous/);
  assert.match(sql,/public\.erp_x_work_resume/);
  assert.match(sql,/\{pausedActivities\}/);
  assert.match(sql,/e\.profile_id=v_actor/);
  assert.match(today,/data-resume-paused/);
  assert.match(today,/api\.workResume\(button\.dataset\.resumePaused\)/);
  assert.match(agenda,/data-select-assignment/);
  assert.match(agenda,/data-catalog-id/);
});

test("autoprogramación no necesita aprobación, sin otorgar programación ajena",async()=>{
  const [sql,dialog,policy]=await Promise.all([
    read("supabase/migrations/20261104102500_workforce_universal_activity_self_service.sql"),
    read("assets/js/domains/workforce/catalog/activity-schedule-dialog.js"),
    read("assets/js/domains/workforce/catalog/scheduling-policy.js")
  ]);
  assert.match(sql,/v_profile<>v_actor and not v_is_manager/);
  assert.match(sql,/erp_supply\.can_manage_work_profile/);
  assert.match(sql,/i\.organization_id|c\.organization_id=v_org/);
  assert.match(sql,/revoke all on function public\.erp_x_work_start/);
  assert.match(sql,/grant execute on function public\.erp_x_work_schedule\(jsonb\) to authenticated/);
  assert.match(dialog,/api\.workSchedule/);
  assert.doesNotMatch(dialog,/workProposeAssignment/);
  assert.match(policy,/return false/);
});
