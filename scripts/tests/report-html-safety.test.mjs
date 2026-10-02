import assert from 'node:assert/strict';
import test from 'node:test';
import {state} from '../../assets/js/domains/analytics/reports/reports-state.js';
import {renderExplorer} from '../../assets/js/domains/analytics/reports/explorer/explorer-view.js';

test('saved report periods remain text when rendered into HTML',()=>{
  const before={from:state.from,to:state.to};
  try{
    state.from='<img data-report-attack src=x onerror="alert(1)">';
    state.to='</p><script data-report-attack>alert(1)</script>';
    const html=renderExplorer();
    assert.doesNotMatch(html,/<(?:img|script)[^>]*data-report-attack/);
    assert.match(html,/&lt;img/);
    assert.match(html,/&lt;script/);
  }finally{Object.assign(state,before)}
});
