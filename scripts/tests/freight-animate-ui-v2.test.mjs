import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {quoteView} from '../../assets/js/domains/freight-quotes/quote-view.js';
import {setupFreightDestinationPicker} from '../../assets/js/domains/freight-quotes/destination-picker.js';

test('a single searchable city field replaces two competing controls',()=>{
 const ui=quoteView();
 assert.equal((ui.match(/data-destination-search/g)||[]).length,1);
 assert.match(ui,/data-destination-options/);
 assert.match(ui,/role="combobox"/);
 assert.match(ui,/class="freight-native-select" name="destinationKey"/);
 assert.doesNotMatch(ui,/freight-route-extras|Opciones adicionales/);
 assert.equal(typeof setupFreightDestinationPicker,'function');
});
test('carrier selection and COP are prominent and accessible',()=>{
 const ui=quoteView();
 assert.match(ui,/data-carrier-choice="TCC"/);
 assert.match(ui,/data-carrier-choice="ENVIA"/);
 assert.match(ui,/aria-pressed="true"/);
 assert.match(ui,/name="carrier"/);
 assert.match(ui,/name="declaredValue"/);
 assert.match(ui,/VALOR DECLARADO DE LA MERCANCÍA/);
 assert.match(ui,/TRANSPORTADORA PREFERIDA/);
 assert.equal((ui.match(/name="carrier"/g)||[]).length,1);
});
test('Anime.js stays local while shared button microinteractions use CSS-only composited transforms',()=>{
 const root=new URL('../../assets/js/',import.meta.url);
 const runtime=fs.readFileSync(new URL('shared/motion/crm-visual-system.js',root),'utf8');
 const css=fs.readFileSync(new URL('../css/components/crm-animate-experience.css',root),'utf8');
 const freightCSS=fs.readFileSync(new URL('../css/modules/freight/freight-design-v2.css',root),'utf8');
 assert.match(runtime,/vendor-anime\.js/);
 assert.match(runtime,/animeAnimate\(/);
 assert.ok(!runtime.includes("addEventListener('pointerdown'"));
 assert.doesNotMatch(css,/crm-ui-ripple|crm-shine/);
 assert.match(css,/prefers-reduced-motion/);
 assert.ok(css.includes('translate3d(-125%,0,0)'));
 assert.ok(css.includes('.freight-carrier-segment button[aria-pressed="true"]'));
 assert.ok(css.includes('.freight-mode button[aria-pressed="true"]'));
 assert.ok(css.includes('.btn-primary'));
 assert.ok(css.includes('.freight-add-material'));
 assert.ok(css.includes('.freight-calculate'));
 assert.ok(!css.includes('setInterval'));
 const base=fs.readFileSync(new URL('../css/components/buttons.css',root),'utf8');
 assert.doesNotMatch(base,/\.btn:hover:not\(:disabled\) \{ transform:/);
 assert.match(freightCSS,/freight-city-results|freight-carrier-segment|freight-money-input/);
 const vendor=new URL('shared/motion/vendor-anime.js',root);
 assert.ok(fs.existsSync(vendor),'local Anime.js ESM required by global entry');
});
