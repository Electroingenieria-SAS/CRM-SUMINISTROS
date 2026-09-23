import fs from "node:fs";
import assert from "node:assert/strict";

const css=fs.readFileSync(new URL("../assets/runtime-css/workforce-experience-v11344.css",import.meta.url),"utf8");
for(const token of [
  "#workforce-content .btn{min-height:52px",
  ".work-catalog-choice",
  "min-height:86px",
  ".work-catalog-choice-copy strong{font-size:16px",
  ".work-catalog-activity-copy strong{font-size:15px",
  ".work-start-confirm-actions .btn{min-height:56px",
  ".work-timer-face strong{font-size:clamp(32px,3vw,42px)",
  ".workday-traffic-legend",
  ".workforce-alert-banner",
  "@media(max-width:560px)",
  "@media(prefers-reduced-motion:reduce)"
]){
  assert.equal(css.includes(token),true,`Workforce accesible debe contener: ${token}`);
}
assert.equal(css.includes("font-size:7px"),false,"La nueva capa Workforce no debe usar texto de 7px");
assert.equal(css.includes("font-size:8px"),false,"La nueva capa Workforce no debe usar texto de 8px");
assert.equal(css.includes("font-size:9px"),false,"La nueva capa Workforce no debe usar texto de 9px");

const workforce=fs.readFileSync(new URL("../assets/js/modules/workforce.js",import.meta.url),"utf8");
assert.equal(workforce.includes("ensureWorkforceExperienceStyles"),true,"Mi jornada debe cargar su capa visual aislada");
assert.equal(workforce.includes("workday-no-schedule"),true,"Estado sin programación debe ser compacto, no una tarjeta vacía grande");

const approvals=fs.readFileSync(new URL("../assets/js/modules/approvals.js",import.meta.url),"utf8");
assert.equal(approvals.includes("ensureWorkforceExperienceStyles"),true,"Excepciones debe compartir la semántica visual del semáforo");

const core=fs.readFileSync(new URL("../assets/css/core-shell.css",import.meta.url),"utf8");
assert.equal(core.includes("V11.34.2 · Mi jornada visual"),false,"core-shell no debe conservar la implementación visual V11.34.2");
assert.equal(core.includes("V11.34.3 · Mi jornada jerárquica"),false,"core-shell no debe conservar la implementación visual V11.34.3");

const operations=fs.readFileSync(new URL("../assets/css/operations.css",import.meta.url),"utf8");
for(const token of ["workforce-quick-card","workforce-main-grid","work-catalog-group","work-catalog-list","work-catalog-item","Desliza para explorar"]){
  assert.equal(operations.includes(token),false,`operations.css no debe reintroducir visual legado de Jornada: ${token}`);
}
const bootstrap=fs.readFileSync(new URL("../assets/js/modules/bootstrap-v113.js",import.meta.url),"utf8");
assert.equal(bootstrap.includes("activity-browser-v113"),false,"bootstrap no debe volver a instalar el navegador legado de Jornada");
assert.equal(fs.existsSync(new URL("../assets/js/modules/activity-browser-v113.js",import.meta.url)),false,"El navegador legado activity-browser-v113.js debe permanecer eliminado");

console.log("workforce accessibility UX tests: OK");
