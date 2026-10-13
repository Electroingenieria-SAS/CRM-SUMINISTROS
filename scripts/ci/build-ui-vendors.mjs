import fs from 'node:fs';
import {build} from 'esbuild';
const source=new URL('../vendor/ui-animations-entry.js',import.meta.url);
const output=new URL('../../assets/js/vendor/ui-animations.js',import.meta.url);
const result=await build({entryPoints:[source.pathname],bundle:true,write:false,format:'esm',platform:'browser',target:'es2022',minify:true,legalComments:'none',logLevel:'warning'});
if(result.outputFiles.length!==1)throw Error('Expected one ESM bundle');
const built=result.outputFiles[0].text;
if(process.argv.includes('--check')){
 if(!fs.existsSync(output)||fs.readFileSync(output,'utf8')!==built)throw Error('Vendor ESM is stale. Run npm run vendor:build.');
}else{
 fs.mkdirSync(new URL('../../assets/js/vendor/',import.meta.url),{recursive:true});
 fs.writeFileSync(output,built);
}
console.log('UI vendor ESM verified: '+Buffer.byteLength(built)+' bytes.');
