import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import {fileURLToPath,pathToFileURL} from "node:url";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const files=[];
function walk(dir){
  if(!fs.existsSync(dir))return;
  for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
    const full=path.join(dir,entry.name);
    if(entry.isDirectory())walk(full);
    else if(entry.name.endsWith(".js"))files.push(path.resolve(full));
  }
}
walk(path.join(root,"assets/js"));

const modules=new Map(files.map(file=>[
  file,
  new vm.SourceTextModule(fs.readFileSync(file,"utf8"),{
    identifier:pathToFileURL(file).href,
    initializeImportMeta(meta){meta.url=pathToFileURL(file).href;}
  })
]));

function targetFor(specifier,referencingModule){
  if(!specifier.startsWith(".")&&!specifier.startsWith("/")){
    throw new Error(`Import externo no soportado en runtime: ${specifier} (${referencingModule.identifier})`);
  }
  const base=path.dirname(fileURLToPath(referencingModule.identifier));
  let target=path.resolve(base,specifier);
  if(!path.extname(target))target+=".js";
  if(!modules.has(target))throw new Error(`Módulo inexistente: ${specifier} -> ${target}`);
  return target;
}

function resolve(specifier,referencingModule){
  return modules.get(targetFor(specifier,referencingModule));
}

const failures=[];
for(const [file,module] of modules){
  if(module.status!=="unlinked")continue;
  try{await module.link(resolve);}catch(error){
    failures.push(`${path.relative(root,file)}: ${error.message}`);
  }
}

if(failures.length){
  console.error("VALIDACIÓN DE MÓDULOS FALLIDA");
  failures.forEach(item=>console.error(`- ${item}`));
  process.exit(1);
}

const entry=path.resolve(root,"assets/js/app-entry.js");
const reachable=new Set();
function visit(file){
  if(reachable.has(file))return;
  reachable.add(file);
  const module=modules.get(file);
  if(!module)return;
  for(const specifier of module.dependencySpecifiers||[]){
    visit(targetFor(specifier,module));
  }
}
visit(entry);

const orphans=files.filter(file=>!reachable.has(file));
if(orphans.length){
  console.error("AUDITORÍA DE RUNTIME FALLIDA · módulos JS no alcanzables desde app-entry.js");
  orphans.forEach(file=>console.error(`- ${path.relative(root,file)}`));
  process.exit(1);
}

console.log(`ENLACE ES MODULES CORRECTO · ${files.length} archivos · 0 contratos rotos · 0 módulos huérfanos.`);
