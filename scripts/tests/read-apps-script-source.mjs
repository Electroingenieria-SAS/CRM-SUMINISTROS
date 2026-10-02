import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const directory=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../google-apps-script');

export function readAppsScriptSource(){
  return fs.readdirSync(directory).filter(file=>file.endsWith('.gs')).sort()
    .map(file=>fs.readFileSync(path.join(directory,file),'utf8')).join('\n');
}
