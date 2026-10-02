import { getSupabase } from "../../../../services/supabase.js";

export async function rpc(name,params={}){
  const {data,error}=await getSupabase().rpc(name,params);
  if(error)throw error;
  return data;
}
