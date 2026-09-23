import fs from "node:fs";
import assert from "node:assert/strict";
import {
  composePlannerTimeline,
  timelineDetailRequest
} from "../assets/js/modules/workforce-timeline-v11350.js";

const assignment={
  id:"a1",
  title:"Actividad planificada",
  kind:"ACTIVITY",
  profileId:"p1",
  profileName:"Juan",
  plannedStart:"2026-09-23T08:00:00-05:00",
  plannedEnd:"2026-09-23T09:00:00-05:00",
  estimatedMinutes:60,
  memberStatus:"PLANNED"
};

const execution={
  id:"e1",
  assignmentId:"a1",
  profileId:"p1",
  profileName:"Juan",
  title:"Actividad planificada",
  kind:"ACTIVITY",
  source:"PLANNED",
  status:"COMPLETED",
  startedAt:"2026-09-23T08:05:00-05:00",
  endedAt:"2026-09-23T08:52:00-05:00",
  activeSeconds:2820,
  evidenceCount:1,
  hasPhoto:true
};

const manual={
  id:"e2",
  assignmentId:null,
  profileId:"p1",
  profileName:"Juan",
  title:"Actividad espontánea",
  kind:"ACTIVITY",
  source:"MANUAL",
  status:"COMPLETED",
  startedAt:"2026-09-23T10:00:00-05:00",
  endedAt:"2026-09-23T10:25:00-05:00",
  activeSeconds:1500,
  evidenceCount:1,
  hasPhoto:true
};

const timeline=composePlannerTimeline({
  assignments:[assignment],
  executions:[execution,manual],
  permissions:{canPlanTeam:false}
});

assert.equal(timeline.length,2,"Asignación+ejecución deben verse como una sola actividad y la espontánea como otra.");
const planned=timeline.find(row=>row.executionId==="e1");
const spontaneous=timeline.find(row=>row.executionId==="e2");

assert.ok(planned,"La ejecución asociada debe enriquecer la asignación.");
assert.equal(planned.memberStatus,"COMPLETED");
assert.equal(planned.plannedStart,execution.startedAt,"El cronograma ejecutado debe usar la hora real.");
assert.equal(planned.hasPhoto,true);
assert.equal(planned.canCancel,false,"Una actividad ejecutada nunca debe mostrar cancelar.");

assert.ok(spontaneous,"La actividad espontánea debe aparecer aunque no exista asignación.");
assert.equal(spontaneous.sourceType,"EXECUTION");
assert.equal(spontaneous.source,"MANUAL");
assert.equal(spontaneous.profileId,"p1");
assert.equal(spontaneous.hasPhoto,true);
assert.equal(spontaneous.canCancel,false);

const managerTimeline=composePlannerTimeline({
  assignments:[assignment],
  executions:[],
  permissions:{canPlanTeam:true}
});
assert.equal(managerTimeline[0].canCancel,true,"Solo planificación no ejecutada y con permiso de equipo puede cancelarse.");

assert.deepEqual(
  timelineDetailRequest(spontaneous),
  {assignmentId:null,executionId:"e2",profileId:"p1"}
);

const migration=fs.readFileSync(new URL("../supabase/migrations/119_workforce_timeline_evidence_v11_35_0.sql",import.meta.url),"utf8");
for(const token of [
  "erp_x_work_planner_detail",
  "erp_x_work_evidence_preview_allowed",
  "'executions'",
  "'canViewTeam'",
  "'canPlanTeam'",
  "'driveFileId'",
  "'version','11.35.0'"
]){
  assert.equal(migration.includes(token),true,`Migración timeline debe contener: ${token}`);
}
assert.equal(/create\s+table/i.test(migration),false,"V11.35.0 no debe crear tablas nuevas.");
assert.equal(/create\s+(unique\s+)?index/i.test(migration),false,"V11.35.0 no debe crear índices redundantes.");
assert.equal(migration.includes("'preview'"),false,"La base no debe almacenar ni devolver miniaturas embebidas.");

const drive=fs.readFileSync(new URL("../assets/js/services/drive.js",import.meta.url),"utf8");
for(const token of ["loadWorkEvidencePreview","PREVIEW_WORK_EVIDENCE","workEvidencePreviewCache"]){
  assert.equal(drive.includes(token),true,`Drive bajo demanda debe conservar: ${token}`);
}
assert.equal(drive.includes("buildWorkEvidencePreview"),false,"El navegador no debe generar miniaturas para guardarlas en PostgreSQL.");
assert.equal(drive.includes("metadata: preview"),false,"No se deben persistir previews Base64 en metadata.");

const workforce=fs.readFileSync(new URL("../assets/js/modules/workforce.js",import.meta.url),"utf8");
for(const token of ["composePlannerTimeline","openWorkTimelineCard","loadWorkEvidencePreview","canPlanTeam","Mi cronograma"]){
  assert.equal(workforce.includes(token),true,`Integración cronograma debe conservar: ${token}`);
}

const appsScript=fs.readFileSync(new URL("../google-apps-script/Code.gs",import.meta.url),"utf8");
for(const token of ["VERSION: '3.5.0'","PREVIEW_WORK_EVIDENCE","erp_x_work_evidence_preview_allowed","MAX_PREVIEW_BYTES"]){
  assert.equal(appsScript.includes(token),true,`Apps Script debe conservar: ${token}`);
}
assert.equal(appsScript.includes("SHARING_MODE: 'PRIVATE'"),true,"La evidencia debe permanecer privada en Drive.");

console.log("workforce timeline v11.35.0 tests: OK");
