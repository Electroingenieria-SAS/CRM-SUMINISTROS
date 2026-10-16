import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {quoteResultHtml} from '../../assets/js/domains/freight-quotes/quote-view.js';

test('TCC and ENVÍA retain text and selection state without altering tariff calculations',()=>{
 const card=carrier=>({carrier,commercialEstimate:{
  available:true,totalCop:56000,rangeLowCop:48000,rangeHighCop:65000,source:'TEST'
 },measurementScenarios:{weight:{status:'UNAVAILABLE'},volume:{status:'UNAVAILABLE'}},reference:{status:'UNAVAILABLE'}});
 const html=quoteResultHtml({carrier:'TCC',comparison:[card('TCC'),card('ENVIA')]},{selectedCarrier:'ENVIA'});
 assert.match(html,/data-quote-select-carrier="ENVIA" aria-pressed="true"/);
 assert.match(html,/data-quote-select-carrier="TCC" aria-pressed="false"/);
 assert.match(html,/>Seleccionada<\/button>/);
});
test('TCC, ENVÍA y LOCAL comparten estados exclusivos sin CSS heredado de emergencias',()=>{
 const css=fs.readFileSync(new URL('../../assets/css/modules/freight/quote-interactive-states.css',import.meta.url),'utf8');
 const old=fs.readFileSync(new URL('../../assets/css/modules/logistics/order-freight-action-header.css',import.meta.url),'utf8');
 assert.match(css,/aria-pressed="true"/);
 assert.match(css,/aria-pressed="false"/);
 assert.match(css,/--freight-action-selected: #083b70/);
 assert.match(css,/--freight-action-idle-text: #104b80/);
 assert.doesNotMatch(old,/\.freight-offer-select\[aria-pressed/);
 const actions=fs.readFileSync(new URL('../../assets/css/modules/freight/quote-action-system.css',import.meta.url),'utf8');
 assert.match(actions,/prefers-reduced-motion: reduce/);
});
test('quick-order modal inserts freight action before close and aligns a dedicated X',()=>{
 const source=fs.readFileSync(new URL('../../assets/js/domains/freight-quotes/quote-order-entry.js',import.meta.url),'utf8');
 const css=fs.readFileSync(new URL('../../assets/css/modules/logistics/order-freight-action-header.css',import.meta.url),'utf8');
 assert.match(source,/target\.insertBefore\(button,close\)/);
 assert.match(source,/target\.classList\.add\('order-freight-action-head'\)/);
 assert.match(source,/className='btn order-freight-action'/);
 assert.match(css,/grid-template-columns:minmax\(0,1fr\) auto 44px/);
 assert.match(css,/grid-column:3/);
 assert.doesNotMatch(css,/!important/);
 assert.doesNotMatch(css,/freight-offer-select/);
 assert.match(css,/@media\(max-width:700px\)/);
 const ops=fs.readFileSync(new URL('../../assets/css/operations.css',import.meta.url),'utf8');
 assert.match(ops,/modules\/logistics\/order-freight-action-header\.css/);
});
