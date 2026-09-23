import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const failures=[]; const warn=[];
const ignore=new Set(["node_modules",".git","playwright-report","test-results","dist-deployable"]);
const files=[];
function walk(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){if(ignore.has(e.name))continue;const full=path.join(dir,e.name);if(e.isDirectory())walk(full);else if(/\.(js|mjs|ts|html|json|toml|md|yml|yaml|sql|gs)$/i.test(e.name))files.push(full)}}
walk(root);

for(const required of [".gitignore",".env.example","scripts/git-history-security-check.mjs","docs/REPOSITORY_GOVERNANCE.md"]){
  if(!fs.existsSync(path.join(root,required)))failures.push(`Falta control requerido: ${required}.`);
}
const rootEntries=fs.readdirSync(root);
for(const name of rootEntries){
  if(/^\.env(?:\.|$)/.test(name)&&name!==".env.example")failures.push(`${name}: archivo de entorno real no debe estar versionado.`);
}
const indexHtml=fs.readFileSync(path.join(root,"index.html"),"utf8");
const vercelConfig=fs.readFileSync(path.join(root,"vercel.json"),"utf8");
const externalScripts=[...indexHtml.matchAll(/<script[^>]+src=["'](https:\/\/[^"']+)["'][^>]*>/gi)].map(match=>match[1]);
for(const src of externalScripts){
  if(/cdn\.jsdelivr\.net|unpkg\.com|cdn\.sheetjs\.com/.test(src)){
    if(/\/(latest|next)(?:\/|$)|@latest(?:\/|$)/i.test(src))failures.push(`index.html: dependencia CDN no fijada: ${src}`);
    if(/cdn\.jsdelivr\.net\/npm\//.test(src)&&!/@\d+\.\d+\.\d+/.test(src))failures.push(`index.html: paquete jsDelivr sin versión exacta: ${src}`);
    if(/unpkg\.com\//.test(src)&&!/@\d+\.\d+\.\d+/.test(src))failures.push(`index.html: paquete unpkg sin versión exacta: ${src}`);
  }
}
if(/unsafe-eval/i.test(vercelConfig))failures.push("vercel.json: CSP no puede habilitar unsafe-eval.");
if(/style-src(?!-)[^;]*'unsafe-inline'/i.test(vercelConfig))failures.push("vercel.json: style-src general no puede habilitar unsafe-inline.");
if(!/style-src-attr[^;]*'unsafe-inline'/i.test(vercelConfig))failures.push("vercel.json: la excepción inline debe quedar limitada a style-src-attr mientras existan métricas visuales dinámicas.");
if(!vercelConfig.includes("'sha256-rRTok79almAGgfPvRLw0V1lpoIyngNj1axoWNf4jXA8='"))failures.push("vercel.json: falta hash CSP del bootstrap inline de Speed Insights.");
for(const file of files){
 const rel=path.relative(root,file).replaceAll("\\","/"); const text=fs.readFileSync(file,"utf8");
 if(/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(text))failures.push(`${rel}: contiene una clave privada.`);
 if(/(?:service_role|SUPABASE_SERVICE_ROLE_KEY)\s*[:=]\s*["'`]eyJ/i.test(text))failures.push(`${rel}: parece contener service_role incrustada.`);
 if(/sb_secret_[A-Za-z0-9_-]{16,}/.test(text))failures.push(`${rel}: contiene una Supabase secret key.`);
 if(rel.startsWith("assets/")&&/SUPABASE_SERVICE_ROLE_KEY|service_role|sb_secret_/i.test(text))failures.push(`${rel}: referencia un secreto de servidor en frontend.`);
 if(rel==="index.html"&&/@supabase\/supabase-js@2["/]/.test(text))failures.push("index.html: Supabase JS CDN no está fijado a versión exacta.");
 if(rel.startsWith("assets/js")){
   if(/createElement\s*\(\s*["']style["']\s*\)/i.test(text))failures.push(`${rel}: no se permite inyectar <style>; use CSS same-origin externo.`);
   // `.from()` is forbidden for browser-side Supabase table access, but standard
   // language calls such as Array.from() and Object.fromEntries() are legitimate.
   const withoutStandardFrom=text.replace(/\bArray\s*\.\s*from\s*\(/g,"Array_from(").replace(/\bObject\s*\.\s*fromEntries\s*\(/g,"Object_fromEntries(");
   if(/\.from\s*\(/.test(withoutStandardFrom))failures.push(`${rel}: acceso directo a tabla desde navegador; use RPC.`);
 }
}
const adminEdge=path.join(root,"supabase/functions/erp-admin-users/index.ts");
if(fs.existsSync(adminEdge)&&/Access-Control-Allow-Origin["']?\s*:\s*["']\*["']/.test(fs.readFileSync(adminEdge,"utf8")))failures.push("erp-admin-users: CORS wildcard no permitido para administración.");

const metricsEdge=path.join(root,"supabase/functions/erp-auditoria-metrics/index.ts");
const metricsConfig=path.join(root,"supabase/config.toml");
if(!fs.existsSync(metricsEdge))failures.push("Falta erp-auditoria-metrics.");
else{
  const text=fs.readFileSync(metricsEdge,"utf8");
  if(/Access-Control-Allow-Origin["']?\s*:\s*["']\*["']/.test(text))failures.push("erp-auditoria-metrics: CORS wildcard no permitido.");
  if(/SUPABASE_SERVICE_ROLE_KEY|service_role/i.test(text))failures.push("erp-auditoria-metrics: las métricas de usuario no deben elevarse a service_role.");
  if(!text.includes("erp_x_auditoria_erp_metrics_user"))failures.push("erp-auditoria-metrics: debe usar el RPC autenticado y limitado por organización.");
  if(!/auth\.getUser\s*\(/.test(text))failures.push("erp-auditoria-metrics: falta validación explícita de sesión.");
}
if(!fs.existsSync(metricsConfig)||!/\[functions\.erp-auditoria-metrics\][\s\S]*?verify_jwt\s*=\s*true/.test(fs.readFileSync(metricsConfig,"utf8")))failures.push("supabase/config.toml: erp-auditoria-metrics debe exigir JWT.");

const uiCore=path.join(root,"assets/js/core/ui.js");
if(!fs.existsSync(uiCore))failures.push("Falta core/ui.js.");
else{
  const text=fs.readFileSync(uiCore,"utf8");
  for(const token of ["export function sanitizeHtml","BLOCKED_HTML_TAGS","UNSAFE_URL","UNSAFE_STYLE","sanitizeHtml(body","sanitizeHtml(step.content"]){
    if(!text.includes(token))failures.push(`core/ui.js: falta barrera XSS requerida: ${token}.`);
  }
}

const impersonationEdge=path.join(root,"supabase/functions/erp-admin-impersonate/index.ts");
const impersonationMigration=path.join(root,"supabase/migrations/114_impersonation_metrics_security_v11_32_0.sql");
if(!fs.existsSync(impersonationEdge)||!fs.readFileSync(impersonationEdge,"utf8").includes("erp_x_admin_impersonation_start"))failures.push("Impersonación: Edge Function no está enlazada a una sesión auditable.");
if(!fs.existsSync(impersonationMigration)){
  failures.push("Impersonación: falta migración de trazabilidad V11.32.0.");
}else{
  const text=fs.readFileSync(impersonationMigration,"utf8");
  for(const token of ["admin_impersonation_sessions","x-erp-impersonation-session","originalActorProfileId","effectiveActorProfileId","erp_x_auditoria_erp_metrics_user"]){
    if(!text.includes(token))failures.push(`Migración 114 incompleta: falta ${token}.`);
  }
}

const workflow=path.join(root,".github/workflows/validate-crm.yml");
if(!fs.existsSync(workflow))failures.push("Falta workflow canónico.");
else{
  const text=fs.readFileSync(workflow,"utf8");
  for(const token of ["authenticated shell, critical modules and native API","ERP_QA_EMAIL","ERP_QA_PASSWORD","github/codeql-action/init@v4","actions/dependency-review-action@v5","trufflesecurity/trufflehog@v3.97.5"]){
    if(!text.includes(token))failures.push(`CI de seguridad incompleta: falta ${token}.`);
  }
}

if(failures.length){console.error("SECURITY CHECK FALLÓ");for(const x of failures)console.error(`- ${x}`);process.exit(1)}
console.log(`SECURITY CHECK CORRECTO · ${files.length} archivos revisados · secretos privados ausentes · dependencias CDN versionadas · CSP endurecida · métricas autenticadas · trazabilidad de impersonación y barrera XSS verificadas.`);
for(const x of warn)console.warn(`- ${x}`);
