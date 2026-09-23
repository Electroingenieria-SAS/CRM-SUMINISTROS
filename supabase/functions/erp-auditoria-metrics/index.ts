import { createClient } from "npm:@supabase/supabase-js@2.111.0";

const defaultAllowedOrigins=[
  "https://crm-suministros-amber.vercel.app",
  "https://crm-suministros-jeptacs-projects.vercel.app",
  "https://crm-suministros-git-main-jeptacs-projects.vercel.app",
  "http://127.0.0.1:4173",
  "http://localhost:4173"
];
const configuredOrigins=(Deno.env.get("ERP_ALLOWED_ORIGINS")||"").split(",").map(v=>v.trim()).filter(Boolean);
const allowedOrigins=new Set([...defaultAllowedOrigins,...configuredOrigins]);
const origin=(req:Request)=>String(req.headers.get("Origin")||"").trim();
const isAllowedOrigin=(req:Request)=>!origin(req)||allowedOrigins.has(origin(req));
const corsHeaders=(req:Request)=>({
  ...(origin(req)&&allowedOrigins.has(origin(req))?{"Access-Control-Allow-Origin":origin(req)}:{}),
  "Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods":"GET, OPTIONS",
  "Access-Control-Max-Age":"600",
  "Vary":"Origin"
});
const json=(req:Request,body:unknown,status=200)=>new Response(JSON.stringify(body),{
  status,
  headers:{
    ...corsHeaders(req),
    "Content-Type":"application/json; charset=utf-8",
    "Cache-Control":"no-store",
    "X-Content-Type-Options":"nosniff",
    "X-Robots-Tag":"noindex, nofollow"
  }
});
const validDate=(value:string|null)=>!value||/^\d{4}-\d{2}-\d{2}$/.test(value);

Deno.serve(async(req:Request)=>{
  if(!isAllowedOrigin(req))return json(req,{error:"Origen no autorizado"},403);
  if(req.method==="OPTIONS")return new Response(null,{status:204,headers:corsHeaders(req)});
  if(req.method!=="GET")return json(req,{error:"Método no permitido"},405);

  const authHeader=String(req.headers.get("Authorization")||"");
  const token=authHeader.replace(/^Bearer\s+/i,"").trim();
  if(!token)return json(req,{error:"Sesión requerida"},401);

  const requestUrl=new URL(req.url);
  const from=requestUrl.searchParams.get("from"),to=requestUrl.searchParams.get("to");
  if(!validDate(from)||!validDate(to))return json(req,{error:"Rango de fechas inválido"},400);
  if(from&&to){
    const span=(new Date(`${to}T00:00:00Z`).getTime()-new Date(`${from}T00:00:00Z`).getTime())/86400000;
    if(!Number.isFinite(span)||span<0||span>366)return json(req,{error:"El rango debe estar entre 0 y 366 días"},400);
  }

  const supabaseUrl=Deno.env.get("SUPABASE_URL")||"";
  const clientKey=Deno.env.get("SUPABASE_ANON_KEY")||Deno.env.get("SUPABASE_PUBLISHABLE_KEY")||"";
  if(!supabaseUrl||!clientKey)return json(req,{error:"Configuración del servidor incompleta"},500);

  const client=createClient(supabaseUrl,clientKey,{
    global:{headers:{Authorization:`Bearer ${token}`}},
    auth:{autoRefreshToken:false,persistSession:false,detectSessionInUrl:false}
  });

  const {data:userData,error:userError}=await client.auth.getUser(token);
  if(userError||!userData.user)return json(req,{error:"Sesión inválida o vencida"},401);

  const {data,error}=await client.rpc("erp_x_auditoria_erp_metrics_user",{p_from:from||null,p_to:to||null});
  if(error){
    const denied=/42501|permission|authorized|autorizado/i.test(String(error.message||""));
    if(denied)return json(req,{error:"No autorizado para consultar estas métricas"},403);
    console.error("[AUDITORIA ERP METRICS]",error);
    return json(req,{error:"No fue posible consultar las métricas agregadas"},500);
  }

  return json(req,{success:true,data,source:"CRM Suministros",privacy:"organization-scoped aggregate-only"});
});
