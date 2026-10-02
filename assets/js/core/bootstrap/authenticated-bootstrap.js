import {state as appState,setState as setAppState} from "../state.js";
import {renderLogin as renderLoginView,renderShell as renderShellView} from "../layout.js";
import {initRouter as initAppRouter,navigate as navigateApp} from "../router.js";
import {clearLocalSession as clearSession} from "../../services/supabase.js";
import {api as apiService} from "../../services/api.js";
import {loading as loadingMarkup} from "../ui.js";
import {openOrder as openOrderView} from "../../modules/orders.js";
import {createRouteDispatcher as createDispatcher} from "../routing/route-dispatcher.js";
import {installAuthenticatedRuntime as installRuntime} from "./runtime-installers.js";

const SESSION_PROFILE_ERROR=/usuario sin perfil operativo activo|perfil operativo activo|jwt expired|token.*expired/i;
const EMPTY_AUTH_STATE={session:null,profile:null,organization:null,modules:[],catalogs:{}};

export function createAuthenticatedBootstrap({
  api=apiService,
  getModules=()=>appState.modules,
  setState=setAppState,
  renderLogin=renderLoginView,
  renderShell=renderShellView,
  loading=loadingMarkup,
  clearLocalSession=clearSession,
  installAuthenticatedRuntime=installRuntime,
  initRouter=initAppRouter,
  createRouteDispatcher=createDispatcher,
  navigate=navigateApp,
  openOrder=openOrderView,
  bindLogin=()=>{},
  documentRef=globalThis.document
}={}){
  let bootPromise=null;

  function bootAuthenticated(){
    if(bootPromise)return bootPromise;

    bootPromise=(async()=>{
      documentRef.querySelector("#app").innerHTML=loading("Preparando tu espacio de trabajo…");
      try{
        const context=await api.session();
        setState({
          profile:context.profile,
          organization:context.organization,
          modules:context.modules,
          catalogs:context.catalogs
        });
        renderShell();
        installAuthenticatedRuntime();
        initRouter(createRouteDispatcher({getModules,navigate,openOrder}));
      }catch(error){
        const technical=String(error?.technicalMessage||error?.message||"");
        if(error?.rpc==="erp_x_session"&&SESSION_PROFILE_ERROR.test(technical)){
          await clearLocalSession();
          setState(EMPTY_AUTH_STATE);
          renderLogin("La sesión anterior ya no es válida. Inicia sesión nuevamente.");
        }else{
          renderLogin(error?.message);
        }
        bindLogin();
      }
    })().finally(()=>{bootPromise=null});

    return bootPromise;
  }

  return {bootAuthenticated};
}
