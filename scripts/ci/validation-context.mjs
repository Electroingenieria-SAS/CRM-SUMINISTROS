import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
import { readReleaseContext } from "../architecture/release-context.mjs";
import { readInventoryContractContext } from "../tests/inventory-contract-context.mjs";
import { readMigrationContractContext } from "../database/migration-contract-context.mjs";
import { readWorkforceContractContext } from "../tests/workforce-contract-context.mjs";
import { readCssContractContext } from "../architecture/css-contract-context.mjs";
import { readPacoContractContext } from "../tests/paco-contract-context.mjs";
import { readRuntimeContractContext } from "../tests/runtime-contract-context.mjs";

export function createValidationContext(){
  const root=fileURLToPath(new URL("../../",import.meta.url));
  const failures=[];
  const check=(ok,msg)=>{if(!ok)failures.push(msg)};
  const exists=relative=>fs.existsSync(path.join(root,relative));
  const read=relative=>fs.readFileSync(path.join(root,relative),"utf8");
  const rel=file=>path.relative(root,file).replaceAll("\\","/");
  const context={root,failures,check,exists,read,rel,walk};
  Object.assign(context,readReleaseContext(context));
  Object.assign(context,readInventoryContractContext(context));
  Object.assign(context,readMigrationContractContext(context));
  Object.assign(context,readWorkforceContractContext(context));
  Object.assign(context,readCssContractContext(context));
  Object.assign(context,readPacoContractContext(context));
  Object.assign(context,readRuntimeContractContext(context));
  return context;
}

export function walk(dir,out=[]){
  if(!fs.existsSync(dir))return out;
  for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
    const full=path.join(dir,entry.name);
    if(entry.isDirectory())walk(full,out);else out.push(full);
  }
  return out;
}
