import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {quoteView,quoteHistoryHtml} from '../../assets/js/domains/freight-quotes/quote-view.js';

const css=readFileSync(new URL('../../assets/css/modules/freight/quote-action-system.css',import.meta.url),'utf8');
const operations=readFileSync(new URL('../../assets/css/operations.css',import.meta.url),'utf8');
const index=readFileSync(new URL('../../index.html',import.meta.url),'utf8');

test('freight CSS has one cache-busted direct link after all other CRM sheets',()=>{
 const url='assets/css/modules/freight/quote-action-system.css?v=20261016-2';
 assert.ok(index.includes(url),'direct freight stylesheet link');
 assert.ok(index.indexOf(url)>index.indexOf('assets/css/experience.css'),'freight link must be last');
 assert.ok(index.includes('operations.css?v=20261016-1'),'operations import cache gets a new version');
 assert.doesNotMatch(operations,/quote-action-system\.css/);
 assert.equal(index.split(url).length,2,'only one freight stylesheet');
 assert.match(quoteView(),/GESTIÓN DE FLETES · HISTORIAL/);
 assert.match(css,/\.freight-quotes/);
 assert.match(css,/--freight-action-blue: #1167b4/);
 assert.match(css,/--freight-action-hover: #094e91/);
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
 assert.match(css,/aria-selected="true"/);
 assert.match(css,/aria-pressed="true"/);
 assert.match(css,/not\(\[data-remove-line\]\)/);
 assert.ok(css.trimEnd().split('\n').length<=300);
});
