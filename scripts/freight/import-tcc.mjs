// Privileged backend utility. Never ship the CSV to the browser.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {parseTariffs,validateTariffs,datasetChecksum} from './tcc-dataset.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url));
const source=fs.readFileSync(path.join(root,'data/freight/TCC_TARIFAS_INTEGRACION_VERIFICADAS.csv'));
const rows=parseTariffs(source.toString('utf8'));
const result=validateTariffs(rows);
const checksum=datasetChecksum(source);
console.log(JSON.stringify({...result,datasetSha256:checksum}));
const batches=[];
for(let i=0;i<rows.length;i+=1000)batches.push(rows.slice(i,i+1000));
if(process.argv.includes('--sql-dir')){
 const dir=process.argv[process.argv.indexOf('--sql-dir')+1];fs.mkdirSync(dir,{recursive:true});
 batches.forEach((batch,i)=>fs.writeFileSync(path.join(dir,`${String(i).padStart(3,'0')}.sql`),`select public.erp_x_import_tcc_reference('${JSON.stringify(batch).replaceAll("'","''")}'::jsonb);`));
 console.log(`${batches.length} lotes SQL preparados.`);
}else if(process.argv.includes('--apply')){
 const endpoint=process.env.TCC_SUPABASE_URL,key=process.env.TCC_SERVICE_ROLE_KEY;
 if(endpoint!=='https://hezjxcxxcjlpmyalftam.supabase.co'||!key)throw Error('Proyecto exacto y credencial privilegiada requeridos');
 for(const [i,batch] of batches.entries()){
  const res=await fetch(`${endpoint}/rest/v1/rpc/erp_x_import_tcc_reference`,{method:'POST',headers:{'Content-Type':'application/json',apikey:key,Authorization:`Bearer ${key}`},body:JSON.stringify({p_rows:batch})});
  if(!res.ok)throw Error(`Lote ${i} falló: ${res.status}`);
  const count=await res.json();if(count!==batch.length)throw Error(`Conteo inesperado en lote ${i}`);
  console.log(`Lote ${i+1}/${batches.length}: ${count}`);
 }
}
