import {getSupabase} from "../services/supabase.js";

let installed=false;
let retrying=false;
const SYNC_FUNCTION="erp-auditoria-bridge";
const CREATE_RPC="erp_x_goods_receipt_create";
const PENDING_RPC="erp_x_auditoria_erp_pending";

async function syncReceipt(client,receiptId){
  if(!receiptId)return null;
  const {data,error}=await client.functions.invoke(SYNC_FUNCTION,{body:{receiptId}});
  if(error)throw error;
  if(data?.success===false)throw new Error(data.error||"Auditoría pendiente de sincronización");
  return data;
}

async function retryPending(client,originalRpc){
  if(retrying)return;
  retrying=true;
  try{
    const {data,error}=await originalRpc(PENDING_RPC,{p_limit:10});
    if(error)return;
    const rows=Array.isArray(data)?data:[];
    for(const row of rows){
      try{await syncReceipt(client,row?.receiptId)}catch(error){console.warn("[AUDITORIA ERP] Reintento pendiente",row?.receiptId,error?.message||error)}
    }
  }catch(error){
    console.warn("[AUDITORIA ERP] No fue posible consultar pendientes",error?.message||error);
  }finally{
    retrying=false;
  }
}

export function installAuditoriaErpBridge(){
  if(installed)return;
  installed=true;
  const client=getSupabase();
  const originalRpc=client.rpc.bind(client);

  client.rpc=async function(name,params={},options){
    const result=await originalRpc(name,params,options);
    if(name===CREATE_RPC&&!result?.error){
      const receiptId=result?.data?.receipt?.id;
      if(receiptId){
        queueMicrotask(()=>syncReceipt(client,receiptId).catch(error=>console.warn("[AUDITORIA ERP] Recepción guardada; sincronización pendiente",error?.message||error)));
      }
    }
    return result;
  };

  const retry=()=>retryPending(client,originalRpc);
  window.addEventListener("online",retry,{passive:true});
  document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible")retry()});
  client.auth.onAuthStateChange((event,session)=>{
    if(session&&(event==="SIGNED_IN"||event==="TOKEN_REFRESHED"))setTimeout(retry,250);
  });
  setTimeout(retry,1500);
}

installAuditoriaErpBridge();
