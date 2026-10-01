import {initActiveWork} from "../../modules/active-work.js";
import {initWorkClock} from "../../modules/work-clock.js";
import {installSupportFlow} from "../../modules/support-flow.js";
import {installPacoAssistant} from "../../domains/paco/index.js";
import {installOperationalResolveGuard} from "../../modules/operational-resolve-guard-v112.js";
import {installOperationalV112} from "../layout/operational/index.js";
import {installAuditoriaErpRetryScheduler as installAuditoriaErpRetrySchedulerService} from "../../integrations/auditoria-erp/receiving-sync.js";

const DEFAULT_INSTALLERS=[
  initActiveWork,
  initWorkClock,
  installSupportFlow,
  ()=>installAuditoriaErpRetrySchedulerService(),
  installPacoAssistant,
  installOperationalResolveGuard,
  installOperationalV112
];

export function createAuthenticatedRuntimeInstaller(installers=DEFAULT_INSTALLERS){
  let nextInstaller=0;
  return function installAuthenticatedRuntimeOnce(){
    if(nextInstaller>=installers.length)return false;
    while(nextInstaller<installers.length){
      installers[nextInstaller]();
      nextInstaller+=1;
    }
    return true;
  };
}

export const installAuthenticatedRuntime=createAuthenticatedRuntimeInstaller();
