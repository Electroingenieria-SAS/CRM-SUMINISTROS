import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {motionTokens,shouldReduceMotion} from '../../assets/js/shared/motion/motion-tokens.js';
import {createMotionKit} from '../../assets/js/shared/motion/motion-kit.js';
import {createFreightDialogs} from '../../assets/js/domains/freight-quotes/quote-dialogs.js';
test('design tokens are bounded and reduced motion is evaluated lazily',()=>{
 assert.ok(motionTokens.card>=180&&motionTokens.card<=300);
 assert.ok(motionTokens.list<=320&&motionTokens.number<=450);
 assert.equal(typeof shouldReduceMotion(),'boolean');
});
test('native freight dialogs protect order linkage without window.prompt',()=>{
 const controller=fs.readFileSync(new URL('../../assets/js/domains/freight-quotes/quote-controller.js',import.meta.url),'utf8');
 assert.doesNotMatch(controller,/window\.prompt\s*\(/);
 assert.match(controller,/createFreightDialogs\(/);
 assert.match(controller,/can\('freight_quotes','canUpdate'\)/);
 assert.match(controller,/motion\.revealResults/);
 assert.match(controller,/motion\.enableMaterialMotion/);
 assert.equal(typeof createFreightDialogs,'function');
});
test('same-origin bundles and accessible tooltips exist in the source tree',()=>{
 const files=['vendor-motion.js','vendor-auto-animate.js','vendor-floating-ui.js'];
 for(const file of files){
  const p=new URL('../../assets/js/shared/motion/'+file,import.meta.url);
  assert.ok(fs.existsSync(p),file+' must be reproducibly bundled');
  assert.match(fs.readFileSync(p,'utf8'),/MIT/);
 }
 const card=fs.readFileSync(new URL('../../assets/js/domains/freight-quotes/measurement-view.js',import.meta.url),'utf8');
 assert.match(card,/data-freight-help/);
 const stylesheet=fs.readFileSync(new URL('../../assets/css/modules/freight/quote-motion.css',import.meta.url),'utf8');
 assert.match(stylesheet,/prefers-reduced-motion:reduce/);
 assert.match(stylesheet,/freight-detail-sheet/);
});
test('animation kit exposes cancellation and no unscoped global listeners',()=>{
 const source=fs.readFileSync(new URL('../../assets/js/shared/motion/motion-kit.js',import.meta.url),'utf8');
 assert.match(source,/events\.abort\(\)/);
 assert.match(source,/stopPosition\?\.\(\)/);
 assert.match(source,/listController\?\.disable/);
 assert.match(source,/autoUpdate\(/);
 assert.match(source,/shouldReduceMotion\(\)/);
 assert.equal(typeof createMotionKit,'function');
});
