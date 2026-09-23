import fs from "node:fs";
import assert from "node:assert/strict";
import {timeTrafficLight,finalEvidenceType} from "../assets/js/modules/workforce-today-v11340.js";

assert.deepEqual(timeTrafficLight(0),{tone:"green",label:"Tiempo normal",review:false});
assert.deepEqual(timeTrafficLight(44*60+59),{tone:"green",label:"Tiempo normal",review:false});
assert.deepEqual(timeTrafficLight(45*60),{tone:"yellow",label:"Atención al tiempo",review:false});
assert.deepEqual(timeTrafficLight(60*60),{tone:"yellow",label:"Atención al tiempo",review:false});
assert.deepEqual(timeTrafficLight(60*60+1),{tone:"red",label:"Revisión requerida",review:true});
assert.equal(finalEvidenceType("BEFORE_AFTER"),"AFTER_PHOTO");
assert.equal(finalEvidenceType("NONE"),"FINAL_PHOTO");
assert.equal(finalEvidenceType("FINAL_PHOTO"),"FINAL_PHOTO");

const workforce=fs.readFileSync(new URL("../assets/js/modules/workforce.js",import.meta.url),"utf8");
for(const token of [
  "data-work-finish",
  "Tomar foto",
  "Subir foto",
  "Foto final obligatoria",
  "data-time-traffic",
  "Pendiente de revisión",
  "workforce-today-v11340.js"
]){
  assert.equal(workforce.includes(token),true,`Mi jornada debe contener: ${token}`);
}
assert.equal(workforce.includes("Causa de desviación, si aplica"),false,"El trabajador no debe llenar causa de desviación al finalizar");
assert.equal(workforce.includes("Resultado / observación"),false,"El cierre normal no debe exigir observación manual");
assert.equal(/agenda-main[^\n]*estimatedMinutes/.test(workforce),false,"La agenda del trabajador no debe mostrar una estimación manual de minutos");

const migrationPath=new URL("../supabase/migrations/116_workforce_my_day_automation_v11_34_0.sql",import.meta.url);
assert.equal(fs.existsSync(migrationPath),true,"Debe existir la migración V11.34.0 de Mi jornada");
const sql=fs.readFileSync(migrationPath,"utf8");
for(const token of [
  "timeReviewRequired",
  "activeSeconds",
  "3600",
  "FINAL_PHOTO",
  "AFTER_PHOTO",
  "SUBMITTED",
  "work_evidence_complete"
]){
  assert.equal(sql.includes(token),true,`La migración debe contener: ${token}`);
}
console.log("workforce my-day automation tests: OK");
