import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';

const assetFolders=['assets/js','assets/css','assets/runtime-css'];

function collectFiles(directory){
  return fs.readdirSync(directory,{withFileTypes:true}).flatMap(entry=>{
    const file=path.join(directory,entry.name);
    return entry.isDirectory()?collectFiles(file):/\.(?:js|css)$/.test(file)?[file]:[];
  });
}

export function createPrecacheManifest(root){
  const files=assetFolders.flatMap(folder=>collectFiles(path.join(root,folder))).sort();
  const hash=createHash('sha256');
  let sourceBytes=0;
  const assets=files.map(file=>{
    const relative=path.relative(root,file).split(path.sep).join('/');
    const content=fs.readFileSync(file);
    hash.update(relative).update('\0').update(content).update('\0');
    sourceBytes+=content.length;
    return './'+relative;
  });
  return {schemaVersion:1,revision:hash.digest('hex').slice(0,16),sourceBytes,assets};
}
