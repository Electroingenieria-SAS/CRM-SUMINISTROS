#!/usr/bin/env node
import childProcess from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {EXPECTED_PROJECT_REF,TARGET_FILENAME,TARGET_VERSION,sha256,validateCliEvidence} from './core.mjs';

function die(message){console.error('CUTOVER_APPLY=ABORT');console.error(`REASON=${message}`);process.exit(1)}
function arg(name,required=true){const i=process.argv.indexOf(`--${name}`);if(i<0){if(required)die(`MISSING_ARG_${name}`);return null}const v=process.argv[i+1];if(!v||v.startsWith('--'))die(`MISSING_VALUE_${name}`);return v}
if(!process.argv.includes('--authorized'))die('EXPLICIT_AUTHORIZATION_FLAG_REQUIRED');
const changeId=arg('change-id');
const precheckPath=path.resolve(arg('precheck'));
const workspace=path.resolve(arg('workspace'));
const freezeSha=arg('freeze-sha');
const expectedProjectRef=arg('project-ref',false)||EXPECTED_PROJECT_REF;
if(changeId.trim().length<3)die('CHANGE_ID_REQUIRED');
if(!fs.existsSync(precheckPath))die('PRECHECK_ARTIFACT_MISSING');
const artifact=JSON.parse(fs.readFileSync(precheckPath,'utf8'));
if(artifact.status!=='PASS')die('PRECHECK_NOT_PASS');
if(artifact.freeze_sha!==freezeSha)die('FREEZE_SHA_MISMATCH');
if(artifact.project_ref!==expectedProjectRef)die('PROJECT_REF_MISMATCH');
if(JSON.stringify(artifact.pending)!==JSON.stringify([TARGET_FILENAME]))die('PENDING_SET_PROOF_INVALID');
const linkedRefPath=path.join(workspace,'supabase','.temp','project-ref');
if(!fs.existsSync(linkedRefPath)||fs.readFileSync(linkedRefPath,'utf8').trim()!==expectedProjectRef)die('LINKED_PROJECT_REF_MISMATCH');
const runtimeDir=path.join(workspace,'supabase','bridge-runtime');
const manifestPath=path.join(runtimeDir,'bridge-manifest.json');
const snapshotPath=path.join(runtimeDir,'remote-history.snapshot.json');
if(!fs.existsSync(manifestPath)||!fs.existsSync(snapshotPath))die('BRIDGE_EVIDENCE_MISSING');
if(artifact.manifest_sha256!==sha256(fs.readFileSync(manifestPath)))die('MANIFEST_CHANGED_AFTER_PRECHECK');
if(artifact.snapshot_sha256!==sha256(fs.readFileSync(snapshotPath)))die('SNAPSHOT_CHANGED_AFTER_PRECHECK');
const manifest=JSON.parse(fs.readFileSync(manifestPath,'utf8'));
if(manifest.freeze_sha!==freezeSha||manifest.project_ref!==expectedProjectRef)die('MANIFEST_BINDING_INVALID');
if(JSON.stringify(manifest.expected_pending_set)!==JSON.stringify([TARGET_VERSION]))die('MANIFEST_PENDING_INVALID');
const snapshot=JSON.parse(fs.readFileSync(snapshotPath,'utf8'));
const currentCli=childProcess.execFileSync('supabase',['--version'],{cwd:workspace,encoding:'utf8'}).trim();
if(currentCli!==artifact.cli_version)die(`CLI_VERSION_CHANGED:${currentCli}`);
let liveEvidence;
try{
  const listOut=childProcess.execFileSync('supabase',['migration','list','--linked'],{cwd:workspace,encoding:'utf8'});
  const dryOut=childProcess.execFileSync('supabase',['db','push','--linked','--dry-run'],{cwd:workspace,encoding:'utf8'});
  liveEvidence=validateCliEvidence({migrationListOutput:listOut,dryRunOutput:dryOut,snapshot,targetFilename:TARGET_FILENAME});
}catch(e){die(`LIVE_RECHECK_FAILED:${e.message}`)}
if(JSON.stringify(liveEvidence.pending)!==JSON.stringify([TARGET_FILENAME]))die('LIVE_PENDING_SET_INVALID');
console.log('AUTHORIZED_CHANGE_SUMMARY');
console.log(`CHANGE_ID=${changeId}`);
console.log(`FREEZE_SHA=${freezeSha}`);
console.log(`PROJECT_REF=${expectedProjectRef}`);
console.log(`PENDING=${TARGET_FILENAME}`);
// Deliberately the only mutable database command in this bundle.
childProcess.execFileSync('supabase',['db','push','--linked'],{cwd:workspace,stdio:'inherit'});
