import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('../../',import.meta.url));
const folders=[
  'assets/js/domains','assets/js/integrations','assets/js/core/ui',
  'assets/js/core/layout/operational','assets/css/tokens','assets/css/base',
  'assets/css/components','assets/css/modules','assets/css/core',
  'scripts/architecture','scripts/security','scripts/database','scripts/ci',
  'google-apps-script'
];
const vagueNames=/^(?:utils|helpers|common|misc|functions|manager|service|stuff|temp|new|final\d*)\.(?:js|mjs)$/i;

function collectSources(directory){
  if(!fs.existsSync(directory))return [];
  return fs.readdirSync(directory,{withFileTypes:true}).flatMap(entry=>{
    const file=path.join(directory,entry.name);
    return entry.isDirectory()?collectSources(file):/\.(?:js|mjs|css|gs)$/.test(file)?[file]:[];
  });
}

const failures=[];
const files=folders.flatMap(folder=>collectSources(path.join(root,folder)));
files.push(path.join(root,'assets/js/main.js'),path.join(root,'assets/js/app-entry.js'));
for(const file of files){
  const relative=path.relative(root,file).split(path.sep).join('/');
  const lines=fs.readFileSync(file,'utf8').trimEnd().split('\n').length;
  const limit=relative.endsWith('/main.js')?200:relative.endsWith('/app-entry.js')?150:file.endsWith('.gs')?200:300;
  if(lines>limit)failures.push(`${relative}: ${lines}/${limit} lines; split coherent responsibilities.`);
  if(vagueNames.test(path.basename(file)))failures.push(`${relative}: use a semantic responsibility name.`);
}
if(failures.length){
  failures.forEach(failure=>console.error(failure));
  process.exitCode=1;
}else console.log(`Domain boundaries: ${files.length} bounded semantic source files.`);
