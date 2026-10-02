import {getSupabase} from "../../services/supabase.js";

const SYNC_FUNCTION="erp-auditoria-bridge";
const PENDING_RPC="erp_x_auditoria_erp_pending";
const PENDING_LIMIT=20;
const RETRY_INTERVAL_MS=10000;

let retryPromise=null;
let scheduler=null;

function canRetry(){
  return navigator.onLine!==false&&document.visibilityState!=="hidden";
}

function warn(message,error){
  console.warn(message,error?.message||error);
}

export async function syncReceiptToAuditoriaErp(receiptId){
  if(!receiptId)return null;
  const client=getSupabase();
  const {data,error}=await client.functions.invoke(SYNC_FUNCTION,{body:{receiptId}});
  if(error)throw error;
  if(data?.success===false)throw new Error(data.error||"Auditoría pendiente de sincronización");
  return data;
}

export function retryPendingAuditoriaErp(){
  if(retryPromise)return retryPromise;
  if(!canRetry())return Promise.resolve([]);

  const client=getSupabase();
  const task=(async()=>{
    try{
      const {data,error}=await client.rpc(PENDING_RPC,{p_limit:PENDING_LIMIT});
      if(error)return [];
      const rows=Array.isArray(data)?data:[];
      for(const row of rows){
        const receiptId=row?.receiptId??row?.receipt_id;
        if(!receiptId)continue;
        try{
          await syncReceiptToAuditoriaErp(receiptId);
        }catch(error){
          warn("[AUDITORIA ERP] Reintento pendiente",error);
        }
      }
      return rows;
    }catch(error){
      warn("[AUDITORIA ERP] No fue posible consultar pendientes",error);
      return [];
    }
  })();

  retryPromise=task.finally(()=>{retryPromise=null});
  return retryPromise;
}

export async function notifyGoodsReceiptCreated(receiptId){
  if(!receiptId){
    queueMicrotask(()=>{void retryPendingAuditoriaErp()});
    return null;
  }

  try{
    return await syncReceiptToAuditoriaErp(receiptId);
  }catch(error){
    warn("[AUDITORIA ERP] Recepción guardada; sincronización pendiente",error);
    return null;
  }finally{
    queueMicrotask(()=>{void retryPendingAuditoriaErp()});
  }
}

export function installAuditoriaErpRetryScheduler(){
  if(scheduler)return scheduler.dispose;

  const client=getSupabase();
  const timeouts=new Set();
  const retry=()=>{void retryPendingAuditoriaErp()};
  const onVisibility=()=>{if(document.visibilityState==="visible")retry()};
  const onAuth=(event,session)=>{
    if(!session||!["INITIAL_SESSION","SIGNED_IN","TOKEN_REFRESHED"].includes(event))return;
    const id=window.setTimeout(()=>{
      timeouts.delete(id);
      retry();
    },150);
    timeouts.add(id);
  };

  window.addEventListener("online",retry,{passive:true});
  window.addEventListener("focus",retry,{passive:true});
  window.addEventListener("erp:work-changed",retry);
  document.addEventListener("visibilitychange",onVisibility);

  const authRegistration=client.auth.onAuthStateChange(onAuth);
  const authSubscription=authRegistration?.data?.subscription||authRegistration?.subscription||null;

  const first=window.setTimeout(()=>{
    timeouts.delete(first);
    retry();
  },250);
  const second=window.setTimeout(()=>{
    timeouts.delete(second);
    retry();
  },2000);
  timeouts.add(first);
  timeouts.add(second);

  const intervalId=window.setInterval(retry,RETRY_INTERVAL_MS);
  const onPageHide=()=>disposeAuditoriaErpRetryScheduler();
  window.addEventListener("pagehide",onPageHide,{once:true});

  const dispose=()=>{
    if(!scheduler)return;
    window.removeEventListener("online",retry);
    window.removeEventListener("focus",retry);
    window.removeEventListener("erp:work-changed",retry);
    window.removeEventListener("pagehide",onPageHide);
    document.removeEventListener("visibilitychange",onVisibility);
    for(const id of timeouts)window.clearTimeout(id);
    timeouts.clear();
    if(intervalId)window.clearInterval(intervalId);
    try{authSubscription?.unsubscribe?.()}catch{}
    scheduler=null;
  };

  scheduler={dispose};
  return dispose;
}

export function disposeAuditoriaErpRetryScheduler(){
  scheduler?.dispose();
}
