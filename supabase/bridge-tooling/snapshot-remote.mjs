#!/usr/bin/env node
import childProcess from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {EXPECTED_PROJECT_REF,TARGET_VERSION,parseMigrationListOutput,sha256,stableJson} from './core.mjs';

function die(message){console.error(`REMOTE_HISTORY_SNAPSHOT=FAIL`);console.error(`REASON=${message}`);process.exit(1)}
function arg(name,required=true){const i=process.argv.indexOf(`--${name}`);if(i<0){if(required)die(`MISSING_ARG_${name}`);return null}const v=process.argv[i+1];if(!v||v.startsWith('--'))die(`MISSING_VALUE_${name}`);return v}
function run(cmd,args,{cwd}={}){try{return childProcess.execFileSync(cmd,args,{cwd,encoding:'utf8',stdio:['ignore','pipe','pipe']})}catch(e){die(`${cmd} ${args.join(' ')} FAILED ${(e.stderr||e.stdout||'').toString().trim()}`)}}

const workspace=path.resolve(arg('workspace'));
const output=path.resolve(arg('output'));
const expectedProjectRef=arg('project-ref',false)||EXPECTED_PROJECT_REF;
const refFile=path.join(workspace,'supabase','.temp','project-ref');
if(!fs.existsSync(refFile))die('LINKED_PROJECT_REF_FILE_MISSING');
const linked=fs.readFileSync(refFile,'utf8').trim();
if(linked!==expectedProjectRef)die(`PROJECT_REF_MISMATCH:${linked}`);
const cliVersion=run('supabase',['--version'],{cwd:workspace}).trim();
const listOutput=run('supabase',['migration','list','--linked'],{cwd:workspace});
const versions=parseMigrationListOutput(listOutput);
if(!versions.length)die('REMOTE_HISTORY_EMPTY_OR_UNPARSEABLE');
const seen=new Set();
for(const v of versions){if(seen.has(v))die(`REMOTE_HISTORY_DUPLICATE_VERSION:${v}`);seen.add(v)}
if(versions.includes(TARGET_VERSION))die(`TARGET_ALREADY_REMOTE:${TARGET_VERSION}`);
const remoteHistory=versions.map(version=>({version,name:`remote_history_${version}`}));
const body={
  schema_version:1,
  generated_at:new Date().toISOString(),
  project_ref:expectedProjectRef,
  source:'supabase migration list --linked',
  cli_version:cliVersion,
  remote_history_count:remoteHistory.length,
  remote_history_hash:sha256(stableJson(remoteHistory)),
  remoteHistory
};
fs.mkdirSync(path.dirname(output),{recursive:true});
fs.writeFileSync(output,JSON.stringify(body,null,2)+'\n','utf8');
console.log('REMOTE_HISTORY_SNAPSHOT=PASS');
console.log(`REMOTE_HISTORY_COUNT=${remoteHistory.length}`);
console.log(`REMOTE_HISTORY_HASH=${body.remote_history_hash}`);
console.log(`SNAPSHOT=${output}`);
