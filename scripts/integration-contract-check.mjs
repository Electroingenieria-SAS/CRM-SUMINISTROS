import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const read=rel=>fs.readFileSync(path.join(root,rel),"utf8");
const failures=[];
const check=(ok,msg)=>{if(!ok)failures.push(msg)};

const bridge=read("supabase/functions/erp-auditoria-bridge/index.ts");
const metrics=read("supabase/functions/erp-auditoria-metrics/index.ts");
const configToml=read("supabase/config.toml");
const migration102=read("supabase/migrations/102_auditoria_erp_bridge_v11_28_0.sql");
const migration103=read("supabase/migrations/103_auditoria_erp_bridge_hardening_v11_28_0.sql");
const migration104=read("supabase/migrations/104_auditoria_erp_server_dispatch_v11_28_1.sql");
const migration107=read("supabase/migrations/107_auditoria_erp_route_recepcion_v11_28_2.sql");
const frontendBridge=read("assets/js/modules/auditoria-erp-bridge-v11280.js");

check(bridge.includes('target: "recepciones"'),"El bridge dejó de declarar Recepción como destino funcional.");
check(bridge.includes('targetRequest(admin, "recepciones"'),"El bridge dejó de insertar en la tabla recepciones.");
check(!bridge.includes('targetRequest(admin, "auditorias"'),"El bridge no debe volver a escribir novedades CRM en auditorias.");
check(bridge.includes('erp_x_auditoria_erp_mark_reception'),"El bridge perdió el marcado de target_reception_id.");
check(migration107.includes('target_reception_id'),"Migración 107 perdió el destino de Recepción.");

for(const field of ["noveltyNote","informationCaptured","verificationNote","generalNote"]){
  check(bridge.includes(`source.${field}`),`El bridge dejó de transportar ${field}.`);
}
check(bridge.includes('[CRM_SYNC:${eventKey}]'),"El bridge perdió el marcador determinístico de idempotencia.");
check(bridge.includes("findExistingReception"),"El bridge perdió la búsqueda idempotente de recepciones existentes.");

check(bridge.includes('body?.source === "database"'),"El bridge perdió la ruta server-to-server de base de datos.");
check(bridge.includes("erp_x_auditoria_erp_claim_webhook_v2"),"El bridge perdió el claim atómico del webhook.");
check(bridge.includes("admin.auth.getUser(token)"),"El fallback de navegador dejó de validar el JWT del usuario.");
check(bridge.includes("erp_x_auditoria_erp_authorize"),"El fallback de navegador perdió autorización por organización/permisos.");
check(frontendBridge.includes("erp_x_auditoria_erp_pending"),"El fallback frontend perdió el drenaje de pendientes.");
check(frontendBridge.includes("erp-auditoria-bridge"),"El frontend dejó de invocar el bridge autorizado.");

check(migration102.includes("auditoria_erp_outbox"),"Falta la outbox canónica de AuditoriaERP.");
check(migration103.includes("erp_x_auditoria_erp_authorize"),"Falta autorización del bridge.");
check(migration104.includes("dispatch_auditoria_erp_pending"),"Falta dispatcher server-to-server.");
check(migration104.includes("tr_queue_auditoria_erp_receipt"),"Falta trigger de encolado de recepciones.");

const expectedModes={
  "erp-admin-users":true,
  "erp-admin-impersonate":true,
  "erp-auditoria-bridge":false,
  "erp-auditoria-metrics":false
};
for(const [slug,verify] of Object.entries(expectedModes)){
  const section=`[functions.${slug}]`;
  check(configToml.includes(section),`supabase/config.toml no documenta ${slug}.`);
  const pos=configToml.indexOf(section);
  const tail=pos>=0?configToml.slice(pos+section.length):"";
  const next=tail.split("[functions.")[0];
  check(new RegExp(`verify_jwt\\s*=\\s*${verify}`).test(next),`${slug} tiene verify_jwt distinto del contrato productivo.`);
}
check(configToml.includes("custom authentication"),"config.toml debe documentar por qué el bridge usa verify_jwt=false.");
check(configToml.includes("aggregate-only"),"config.toml debe documentar por qué metrics usa verify_jwt=false.");
check(/aggregate|privacy|PII/i.test(metrics),"La función de métricas debe conservar el contrato agregado/no PII.");

if(failures.length){
  console.error("CONTRATO DE INTEGRACIÓN FALLIDO");
  failures.forEach(item=>console.error(`- ${item}`));
  process.exit(1);
}

console.log("CONTRATO CRM → AUDITORIAERP CORRECTO · destino Recepción · texto humano · idempotencia · server-to-server · fallback autenticado.");
