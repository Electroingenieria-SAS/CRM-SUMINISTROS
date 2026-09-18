import {execFileSync} from "node:child_process";
import path from "node:path";
import {fileURLToPath} from "node:url";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const failures=[];
const run=args=>execFileSync("git",args,{cwd:root,encoding:"utf8",maxBuffer:128*1024*1024});

let history="";
try{
  history=run(["log","-p","--all","--full-history","--no-ext-diff","--no-textconv","--format=commit:%H"]);
}catch(error){
  console.error("HISTORY SECURITY CHECK FALLÓ · no fue posible leer el historial Git.");
  console.error(String(error?.message||error));
  process.exit(1);
}

const patterns=[
  ["private-key",/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g],
  ["supabase-secret-key",new RegExp("sb_"+"secret_[A-Za-z0-9_-]{20,}","g")],
  ["service-role-jwt",new RegExp("(?:SUPABASE_SERVICE_ROLE_KEY|service_role)\\s*[:=]\\s*[\\\"'\\x60]?(eyJ[A-Za-z0-9_-]{20,}\\.[A-Za-z0-9_-]{20,}\\.[A-Za-z0-9_-]{20,})","gi")],
  ["github-token",/gh[pousr]_[A-Za-z0-9]{30,}/g],
  ["google-api-key",/AIza[0-9A-Za-z_-]{35}/g],
  ["aws-access-key",/AKIA[0-9A-Z]{16}/g]
];

for(const [name,re] of patterns){
  re.lastIndex=0;
  if(re.test(history))failures.push(name);
}

if(failures.length){
  console.error("HISTORY SECURITY CHECK FALLÓ");
  console.error("Se detectaron patrones compatibles con secretos históricos: "+failures.join(", "));
  console.error("No se imprimen los valores detectados. Rotar primero cualquier credencial real antes de reescribir historia.");
  process.exit(1);
}

console.log("HISTORY SECURITY CHECK CORRECTO · historial completo revisado sin patrones de secretos privados.");
