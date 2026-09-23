/**
 * Workforce Evidence Manager · V11.36.0
 *
 * Capa única de rendimiento para evidencias del cronograma:
 * - deduplica solicitudes simultáneas;
 * - limita memoria por bytes y por cantidad;
 * - precarga únicamente referencias ya autorizables;
 * - desacopla transporte (Drive) de estrategia de caché.
 */

const DEFAULT_MAX_BYTES=8*1024*1024;
const DEFAULT_MAX_ENTRIES=5;
const DEFAULT_PREFETCH_LIMIT=4;
const DEFAULT_CONCURRENCY=2;

export function createWorkEvidenceManager(loadPreview,options={}){
  if(typeof loadPreview!=="function")throw new TypeError("WorkEvidenceManager requiere un transportador de preview.");

  const maxBytes=Math.max(1024*1024,Number(options.maxBytes||DEFAULT_MAX_BYTES));
  const maxEntries=Math.max(1,Number(options.maxEntries||DEFAULT_MAX_ENTRIES));
  const cache=new Map();
  const pending=new Map();
  let cachedBytes=0;

  const get=async(evidenceId,fileId)=>{
    const evidence=String(evidenceId||"").trim();
    const file=String(fileId||"").trim();
    if(!evidence||!file)throw new Error("La evidencia no tiene una referencia de Drive válida.");

    const key=previewKey(evidence,file);
    const hit=cache.get(key);
    if(hit){
      cache.delete(key);
      cache.set(key,hit);
      return hit.preview;
    }

    if(pending.has(key))return pending.get(key);

    const request=(async()=>{
      const preview=await loadPreview(evidence,file);
      if(!preview?.dataUrl||!/^data:image\//i.test(String(preview.dataUrl))){
        throw new Error("Drive no devolvió una imagen válida.");
      }

      await decodePreview(preview.dataUrl);
      remember(key,preview);
      return preview;
    })().finally(()=>pending.delete(key));

    pending.set(key,request);
    return request;
  };

  const remember=(key,preview)=>{
    const bytes=previewBytes(preview);
    if(bytes>maxBytes)return;

    const previous=cache.get(key);
    if(previous){
      cachedBytes-=previous.bytes;
      cache.delete(key);
    }

    cache.set(key,{preview,bytes});
    cachedBytes+=bytes;

    while(cache.size>maxEntries||cachedBytes>maxBytes){
      const oldestKey=cache.keys().next().value;
      const oldest=cache.get(oldestKey);
      cache.delete(oldestKey);
      cachedBytes-=Number(oldest?.bytes||0);
    }
  };

  const prefetch=async(refs,opts={})=>{
    const limit=Math.max(1,Number(opts.limit||DEFAULT_PREFETCH_LIMIT));
    const concurrency=Math.max(1,Math.min(3,Number(opts.concurrency||DEFAULT_CONCURRENCY)));
    const queue=uniquePreviewRefs(refs).slice(0,limit);
    if(!queue.length)return [];

    const results=[];
    const workers=Array.from({length:Math.min(concurrency,queue.length)},async()=>{
      while(queue.length){
        const ref=queue.shift();
        try{
          const preview=await get(ref.evidenceId,ref.fileId);
          results.push({ok:true,ref,preview});
        }catch(error){
          results.push({ok:false,ref,error});
        }
      }
    });

    await Promise.all(workers);
    return results;
  };

  const peek=(evidenceId,fileId)=>{
    const key=previewKey(evidenceId,fileId);
    return cache.get(key)?.preview||null;
  };

  const clear=()=>{
    cache.clear();
    pending.clear();
    cachedBytes=0;
  };

  const stats=()=>({
    entries:cache.size,
    pending:pending.size,
    bytes:cachedBytes,
    maxBytes,
    maxEntries
  });

  return Object.freeze({get,prefetch,peek,clear,stats});
}

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

function uniquePreviewRefs(refs=[]){
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

function previewKey(evidenceId,fileId){
  return `${String(evidenceId||"").trim()}:${String(fileId||"").trim()}`;
}

function previewBytes(preview){
  const declared=Number(preview?.sizeBytes||0);
  if(Number.isFinite(declared)&&declared>0)return declared;

  const data=String(preview?.dataUrl||"");
  const comma=data.indexOf(",");
  const base64=comma>=0?data.slice(comma+1):data;
  return Math.max(0,Math.floor(base64.length*0.75));
}

async function decodePreview(dataUrl){
  if(typeof Image==="undefined")return;
  const image=new Image();
  image.decoding="async";
  image.src=dataUrl;

  try{
    if(typeof image.decode==="function")await image.decode();
    else await new Promise((resolve,reject)=>{
      image.onload=()=>resolve();
      image.onerror=()=>reject(new Error("No fue posible decodificar la evidencia."));
    });
  }catch{
    // La tarjeta vuelve a validar/decodificar al pintar. La precarga no debe
    // bloquear el cronograma por una decodificación anticipada fallida.
  }
}
