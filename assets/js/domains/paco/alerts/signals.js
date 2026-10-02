import { ORDER_WARN_SECONDS, IDLE_WARN_SECONDS, LONG_ACTIVITY_SECONDS, AUX_ROLES } from "../paco-config.js";
import { isManager } from "../context/profile-context.js";
import { orderAge, orderAssignee, activeOrder } from "../context/order-context.js";

export function snapshotExecutions(snapshot){return Array.isArray(snapshot?.executions)?snapshot.executions:[]}

export function snapshotTeam(snapshot){return Array.isArray(snapshot?.team)?snapshot.team:[]}

export function idleAuxiliaries(snapshot){
  if(!isManager())return [];
  return snapshotTeam(snapshot)
    .filter(person=>!person.specialTreatment)
    .filter(person=>(person.roles||[]).some(role=>AUX_ROLES.has(role)))
    .filter(person=>!person.activeTitle&&Number(person.idleBusinessSeconds||0)>=IDLE_WARN_SECONDS)
    .map(person=>({...person,idleSeconds:Number(person.idleBusinessSeconds||0)}))
    .sort((a,b)=>b.idleSeconds-a.idleSeconds);
}

export function delayedOrders(snapshot){
  return (snapshot.orders||[])
    .filter(row=>activeOrder(row)&&(Boolean(row.slaExceeded||row.sla_exceeded)||orderAge(row)>=ORDER_WARN_SECONDS))
    .sort((a,b)=>(Number(Boolean(b.slaExceeded||b.sla_exceeded))-Number(Boolean(a.slaExceeded||a.sla_exceeded)))||orderAge(b)-orderAge(a));
}

export function longActivities(snapshot){
  if(!isManager())return [];
  return snapshotTeam(snapshot)
    .filter(person=>!person.specialTreatment)
    .filter(person=>person.activeTitle&&Number(person.activeBusinessSeconds||0)>=LONG_ACTIVITY_SECONDS)
    .map(person=>({...person,activeSeconds:Number(person.activeBusinessSeconds||0)}))
    .sort((a,b)=>b.activeSeconds-a.activeSeconds);
}

export function unassignedOrders(snapshot){
  return (snapshot?.orders||[])
    .filter(row=>activeOrder(row)&&!orderAssignee(row))
    .sort((a,b)=>orderAge(b)-orderAge(a));
}
