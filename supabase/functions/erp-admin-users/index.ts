import { createClient } from "npm:@supabase/supabase-js@2.111.0";

const defaultAllowedOrigins = [
  "https://ei-erp-google-auth.vercel.app",
  "https://crm-suministros-amber.vercel.app",
  "https://crm-suministros-jeptacs-projects.vercel.app",
  "https://crm-suministros-git-main-jeptacs-projects.vercel.app",
  "https://crm-suministros-aw9itssvt-jeptacs-projects.vercel.app",
  "http://127.0.0.1:4173",
  "http://localhost:4173"
];
const allowedOrigins = new Set((Deno.env.get("ERP_ALLOWED_ORIGINS") || defaultAllowedOrigins.join(",")).split(",").map((value) => value.trim()).filter(Boolean));
const MAX_BODY_BYTES = 64 * 1024;
const MAX_NAME_LENGTH = 120;
const MAX_REASON_LENGTH = 500;
const MIN_PASSWORD_LENGTH = 12;
function requestOrigin(req: Request) { return String(req.headers.get("Origin") || "").trim(); }
function isAllowedOrigin(req: Request) { const origin=requestOrigin(req); return !origin || allowedOrigins.has(origin); }
function corsHeaders(req: Request) { const origin=requestOrigin(req); return { ...(origin && allowedOrigins.has(origin) ? {"Access-Control-Allow-Origin": origin} : {}), "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Max-Age": "600", "Vary": "Origin" }; }
const json = (req: Request, body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders(req), "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
const clean = (value: unknown) => String(value ?? "").trim();
const normalizeEmail = (value: unknown) => clean(value).toLowerCase();
const isBanned = (until?: string | null) => Boolean(until && new Date(until).getTime() > Date.now());
function publicError(error: any) { const raw = clean(error?.message || error?.error_description || error); if (/already.*registered|already.*exists|user.*exists|duplicate/i.test(raw)) return "Ya existe una cuenta con ese correo."; if (/password/i.test(raw) && /weak|short|characters|strength|least/i.test(raw)) return "La contraseña no cumple los requisitos de seguridad de Supabase."; if (/email/i.test(raw) && /invalid/i.test(raw)) return "El correo ingresado no es válido."; if (/not authorized|permission|42501/i.test(raw)) return "Solo Super Admin puede realizar esta acción."; return raw || "No fue posible completar la operación administrativa."; }
Deno.serve(async (req: Request) => {
  if (!isAllowedOrigin(req)) return json(req, { error: "Origen no autorizado" }, 403);
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(req) });
  if (req.method !== "POST") return json(req, { error: "Método no permitido" }, 405);
  if (!/^application\/json(?:;|$)/i.test(req.headers.get("content-type") || "")) return json(req, { error: "Content-Type debe ser application/json" }, 415);
  const declaredLength=Number(req.headers.get("content-length")||0); if (declaredLength>MAX_BODY_BYTES) return json(req, { error: "Solicitud demasiado grande" }, 413);
  const url = Deno.env.get("SUPABASE_URL") ?? ""; const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""; const clientKey = Deno.env.get("SUPABASE_ANON_KEY") ?? serviceKey;
  if (!url || !serviceKey) return json(req, { error: "Configuración del servidor incompleta" }, 500);
  const authHeader = req.headers.get("Authorization") ?? ""; const token = authHeader.replace(/^Bearer\s+/i, "").trim(); if (!token) return json(req, { error: "Sesión requerida" }, 401);
  const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false } });
  const userClient = createClient(url, clientKey, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false } });
  try {
    const { data: callerData, error: callerError } = await admin.auth.getUser(token); if (callerError || !callerData.user) return json(req, { error: "Sesión inválida o vencida" }, 401);
    const { data: directory, error: directoryError } = await userClient.rpc("erp_x_admin_user_directory"); if (directoryError || !directory) return json(req, { error: publicError(directoryError) }, 403);
    const actorProfileId = directory.actorProfileId as string; const callerAuthId = callerData.user.id; const profiles = Array.isArray(directory.profiles) ? directory.profiles : []; const roles = Array.isArray(directory.roles) ? directory.roles : [];
    const audit = async (profileId: string, action: string, metadata: Record<string, unknown> = {}) => { const { error } = await userClient.rpc("erp_x_admin_auth_audit", { p_profile_id: profileId, p_action: action, p_metadata: metadata }); if (error) console.error("[ADMIN AUDIT]", error); };
    const saveProfile = async (payload: Record<string, unknown>) => { const { data, error } = await userClient.rpc("erp_x_admin_profile_upsert", { p_payload: payload }); if (error) throw error; return data; };
    const rawBody = await req.text(); if (new TextEncoder().encode(rawBody).byteLength > MAX_BODY_BYTES) return json(req, { error: "Solicitud demasiado grande" }, 413);
    let body: any = {}; try { body = rawBody ? JSON.parse(rawBody) : {}; } catch { return json(req, { error: "JSON inválido" }, 400); }
    const action = clean(body?.action).toLowerCase(); const allowedActions = new Set(["list","create","update","password","delete"]); if (!allowedActions.has(action)) return json(req, { error: "Acción administrativa no reconocida" }, 400);
    const roleCodes = new Set(roles.map((role: any) => clean(role.code)).filter(Boolean)); const validRoles = (items: unknown) => Array.isArray(items) ? [...new Set(items.map(clean).filter((role) => roleCodes.has(role)))] : [];
    if (action === "list") {
      const { data: authData, error: authError } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 }); if (authError) throw authError; const authUsers = authData?.users ?? [];
      const byId = new Map(authUsers.map((u) => [u.id, u])); const byEmail = new Map(authUsers.filter((u) => u.email).map((u) => [normalizeEmail(u.email), u])); const matched = new Set<string>();
      const users = profiles.map((p: any) => { const au = (p.authUserId && byId.get(p.authUserId)) || byEmail.get(normalizeEmail(p.email)); if (au) matched.add(au.id); return { id:p.id,name:p.name,email:p.email,employeeCode:p.employeeCode,profileActive:Boolean(p.active),active:Boolean(p.active)&&!isBanned(au?.banned_until),authUserId:au?.id??p.authUserId??null,authLinked:Boolean(au),authConfirmed:Boolean(au?.email_confirmed_at),authEmail:au?.email??null,authCreatedAt:au?.created_at??null,lastSignInAt:au?.last_sign_in_at??null,bannedUntil:au?.banned_until??null,roles:Array.isArray(p.roles)?p.roles:[],profileMissing:false,isCurrentUser:p.id===actorProfileId }; });
      for (const au of authUsers) { if (matched.has(au.id)) continue; users.push({ id:null,name:au.user_metadata?.full_name||au.email?.split("@")[0]||"Cuenta Auth",email:au.email||"",employeeCode:null,profileActive:false,active:false,authUserId:au.id,authLinked:true,authConfirmed:Boolean(au.email_confirmed_at),authEmail:au.email??null,authCreatedAt:au.created_at??null,lastSignInAt:au.last_sign_in_at??null,bannedUntil:au.banned_until??null,roles:[],profileMissing:true,isCurrentUser:au.id===callerAuthId }); }
      users.sort((a:any,b:any)=>clean(a.name).localeCompare(clean(b.name),"es",{sensitivity:"base"})); return json(req,{success:true,actorProfileId,superAdminCount:Number(directory.superAdminCount||0),roles,users});
    }
    if (action === "create") {
      const input=body?.user??{}; const name=clean(input.name); const email=normalizeEmail(input.email); const password=String(input.password??""); const active=input.active!==false; const selectedRoles=validRoles(input.roles);
      if(!name||name.length>MAX_NAME_LENGTH)return json(req,{error:"Nombre requerido o demasiado largo"},400); if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254)return json(req,{error:"Correo inválido"},400); if(password.length<MIN_PASSWORD_LENGTH||password.length>128)return json(req,{error:`La contraseña debe tener entre ${MIN_PASSWORD_LENGTH} y 128 caracteres.`},400); if(active&&selectedRoles.length===0)return json(req,{error:"Selecciona al menos un rol para un usuario activo."},400);
      const existingProfile=profiles.find((p:any)=>normalizeEmail(p.email)===email); if(existingProfile?.authUserId)return json(req,{error:"Ese perfil ya tiene una cuenta de acceso vinculada."},409);
      const {data:created,error:createError}=await admin.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{full_name:name},app_metadata:{erp_managed:true}}); if(createError||!created.user)throw createError||new Error("No fue posible crear la cuenta Auth");
      try { if(!active){const {error:banError}=await admin.auth.admin.updateUserById(created.user.id,{ban_duration:"876000h"});if(banError)throw banError;} const saved=await saveProfile({id:input.profileId||existingProfile?.id||null,authUserId:created.user.id,email,name,employeeCode:clean(input.employeeCode)||null,active,roles:selectedRoles}); const profileId=saved?.profile?.id; if(profileId)await audit(profileId,"AUTH_USER_CREATED",{authUserId:created.user.id,email}); return json(req,{success:true,profile:saved?.profile,authUserId:created.user.id}); } catch(error){await admin.auth.admin.deleteUser(created.user.id,false).catch(()=>undefined);throw error;}
    }
    if (action === "update") {
      const input=body?.user??{}; const profileId=clean(input.id||input.profileId); const current=profiles.find((p:any)=>p.id===profileId); if(!current)return json(req,{error:"Perfil no encontrado"},404); const name=clean(input.name||current.name); const email=normalizeEmail(input.email||current.email); const active=input.active!==false; const selectedRoles=Array.isArray(input.roles)?validRoles(input.roles):(current.roles||[]).filter((role:string)=>roleCodes.has(role)); const authUserId=clean(current.authUserId||input.authUserId)||null;
      if(!name||name.length>MAX_NAME_LENGTH||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254)return json(req,{error:"Nombre o correo inválido"},400); if(active&&selectedRoles.length===0)return json(req,{error:"Selecciona al menos un rol para un usuario activo."},400);
      let oldAuth:any=null; if(authUserId){const {data,error}=await admin.auth.admin.getUserById(authUserId);if(error)throw error;oldAuth=data.user;const {error:authUpdateError}=await admin.auth.admin.updateUserById(authUserId,{email,email_confirm:true,user_metadata:{...(oldAuth?.user_metadata||{}),full_name:name},ban_duration:active?"none":"876000h"});if(authUpdateError)throw authUpdateError;}
      try {const saved=await saveProfile({id:profileId,...(authUserId?{authUserId}:{}),email,name,employeeCode:clean(input.employeeCode)||null,active,roles:selectedRoles});if(authUserId){const authAction=Boolean(current.active)!==active?(active?"AUTH_USER_ENABLED":"AUTH_USER_DISABLED"):"AUTH_USER_UPDATED";await audit(profileId,authAction,{authUserId,email});}return json(req,{success:true,profile:saved?.profile});} catch(error){if(authUserId&&oldAuth){await admin.auth.admin.updateUserById(authUserId,{email:oldAuth.email||current.email,email_confirm:true,user_metadata:oldAuth.user_metadata||{},ban_duration:isBanned(oldAuth.banned_until)?"876000h":"none"}).catch(()=>undefined);}throw error;}
    }
    if(action==="password"){const profileId=clean(body?.profileId);const password=String(body?.password??"");const current=profiles.find((p:any)=>p.id===profileId);if(!current)return json(req,{error:"Perfil no encontrado"},404);if(!current.authUserId)return json(req,{error:"Este perfil no tiene cuenta de acceso Auth."},409);if(password.length<MIN_PASSWORD_LENGTH||password.length>128)return json(req,{error:`La contraseña debe tener entre ${MIN_PASSWORD_LENGTH} y 128 caracteres.`},400);const {error}=await admin.auth.admin.updateUserById(current.authUserId,{password});if(error)throw error;await audit(profileId,"AUTH_PASSWORD_CHANGED",{authUserId:current.authUserId});return json(req,{success:true});}
    if(action==="delete"){const profileId=clean(body?.profileId);const reason=(clean(body?.reason)||"Eliminado desde consola Super Admin").slice(0,MAX_REASON_LENGTH);const current=profiles.find((p:any)=>p.id===profileId);if(!current)return json(req,{error:"Perfil no encontrado"},404);if(profileId===actorProfileId||current.authUserId===callerAuthId)return json(req,{error:"No puedes eliminar tu propia cuenta Super Admin."},409);const {data:detached,error:detachError}=await userClient.rpc("erp_x_admin_detach_profile",{p_profile_id:profileId,p_reason:reason});if(detachError)throw detachError;if(current.authUserId){const {error:deleteError}=await admin.auth.admin.deleteUser(current.authUserId,false);if(deleteError){await saveProfile({id:current.id,authUserId:current.authUserId,email:current.email,name:current.name,employeeCode:current.employeeCode,active:current.active,roles:current.roles||[]}).catch(()=>undefined);throw deleteError;}await audit(profileId,"AUTH_USER_DELETED",{authUserId:current.authUserId,email:current.email,reason});}return json(req,{success:true,profile:detached?.profile});}
    return json(req,{error:"Acción administrativa no reconocida"},400);
  } catch(error){console.error("[ERP SUPER ADMIN]",error);return json(req,{error:publicError(error)},500);}
});
