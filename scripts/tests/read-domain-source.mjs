import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');

// Keep historical text contracts pointed at the actual domain implementation.
// No assertions are dropped when a legacy entry point becomes a facade.
export function readDomainSource(domain,legacyPath){
  const directory=path.join(root,'assets/js/domains',domain);
  if(!fs.existsSync(directory))return fs.readFileSync(path.join(root,legacyPath),'utf8');
  const read=folder=>fs.readdirSync(folder,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name)).map(entry=>{
    const target=path.join(folder,entry.name);
    return entry.isDirectory()?read(target):entry.name.endsWith('.js')?fs.readFileSync(target,'utf8'):'';
  }).join('\n');
  return read(directory);
}
