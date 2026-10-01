import {state as appState,setState as setAppState} from "../state.js";
import {renderLogin as renderLoginView} from "../layout.js";
import {getSession as getCurrentSession,onAuthChange as subscribeAuthChanges} from "../../services/supabase.js";

const EMPTY_PROFILE_STATE={profile:null,organization:null,modules:[],catalogs:{}};

function unsubscribe(subscriptionResult){
  const candidate=subscriptionResult?.data?.subscription||subscriptionResult?.subscription||subscriptionResult;
  if(typeof candidate==="function"){candidate();return}
  candidate?.unsubscribe?.();
}

export function createSessionLifecycle({
  bootAuthenticated,
  bindLogin,
  getSession=getCurrentSession,
  onAuthChange=subscribeAuthChanges,
  setState=setAppState,
  getState=()=>appState,
  renderLogin=renderLoginView
}={}){
  if(typeof bootAuthenticated!=="function")throw new TypeError("bootAuthenticated es requerido");
  if(typeof bindLogin!=="function")throw new TypeError("bindLogin es requerido");

  let startPromise=null;
  let authSubscription=null;

  async function startInternal(){
    const session=await getSession();
    setState({session});
    if(session)await bootAuthenticated();
    else{
      renderLogin();
      bindLogin();
    }

    authSubscription=onAuthChange(async(nextSession,event)=>{
      setState({session:nextSession});
      if(nextSession&&!getState().profile&&event!=="INITIAL_SESSION"){
        await bootAuthenticated();
      }
      if(!nextSession){
        setState(EMPTY_PROFILE_STATE);
        renderLogin();
        bindLogin();
      }
    });
  }

  function startSessionLifecycle(){
    if(startPromise)return startPromise;
    startPromise=startInternal().catch(error=>{
      startPromise=null;
      throw error;
    });
    return startPromise;
  }

  function disposeSessionLifecycle(){
    unsubscribe(authSubscription);
    authSubscription=null;
    startPromise=null;
  }

  return {startSessionLifecycle,disposeSessionLifecycle};
}
