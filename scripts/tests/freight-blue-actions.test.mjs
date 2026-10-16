import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {quoteView,quoteHistoryHtml} from '../../assets/js/domains/freight-quotes/quote-view.js';

const css=readFileSync(new URL('../../assets/css/modules/freight/quote-action-system.css',import.meta.url),'utf8');
const states=readFileSync(new URL('../../assets/css/modules/freight/quote-interactive-states.css',import.meta.url),'utf8');
const operations=readFileSync(new URL('../../assets/css/operations.css',import.meta.url),'utf8');
const index=readFileSync(new URL('../../index.html',import.meta.url),'utf8');
const experience=readFileSync(new URL('../../assets/css/experience.css',import.meta.url),'utf8');

test('four canonical CSS families preserved; freight theme loaded last in experience',()=>{
 const links=[...index.matchAll(/href="\.\/assets\/css\/([^"?]+)\?v=([^"]+)"/g)].map(m=>[m[1],m[2]]);
 assert.deepEqual(links,[
  ['core-shell.css','11.46.1'],['operations.css','11.46.1'],
  ['analytics.css','11.46.1'],['experience.css','11.46.1']
 ]);
 assert.match(experience,/@import "modules\/freight\/quote-action-system\.css";/);
 assert.equal(experience.split('quote-action-system.css').length,2,'freight imported once');
 assert.ok(experience.includes('@import "modules/freight/quote-interactive-states.css";'));
 assert.ok(experience.indexOf('quote-interactive-states.css')<experience.indexOf('quote-action-system.css'));
 assert.match(experience.trimEnd(),/quote-action-system\.css";$/);
 assert.doesNotMatch(operations,/quote-action-system\.css/);
 assert.match(quoteView(),/GESTIÓN DE FLETES · HISTORIAL/);
 assert.match(css,/\.freight-quotes/);
 assert.match(states,/--freight-action-blue: #1167b4/);
 assert.match(states,/--freight-action-hover: #094e91/);
 assert.match(css,/color: #fff/);
 assert.match(css,/:focus-visible/);
 assert.match(css,/:disabled/);
});

test('all history actions remain real buttons with stable handlers, badges stay semantic',()=>{
 const html=quoteView(),row=quoteHistoryHtml([{
  id:'q1',folio:23,status:'CALCULATED',carrier:'ENVIA',
  snapshot:{origin:'TULUA',destination:'CALI',commercialEstimate:{available:true,totalCop:27286}},
  created_at:'2026-10-15T12:00:00Z',actual_cost_cop:null
 }]);
 for(const attribute of ['data-view-tab="quote"','data-view-tab="history"',
  'data-history-clear','data-history-export','data-history-prev','data-history-next']){
  assert.match(html,new RegExp(attribute));
 }
 for(const attribute of ['data-quote-view="q1"','data-quote-duplicate="q1"','data-quote-link="q1"']){
  assert.match(row,new RegExp(attribute));
 }
 assert.match(row,/freight-history-status/);
 assert.doesNotMatch(css,/\.freight-quotes \*\s*\{/);
 assert.doesNotMatch(css,/\.freight-quotes button\s*\{background:/);
 assert.match(css,/\.freight-history-buttons \.btn/);
});

test('supports mobile filters and actions without deleting native states',()=>{
 assert.match(css,/@media \(max-width: 900px\)/);
 assert.match(css,/@media \(max-width: 760px\)/);
 assert.match(css,/@media \(max-width: 440px\)/);
 assert.match(states,/aria-selected="true"/);
 assert.match(states,/aria-pressed="true"/);
 assert.match(css,/not\(\[data-remove-line\]\)/);
 assert.ok(css.trimEnd().split('\n').length<=300);
  assert.ok(states.trimEnd().split('\n').length<=300);
  assert.match(states,/aria-pressed="false"/);
  assert.match(states,/--freight-action-idle: #ffffff/);
  assert.match(css,/data-history-stat="visible"/);
  assert.ok(css.includes('background-image:none'));
  assert.ok(states.includes('.freight-carrier-segment > button[aria-pressed="false"]'));
  assert.doesNotMatch(states,/transition: background-color/);
  const motion=readFileSync(new URL('../../assets/css/components/crm-animate-experience.css',import.meta.url),'utf8');
  assert.match(motion,/prefers-reduced-motion:reduce/);
  assert.match(motion,/segment-control button/);
  // Regression: selection styles have a single owner instead of appended overrides.
  assert.doesNotMatch(states,/Estados explícitos de los cuatro selectores/);
  assert.match(states,/background-image: none/);
  assert.doesNotMatch(readFileSync(new URL('../../assets/css/modules/freight/quote-motion.css',import.meta.url),'utf8'),/\.freight-view-tab\[aria-selected=true\]/);
  assert.doesNotMatch(readFileSync(new URL('../../assets/css/modules/freight/quotes-enterprise.css',import.meta.url),'utf8'),/\.freight-offer-selected \.freight-offer-select/);
});
