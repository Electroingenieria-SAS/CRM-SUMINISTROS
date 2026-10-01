import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

// Expand local composition entries in cascade order for the existing CSS contracts.
export function readCssSource(file,ancestors=[]){
  const absolute=file instanceof URL?fileURLToPath(file):path.resolve(file);
  if(ancestors.includes(absolute))throw new Error(`CSS import cycle: ${absolute}`);
  const next=[...ancestors,absolute];
  return fs.readFileSync(absolute,'utf8').replace(/@import\s+["']([^"']+)["']\s*;/g,(statement,target)=>{
    if(/^(?:[a-z]+:|\/\/)/i.test(target))return statement;
    return readCssSource(path.resolve(path.dirname(absolute),target),next);
  }).replace(/\s*\{\s*/g,'{').replace(/@media\s+\(/g,'@media(');
}
