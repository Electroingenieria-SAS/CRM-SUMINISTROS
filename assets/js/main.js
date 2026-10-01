import {state,setState} from "./core/state.js";
import {renderLogin,renderShell,updateShell} from "./core/layout.js";
import {initRouter,navigate} from "./core/router.js";
import {signIn,getSession,onAuthChange,clearLocalSession} from "./services/supabase.js";
import {api} from "./services/api.js";
import {toast,loading,installDialogSystem} from "./core/ui.js";
import {fmt} from "./core/format.js";
import {renderDashboard} from "./modules/dashboard.js";
import {renderOrders,openOrder} from "./modules/orders.js";
import {renderQueue} from "./modules/queue.js";
import {renderInventory} from "./modules/inventory.js";
import {renderApprovals} from "./modules/approvals.js";
import {renderVsm} from "./modules/vsm.js";
import {renderImports} from "./modules/imports.js";
import {renderAudit} from "./modules/audit.js";
import {renderAdmin} from "./modules/admin.js";
import {renderCredit} from "./modules/credit.js";
import {renderReports} from "./modules/reports.js";
import {renderCutting} from "./modules/cutting-flow.js";
import {initActiveWork,moduleForStep} from "./modules/active-work.js";
import {installSupportFlow} from "./modules/support-flow.js";
import {installPacoAssistant} from "./domains/paco/index.js";
import {renderWorkforce} from "./modules/workforce.js";
import {initWorkClock} from "./modules/work-clock.js";
import {installOperationalV112,enhanceOperationalDashboard} from "./core/layout/operational/index.js";
import {enhanceFreightIntelligenceDashboard} from "./modules/freight-intelligence-v11410.js";
import {installOperationalResolveGuard} from "./modules/operational-resolve-guard-v112.js";
import {renderReceivingHub} from "./domains/receiving/index.js";
import {registerServiceWorker} from "./core/pwa/register-service-worker.js";
import {getModuleMetadata} from "./core/layout/module-metadata.js";
import {installGlobalNavigationEvents} from "./core/events/global-navigation.js";

const routes={
  dashboard:async root=>{await renderDashboard(root);await enhanceOperationalDashboard(root);await enhanceFreightIntelligenceDashboard(root)},
  orders:renderOrders,
  sales:renderOrders,
  credit:renderCredit,
  receiving:renderReceivingHub,
  inventory:renderInventory,
  approvals:renderApprovals,
  vsm:renderVsm,
  imports:renderImports,
  audit:renderAudit,
  admin:renderAdmin,
  reports:renderReports,
  cutting:renderCutting,
  workforce:renderWorkforce
};
const queueModules={cartera:["CARTERA"],caja:["CAJA","CAJA_FACTURACION"],purchasing:["COMPRAS"],picking:["ALISTAMIENTO"],billing:["FACTURACION"],shipping:["CLIENT_POINT","CLIENT_PICKUP","LOCAL_DISPATCH","NATIONAL_DISPATCH","CLOSURE"]};
let authBootPromise=null;
const SESSION_PROFILE_ERROR=/usuario sin perfil operativo activo|perfil operativo activo|jwt expired|token.*expired/i;

function moduleReadable(code){return Boolean(state.modules?.find(module=>module.code===code)?.canRead)}
function firstReadableModule(){return state.modules?.find(module=>module.canRead)?.code||"dashboard"}

async function bootAuthenticated(){
  if(authBootPromise)return authBootPromise;
  authBootPromise=(async()=>{
    document.querySelector("#app").innerHTML=loading("Preparando tu espacio de trabajo…");
    try{
      const context=await api.session();
      setState({profile:context.profile,organization:context.organization,modules:context.modules,catalogs:context.catalogs});
      renderShell();
      initActiveWork();
      initWorkClock();
      installSupportFlow();
      installPacoAssistant();
      installOperationalResolveGuard();
      installOperationalV112();
      initRouter(async route=>{
        const requestedModule=route.segments[0]==="order"?"orders":route.module;
        if(!moduleReadable(requestedModule)){
          const fallback=firstReadableModule();
          if(fallback!==route.module){navigate(fallback);return}
        }
        if(route.segments[0]==="order"&&route.segments[1]){navigate("orders");setTimeout(()=>openOrder(route.segments[1]),0);return}
        const moduleId=route.module;
        const [title,sub]=getModuleMetadata(moduleId);
        updateShell(moduleId,title,sub);
        const root=document.querySelector("#page-content");
        root.innerHTML=loading();
        try{
          if(queueModules[moduleId])await renderQueue(root,{moduleId,steps:queueModules[moduleId],params:route.params});
          else await (routes[moduleId]||routes.dashboard)(root,{moduleId,params:route.params});
        }catch(e){
          console.error("[CRM MODULE]",moduleId,e);
          root.innerHTML=`<div class="card card-pad module-error"><h3>No fue posible cargar el módulo</h3><p class="danger">${fmt.escape(e.message)}</p><button class="btn btn-primary" id="retry-module">Reintentar</button></div>`;
          root.querySelector("#retry-module")?.addEventListener("click",()=>location.reload());
          toast(e.message,"error",8000);
        }
      });
    }catch(e){
      const technical=String(e?.technicalMessage||e?.message||"");
      if(e?.rpc==="erp_x_session"&&SESSION_PROFILE_ERROR.test(technical)){
        await clearLocalSession();
        setState({session:null,profile:null,organization:null,modules:[],catalogs:{}});
        renderLogin("La sesión anterior ya no es válida. Inicia sesión nuevamente.");
      }else renderLogin(e.message);
      bindLogin();
    }
  })();
  try{return await authBootPromise}finally{authBootPromise=null}
}

const LOGIN_GUARD_KEY="erp_ei_login_guard";
const LOGIN_MAX_ATTEMPTS=10;
const LOGIN_WINDOW_MS=15*60*1000;
function readLoginGuard(){try{const v=JSON.parse(localStorage.getItem(LOGIN_GUARD_KEY)||"{}");return {count:Number(v.count||0),resetAt:Number(v.resetAt||0)}}catch{return {count:0,resetAt:0}}}
function clearLoginGuard(){try{localStorage.removeItem(LOGIN_GUARD_KEY)}catch{}}
function registerLoginFailure(){const now=Date.now(),old=readLoginGuard(),active=old.resetAt>now?old:{count:0,resetAt:now+LOGIN_WINDOW_MS},next={count:active.count+1,resetAt:active.resetAt};try{localStorage.setItem(LOGIN_GUARD_KEY,JSON.stringify(next))}catch{}return next}
function loginGuardMessage(guard){const minutes=Math.max(1,Math.ceil((guard.resetAt-Date.now())/60000));return `Demasiados intentos fallidos en este navegador. Intenta nuevamente en ${minutes} min.`}
function bindLogin(){
  const form=document.querySelector("#login-form");if(!form)return;
  form.onsubmit=async e=>{
    e.preventDefault();
    const btn=form.querySelector("button"),guard=readLoginGuard();
    if(guard.count>=LOGIN_MAX_ATTEMPTS&&guard.resetAt>Date.now()){renderLogin(loginGuardMessage(guard));bindLogin();return}
    if(guard.resetAt&&guard.resetAt<=Date.now())clearLoginGuard();
    const email=form.email.value.trim();
    const password=form.password.value;
    btn.disabled=true;
    let auth;
    try{
      await clearLocalSession();
      setState({session:null,profile:null,organization:null,modules:[],catalogs:{}});
      auth=await signIn(email,password);
      clearLoginGuard();
    }catch(err){
      const next=registerLoginFailure();
      setState({session:null,profile:null,organization:null,modules:[],catalogs:{}});
      renderLogin(next.count>=LOGIN_MAX_ATTEMPTS?loginGuardMessage(next):(err.message||"No fue posible iniciar sesión."));
      bindLogin();
      return;
    }finally{btn.disabled=false}
    try{
      setState({session:auth.session||null});
      await bootAuthenticated();
    }catch(err){
      setState({session:null,profile:null,organization:null,modules:[],catalogs:{}});
      renderLogin(err.message||"No fue posible iniciar CRM Suministros.");
      bindLogin();
    }
  };
}

installDialogSystem();

async function start(){
  const session=await getSession();
  setState({session});
  if(session)await bootAuthenticated();else{renderLogin();bindLogin()}
  onAuthChange(async(session,event)=>{
    setState({session});
    if(session&&!state.profile&&event!=="INITIAL_SESSION")await bootAuthenticated();
    if(!session){setState({profile:null,organization:null,modules:[],catalogs:{}});renderLogin();bindLogin()}
  });
}
installGlobalNavigationEvents({openOrder,navigate,moduleForStep,toast});
start().catch(e=>{renderLogin(e.message);bindLogin()});
registerServiceWorker();
