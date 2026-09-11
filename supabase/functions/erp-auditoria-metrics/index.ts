import { createClient } from "npm:@supabase/supabase-js@2.111.0";

const corsHeaders = {
  "Access-Control-Allow-Origin":"*",
  "Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods":"GET, OPTIONS",
  "Access-Control-Max-Age":"600"
};
const json = (body:unknown,status=200) => new Response(JSON.stringify(body),{
  status,
  headers:{
    ...corsHeaders,
    "Content-Type":"application/json; charset=utf-8",
    "Cache-Control":"public, max-age=60, s-maxage=300, stale-while-revalidate=600",
    "X-Content-Type-Options":"nosniff",
    "X-Robots-Tag":"noindex, nofollow"
  }
});
const validDate=(value:string|null)=>!value||/^\d{4}-\d{2}-\d{2}$/.test(value);

Deno.serve(async(req:Request)=>{
  if(req.method==="OPTIONS")return new Response(null,{status:204,headers:corsHeaders});
  if(req.method!=="GET")return json({error:"Método no permitido"},405);
  const url=new URL(req.url);
  const from=url.searchParams.get("from"),to=url.searchParams.get("to");
  if(!validDate(from)||!validDate(to))return json({error:"Rango de fechas inválido"},400);
  if(from&&to){
    const span=(new Date(`${to}T00:00:00Z`).getTime()-new Date(`${from}T00:00:00Z`).getTime())/86400000;
    if(!Number.isFinite(span)||span<0||span>366)return json({error:"El rango debe estar entre 0 y 366 días"},400);
  }
  const supabaseUrl=Deno.env.get("SUPABASE_URL")||"";
  const serviceKey=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"";
  if(!supabaseUrl||!serviceKey)return json({error:"Configuración del servidor incompleta"},500);
  const admin=createClient(supabaseUrl,serviceKey,{auth:{autoRefreshToken:false,persistSession:false}});
  const {data,error}=await admin.rpc("erp_x_auditoria_erp_metrics",{p_from:from||null,p_to:to||null});
  if(error){console.error("[AUDITORIA ERP METRICS]",error);return json({error:"No fue posible consultar las métricas agregadas"},500);}
  return json({success:true,data,source:"CRM Suministros",privacy:"aggregate-only"});
});
