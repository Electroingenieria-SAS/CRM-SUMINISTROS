/* CRM Suministros V11.10.6 · evita RPC getOrder simultáneos duplicados */
import {api} from "../services/api.js";

const inFlight=new Map();
const originalGetOrder=api.getOrder.bind(api);

api.getOrder=function getOrderDeduped(id){
  const key=String(id||"");
  if(!key)return originalGetOrder(id);
  const current=inFlight.get(key);
  if(current)return current;

  const request=Promise.resolve()
    .then(()=>originalGetOrder(id))
    .finally(()=>{
      if(inFlight.get(key)===request)inFlight.delete(key);
    });

  inFlight.set(key,request);
  return request;
};
