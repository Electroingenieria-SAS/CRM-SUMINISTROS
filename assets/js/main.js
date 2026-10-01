import {state,setState} from "./core/state.js";
import {moduleForStep} from "./modules/active-work.js";
import {registerServiceWorker} from "./core/pwa/register-service-worker.js";
import {createLoginController} from "./core/auth/login-controller.js";
import {createAuthenticatedBootstrap} from "./core/bootstrap/authenticated-bootstrap.js";
import {renderLogin} from "./core/layout.js";
import {getSession,onAuthChange} from "./services/supabase.js";
import {installDialogSystem,toast} from "./core/ui.js";
import {navigate} from "./core/router.js";
import {openOrder} from "./modules/orders.js";
import {installGlobalNavigationEvents} from "./core/events/global-navigation.js";

let bindLogin=()=>{};
const {bootAuthenticated}=createAuthenticatedBootstrap({bindLogin:()=>bindLogin()});
({bindLogin}=createLoginController({bootAuthenticated}));

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
