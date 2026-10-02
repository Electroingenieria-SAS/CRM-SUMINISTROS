import {renderLogin as renderLoginView} from "../layout.js";
import {setState as setAppState} from "../state.js";
import {signIn as signInService,clearLocalSession as clearLocalSessionService} from "../../services/supabase.js";

const LOGIN_GUARD_KEY="erp_ei_login_guard";
const LOGIN_MAX_ATTEMPTS=10;
const LOGIN_WINDOW_MS=15*60*1000;
const EMPTY_AUTH_STATE={session:null,profile:null,organization:null,modules:[],catalogs:{}};

export function createLoginController({
  bootAuthenticated,
  signIn=signInService,
  clearLocalSession=clearLocalSessionService,
  renderLogin=renderLoginView,
  setState=setAppState,
  storage=globalThis.localStorage,
  documentRef=globalThis.document,
  now=()=>Date.now()
}={}){
  if(typeof bootAuthenticated!=="function")throw new TypeError("bootAuthenticated es requerido");

  function readLoginGuard(){
    try{
      const value=JSON.parse(storage?.getItem(LOGIN_GUARD_KEY)||"{}");
      return {count:Number(value.count||0),resetAt:Number(value.resetAt||0)};
    }catch{return {count:0,resetAt:0}}
  }

  function clearLoginGuard(){
    try{storage?.removeItem(LOGIN_GUARD_KEY)}catch{}
  }

  function registerLoginFailure(){
    const current=now();
    const previous=readLoginGuard();
    const active=previous.resetAt>current?previous:{count:0,resetAt:current+LOGIN_WINDOW_MS};
    const next={count:active.count+1,resetAt:active.resetAt};
    try{storage?.setItem(LOGIN_GUARD_KEY,JSON.stringify(next))}catch{}
    return next;
  }

  function loginGuardMessage(guard){
    const minutes=Math.max(1,Math.ceil((guard.resetAt-now())/60000));
    return `Demasiados intentos fallidos en este navegador. Intenta nuevamente en ${minutes} min.`;
  }

  function bindLogin(){
    const form=documentRef?.querySelector?.("#login-form");
    if(!form)return;
    form.onsubmit=async event=>{
      event.preventDefault();
      const btn=form.querySelector("button");
      const guard=readLoginGuard();
      if(guard.count>=LOGIN_MAX_ATTEMPTS&&guard.resetAt>now()){
        renderLogin(loginGuardMessage(guard));
        bindLogin();
        return;
      }
      if(guard.resetAt&&guard.resetAt<=now())clearLoginGuard();
      const email=form.email.value.trim();
      const password=form.password.value;
      btn.disabled=true;
      let auth;
      try{
        await clearLocalSession();
        setState(EMPTY_AUTH_STATE);
        auth=await signIn(email,password);
        clearLoginGuard();
      }catch(err){
        const next=registerLoginFailure();
        setState(EMPTY_AUTH_STATE);
        renderLogin(next.count>=LOGIN_MAX_ATTEMPTS?loginGuardMessage(next):(err.message||"No fue posible iniciar sesión."));
        bindLogin();
        return;
      }finally{btn.disabled=false}
      try{
        setState({session:auth.session||null});
        await bootAuthenticated();
      }catch(err){
        setState(EMPTY_AUTH_STATE);
        renderLogin(err.message||"No fue posible iniciar CRM Suministros.");
        bindLogin();
      }
    };
  }

  return {bindLogin};
}
