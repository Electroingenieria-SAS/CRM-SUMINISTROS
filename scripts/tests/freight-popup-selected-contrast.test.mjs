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
test('selected carrier uses explicit white contrast for both companies',()=>{
 const css=fs.readFileSync(new URL('../../assets/css/modules/logistics/freight-button-popup-layout-fix.css',import.meta.url),'utf8');
 assert.match(css,/\[data-offer-carrier="ENVIA"\] \.freight-offer-select\[aria-pressed="true"\]/);
 assert.match(css,/\[data-offer-carrier="TCC"\] \.freight-offer-select\[aria-pressed="true"\]/);
 assert.ok((css.match(/color:#fff!important/g)||[]).length>=3);
 assert.match(css,/prefers-reduced-motion:reduce/);
});
test('quick-order modal inserts freight action before close and aligns a dedicated X',()=>{
 const source=fs.readFileSync(new URL('../../assets/js/domains/freight-quotes/quote-order-entry.js',import.meta.url),'utf8');
 const css=fs.readFileSync(new URL('../../assets/css/modules/logistics/freight-button-popup-layout-fix.css',import.meta.url),'utf8');
 assert.match(source,/target\.insertBefore\(button,close\)/);
 assert.match(source,/target\.classList\.add\('order-freight-action-head'\)/);
 assert.match(source,/className='btn order-freight-action'/);
 assert.match(css,/grid-template-columns:minmax\(0,1fr\) auto 42px/);
 assert.match(css,/grid-column:3!important/);
 assert.match(css,/@media\(max-width:700px\)/);
 const ops=fs.readFileSync(new URL('../../assets/css/operations.css',import.meta.url),'utf8');
 assert.match(ops,/modules\/logistics\/freight-button-popup-layout-fix\.css/);
});
