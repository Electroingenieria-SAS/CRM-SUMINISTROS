import fs from "node:fs";
import assert from "node:assert/strict";
import {catalogTaxonomy,catalogBrowserHtml,selectedActivityHtml} from "../assets/js/modules/workforce-catalog-v11343.js";

const catalog=[
  {id:"1",name:"Organización de mercancía",activityKind:"ACTIVITY",uiCategory:"ALISTAMIENTO",uiCategoryLabel:"Alistamiento",uiSubcategory:"Organización de zona de trabajo"},
  {id:"2",name:"Surtido de estanterías",activityKind:"ACTIVITY",uiCategory:"ALISTAMIENTO",uiCategoryLabel:"Alistamiento",uiSubcategory:"Organización de zona de trabajo"},
  {id:"3",name:"Apoyo en inventarios",activityKind:"ACTIVITY",uiCategory:"ALISTAMIENTO",uiCategoryLabel:"Alistamiento",uiSubcategory:"Realización de inventarios"},
  {id:"4",name:"Cargue de mercancía",activityKind:"ACTIVITY",uiCategory:"DESPACHO_LOCAL",uiCategoryLabel:"Despacho local",uiSubcategory:"Cargue y entrega"}
];

const tree=catalogTaxonomy(catalog);
assert.equal(tree.length,2);
assert.equal(tree[0].label,"Alistamiento");
assert.equal(tree[0].subcategories.length,2);
assert.equal(tree[0].subcategories[0].activities.length,2);

const html=catalogBrowserHtml(catalog,false);
for(const token of ["Categorías","Subcategorías","Actividad específica","data-work-category","data-work-subcategory","data-work-activity-select"]){
  assert.equal(html.includes(token),true,`El navegador debe contener: ${token}`);
}
assert.equal(html.includes("data-start-catalog"),false,"Seleccionar catálogo no debe iniciar el cronómetro directamente");

const selected=selectedActivityHtml(catalog[0]);
for(const token of ["Organización de mercancía","Alistamiento","Organización de zona de trabajo","Iniciar actividad","data-work-start-confirmed"]){
  assert.equal(selected.includes(token),true,`La confirmación debe contener: ${token}`);
}

const workforce=fs.readFileSync(new URL("../assets/js/modules/workforce.js",import.meta.url),"utf8");
assert.equal(workforce.includes("data-work-start-confirmed"),true,"workforce debe iniciar solo desde confirmación explícita");
assert.equal(workforce.includes("data-start-catalog"),false,"workforce no debe conservar inicio directo por click/touch");
for(const token of ["work-active-console","work-timer-face","work-timer-traffic","Confirmar inicio"]){
  assert.equal(workforce.includes(token),true,`Cronómetro/flujo debe contener: ${token}`);
}

const migration=fs.readFileSync(new URL("../supabase/migrations/118_workforce_catalog_taxonomy_v11_34_3.sql",import.meta.url),"utf8");
for(const token of ['"uiCategory"','"uiCategoryLabel"','"uiSubcategory"',"erp_x_work_catalog"]){
  assert.equal(migration.includes(token),true,`Migración 118 debe devolver: ${token}`);
}

console.log("workforce catalog hierarchy tests: OK");
