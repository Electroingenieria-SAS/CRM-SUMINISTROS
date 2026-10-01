import { canOperateShipping } from "./permissions/shipping-permissions.js";
import { renderDispatch } from "./dispatch/dispatch-stage.js";
import { renderClosure } from "./closure/closure-stage.js";
import { renderCommercialViewer } from "./views/commercial-viewer.js";

export const ROUTE_STEPS=new Set(["CLIENT_POINT","CLIENT_PICKUP","LOCAL_DISPATCH","NATIONAL_DISPATCH"]);

export function isShippingFlow(data){return ROUTE_STEPS.has(data?.order?.current_step_code)||data?.order?.current_step_code==="CLOSURE"}

export function renderShippingFlow(host,data,{reload,refreshLists}={}){
  if(!canOperateShipping())return renderCommercialViewer(host,data,{refreshLists});
  if(data.order.current_step_code==="CLOSURE")return renderClosure(host,data,{reload,refreshLists});
  return renderDispatch(host,data,{reload,refreshLists});
}
