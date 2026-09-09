import {getSupabase} from "./supabase.js";

function friendlyInventoryError(error){
  const technical=[error?.message,error?.details,error?.hint].filter(Boolean).join(" · ");
  if(/permission denied|not authorized|unauthorized|42501/i.test(technical))return "No tienes permiso para consultar esta información de inventario.";
  if(/not found|no existe|no encontrado/i.test(technical))return "No se encontró la información de inventario solicitada.";
  if(/failed to fetch|networkerror|load failed/i.test(technical))return "No fue posible conectar con Inventario. Revisa la conexión e inténtalo nuevamente.";
  return technical||"No fue posible consultar la trazabilidad de inventario.";
}

async function rpc(name,params={}){
  const {data,error}=await getSupabase().rpc(name,params);
  if(error){
    console.error(`[ERP INVENTORY RPC] ${name}`,{message:error?.message,code:error?.code,status:error?.status});
    const wrapped=new Error(friendlyInventoryError(error));
    Object.assign(wrapped,error,{rpc:name});
    throw wrapped;
  }
  return data;
}

export function inventoryMovements(itemId,{lotId=null,page=1,pageSize=50}={}){
  return rpc("erp_x_inventory_movements",{
    p_item_id:itemId||null,
    p_lot_id:lotId||null,
    p_page:page,
    p_page_size:pageSize
  });
}

export function inventoryCycleControl(day=null){
  return rpc("erp_x_inventory_cycle_control",{p_day:day||null});
}

export async function inventoryCycleCount(payload={}){
  const data=await rpc("erp_x_inventory_cycle_count",{p_payload:payload||{}});
  if(typeof window!=="undefined")window.dispatchEvent(new CustomEvent("erp:work-changed",{detail:{rpc:"erp_x_inventory_cycle_count"}}));
  return data;
}
