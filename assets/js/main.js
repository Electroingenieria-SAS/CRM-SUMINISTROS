import {state,setState} from "./core/state.js";
import {renderLogin,renderShell} from "./core/layout.js";
import {initRouter,navigate} from "./core/router.js";
import {getSession,onAuthChange,clearLocalSession} from "./services/supabase.js";
import {api} from "./services/api.js";
import {toast,loading,installDialogSystem} from "./core/ui.js";
import {openOrder} from "./modules/orders.js";
import {moduleForStep} from "./modules/active-work.js";
import {registerServiceWorker} from "./core/pwa/register-service-worker.js";
import {installGlobalNavigationEvents} from "./core/events/global-navigation.js";
import {createLoginController} from "./core/auth/login-controller.js";
import {createRouteDispatcher} from "./core/routing/route-dispatcher.js";
import {installAuthenticatedRuntime} from "./core/bootstrap/runtime-installers.js";

let authBootPromise=null;
const SESSION_PROFILE_ERROR=/usuario sin perfil operativo activo|perfil operativo activo|jwt expired|token.*expired/i;

async function bootAuthenticated(){
  if(authBootPromise)return authBootPromise;
  authBootPromise=(async()=>{
    document.querySelector("#app").innerHTML=loading("Preparando tu espacio de trabajo…");
    try{
      const context=await api.session();
      setState({profile:context.profile,organization:context.organization,modules:context.modules,catalogs:context.catalogs});
      renderShell();
      installAuthenticatedRuntime();
      initRouter(createRouteDispatcher({getModules:()=>state.modules,navigate,openOrder}));
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

const {bindLogin}=createLoginController({bootAuthenticated});

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
