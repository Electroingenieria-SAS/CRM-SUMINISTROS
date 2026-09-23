import fs from "node:fs";
import assert from "node:assert/strict";
import {
  managerQueueSummary,
  timeReviewCardHtml,
  timeReviewDialogHtml,
  recentTimeReviewHtml
} from "../assets/js/modules/workforce-time-review-v11340.js";

const row={
  executionId:"exec-1",
  profileId:"profile-1",
  profileName:"Ana Gómez",
  title:"Organización de inventario",
  catalogName:"Organización",
  activityGroup:"LOGISTICS",
  startedAt:"2026-09-23T08:00:00-05:00",
  endedAt:"2026-09-23T09:18:00-05:00",
  activeSeconds:4680,
  pausedSeconds:120,
  businessSeconds:4680,
  timeReviewStatus:"PENDING",
  evidence:[
    {type:"FINAL_PHOTO",fileName:"final.jpg",webViewLink:"https://drive.google.com/file/d/abc/view"}
  ]
};

const summary=managerQueueSummary([row]);
assert.deepEqual(summary,{pending:1,overHour:1,withPhoto:1});
const card=timeReviewCardHtml(row);
for(const token of ["Ana Gómez","Organización de inventario","1 h 18 min","Ver foto","Revisar tiempo"]){
  assert.equal(card.includes(token),true,`La tarjeta debe mostrar: ${token}`);
}
const dialog=timeReviewDialogHtml(row);
for(const token of ["Ana Gómez","Organización de inventario","Foto final","1 h 18 min","Revisado","Observado"]){
  assert.equal(dialog.includes(token),true,`El diálogo debe mostrar: ${token}`);
}
assert.equal(dialog.includes("https://drive.google.com/file/d/abc/view"),true,"La revisión debe enlazar la evidencia de Drive");
const recent=recentTimeReviewHtml({
  profileName:"Ana Gómez",
  title:"Organización de inventario",
  activeSeconds:4680,
  decision:"OBSERVED",
  note:"Validar distribución del trabajo.",
  reviewedBy:"Jefe Logística",
  reviewedAt:"2026-09-23T10:00:00-05:00"
});
for(const token of ["Observado","Ana Gómez","1 h 18 min","Jefe Logística","Validar distribución"]){
  assert.equal(recent.includes(token),true,`El historial debe mostrar: ${token}`);
}

const operational=fs.readFileSync(new URL("../assets/js/modules/operational-v112.js",import.meta.url),"utf8");
assert.equal(operational.includes("workManagerQueue"),false,"Mi jornada no debe duplicar la cola de revisión del jefe");
assert.equal(operational.includes("openTimeReviewDialog"),false,"La revisión de tiempos debe centralizarse en Excepciones y aprobaciones");
assert.equal(operational.includes("workQuickRequest"),false,"No debe existir solicitud rápida ni aprobación previa para auxiliares");

const approvals=fs.readFileSync(new URL("../assets/js/modules/approvals.js",import.meta.url),"utf8");
for(const token of ['data-mode="WORKFORCE"',"workManagerQueue","workforce-alert-banner","openWorkforceTimeReview","workReviewTime","timeReviewDialogHtml"]){
  assert.equal(approvals.includes(token),true,`Excepciones y aprobaciones debe integrar alertas de jornada: ${token}`);
}

const api=fs.readFileSync(new URL("../assets/js/services/api.js",import.meta.url),"utf8");
assert.equal(api.includes("workQuickRequest"),false,"API no debe conservar el flujo de aprobación previa");
for(const token of ["workManagerQueue","erp_x_work_manager_queue","workReviewTime","erp_x_work_review_time"]){
  assert.equal(api.includes(token),true,`API debe exponer: ${token}`);
}

const migrationPath=new URL("../supabase/migrations/117_workforce_manager_review_v11_34_1.sql",import.meta.url);
assert.equal(fs.existsSync(migrationPath),true,"Debe existir migración 117 para la cola del jefe");
const sql=fs.readFileSync(migrationPath,"utf8");
for(const token of [
  "erp_x_work_manager_queue",
  "erp_x_work_start",
  "work_catalog_allowed",
  "source",
  "'MANUAL'",
  "timeReviewRequired",
  "PENDING",
  "webViewLink",
  "erp_x_work_review_time",
  "TIME_REVIEWED",
  "limit v_limit"
]){
  assert.equal(sql.includes(token),true,`Migración 117 debe contener: ${token}`);
}
assert.equal(sql.includes("erp_x_work_quick_request"),false,"La migración no debe crear una solicitud rápida con aprobación previa");
assert.equal(sql.includes("least(coalesce(p_limit,50),50)"),true,"La cola debe estar acotada a máximo 50 filas");
assert.equal(sql.includes("assignmentApprovals"),false,"La cola gerencial debe consultar solo revisiones de tiempo");
assert.equal(sql.includes("Para iniciar una actividad adicional primero debes agregarla a tu jornada"),false,"El backend no debe exigir aprobación previa para iniciar manualmente");
assert.equal(/create\s+(unique\s+)?index/i.test(sql),false,"La cola no debe crear índices sin evidencia de necesidad");

console.log("workforce manager time-review tests: OK");
