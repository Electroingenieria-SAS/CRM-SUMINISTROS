import fs from "node:fs";
import assert from "node:assert/strict";

const workforce=fs.readFileSync(new URL("../assets/js/modules/workforce.js",import.meta.url),"utf8");
const css=fs.readFileSync(new URL("../assets/css/analytics.css",import.meta.url),"utf8");

for(const token of [
  "work-indicator-hero-v11363",
  "work-indicator-ring-v11363",
  "work-indicator-filter-v11363",
  "work-indicator-metrics-v11363",
  "analyticsBalance(summary)",
  "work-indicator-layout-v11363",
  "work-indicator-method-v11363",
  "work-indicator-section-v11383",
  "work-indicator-section-head-v11383",
  "work-indicator-panel-featured-v11383",
  "work-indicator-layout-paired-v11383",
  "RESUMEN EJECUTIVO",
  "JORNADA Y CAPACIDAD",
  "ACTIVIDAD Y CAUSAS",
  "REFERENCIAS DE TIEMPO",
  "OPERACIÓN ACTUAL",
  "data-analytics-apply"
]){
  assert.equal(workforce.includes(token),true,`Indicadores debe conservar: ${token}`);
}

for(const token of [
  "work-indicator-hero-v11363",
  "work-indicator-metrics-v11363",
  "work-indicator-balance-bar-v11363",
  "work-indicator-bars-v11363",
  "work-indicator-standards-v11363",
  "work-indicator-deviations-v11363",
  "work-indicator-team-v11363",
  "work-indicator-section-v11383",
  "work-indicator-section-head-v11383",
  "Workforce Indicators V11.38.3",
  "grid-template-columns:repeat(3,minmax(0,1fr))",
  "font-size:29px",
  "@media(max-width:720px)"
]){
  assert.equal(css.includes(token),true,`CSS Indicadores debe conservar: ${token}`);
}

assert.equal(workforce.includes("erp_x_work_analytics"),false,"Workforce UI no debe invocar RPC directo.");
assert.equal(/create\s+table/i.test(workforce),false,"Indicadores frontend no debe contener DDL.");
assert.equal(css.includes("Workforce Indicators V11.38.3"),true);
assert.equal(css.includes(".work-indicator-metric-v11363.tone-violet{--metric-accent:#527795}"),true,"Indicadores no debe reintroducir el acento morado anterior.");

const metrics=(workforce.match(/indicatorMetric\(/g)||[]).length;
assert.ok(metrics>=7,"El dashboard debe conservar seis KPIs además del helper.");

console.log("workforce indicators professional layout v11.38.3 tests: OK");
