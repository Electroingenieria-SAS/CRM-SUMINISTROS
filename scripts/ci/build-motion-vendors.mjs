import {build} from 'esbuild';
import {mkdir,stat,writeFile} from 'node:fs/promises';
import path from 'node:path';
const outdir='assets/js/shared/motion';
await mkdir(outdir,{recursive:true});
const dependencies=[
 ['motion','motion.mjs','vendor-motion.js','Motion MIT'],
 ['auto-animate','auto-animate.mjs','vendor-auto-animate.js','AutoAnimate MIT'],
 ['floating-ui','floating-ui.mjs','vendor-floating-ui.js','Floating UI MIT']
];
for(const [name,source,file,license] of dependencies){
 await build({
  entryPoints:[path.join('scripts/vendor-entries',source)],
  outfile:path.join(outdir,file),
  platform:'browser',format:'esm',target:'es2022',bundle:true,
  minify:true,legalComments:'inline',
  banner:{js:'/*! '+license+'; licenses and pinned versions in docs/FREIGHT_MOTION_ARCHITECTURE.md */'}
 });
 const fileSize=(await stat(path.join(outdir,file))).size;
 if(fileSize>155000)throw Error(name+' bundle exceeds per-vendor safety bound: '+fileSize);
 console.log(name+' '+fileSize+' bytes');
}
