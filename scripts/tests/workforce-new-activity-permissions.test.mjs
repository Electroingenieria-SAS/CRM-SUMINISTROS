import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
const read=path=>readFile(new URL("../../"+path,import.meta.url),"utf8");

test("El catálogo ordinario pertenece a todos los perfiles activos de su empresa",async()=>{
  const sql=await read("supabase/migrations/20261104112000_workforce_new_activity_universal_planner.sql");
  assert.match(sql,/c\.organization_id=p\.organization_id/);
  assert.match(sql,/and p\.active/);
  assert.match(sql,/c\.activity_kind='ACTIVITY'/);
  assert.match(sql,/v_roles:=case when v_kind='ACTIVITY' then array\[\]::text\[\]/);
  assert.match(sql,/v_profile_id<>v_actor/);
  assert.match(sql,/erp_supply\.can_manage_work_profile\(v_profile_id,v_kind\)/);
  assert.match(sql,/v_kind='DELIVERABLE' and not/);
  assert.doesNotMatch(sql,/La actividad seleccionada no está habilitada para uno de los perfiles/);
});

test("Crear actividad y asignarla usa una ruta compatible con todos los usuarios",async()=>{
  const [wizard,planner,toolbar,actions,assignee]=await Promise.all([
    read("assets/js/domains/workforce/planner/assignment-wizard.js"),
    read("assets/js/domains/workforce/planner/planner-controller.js"),
    read("assets/js/domains/workforce/planner/planner-shell.js"),
    read("assets/js/domains/workforce/planner/planner-assignments.js"),
    read("assets/js/domains/workforce/planner/assignment-schedule-step.js")
  ]);
  assert.match(wizard,/assignment\.kinds=\[\["ACTIVITY"/);
  assert.match(wizard,/api\.workCreateCatalogItem/);
  assert.match(wizard,/api\.workSaveAssignment/);
  assert.match(planner,/planner\.canPlanOwn/);
  assert.match(toolbar,/planner\.canPlanOwn/);
  assert.match(toolbar,/data-plan-new-custom/);
  assert.match(actions,/if\(planner\.canPlanOwn\)/);
  assert.match(assignee,/kind==="ACTIVITY"\|\|/);
  assert.match(assignee,/assignment\.isPersonal/);
});

test("La migración mantiene límites para asignar trabajo ajeno y entregables",async()=>{
  const sql=await read("supabase/migrations/20261104112000_workforce_new_activity_universal_planner.sql");
  assert.match(sql,/v_profile_id<>v_actor and \(/);
  assert.match(sql,/array\['super_admin','jefe_logistica','lider_logistica','coordinador_logistico','gerencia'\]/);
  assert.match(sql,/Solo Gerencia puede asignar entregables con fecha límite/);
  assert.match(sql,/revoke all on function public\.erp_x_work_save_assignment\(jsonb\) from public,anon/);
  assert.match(sql,/grant execute on function public\.erp_x_work_create_catalog_item\(jsonb\) to authenticated/);
});

test("La autoprogramación no depende del horario ni se puede fingir para otro usuario",async()=>{
  const sql=await read("supabase/migrations/20261104112500_workforce_self_planning_calendar.sql");
  assert.match(sql,/v_self_only:=\(v_kind='ACTIVITY'/);
  assert.match(sql,/jsonb_array_length\(p_payload->'profileIds'\)=1/);
  assert.match(sql,/erp_supply\.safe_uuid\(p_payload->'profileIds'->>0\)=v_actor/);
  assert.match(sql,/new\.metadata->>'selfScheduled'/);
  assert.match(sql,/'selfScheduled',v_self_only/);
  assert.match(sql,/coalesce\(p_payload->'metadata','\{\}'::jsonb\)\|\|jsonb_build_object/);
});
