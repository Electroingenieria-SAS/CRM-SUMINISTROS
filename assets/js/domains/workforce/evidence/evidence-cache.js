import { uniquePreviewRefs, previewKey } from "./preview-references.js";
import { previewBytes, decodePreview } from "./preview-decoder.js";

export const DEFAULT_MAX_BYTES=8*1024*1024;

export const DEFAULT_MAX_ENTRIES=5;

export const DEFAULT_PREFETCH_LIMIT=4;

export const DEFAULT_CONCURRENCY=2;

export function createWorkEvidenceManager(loadPreview,options={}){
const previewCache={loadPreview,options};
prepareEvidenceCache(previewCache);
prepareEvidenceLoader(previewCache);
prepareEvidenceEviction(previewCache);
prepareEvidencePrefetch(previewCache);
return finishEvidenceCache(previewCache);
}

export function prepareEvidenceCache(previewCache){
if(typeof previewCache.loadPreview!=="function")throw new TypeError("WorkEvidenceManager requiere un transportador de preview.");
previewCache.maxBytes=Math.max(1024*1024,Number(previewCache.options.maxBytes||DEFAULT_MAX_BYTES));
previewCache.maxEntries=Math.max(1,Number(previewCache.options.maxEntries||DEFAULT_MAX_ENTRIES));
previewCache.cache=new Map();
previewCache.pending=new Map();
previewCache.cachedBytes=0;
}

export function prepareEvidenceLoader(previewCache){
previewCache.get=async(evidenceId,fileId)=>{
    const evidence=String(evidenceId||"").trim();
    const file=String(fileId||"").trim();
    if(!evidence||!file)throw new Error("La evidencia no tiene una referencia de Drive válida.");

    const key=previewKey(evidence,file);
    const hit=previewCache.cache.get(key);
    if(hit){
      previewCache.cache.delete(key);
      previewCache.cache.set(key,hit);
      return hit.preview;
    }

    if(previewCache.pending.has(key))return previewCache.pending.get(key);

    const request=(async()=>{
      const preview=await previewCache.loadPreview(evidence,file);
      if(!preview?.dataUrl||!/^data:image\//i.test(String(preview.dataUrl))){
        throw new Error("Drive no devolvió una imagen válida.");
      }

      await decodePreview(preview.dataUrl);
      previewCache.remember(key,preview);
      return preview;
    })().finally(()=>previewCache.pending.delete(key));

    previewCache.pending.set(key,request);
    return request;
  };
}

export function prepareEvidenceEviction(previewCache){
previewCache.remember=(key,preview)=>{
    const bytes=previewBytes(preview);
    if(bytes>previewCache.maxBytes)return;

    const previous=previewCache.cache.get(key);
    if(previous){
      previewCache.cachedBytes-=previous.bytes;
      previewCache.cache.delete(key);
    }

    previewCache.cache.set(key,{preview,bytes});
    previewCache.cachedBytes+=bytes;

    while(previewCache.cache.size>previewCache.maxEntries||previewCache.cachedBytes>previewCache.maxBytes){
      const oldestKey=previewCache.cache.keys().next().value;
      const oldest=previewCache.cache.get(oldestKey);
      previewCache.cache.delete(oldestKey);
      previewCache.cachedBytes-=Number(oldest?.bytes||0);
    }
  };
}

export function prepareEvidencePrefetch(previewCache){
previewCache.prefetch=async(refs,opts={})=>{
    const limit=Math.max(1,Number(opts.limit||DEFAULT_PREFETCH_LIMIT));
    const concurrency=Math.max(1,Math.min(3,Number(opts.concurrency||DEFAULT_CONCURRENCY)));
    const queue=uniquePreviewRefs(refs).slice(0,limit);
    if(!queue.length)return [];

    const results=[];
    const workers=Array.from({length:Math.min(concurrency,queue.length)},async()=>{
      while(queue.length){
        const ref=queue.shift();
        try{
          const preview=await previewCache.get(ref.evidenceId,ref.fileId);
          results.push({ok:true,ref,preview});
        }catch(error){
          results.push({ok:false,ref,error});
        }
      }
    });

    await Promise.all(workers);
    return results;
  };
}

export function finishEvidenceCache(previewCache){
previewCache.peek=(evidenceId,fileId)=>{
    const key=previewKey(evidenceId,fileId);
    return previewCache.cache.get(key)?.preview||null;
  };
previewCache.clear=()=>{
    previewCache.cache.clear();
    previewCache.pending.clear();
    previewCache.cachedBytes=0;
  };
previewCache.stats=()=>({
    entries:previewCache.cache.size,
    pending:previewCache.pending.size,
    bytes:previewCache.cachedBytes,
    maxBytes:previewCache.maxBytes,
    maxEntries:previewCache.maxEntries
  });
return Object.freeze({get:previewCache.get,prefetch:previewCache.prefetch,peek:previewCache.peek,clear:previewCache.clear,stats:previewCache.stats});
}
