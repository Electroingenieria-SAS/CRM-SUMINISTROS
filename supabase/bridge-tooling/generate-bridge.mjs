#!/usr/bin/env node
import childProcess from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {
  TOOLING_VERSION,TARGET_VERSION,TARGET_FILENAME,TARGET_BLOB,TARGET_SHA256,EXPECTED_PROJECT_REF,COMPARATOR_REFERENCE,
  buildWorkspacePlan,sha256,stableJson,writeBridgeArtifacts
} from './core.mjs';

function die(message){console.error(`BRIDGE_GENERATOR_FAIL=${message}`);process.exit(1)}
function arg(name,required=true){const i=process.argv.indexOf(`--${name}`);if(i<0){if(required)die(`MISSING_ARG_${name}`);return null}const v=process.argv[i+1];if(!v||v.startsWith('--'))die(`MISSING_VALUE_${name}`);return v}
function git(cwd,args){return childProcess.execFileSync('git',args,{cwd,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim()}

const freezeSha=arg('freeze-sha');
const snapshotPath=path.resolve(arg('snapshot'));
const workspace=path.resolve(arg('workspace'));
const repoRoot=path.resolve(arg('repo-root',false)||process.cwd());
const expectedProjectRef=arg('project-ref',false)||EXPECTED_PROJECT_REF;
const targetPath=arg('target-path',false)||`supabase/migrations/${TARGET_FILENAME}`;
if(!/^[0-9a-f]{40}$/i.test(freezeSha))die('FREEZE_SHA_INVALID');
if(!fs.existsSync(snapshotPath))die('SNAPSHOT_NOT_FOUND');
if(!fs.existsSync(path.join(workspace,'.git')))die('WORKSPACE_NOT_GIT_WORKTREE');
if(!fs.existsSync(path.join(workspace,'supabase','config.toml')))die('WORKSPACE_SUPABASE_CONFIG_MISSING');
let workspaceHead;
try{workspaceHead=git(workspace,['rev-parse','HEAD'])}catch(e){die('WORKSPACE_HEAD_UNRESOLVED')}
if(workspaceHead!==freezeSha)die(`WORKSPACE_FREEZE_SHA_MISMATCH:${workspaceHead}`);

let snapshot,targetContent,targetBlob;
try{snapshot=JSON.parse(fs.readFileSync(snapshotPath,'utf8'))}catch(e){die(`SNAPSHOT_PARSE:${e.message}`)}
try{targetContent=childProcess.execFileSync('git',['show',`${freezeSha}:${targetPath}`],{cwd:repoRoot,encoding:'utf8',stdio:['ignore','pipe','pipe']})}catch(e){die('FREEZE_SHA_TARGET_MISSING')}
try{
  const ls=git(repoRoot,['ls-tree',freezeSha,'--',targetPath]);
  const m=ls.match(/\bblob\s+([0-9a-f]{40})\t/);
  if(!m)die('FREEZE_SHA_TARGET_BLOB_UNRESOLVED');
  targetBlob=m[1];
}catch(e){die(e.message)}

let plan;
try{plan=buildWorkspacePlan({snapshot,targetContent,targetBlob,expectedProjectRef})}catch(e){die(e.message)}

const here=path.dirname(fileURLToPath(import.meta.url));
const generatorFiles=['core.mjs','generate-bridge.mjs'].map(name=>fs.readFileSync(path.join(here,name),'utf8'));
const generatorHash=sha256(generatorFiles.join('\n---FILE---\n'));
const remoteHistoryHash=sha256(stableJson(plan.history));
const generatedAt=snapshot.generated_at??snapshot.generatedAt??new Date().toISOString();
const manifest={
  schema_version:1,
  tooling_version:TOOLING_VERSION,
  generated_at:generatedAt,
  freeze_sha:freezeSha,
  project_ref:plan.projectRef,
  remote_history_count:plan.history.length,
  remote_history_hash:remoteHistoryHash,
  placeholder_count:plan.history.length,
  target_migration:{version:TARGET_VERSION,filename:TARGET_FILENAME,git_blob:targetBlob,sha256:TARGET_SHA256},
  comparator_reference:COMPARATOR_REFERENCE,
  expected_pending_set:[TARGET_VERSION],
  generator_hash:generatorHash,
  workspace_tree_hash:plan.treeHash
};

try{writeBridgeArtifacts({workspaceDir:workspace,plan,manifest})}catch(e){die(`WRITE_WORKSPACE:${e.message}`)}
console.log('BRIDGE_GENERATOR=PASS');
console.log(`FREEZE_SHA=${freezeSha}`);
console.log(`PROJECT_REF=${plan.projectRef}`);
console.log(`REMOTE_HISTORY_COUNT=${plan.history.length}`);
console.log(`PLACEHOLDER_COUNT=${plan.history.length}`);
console.log&‡TARGET_BLOB=${TARGET_BLOB}`);
console.log(`TARGET_SHA256=${TARGET_SHA256}`);
console.log&‡PENDING_RUNNER_SET=${TARGET_VERSION}`);
console.log(`WORKSPACE_TREE_HASH=${plan.treeHash}`);
