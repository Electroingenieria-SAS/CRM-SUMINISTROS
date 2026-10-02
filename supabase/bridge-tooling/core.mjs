import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export const TOOLING_VERSION='1.1.0';
export const TARGET_VERSION='20261001205000';
export const TARGET_FILENAME='20261001205000_shipping_carrier_persistence_v11_43_1.sql';
export const TARGET_BLOB='62ae25ffb04e5c210cd917dabd8e6cdf54a562f6';
export const TARGET_SHA256='fe5ef6e94dd766ad0edc497e22dcab2912c5fc38a2c4086d68031f412035f6c9';
export const EXPECTED_PROJECT_REF='hezjxcxxcjlpmyalftam';
export const COMPARATOR_REFERENCE='supabase/cli develop apps/cli-go/pkg/migration/apply.go FindPendingMigrations';

export function sha256(value){
  return crypto.createHash('sha256').update(value).digest('hex');
}

export function stableJson(value){
  if(Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if(value&&typeof value==='object'){
    return `{${Object.keys(value).sort().map(k=>`${JSON.stringify(k)}:${stableJson(value[k])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

export function normalizeHistory(raw){
  const rows=Array.isArray(raw)?raw:raw?.remoteHistory;
  if(!Array.isArray(rows)||rows.length===0) throw new Error('REMOTE_HISTORY_EMPTY_OR_INVALID');
  const clean=rows.map((row,index)=>{
    const version=String(row?.version??'').trim();
    const suppliedName=String(row?.name??'').trim();
    if(!/^\d{14}$/.test(version)) throw new Error(`REMOTE_HISTORY_INVALID_VERSION:${index}:${version}`);
    const name=suppliedName||`remote_history_${version}`;
    if(!/^[A-Za-z0-9_]+$/.test(name)) throw new Error(`REMOTE_HISTORY_INVALID_NAME:${index}:${name}`);
    return {version,name};
  }).sort((a,b)=>a.version.localeCompare(b.version));
  const seen=new Set();
  for(const row of clean){
    if(seen.has(row.version)) throw new Error(`REMOTE_HISTORY_DUPLICATE_VERSION:${row.version}`);
    seen.add(row.version);
  }
  return clean;
}

export function validateSnapshot(snapshot,{expectedProjectRef=EXPECTED_PROJECT_REF,targetVersion=TARGET_VERSION}={}){
  if(!snapshot||typeof snapshot!=='object') throw new Error('SNAPSHOT_INVALID');
  const projectRef=String(snapshot.project_ref??snapshot.projectId??'').trim();
  if(projectRef!==expectedProjectRef) throw new Error(`PROJECT_REF_MISMATCH:${projectRef||'<empty>'}`);
  const history=normalizeHistory(snapshot);
  if(history.some(row=>row.version===targetVersion)) throw new Error(`TARGET_ALREADY_REMOTE:${targetVersion}`);
  return {projectRef,history};
}

export function placeholderContent(version,name){
  return [
    '-- E2 CUTOVER BRIDGE HISTORY REPRESENTATION ONLY',
    `-- remote_version=${version}`,
    `-- remote_name=${name}`,
    '-- This version is already represented in production migration history.',
    '-- If this file is reported as pending, stop the cutover before apply.',
    '-- Historical SQL is intentionally omitted from this bridge file.',
    ''
  ].join('\n');
}

export function assertCommentOnlySql(content,{label='placeholder'}={}){
  const normalized=String(content).replace(/^\uFEFF/,'');
  const nonComment=normalized.split(/\r?\n/)
    .map(line=>line.trim())
    .filter(line=>line && !line.startsWith('--'));
  if(nonComment.length) throw new Error(`PLACEHOLDER_EXECUTABLE_CONTENT:${label}:${nonComment[0]}`);
  const stripped=normalized.replace(/^\s*--.*$/gm,'').trim();
  if(stripped) throw new Error(`PLACEHOLDER_NONCOMMENT_CONTENT:${label}`);
  const commentText=normalized.replace(/^\s*--/gm,'');
  const forbidden=/\b(begin|commit|rollback|create|alter|drop|insert|update|delete|truncate|grant|revoke|select|call|do|copy|vacuum|reindex|function|procedure)\b|^\s*\\/im;
  if(forbidden.test(commentText)) throw new Error(`PLACEHOLDER_FORBIDDEN_TOKEN:${label}`);
  return true;
}

export function parseMigrationFilename(file){
  const name=path.basename(file);
  const m=name.match(/^([0-9]+)_(.*)\.sql$/);
  if(!m) throw new Error(`MIGRATION_FILENAME_INVALID:${name}`);
  return {version:m[1],name:m[2],filename:name};
}

export function findPendingMigrations(localFiles,remoteVersions){
  const local=[...localFiles].sort((a,b)=>path.basename(a).localeCompare(path.basename(b)));
  const remote=[...remoteVersions].map(String).sort();
  const duplicates={local:[],remote:[]};
  const localVersionCounts=new Map();
  for(const file of local){
    const {version}=parseMigrationFilename(file);
    localVersionCounts.set(version,(localVersionCounts.get(version)||0)+1);
  }
  for(const [v,n] of localVersionCounts) if(n>1) duplicates.local.push(v);
  const remoteVersionCounts=new Map();
  for(const v of remote) remoteVersionCounts.set(v,(remoteVersionCounts.get(v)||0)+1);
  for(const [v,n] of remoteVersionCounts) if(n>1) duplicates.remote.push(v);
  if(duplicates.local.length||duplicates.remote.length){
    return {matched:[],pending:[],missingLocal:[],missingRemote:[],outOfOrder:[],duplicates,error:'DUPLICATE_VERSION'};
  }

  const matched=[],unapplied=[],missing=[];
  let i=0,j=0;
  while(i<remote.length&&j<local.length){
    const rv=remote[i];
    const lv=parseMigrationFilename(local[j]).version;
    if(rv===lv){matched.push(rv);i++;j++;}
    else if(rv<lv){missing.push(rv);i++;}
    else {unapplied.push(local[j]);j++;}
  }
  if(j===local.length) missing.push(...remote.slice(i));
  if(missing.length){
    return {matched,pending:[],missingLocal:missing,missingRemote:[],outOfOrder:unapplied,duplicates,error:'ErrMissingLocal'};
  }
  if(unapplied.length){
    return {matched,pending:[],missingLocal:[],missingRemote:unapplied.map(f=>parseMigrationFilename(f).version),outOfOrder:unapplied,duplicates,error:'ErrMissingRemote'};
  }
  const pending=local.slice(remote.length);
  return {matched,pending,missingLocal:[],missingRemote:[],outOfOrder:[],duplicates,error:null};
}

export function validateComparatorPass(result,{targetVersion=TARGET_VERSION}={}){
  const pendingVersions=result.pending.map(f=>parseMigrationFilename(f).version);
  if(result.error) throw new Error(`COMPARATOR_ERROR:${result.error}`);
  if(result.duplicates.local.length||result.duplicates.remote.length) throw new Error('COMPARATOR_DUPLICATES');
  if(result.missingLocal.length||result.missingRemote.length||result.outOfOrder.length) throw new Error('COMPARATOR_DRIFT');
  if(pendingVersions.length!==1||pendingVersions[0]!==targetVersion){
    throw new Error(`PENDING_SET_MISMATCH:${pendingVersions.join(',')}`);
  }
  return true;
}

export function validateTarget({content,blob,expectedBlob=TARGET_BLOB,expectedSha256=TARGET_SHA256,remoteHistory,targetVersion=TARGET_VERSION}){
  if(blob!==expectedBlob) throw new Error(`TARGET_BLOB_MISMATCH:${blob}`);
  const digest=sha256(content);
  if(digest!==expectedSha256) throw new Error(`TARGET_SHA256_MISMATCH:${digest}`);
  if(remoteHistory.some(row=>row.version===targetVersion)) throw new Error(`TARGET_ALREADY_REMOTE:${targetVersion}`);
  return digest;
}

export function workspaceTreeHash(entries){
  const canonical=[...entries].sort((a,b)=>a.filename.localeCompare(b.filename))
    .map(entry=>`${entry.filename}\0${sha256(entry.content)}\n`).join('');
  return sha256(canonical);
}

export function buildWorkspacePlan({snapshot,targetContent,targetBlob,expectedProjectRef=EXPECTED_PROJECT_REF,targetFilename=TARGET_FILENAME,expectedBlob=TARGET_BLOB,expectedSha256=TARGET_SHA256}){
  const {projectRef,history}=validateSnapshot(snapshot,{expectedProjectRef});
  validateTarget({content:targetContent,blob:targetBlob,expectedBlob,expectedSha256,remoteHistory:history});

  const entries=history.map(row=>({
    filename:`${row.version}_${row.name}.sql`,
    content:placeholderContent(row.version,row.name),
    kind:'history-placeholder'
  }));
  entries.push({filename:targetFilename,content:targetContent,kind:'target'});

  for(const entry of entries.filter(e=>e.kind==='history-placeholder')) assertCommentOnlySql(entry.content,{label:entry.filename});
  const executable=entries.filter(e=>e.kind!=='history-placeholder');
  if(executable.length!==1||executable[0].filename!==targetFilename) throw new Error('EXTRA_LOCAL_EXECUTABLE_MIGRATION');

  const comparator=findPendingMigrations(entries.map(e=>e.filename),history.map(r=>r.version));
  validateComparatorPass(comparator);
  return {projectRef,history,entries,comparator,treeHash:workspaceTreeHash(entries)};
}

export function parseMigrationListOutput(output){
  const versions=[];
  for(const line of String(output).split(/\r?\n/)){
    if(!line.includes('│')&&!line.includes('|')) continue;
    const sep=line.includes('│')?'│':'|';
    const parts=line.split(sep).map(v=>v.trim());
    if(parts.length<2) continue;
    const remote=(parts[1].match(/^\d{14}$/)||[])[0];
    if(remote) versions.push(remote);
  }
  return versions.sort();
}

export function extractMigrationFilenames(output){
  return [...new Set(String(output).match(/\b\d+_[A-Za-z0-9_\-]+\.sql\b/g)||[])].sort();
}

export function validateCliEvidence({migrationListOutput,dryRunOutput,snapshot,targetFilename=TARGET_FILENAME}){
  const forbidden=/--include-all|include-all|migration repair|remote migration versions not found|inserted before the last migration|errmissinglocal|errmissingremote/i;
  if(forbidden.test(`${migrationListOutput}\n${dryRunOutput}`)) throw new Error('CLI_OUTPUT_UNSAFE_SUGGESTION_OR_DRIFT');
  const expectedHistory=normalizeHistory(snapshot).map(r=>r.version);
  const listedRemote=parseMigrationListOutput(migrationListOutput);
  if(listedRemote.length!==expectedHistory.length||listedRemote.some((v,i)=>v!==expectedHistory[i])){
    throw new Error(`REMOTE_HISTORY_DRIFT:${listedRemote.length}/${expectedHistory.length}`);
  }
  const pending=extractMigrationFilenames(dryRunOutput);
  if(pending.length!==1||pending[0]!==targetFilename){
    throw new Error(`DRY_RUN_PENDING_SET_MISMATCH:${pending.join(',')}`);
  }
  return {remoteVersions:listedRemote,pending};
}

export function writeBridgeArtifacts({workspaceDir,plan,manifest}){
  const supabaseDir=path.join(workspaceDir,'supabase');
  const migrationsDir=path.join(supabaseDir,'migrations');
  const runtimeDir=path.join(supabaseDir,'bridge-runtime');
  if(!fs.existsSync(path.join(supabaseDir,'config.toml'))) throw new Error('WORKSPACE_SUPABASE_CONFIG_MISSING');
  fs.rmSync(migrationsDir,{recursive:true,force:true});
  fs.mkdirSync(migrationsDir,{recursive:true});
  fs.rmSync(runtimeDir,{recursive:true,force:true});
  fs.mkdirSync(runtimeDir,{recursive:true});
  for(const entry of plan.entries){
    fs.writeFileSync(path.join(migrationsDir,entry.filename),entry.content,'utf8');
  }
  const reconciliation={
    historical:plan.history.map(row=>({version:row.version,name:row.name,status:'MATCHED_REMOTE_HISTORY',action:'PLACEHOLDER_ONLY'})),
    target:{version:TARGET_VERSION,filename:TARGET_FILENAME,status:'NEW_PENDING',action:'ONLY_EXECUTABLE_MIGRATION'}
  };
  fs.writeFileSync(path.join(runtimeDir,'bridge-manifest.json'),JSON.stringify(manifest,null,2)+'\n','utf8');
  fs.writeFileSync(path.join(runtimeDir,'comparator-report.json'),JSON.stringify(plan.comparator,null,2)+'\n','utf8');
  fs.writeFileSync(path.join(runtimeDir,'reconciliation-report.json'),JSON.stringify(reconciliation,null,2)+'\n','utf8');
  fs.writeFileSync(path.join(runtimeDir,expected_PENDING_SET.txt'),`${TARGET_VERSION}\n`,'utf8');
}
