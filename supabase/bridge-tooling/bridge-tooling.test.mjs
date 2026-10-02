import assert from 'node:assert/strict';
import test from 'node:test';
import {
  TARGET_VERSION,TARGET_FILENAME,EXPECTED_PROJECT_REF,
  sha256,normalizeHistory,validateSnapshot,assertCommentOnlySql,
  findPendingMigrations,buildWorkspacePlan,validateCliEvidence,parseMigrationListOutput
} from './core.mjs';

function history99(){
  return Array.from({length:99},(_,i)=>({version:String(20260101000000+i),name:`m${i}`}));
}
function snapshot(rows=history99(),projectRef=EXPECTED_PROJECT_REF){
  return {generated_at:'2026-10-02T00:00:00Z',project_ref:projectRef,remoteHistory:rows};
}
function target(content='select 1;'){
  return {content,blob:'blob-ok',sha:sha256(content)};
}
function listOutput(rows){
  return ['LOCAL │ REMOTE │ TIME (UTC)',...rows.map(r=>` ${r.version} │ ${r.version} │ x`)].join('\n');
}

// 1. remote 99 + target 1 -> PASS
test('99 remote versions plus one target yields exactly one pending migration',()=>{
  const rows=history99();
  const t=target();
  const plan=buildWorkspacePlan({snapshot:snapshot(rows),targetContent:t.content,targetBlob:t.blob,expectedBlob:t.blob,expectedSha256:t.sha});
  assert.equal(plan.entries.length,100);
  assert.deepEqual(plan.comparator.pending,[TARGET_FILENAME]);
  assert.equal(plan.comparator.error,null);
});

// 2. target already remote -> FAIL
test('target already remote fails closed',()=>{
  const rows=[...history99(),{version:TARGET_VERSION,name:'shipping_carrier_persistence_v11_43_1'}];
  assert.throws(()=>validateSnapshot(snapshot(rows)),/TARGET_ALREADY_REMOTE/);
});

// 3. extra local executable migration -> FAIL
test('extra local executable migration changes pending set and fails comparator',()=>{
  const rows=history99();
  const local=[...rows.map(r=>`${r.version}_${r.name}.sql`),'20261001204000_extra.sql',TARGET_FILENAME];
  const result=findPendingMigrations(local,rows.map(r=>r.version));
  assert.deepEqual(result.pending,['20261001204000_extra.sql',TARGET_FILENAME]);
});

// 4. duplicate remote version -> FAIL
test('duplicate remote version fails closed',()=>{
  const rows=history99();
  rows.push({...rows[0],name:'duplicate'});
  assert.throws(()=>normalizeHistory(rows),/REMOTE_HISTORY_DUPLICATE_VERSION/);
});

// 5. target hash drift -> FAIL
test('target hash drift fails closed',()=>{
  const rows=history99();
  const t=target('select 1;');
  assert.throws(()=>buildWorkspacePlan({snapshot:snapshot(rows),targetContent:'select 2;',targetBlob:t.blob,expectedBlob:t.blob,expectedSha256:t.sha}),/TARGET_SHA256_MISMATCH/);
});

// 6. wrong project ref -> FAIL
test('wrong project ref fails closed',()=>{
  assert.throws(()=>validateSnapshot(snapshot(history99(),'wrong-project')),/PROJECT_REF_MISMATCH/);
});

// 7. placeholder with SQL -> FAIL
test('placeholder containing SQL fails closed',()=>{
  assert.throws(()=>assertCommentOnlySql('-- safe\nselect 1;\n',{label:'bad.sql'}),/PLACEHOLDER_EXECUTABLE_CONTENT/);
});

// 8. missing remote version representation -> FAIL
test('missing remote version representation returns ErrMissingLocal',()=>{
  const rows=history99();
  const local=rows.slice(1).map(r=>`${r.version}_${r.name}.sql`).concat(TARGET_FILENAME);
  const result=findPendingMigrations(local,rows.map(r=>r.version));
  assert.equal(result.error,'ErrMissingLocal');
  assert.equal(result.missingLocal[0],rows[0].version);
});

// 9. out-of-order migration -> FAIL
test('out-of-order local migration returns ErrMissingRemote',()=>{
  const rows=history99();
  const older='20250101000000_old.sql';
  const local=[older,...rows.map(r=>`${r.version}_${r.name}.sql`),TARGET_FILENAME];
  const result=findPendingMigrations(local,rows.map(r=>r.version));
  assert.equal(result.error,'ErrMissingRemote');
  assert.equal(result.outOfOrder[0],older);
});

// 10. expected single pending target -> PASS
test('expected single pending target passes exact comparator semantics',()=>{
  const rows=history99();
  const local=[...rows.map(r=>`${r.version}_${r.name}.sql`),TARGET_FILENAME];
  const result=findPendingMigrations(local,rows.map(r=>r.version));
  assert.equal(result.error,null);
  assert.deepEqual(result.pending,[TARGET_FILENAME]);
  assert.equal(result.matched.length,99);
});

// 11. dry-run mock shows two migrations -> FAIL
test('dry-run with two migrations fails closed',()=>{
  const rows=history99();
  assert.throws(()=>validateCliEvidence({
    migrationListOutput:listOutput(rows),
    dryRunOutput:`Would push:\n${TARGET_FILENAME}\n20261001206000_extra.sql`,
    snapshot:snapshot(rows)
  }),/DRY_RUN_PENDING_SET_MISMATCH/);
});

// 12. dry-run mock suggests --include-all -> FAIL
test('dry-run suggesting include-all fails closed',()=>{
  const rows=history99();
  assert.throws(()=>validateCliEvidence({
    migrationListOutput:listOutput(rows),
    dryRunOutput:`Try again with --include-all\n${TARGET_FILENAME}`,
    snapshot:snapshot(rows)
  }),/CLI_OUTPUT_UNSAFE_SUGGESTION_OR_DRIFT/);
});

// 13. migration-list parser captures the exact remote column
test('migration-list parser captures exact remote versions',()=>{
  const rows=history99();
  assert.deepEqual(parseMigrationListOutput(listOutput(rows)),rows.map(r=>r.version));
});
