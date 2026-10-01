import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import {createPrecacheManifest} from '../architecture/precache-assets.mjs';

const root=fileURLToPath(new URL('../../',import.meta.url));
const manifestFile=new URL('../../assets/precache-manifest.json',import.meta.url);
const workerFile=new URL('../../service-worker.js',import.meta.url);
const manifest=createPrecacheManifest(root);
const json=JSON.stringify(manifest,null,2)+'\n';
const worker=fs.readFileSync(workerFile,'utf8');
const updatedWorker=worker.replace(/const STATIC_REVISION="[^"]*";/,`const STATIC_REVISION="${manifest.revision}";`);
if(updatedWorker===worker&&!worker.includes(`const STATIC_REVISION="${manifest.revision}";`)){
  throw new Error('Service worker lacks the STATIC_REVISION declaration.');
}
if(process.argv.includes('--check')){
  if(!fs.existsSync(manifestFile)||fs.readFileSync(manifestFile,'utf8')!==json||updatedWorker!==worker){
    console.error('PWA manifest is stale. Run npm run pwa:generate and commit both generated changes.');
    process.exit(1);
  }
}else{
  fs.writeFileSync(manifestFile,json);
  fs.writeFileSync(workerFile,updatedWorker);
}
console.log(`PWA: ${manifest.assets.length} assets, ${manifest.sourceBytes} source bytes, revision ${manifest.revision}.`);
