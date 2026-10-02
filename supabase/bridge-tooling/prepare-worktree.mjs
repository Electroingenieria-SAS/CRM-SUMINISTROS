#!/usr/bin/env node
import childProcess from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

function die(message){console.error(`BRIDGE_PREPARE_FAIL=${message}`);process.exit(1)}
function arg(name){const i=process.argv.indexOf(`--${name}`);if(i<0)die(`MISSING_ARG_${name}`);const v=process.argv[i+1];if(!v||v.startsWith('--'))die(`MISSING_VALUE_${name}`);return v}
const freezeSha=arg('freeze-sha');
const workspace=path.resolve(arg('workspace'));
if(!/^[0-9a-f]{40}$/i.test(freezeSha))die('FREEZE_SHA_INVALID');
if(fs.existsSync(workspace))die('WORKSPACE_ALREADY_EXISTS');
try{
  childProcess.execFileSync('git',['cat-file','-e',`${freezeSha}^{commit}`],{stdio:'ignore'});
  childProcess.execFileSync('git',['worktree','add','--detach',workspace,freezeSha],{stdio:'inherit'});
}catch(e){die(`GIT_WORKTREE_ADD:${e.message}`)}
console.log('BRIDGE_WORKTREE_PREPARED=PASS');
console.log(`WORKSPACE=${workspace}`);
console.log(`FREEZE_SHA=${freezeSha}`);
console.log('NEXT=manually link/verify the expected Supabase project in this worktree, then run preflight.mjs');
