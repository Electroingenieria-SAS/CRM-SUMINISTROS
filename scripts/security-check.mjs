import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const failures=[]; const warn=[];
const ignore=new Set(["node_modules",".git","playwright-report","test-results"]);
const files=[];
function walk(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){if(ignore.has(e.name))continue;const full=path.join(dir,e.name);if(e.isDirectory())walk(full);else if(/\.(js|mjs|ts|html|json|toml|md|yml|yaml|sql|gs)$/i.test(e.name))files.push(full)}}
walk(root);
for(const file of files){
 const rel=path.relative(root,file).replaceAll("\\","/"); const text=fs.readFileSync(file,"utf8");
 if(/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(text))failures.push(`${rel}: contiene una clave privada.`);
 if(/(?:service_role|SUPABASE_SERVICE_ROLE_KEY)\s*[:=]\s*["'`]eyJ/i.test(text))failures.push(`${rel}: parece contener service_role incrustada.`);
 if(/sb_secret_[A-Za-z0-9_-]{16,}/.test(text))failures.push(`${rel}: contiene una Supabase secret key.`);
 if(rel.startsWith("assets/")&&/SUPABASE_SERVICE_ROLE_KEY|service_role|sb_secret_/i.test(text))failures.push(`${rel}: referencia un secreto de servidor en frontend.`);
 if(rel==="index.html"&&/@supabase\/supabase-js@2["/]/.test(text))failures.push("index.html: Supabase JS CDN no está fijado a versión exacta.");
 if(rel.startsWith("assets/js")&&/\.from\s*\(/.test(text))failures.push(`${rel}: acceso directo a tabla desde navegador; use RPC.`);
}
const edge=path.join(root,"supabase/functions/erp-admin-users/index.ts");
if(fs.existsSync(edge)&&/Access-Control-Allow-Origin["']?\s*:\s*["']\*["']/.test(fs.readFileSync(edge,"utf8")))failures.push("erp-admin-users: CORS wildcard no permitido para administración.");
if(failures.length){console.error("SECURITY CHECK FALLÓ");for(const x of failures)console.error(`- ${x}`);process.exit(1)}
console.log(`SECURITY CHECK CORRECTO · ${files.length} archivos revisados · 0 secretos privados detectados.`);
for(const x of warn)console.warn(`- ${x}`);
