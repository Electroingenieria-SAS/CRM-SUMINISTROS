import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import {fileURLToPath} from 'node:url';
import {readCssSource} from './read-css-source.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const entries=[
  'assets/css/core-shell.css','assets/css/operations.css',
  'assets/css/analytics.css','assets/css/experience.css',
  'assets/runtime-css/workforce-calendar-v11360.css',
  'assets/runtime-css/workforce-timeline-v11350.css',
  'assets/runtime-css/workforce-experience-v11344.css',
  'assets/runtime-css/paco-operational-v11370.css'
];

test('CSS composition resolves each extracted responsibility once, with bounded source files',()=>{
  const seen=new Set();
  for(const entry of entries){
    const file=path.join(root,entry),source=fs.readFileSync(file,'utf8');
    const imports=[...source.matchAll(/@import\s+"([^"\n]+)";/g)];
    assert.ok(imports.length,`${entry}: expected composition imports`);
    const remainder=source.replace(/\/\*[\s\S]*?\*\//g,'').replace(/@import\s+"[^"\n]+";/g,'').trim();
    assert.equal(remainder,'',`${entry}: composition must contain no duplicate implementation`);
    for(const [,relative] of imports){
      const target=path.resolve(path.dirname(file),relative);
      assert.equal(seen.has(target),false,`duplicated CSS import: ${target}`);
      seen.add(target);
      const css=fs.readFileSync(target,'utf8');
      assert.ok(css.split('\n').length<=300,`${relative}: review stylesheet size`);
      for(const [,asset] of css.matchAll(/url\(\s*["']?([^"')\s]+)["']?\s*\)/g)){
        if(/^(?:[a-z]+:|\/|#)/i.test(asset))continue;
        const resource=path.resolve(path.dirname(target),asset.split(/[?#]/)[0]);
        assert.ok(fs.existsSync(resource),`missing CSS resource: ${resource}`);
      }
    }
    assert.ok(readCssSource(file).length>source.length,`${entry}: imports must expand`);
  }
});
