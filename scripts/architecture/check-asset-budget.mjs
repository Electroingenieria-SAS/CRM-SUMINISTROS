import fs from 'node:fs';

// Source budget for the complete offline JS/CSS set; this is not a transfer or CWV measurement.
const manifest=JSON.parse(fs.readFileSync(new URL('../../assets/precache-manifest.json',import.meta.url),'utf8'));
const maxSourceBytes=3*1024*1024;
const maxAssets=750;
if(manifest.sourceBytes>maxSourceBytes||manifest.assets.length>maxAssets){
  console.error(`Asset budget exceeded: ${manifest.sourceBytes}/${maxSourceBytes} bytes; ${manifest.assets.length}/${maxAssets} files.`);
  process.exitCode=1;
}else{
  console.log(`Asset budget: ${manifest.sourceBytes}/${maxSourceBytes} bytes; ${manifest.assets.length}/${maxAssets} files.`);
}
