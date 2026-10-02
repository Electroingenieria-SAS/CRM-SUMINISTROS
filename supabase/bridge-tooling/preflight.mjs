#!/usr/bin/env node
import childProcess from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {EXPECTED_PROJECT_REF,TARGET_FILENAME,TARGET_VERSION,validateCliEvidence,sha256} from './core.mjs';

function die(message){console.error('CUTOVER_PRECHECK=FAIL');console.error(`REASON=${message}`);process.exit(1)}
function arg(name,required=true){const i=process.argv.indexOf(`--${name}`);if(i<0){if(required)die(`MISSING_ARG_${name}`);return null}const v=process.argv[i+1];if(!v||v.startsWith('--'))die(`MISSING_VALUE_${name}`);return v}
function run(cmd,args,{cwd=process.cwd()}={}){try{return childProcess.execFileSync(cmd,args,{cwd,encoding:'utf8',stdio:['ignore','pipe','pipe']})}catch(e){die(`${cmd} ${args.join(' ')} FAILED ${(e.stderr||e.stdout||'').toString().trim()}`)}}

const freezeSha=arg('freeze-sha');
const workspace=path.resolve(arg('workspace'));
const artifact=path.resolve(arg('artifact'));
const repoRoot=path.resolve(arg('repo-root'));
const expectedProjectRef=arg('project-ref',false)||EXPECTED_PROJECT_REF;
const here=path.dirname(fileURLToPath(import.meta.url));
const runtimeDir=path.join(workspace,'supabase','bridge-runtime');
const snapshot=path.join(runtimeDir,'remote-history.snapshot.json');

const cliVersion=run('supabase',['--version'],{cwd:workspace}).trim();
run('supabase',['db','push','--help'],{cwd:workspace});
run('supabase',['migration','list','--help'],{cwd:workspace});
const linkedRefPath=path.join(workspace,'supabase','.temp','project-ref');
if(!fs.existsSync(linkedRefPath))die('LINKED_PROJECT_REF_FILE_MISSING');
const linkedRef=fs.readFileSync(linkedRefPath,'utf8').trim();
if(linkedRef!==expectedProjectRef)die(`PROJECT_REF_MISMATCH:${linkedRef}`);
const workspaceHead=run('git',['rev-parse','HEAD'],{cwd:workspace}).trim();
if(workspaceHead!==freezeSha)die(`WORKSPACE_FREEZE_SHA_MISMATCH:${workspaceHead}`);

// Fresh read-only history snapshot BEFORE rewriting the workspace migration directory.
run(process.execPath,[path.join(here,'snapshot-remote.mjs'),'--workspace',workspace,'--output',snapshot,'--project-ref',expectedProjectRef],{cwd:repoRoot});
run(process.execPath,[path.join(here,'generate-bridge.mjs'),'--freeze-sha',freezeSha,'--snapshot',snapshot,'--workspace',workspace,'--repo-root',repoRoot,'--project-ref',expectedProjectRef],{cwd:repoRoot});
const snapshotJson=JSON.parse(fs.readFileSync(snapshot,'utf8'));
const manifestPath=path.join(runtimeDir,'bridge-manifest.json');
const manifest=JSON.parse(fs.readFileSync(manifestPath,'utf8'));
if(manifest.freeze_sha!==freezeSha)die('MANIFEST_FREEZE_SHA_MISMATCH');
if(manifest.project_ref!==expectedProjectRef)die('MANIFEST_PROJECT_REF_MISMATCH');
if(JSON.stringify(manifest.expected_pending_set)!==JSON.stringify([TARGET_VERSION]))die('MANIFEST_PENDING_SET_MISMATCH');

const migrationListOutput=run('supabase',['migration','list','--linked'],{cwd:workspace});
const dryRunOutput=run('supabase',['db','push','--linked','--dry-run'],{cwd:workspace});
let evidence;
try{evidence=validateCliEvidence({migrationListOutput,dryRunOutput,snapshot:snapshotJson,targetFilename:TARGET_FILENAME})}catch(e){die(e.message)}
if(fs.readFileSync(linkedRefPath,'utf8').trim()!==expectedProjectRef)die('PROJECT_REF_DRIFT_AFTER_DRY_RUN');

const artifactBody={
  schema_version:1,status:'PASS',freeze_sha:freezeSha,project_ref:expectedProjectRef,cli_version:cliVersion,
  snapshot_sha256:sha256(fs.readFileSync(snapshot)),manifest_sha256:sha256(fs.readFileSync(manifestPath)),
  remote_versions:evidence.remoteVersions,pending:evidence.pending,created_at:new Date().toISOString()
};
fs.mkdirSync(path.dirname(artifact),{recursive:true});
fs.writeFileSync(artifact,JSON.stringify(artifactBody,null,2)+'\n','utf8');
fs.writeFileSync(path.join(runtimeDir,'migration-list.out.txt'),migrationListOutput,'utf8');
fs.writeFileSync(path.join(runtimeDir,'db-push-dry-run.out.txt'),dryRunOutput,'utf8');
console.log('CUTOVER_PRECHECK=PASS');
console.log(`PENDING_RUNNER_SET=${TARGET_VERSION}`);
console.log(`PRECHECK_ARTIFACT=${artifact}`);
