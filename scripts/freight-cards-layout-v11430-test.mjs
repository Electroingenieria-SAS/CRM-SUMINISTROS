import assert from "node:assert/strict";
import fs from "node:fs";

const css=fs.readFileSync(new URL("../assets/css/operations.css",import.meta.url),"utf8");
const orders=fs.readFileSync(new URL("../assets/js/modules/orders.js",import.meta.url),"utf8");

for(const token of [
  "sales-freight-carrier-head-v1143",
  "sales-freight-carrier-title-v1143",
  "sales-freight-carrier-price-v1143",
  "sales-freight-carrier-metrics-v1143",
  "sales-freight-metric-v1143",
  "sales-freight-carrier-tags-v1143",
  "is-recommended"
]) assert.equal(orders.includes(token),true,`orders.js debe incluir ${token}`);

for(const token of [
  ".sales-freight-carriers-v1140{",
  "grid-column:1/-1!important",
  "grid-template-columns:repeat(3,minmax(0,1fr))!important",
  ".sales-freight-carrier-v1140.is-recommended",
  ".sales-freight-carrier-metrics-v1143",
  "@media(max-width:1050px)",
  "@media(max-width:720px)",
  "@media(max-width:430px)"
]) assert.equal(css.includes(token),true,`operations.css debe incluir ${token}`);

assert.equal(css.includes("grid-row:2!important"),true,"El comparador debe ocupar su propia fila, no una columna implícita.");
assert.equal(css.includes("grid-column:1/-1!important"),true,"El comparador debe abarcar todo el ancho del bloque.");
assert.equal(/sales-freight-carriers-v1140\{[\s\S]*?grid-template-columns:repeat\(3,minmax\(0,1fr\)\)!important/.test(css),true,"Desktop debe mostrar tres tarjetas reales.");
assert.equal(/@media\(max-width:720px\)[\s\S]*?sales-freight-carriers-v1140[\s\S]*?grid-template-columns:1fr!important/.test(css),true,"Móvil debe apilar las tarjetas en una columna.");

console.log("freight cards layout v11.43.0 tests: OK");
