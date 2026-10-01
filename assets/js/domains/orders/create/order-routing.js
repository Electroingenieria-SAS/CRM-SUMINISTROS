

export function initialRouteLabel(data){
  if(["PVC","PVP"].includes(data.orderType)&&data.hasCreditArrears)return "Cartera · cliente con mora";
  if(data.orderType==="PVN"&&data.heldByCashier)return "Caja · pedido retenido";
  if(data.orderType==="PVE"||data.requiresPurchase)return "Compras";
  return "Recepción de pedidos";
}
