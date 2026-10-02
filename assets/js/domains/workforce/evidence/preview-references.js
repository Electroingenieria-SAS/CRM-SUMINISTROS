

export function collectPreviewRefs(items=[],limit=6){
  const refs=[];
  const seen=new Set();

  for(const item of Array.isArray(items)?items:[]){
    const evidenceId=String(item?.previewEvidenceId||"").trim();
    const fileId=String(item?.previewDriveFileId||"").trim();
    if(!evidenceId||!fileId)continue;

    const key=previewKey(evidenceId,fileId);
    if(seen.has(key))continue;
    seen.add(key);
    refs.push({evidenceId,fileId,itemId:String(item.id||"")});
    if(refs.length>=limit)break;
  }

  return refs;
}

export function uniquePreviewRefs(refs=[]){
  const seen=new Set();
  const result=[];

  for(const ref of Array.isArray(refs)?refs:[]){
    const evidenceId=String(ref?.evidenceId||"").trim();
    const fileId=String(ref?.fileId||ref?.driveFileId||"").trim();
    if(!evidenceId||!fileId)continue;

    const key=previewKey(evidenceId,fileId);
    if(seen.has(key))continue;
    seen.add(key);
    result.push({evidenceId,fileId,itemId:String(ref?.itemId||"")});
  }

  return result;
}

export function previewKey(evidenceId,fileId){
  return `${String(evidenceId||"").trim()}:${String(fileId||"").trim()}`;
}
