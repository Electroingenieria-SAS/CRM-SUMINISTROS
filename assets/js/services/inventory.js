import {getSupabase} from "./supabase.js";

function friendlyInventoryError(error){
  const technical=[error?.message,error?.details,error?.hint].filter(Boolean).join(" · ");
  if(/permission denied|not authorized|unauthorized|42501/i.test(technical))return "No tienes permiso para realizar esta acción en Inventario.";
  if(/not found|no existe|no encontrado/i.test(technical))return "No se encontró la información de inventario solicitada.";
  if(/pending|pendiente de revisión/i.test(technical))return technical;
  if(/failed to fetch|networkerror|load failed/i.test(technical))return "No fue posible conectar con Inventario. Revisa la conexión e inténtalo nuevamente.";
  return technical||"No fue posible completar la operación de inventario.";
}
async function rpc(name,params={}){
  const {data,error}=await getSupabase().rpc(name,params);
  if(error){console.error(`[ERP INVENTORY RPC] ${name}`,{message:error?.message,code:error?.code,status:error?.status});const wrapped=new Error(friendlyInventoryError(error));Object.assign(wrapped,error,{rpc:name});throw wrapped}
  return data;
}
async function mutation(name,params={}){const data=await rpc(name,params);if(typeof window!=="undefined")window.dispatchEvent(new CustomEvent("erp:work-changed",{detail:{rpc:name}}));return data}
export function inventoryMovements(itemId,{lotId=null,page=1,pageSize=50}={}){return rpc("erp_x_inventory_movements",{p_item_id:itemId||null,p_lot_id:lotId||null,p_page:page,p_page_size:pageSize})}
export function inventoryCountCenter(day=null){return rpc("erp_x_inventory_count_center",{p_day:day||null})}
export function inventoryCountSearch(query,limit=20){return rpc("erp_x_inventory_count_search",{p_query:query||null,p_limit:limit})}
export function inventoryCountResolve(code){return rpc("erp_x_inventory_count_resolve",{p_code:String(code||"").trim()})}
export function inventoryCountSubmit(payload={}){return mutation("erp_x_inventory_count_submit",{p_payload:payload||{}})}
export function inventoryCountReports(status=null,page=1,pageSize=50){return rpc("erp_x_inventory_count_reports",{p_status:status||null,p_page:page,p_page_size:pageSize})}
export function inventoryCountReview(reportId,decision,reason){return mutation("erp_x_inventory_count_review",{p_report_id:reportId,p_decision:decision,p_reason:reason})}
