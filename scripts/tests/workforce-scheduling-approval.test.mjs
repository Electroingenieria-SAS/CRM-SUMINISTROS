import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { requiresManagerApproval, buildActivitySchedulePayload } from "../../assets/js/domains/workforce/catalog/scheduling-policy.js";

const read=path=>readFile(new URL(`../../${path}`,import.meta.url),"utf8");

test("todos los roles pueden registrar su actividad propia sin aprobación",()=>{
  assert.equal(requiresManagerApproval(["aux_logistica"]),false);
  assert.equal(requiresManagerApproval(["auxiliar_corte"]),false);
  assert.equal(requiresManagerApproval(["coordinador_logistico"]),false);
  assert.equal(requiresManagerApproval(["jefe_logistica"]),false);
  assert.equal(requiresManagerApproval(["aux_logistica","jefe_logistica"]),false);
});

test("la programación acepta otra semana y cierre manual",()=>{
  const payload=buildActivitySchedulePayload({
    catalogId:"activity-1",
    plannedStart:"2026-10-12T08:00",
    plannedEnd:"",
    openEnded:true,
    estimatedMinutes:75,
    priority:"HIGH",
    reason:"Apoyo operativo programado para la semana siguiente"
  });
  assert.equal(payload.catalogId,"activity-1");
  assert.equal(payload.plannedEnd,null);
  assert.equal(payload.openEnded,true);
  assert.match(payload.plannedStart,/2026-10-12T/);
});

test("una actividad con hora final exige que sea posterior al inicio",()=>{
  assert.throws(()=>buildActivitySchedulePayload({
    catalogId:"activity-1",
    plannedStart:"2026-10-12T10:00",
    plannedEnd:"2026-10-12T09:00",
    openEnded:false,
    estimatedMinutes:60,
    priority:"MEDIUM",
    reason:"Actividad programada"
  }),/posterior/);
});

test("la UI programa antes de iniciar y muestra solicitudes",async()=>{
  const [selection,dialog,today,approvals]=await Promise.all([
    read("assets/js/domains/workforce/catalog/catalog-selection.js"),
    read("assets/js/domains/workforce/catalog/activity-schedule-dialog.js"),
    read("assets/js/domains/workforce/today/today-controller.js"),
    read("assets/js/modules/approvals.js")
  ]);
  assert.match(selection,/openActivitySchedule/);
  assert.doesNotMatch(selection,/api\.workStart\(confirmButton\.dataset\.workStartConfirmed,null/);
  assert.doesNotMatch(dialog,/workProposeAssignment/);
  assert.match(selection,/data-work-start-now/);
  assert.match(selection,/workStart/);
  assert.match(dialog,/workSchedule/);
  assert.match(dialog,/data-open-ended/);
  assert.match(today,/pendingRequests/);
  assert.match(today,/pendingApproval/);
  assert.match(approvals,/workPendingApprovals/);
  assert.match(approvals,/workDecideAssignment/);
});

test("la migración de acceso universal protege propiedad y acceso autenticado",async()=>{
  const sql=await read("supabase/migrations/132_workforce_scheduled_approval_v11_44_0.sql");
  const continuitySql=await read("supabase/migrations/133_workforce_open_ended_continuity_v11_44_0.sql");
  const universalSql=await read("supabase/migrations/20261104102500_workforce_universal_activity_self_service.sql");
  assert.match(universalSql,/uq_work_running_execution_per_profile/);
  assert.match(universalSql,/public.erp_x_work_start/);
  assert.match(universalSql,/public.erp_x_work_schedule/);
  assert.match(universalSql,/grant execute on function public.erp_x_work_start/);
  assert.equal((continuitySql.match(/case when v_open_ended then v_start else null end/g)||[]).length>=2,true,"las actividades sin hora final deben conservar una fecha límite para seguir visibles si se vencen");
  assert.match(sql,/revoke all on function public\.erp_x_work_start\(uuid,uuid,jsonb\) from public,anon/);
  assert.match(sql,/grant execute on function public\.erp_x_work_start\(uuid,uuid,jsonb\) to authenticated/);
});
