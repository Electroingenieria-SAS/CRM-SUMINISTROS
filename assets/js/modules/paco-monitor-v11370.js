const DEFAULT_INTERVAL_MS=45000;

export function createPacoMonitor({
  fetchSnapshot,
  onSnapshot,
  onError=()=>{},
  intervalMs=DEFAULT_INTERVAL_MS
}={}){
  if(typeof fetchSnapshot!=="function")throw new TypeError("PACO monitor requiere fetchSnapshot.");
  if(typeof onSnapshot!=="function")throw new TypeError("PACO monitor requiere onSnapshot.");

  let timer=null;
  let running=false;
  let inFlight=false;
  let since=new Date(Date.now()-3000).toISOString();

  const schedule=(delay=intervalMs)=>{
    clearTimeout(timer);
    if(!running)return;
    timer=setTimeout(run,Math.max(1000,delay));
  };

  const run=async(force=false)=>{
    if(!running||inFlight)return;
    if(typeof document!=="undefined"&&document.hidden&&!force){
      schedule();
      return;
    }
    if(typeof navigator!=="undefined"&&navigator.onLine===false){
      schedule();
      return;
    }

    inFlight=true;
    try{
      const snapshot=await fetchSnapshot(since);
      const serverTime=snapshot?.serverTime||new Date().toISOString();
      const nextSince=new Date(new Date(serverTime).getTime()-2000);
      since=Number.isNaN(nextSince.getTime())?serverTime:nextSince.toISOString();
      await onSnapshot(snapshot||{});
    }catch(error){
      onError(error);
    }finally{
      inFlight=false;
      schedule();
    }
  };

  const start=()=>{
    if(running)return;
    running=true;
    bind();
    schedule(1200);
  };

  const stop=()=>{
    running=false;
    clearTimeout(timer);
    unbind();
  };

  const poke=(delay=700)=>{
    if(!running)return;
    schedule(delay);
  };

  const visibility=()=>{
    if(!document.hidden)poke(250);
  };
  const online=()=>poke(250);
  const changed=()=>poke(600);

  let bound=false;
  function bind(){
    if(bound||typeof window==="undefined")return;
    bound=true;
    document.addEventListener("visibilitychange",visibility);
    window.addEventListener("online",online);
    window.addEventListener("erp:work-changed",changed);
    window.addEventListener("erp:refresh",changed);
  }

  function unbind(){
    if(!bound||typeof window==="undefined")return;
    bound=false;
    document.removeEventListener("visibilitychange",visibility);
    window.removeEventListener("online",online);
    window.removeEventListener("erp:work-changed",changed);
    window.removeEventListener("erp:refresh",changed);
  }

  return Object.freeze({start,stop,poke,run:()=>run(true)});
}
