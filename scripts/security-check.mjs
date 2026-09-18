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
const edge=path.join(root,"supabase/functions/erp-admin-users/index.ts");
if(fs.existsSync(edge)&&/Access-Control-Allow-Origin["']?\s*:\s*["']\*["']/.test(fs.readFileSync(edge,"utf8")))failures.push("erp-admin-users: CORS wildcard no permitido para administración.");
if(failures.length){console.error("SECURITY CHECK FALLÓ");for(const x of failures)console.error(`- ${x}`);process.exit(1)}
console.log(`SECURITY CHECK CORRECTO · ${files.length} archivos revisados · secretos privados ausentes · dependencias CDN versionadas · CSP sin unsafe-eval y sin style-src unsafe-inline general.`);
for(const x of warn)console.warn(`- ${x}`);
