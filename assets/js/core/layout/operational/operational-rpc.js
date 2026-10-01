import { getSupabase } from "../../../services/supabase.js";

export async function rpc(name,params={}){
  const {data,error}=await getSupabase().rpc(name,params);
  if(error){
    const detail=[error.message,error.details,error.hint].filter(Boolean).join(" · ");
    throw new Error(detail||"No fue posible completar la operación.");
  }
  return data;
}
