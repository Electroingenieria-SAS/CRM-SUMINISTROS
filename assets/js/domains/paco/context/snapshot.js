import { api } from "../../../services/api.js";
import { paco } from "../paco-state.js";
import { isManager } from "./profile-context.js";
import { itemArray } from "./order-context.js";
import { snapshotExecutions } from "../alerts/signals.js";

export function snapshotShape(data={},extra={}){
  return {
    at:Date.now(),
    orders:Array.isArray(data?.orders)?data.orders:[],
    team:Array.isArray(data?.team)?data.team:[],
    executions:Array.isArray(data?.executions)?data.executions:[],
    managerScope:Boolean(data?.managerScope),
    serverTime:data?.serverTime||null,
    ...extra
  };
}

export function missingSnapshotRpc(error){
  const text=[error?.code,error?.message,error?.technicalMessage].filter(Boolean).join(" ");
  return /PGRST202|erp_x_paco_snapshot|schema cache/i.test(text);
}

export async function compatibilitySnapshot(){
  const [ordersResult,myDayResult,peopleResult,freightResult]=await Promise.allSettled([
    api.listOrders({page:1,pageSize:120,includeHistory:true,assignment:isManager()?"ALL":"MINE"}),
    api.workMyDay(),
    isManager()?api.workPeople(null):Promise.resolve([]),
    isManager()?api.freightAlerts(10):Promise.resolve({alerts:[]})
  ]);
  const orders=ordersResult.status==="fulfilled"?itemArray(ordersResult.value):[];
  const myDay=myDayResult.status==="fulfilled"?(myDayResult.value||{}):{};
  const team=peopleResult.status==="fulfilled"?itemArray(peopleResult.value).map(person=>({
    ...person,
    activeBusinessSeconds:person.activeStartedAt?Math.max(0,Math.floor((Date.now()-new Date(person.activeStartedAt).getTime())/1000)):0,
    idleBusinessSeconds:0
  })):[];
  const executions=[...(myDay.history||[])];
  if(myDay.active&&!executions.some(row=>String(row.id)===String(myDay.active.id)))executions.unshift(myDay.active);
  const freightAlerts=freightResult.status==="fulfilled"?itemArray(freightResult.value?.alerts||freightResult.value):[];
  return snapshotShape({orders,team,executions,managerScope:isManager(),serverTime:new Date().toISOString()},{degraded:true,freightAlerts});
}

export async function loadSnapshot(){
  if(Date.now()<paco.snapshotRpcUnavailableUntil)return compatibilitySnapshot();
  try{
    const [data,freight]=await Promise.all([
      api.pacoSnapshot(),
      isManager()?api.freightAlerts(10).catch(()=>({alerts:[]})):Promise.resolve({alerts:[]})
    ]);
    paco.snapshotRpcUnavailableUntil=0;
    return snapshotShape(data,{freightAlerts:itemArray(freight?.alerts||freight)});
  }catch(error){
    if(!missingSnapshotRpc(error))throw error;
    paco.snapshotRpcUnavailableUntil=Date.now()+10*60*1000;
    console.warn("[PACO SNAPSHOT] RPC especializada no disponible; se activa compatibilidad por 10 minutos.");
    return compatibilitySnapshot();
  }
}

export function executionMap(snapshot){
  return new Map(snapshotExecutions(snapshot).map(row=>[String(row.id),row]));
}

export function orderMap(snapshot){
  return new Map((snapshot?.orders||[]).map(row=>[String(row.id||row.orderId),row]));
}
