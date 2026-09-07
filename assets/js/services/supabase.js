import {CONFIG} from "../config.js";

let client;
const URL_PARAMS=(()=>{try{return new URLSearchParams(window.location.search)}catch{return new URLSearchParams()}})();
const IMPERSONATION_MODE=URL_PARAMS.get("impersonation")==="1";
const IMPERSONATION_SLOT=String(URL_PARAMS.get("slot")||"single").replace(/[^a-zA-Z0-9_-]/g,"").slice(0,80)||"single";
const BASE_AUTH_STORAGE_KEY="ei-erp-supply-v10";
const AUTH_STORAGE_KEY=IMPERSONATION_MODE?`${BASE_AUTH_STORAGE_KEY}-verify-${IMPERSONATION_SLOT}`:BASE_AUTH_STORAGE_KEY;
const PROJECT_REF=(()=>{try{return new URL(CONFIG.supabase.url).hostname.split(".")[0]||""}catch{return ""}})();
let impersonationPromise=null;

function message(error){
  const raw=String(error?.message||error||"");
  const code=String(error?.code||"");
  if(code==="invalid_credentials")return "Correo o contraseña incorrectos.";
  const rules=[
    [/invalid login credentials/i,"Correo o contraseña incorrectos."],
    [/email not confirmed/i,"El correo todavía no ha sido confirmado."],
    [/user not found/i,"No existe una cuenta activa con ese correo."],
    [/password should be/i,"La contraseña no cumple los requisitos de seguridad."],
    [/otp.*expired|token.*invalid|token.*expired/i,"La sesión temporal de verificación venció. Genera una nueva desde Administración."],
    [/jwt expired|refresh token.*not found|invalid refresh token/i,"Tu sesión venció. Ingresa nuevamente."],
    [/failed to fetch|networkerror|load failed/i,"No fue posible conectar con el ERP. Revisa la conexión e inténtalo nuevamente."]
  ];
  return rules.find(([re])=>re.test(raw))?.[1]||raw||"No fue posible completar la solicitud.";
}
function throwError(error){
  const e=new Error(message(error));
  Object.assign(e,error||{});
  e.message=message(error);
  throw e;
}
function removeStoredAuth(){
  try{
    const prefixes=IMPERSONATION_MODE
      ? [AUTH_STORAGE_KEY]
      : [AUTH_STORAGE_KEY,PROJECT_REF?`sb-${PROJECT_REF}-auth-token`:""] .filter(Boolean);
    for(let i=localStorage.length-1;i>=0;i--){
      const key=localStorage.key(i);
      if(key&&prefixes.some(prefix=>key===prefix||key.startsWith(`${prefix}.`)||key.startsWith(`${prefix}-`)))localStorage.removeItem(key);
    }
  }catch{}
}
function impersonationHash(){
  try{return new URLSearchParams(String(window.location.hash||"").replace(/^#/,""))}catch{return new URLSearchParams()}
}
function ensureImpersonationBanner(label=""){
  if(!IMPERSONATION_MODE)return;
  const mount=()=>{
    if(document.querySelector("[data-erp-impersonation-banner]"))return;
    const banner=document.createElement("div");
    banner.dataset.erpImpersonationBanner="true";
    banner.setAttribute("role","status");
    Object.assign(banner.style,{position:"fixed",left:"50%",bottom:"14px",transform:"translateX(-50%)",zIndex:"2147483000",display:"flex",alignItems:"center",gap:"12px",maxWidth:"calc(100vw - 24px)",padding:"10px 12px",borderRadius:"12px",boxShadow:"0 8px 28px rgba(0,0,0,.24)",background:"#111827",color:"#fff",fontFamily:"inherit",fontSize:"13px"});
    const text=document.createElement("span");
    text.style.cssText="min-width:0;line-height:1.25";
    const strong=document.createElement("strong");
    strong.textContent="Modo de verificación";
    const detail=document.createElement("span");
    detail.textContent=` · Sesión aislada${label?` como ${label}`:""}. Las acciones se ejecutan con los permisos reales de este perfil.`;
    text.append(strong,detail);
    const close=document.createElement("button");
    close.type="button";
    close.textContent="Cerrar prueba";
    Object.assign(close.style,{border:"1px solid rgba(255,255,255,.35)",background:"transparent",color:"#fff",borderRadius:"8px",padding:"7px 9px",cursor:"pointer",whiteSpace:"nowrap"});
    close.addEventListener("click",async()=>{
      try{await getSupabase().auth.signOut({scope:"local"})}catch{}
      removeStoredAuth();
      try{window.close()}catch{}
      if(!window.closed)window.location.replace(window.location.pathname);
    });
    banner.append(text,close);
    document.body.appendChild(banner);
  };
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",mount,{once:true});else mount();
}
async function consumeImpersonationToken(){
  if(!IMPERSONATION_MODE)return null;
  if(impersonationPromise)return impersonationPromise;
  const params=impersonationHash();
  const tokenHash=params.get("impersonation_token");
  const target=params.get("target")||"";
  if(!tokenHash){ensureImpersonationBanner(target);return null}
  impersonationPromise=(async()=>{
    const {data,error}=await getSupabase().auth.verifyOtp({token_hash:tokenHash,type:"email"});
    if(error)throwError(error);
    const cleanUrl=new URL(window.location.href);
    cleanUrl.hash="";
    window.history.replaceState({},document.title,`${cleanUrl.pathname}${cleanUrl.search}`);
    ensureImpersonationBanner(target||data?.user?.email||"");
    return data?.session||null;
  })();
  return impersonationPromise;
}
export function getSupabase(){
  if(client)return client;
  if(!window.supabase?.createClient)throw new Error("No fue posible iniciar el servicio del ERP. Recarga la página e inténtalo nuevamente.");
  client=window.supabase.createClient(CONFIG.supabase.url,CONFIG.supabase.publishableKey,{
    auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:!IMPERSONATION_MODE,flowType:"pkce",storageKey:AUTH_STORAGE_KEY},
    db:{retry:false}
  });
  return client;
}
export async function clearLocalSession(){
  const auth=getSupabase().auth;
  try{await auth.signOut({scope:"local"})}catch{}
  removeStoredAuth();
}
export async function signIn(email,password){
  const normalized=String(email||"").trim().toLowerCase();
  const {data,error}=await getSupabase().auth.signInWithPassword({email:normalized,password});
  if(error)throwError(error);
  return data;
}
export async function signOut(){
  const {error}=await getSupabase().auth.signOut({scope:"local"});
  removeStoredAuth();
  if(error)throwError(error);
}
export async function getSession(){
  await consumeImpersonationToken();
  const {data,error}=await getSupabase().auth.getSession();
  if(error){await clearLocalSession();throwError(error)}
  if(IMPERSONATION_MODE&&data.session)ensureImpersonationBanner(data.session.user?.email||"");
  return data.session;
}
export function onAuthChange(callback){return getSupabase().auth.onAuthStateChange((event,session)=>callback(session,event))}
