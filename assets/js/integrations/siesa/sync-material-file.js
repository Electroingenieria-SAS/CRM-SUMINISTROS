import { api } from "../../services/api.js";
import { parseSiesaFile } from "./parse-material-file.js";

export async function syncSiesaFile(file,onProgress=()=>{}){
  const parsed=await parseSiesaFile(file);
  onProgress({phase:"validated",progress:8,...parsed});
  const start=await api.materialSyncBegin(file.name,parsed.sha256,parsed.rows.length);
  const batchId=start.batchId;
  const chunk=150;
  for(let offset=0;offset<parsed.rows.length;offset+=chunk){
    const slice=parsed.rows.slice(offset,offset+chunk);
    await api.materialSyncAppend(batchId,slice);
    onProgress({phase:"upload",progress:8+Math.round(((offset+slice.length)/parsed.rows.length)*82),sent:offset+slice.length,total:parsed.rows.length});
  }
  onProgress({phase:"apply",progress:94});
  const result=await api.materialSyncFinish(batchId);
  onProgress({phase:"done",progress:100,result});
  return {...result,parsed};
}
