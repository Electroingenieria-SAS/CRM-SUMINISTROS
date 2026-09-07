import { createClient } from "@supabase/supabase-js";

const defaultAllowedOrigins = [
  "https://ei-erp-google-auth.vercel.app",
  "https://crm-suministros-amber.vercel.app",
  "https://crm-suministros-jeptacs-projects.vercel.app",
  "https://crm-suministros-git-main-jeptacs-projects.vercel.app",
  "https://crm-suministros-aw9itssvt-jeptacs-projects.vercel.app",
  "http://127.0.0.1:4173",
  "http://localhost:4173"
];
const configuredOrigins = (Deno.env.get("ERP_ALLOWED_ORIGINS") || "")
  .split(",")
  .map(value => value.trim())
  .filter(Boolean);
const allowedOrigins = new Set([...defaultAllowedOrigins, ...configuredOrigins]);
const MAX_BODY_BYTES = 16 * 1024;
const MAX_REASON_LENGTH = 500;

function origin(req: Request) { return String(req.headers.get("Origin") || "").trim(); }
function isAllowedOrigin(req: Request) { const value=origin(req); return !value || allowedOrigins.has(value); }
function cors(req: Request) {
  const value=origin(req);
  return {
    ...(value && allowedOrigins.has(value) ? {"Access-Control-Allow-Origin": value} : {}),
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Max-Age": "600",
    "Vary": "Origin"
  };
}
function json(req: Request, body: unknown, status=200) {
  return new Response(JSON.stringify(body), {
    status,
    headers:{...cors(req),"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store","X-Content-Type-Options":"nosniff"}
  });
}
const clean=(value:unknown)=>String(value??"").trim();
const isBanned=(until?:string|null)=>Boolean(until && new Date(until).getTime()>Date.now());
function publicError(error:any){
  const raw=clean(error?.message||error?.error_description||error);
  if(/not authorized|permission|42501/i.test(raw))return "Solo Super Admin puede iniciar una sesión de verificación.";
  if(/rate limit|too many requests/i.test(raw))return "Supabase limitó temporalmente la generación de accesos. Intenta nuevamente en unos minutos.";
  return raw||"No fue posible generar la sesión temporal de verificación.";
}

Deno.serve(async (req:Request)=>{
  if(!isAllowedOrigin(req))return json(req,{error:"Origen no autorizado"},403);
  if(req.method==="OPTIONS")return new Response(null,{status:204,headers:cors(req)});
  if(req.method!=="POST")return json(req,{error:"Método no permitido"},405);
  if(!/^application\/json(?:;|$)/i.test(req.headers.get("content-type")||""))return json(req,{error:"Content-Type debe ser application/json"},415);
  const declared=Number(req.headers.get("content-length")||0);
  if(declared>MAX_BODY_BYTES)return json(req,{error:"Solicitud demasiado grande"},413);

  const url=Deno.env.get("SUPABASE_URL")??"";
  const serviceKey=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")??"";
  const clientKey=Deno.env.get("SUPABASE_ANON_KEY")??serviceKey;
  if(!url||!serviceKey)return json(req,{error:"Configuración del servidor incompleta"},500);

  const authHeader=req.headers.get("Authorization")??"";
  const token=authHeader.replace(/^Bearer\s+/i,"").trim();
  if(!token)return json(req,{error:"Sesión requerida"},401);

  const admin=createClient(url,serviceKey,{auth:{autoRefreshToken:false,persistSession:false,detectSessionInUrl:false}});
  const userClient=createClient(url,clientKey,{
    global:{headers:{Authorization:`Bearer ${token}`}},
    auth:{autoRefreshToken:false,persistSession:false,detectSessionInUrl:false}
  });

  try{
    const {data:callerData,error:callerError}=await admin.auth.getUser(token);
    if(callerError||!callerData.user)return json(req,{error:"Sesión inválida o vencida"},401);

    const {data:directory,error:directoryError}=await userClient.rpc("erp_x_admin_user_directory");
    if(directoryError||!directory)return json(req,{error:publicError(directoryError)},403);

    const raw=await req.text();
    if(new TextEncoder().encode(raw).byteLength>MAX_BODY_BYTES)return json(req,{error:"Solicitud demasiado grande"},413);
    let body:any={};
    try{body=raw?JSON.parse(raw):{}}catch{return json(req,{error:"JSON inválido"},400)}

    const profileId=clean(body?.profileId);
    const reason=clean(body?.reason).slice(0,MAX_REASON_LENGTH);
    if(!profileId)return json(req,{error:"Perfil requerido"},400);
    if(reason.length<5)return json(req,{error:"Indica el motivo de la verificación"},400);

    const actorProfileId=clean(directory.actorProfileId);
    const profiles=Array.isArray(directory.profiles)?directory.profiles:[];
    const target=profiles.find((p:any)=>clean(p.id)===profileId);
    if(!target)return json(req,{error:"Perfil no encontrado"},404);
    if(profileId===actorProfileId)return json(req,{error:"No necesitas abrir una sesión de verificación sobre tu propio perfil."},409);
    if(target.active!==true)return json(req,{error:"El perfil está inactivo y no puede iniciar sesión."},409);
    if(!clean(target.authUserId))return json(req,{error:"El perfil no tiene una cuenta Supabase Auth vinculada."},409);
    if(Array.isArray(target.roles)&&target.roles.includes("super_admin"))return json(req,{error:"No se permite suplantar otro perfil Super Admin."},403);

    const {data:targetAuth,error:targetAuthError}=await admin.auth.admin.getUserById(clean(target.authUserId));
    if(targetAuthError||!targetAuth.user)return json(req,{error:"La cuenta Auth del perfil no está disponible."},409);
    if(isBanned(targetAuth.user.banned_until))return json(req,{error:"La cuenta Auth está deshabilitada."},409);
    const email=clean(targetAuth.user.email||target.email).toLowerCase();
    if(!email)return json(req,{error:"La cuenta no tiene correo de autenticación."},409);

    const {data:linkData,error:linkError}=await admin.auth.admin.generateLink({type:"magiclink",email});
    if(linkError)throw linkError;
    const properties:any=linkData?.properties||{};
    const tokenHash=clean(properties.hashed_token||properties.hashedToken);
    if(!tokenHash)throw new Error("Supabase no devolvió un token temporal de verificación");

    const {error:auditError}=await userClient.rpc("erp_x_admin_auth_audit",{
      p_profile_id:profileId,
      p_action:"AUTH_IMPERSONATION_STARTED",
      p_metadata:{reason,targetEmail:email,targetRoles:Array.isArray(target.roles)?target.roles:[],sourceOrigin:origin(req)}
    });
    if(auditError)throw auditError;

    return json(req,{
      success:true,
      tokenHash,
      target:{id:profileId,name:clean(target.name)||email,email,roles:Array.isArray(target.roles)?target.roles:[]}
    });
  }catch(error){
    console.error("[ERP ADMIN IMPERSONATION]",error);
    return json(req,{error:publicError(error)},500);
  }
});
