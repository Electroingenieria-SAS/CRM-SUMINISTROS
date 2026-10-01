import {installDialogSystem as installDialogs,toast as showToast} from "../ui.js";
import {renderLogin as renderLoginView} from "../layout.js";
import {navigate as navigateApp} from "../router.js";
import {openOrder as openOrderView} from "../../modules/orders.js";
import {moduleForStep as resolveModuleForStep} from "../../modules/active-work.js";
import {installGlobalNavigationEvents as installGlobalNavigation} from "../events/global-navigation.js";
import {registerServiceWorker as registerWorker} from "../pwa/register-service-worker.js";
import {createLoginController as createLogin} from "../auth/login-controller.js";
import {createAuthenticatedBootstrap as createBootstrap} from "./authenticated-bootstrap.js";
import {createSessionLifecycle as createLifecycle} from "../auth/session-lifecycle.js";

export function createApplication({
  installDialogSystem=installDialogs,
  installGlobalNavigationEvents=installGlobalNavigation,
  registerServiceWorker=registerWorker,
  createLoginController=createLogin,
  createAuthenticatedBootstrap=createBootstrap,
  createSessionLifecycle=createLifecycle,
  renderLogin=renderLoginView,
  navigate=navigateApp,
  openOrder=openOrderView,
  moduleForStep=resolveModuleForStep,
  toast=showToast
}={}){
  let composed=false;
  let startPromise=null;
  let lifecycle=null;
  let bindLogin=()=>{};

  function compose(){
    if(composed)return;

    installDialogSystem();

    const {bootAuthenticated}=createAuthenticatedBootstrap({
      bindLogin:()=>bindLogin()
    });
    ({bindLogin}=createLoginController({bootAuthenticated}));
    lifecycle=createSessionLifecycle({bootAuthenticated,bindLogin});

    installGlobalNavigationEvents({openOrder,navigate,moduleForStep,toast});
    registerServiceWorker();
    composed=true;
  }

  function startApplication(){
    compose();
    if(startPromise)return startPromise;
    startPromise=Promise.resolve(lifecycle.startSessionLifecycle()).catch(error=>{
      renderLogin(error?.message);
      bindLogin();
    });
    return startPromise;
  }

  function disposeApplication(){
    lifecycle?.disposeSessionLifecycle?.();
    startPromise=null;
  }

  return {startApplication,disposeApplication};
}

const application=createApplication();
export const startApplication=application.startApplication;
export const disposeApplication=application.disposeApplication;
