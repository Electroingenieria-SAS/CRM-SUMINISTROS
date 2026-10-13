import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {quoteView} from '../../assets/js/domains/freight-quotes/quote-view.js';
import {durations,currencyLabel} from '../../assets/js/core/animation/motion-tokens.js';

test('vendor ESM está incluido y no depende de CDN ni import bare en navegador',()=>{
 const bundle=fs.readFileSync(new URL('../../assets/js/vendor/ui-animations.js',import.meta.url),'utf8');
 assert.ok(bundle.length>1000&&bundle.length<200000);
 assert.doesNotMatch(bundle,/from\s+["'](?:motion|@floating-ui|@formkit)/);
 const manifest=JSON.parse(fs.readFileSync(new URL('../../assets/precache-manifest.json',import.meta.url),'utf8'));
 assert.ok(manifest.assets.includes('./assets/js/vendor/ui-animations.js'));
 assert.ok(manifest.sourceBytes<=3*1024*1024);
 assert.ok(manifest.assets.length<=750);
});
test('diálogo de historial y selector mantienen contratos del cotizador',()=>{
 const html=quoteView();
 assert.match(html,/data-history-dialog-host/);
 assert.match(html,/data-view-tab="quote"/);
 assert.match(html,/data-view-tab="history"/);
 const controller=fs.readFileSync(new URL('../../assets/js/domains/freight-quotes/quote-controller.js',import.meta.url),'utf8');
 const dialogs=fs.readFileSync(new URL('../../assets/js/domains/freight-quotes/quote-history-dialogs.js',import.meta.url),'utf8');
 assert.doesNotMatch(controller,/window\.prompt\s*\(/);
 assert.match(controller,/createFreightHistoryDialogs/);
 assert.match(controller,/mountFreightEffects/);
 assert.match(dialogs,/role="dialog"/);
 assert.match(dialogs,/aria-modal="true"/);
 assert.match(dialogs,/Escape/);
 assert.match(dialogs,/onLink\(q,value\)/);
 assert.match(dialogs,/canLink/);
});
test('motor ESM conservado y tokens de movimiento modestos',()=>{
 assert.equal(typeof durations.price,'number');
 assert.ok(durations.price<.5);
 assert.ok(currencyLabel(12000).includes('12.000'));
 const pkg=JSON.parse(fs.readFileSync(new URL('../../package.json',import.meta.url),'utf8'));
 const lock=JSON.parse(fs.readFileSync(new URL('../../package-lock.json',import.meta.url),'utf8'));
 for(const [name,version] of Object.entries(pkg.dependencies)){
  assert.equal(lock.packages[''].dependencies[name],version);
  assert.equal(lock.packages['node_modules/'+name].version,version);
 }
 const script=fs.readFileSync(new URL('../../assets/js/core/animation/freight-effects.js',import.meta.url),'utf8');
 assert.match(script,/autoAnimate/);assert.match(script,/computePosition/);
 assert.match(script,/autoUpdate/);assert.match(script,/reducedMotion/);
 assert.match(script,/observer\.disconnect/);
});
