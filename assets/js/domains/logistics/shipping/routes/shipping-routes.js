

export const ROUTE_PROFILE={
  CLIENT_POINT:{label:"Entrega en punto",icon:"⌖",takeTitle:"Confirma el punto y toma la entrega",takeCopy:"Revisa el destino registrado por Ventas. Al tomarla podrás registrar el soporte y continuar al cierre.",takeCta:"Tomar entrega y continuar",guideTitle:"Registrar soporte de entrega",guideCopy:"Carga el soporte o completa manualmente los datos requeridos antes de continuar.",destination:"Punto de entrega",closureTitle:"Finalizar entrega en punto"},
  CLIENT_PICKUP:{label:"Cliente recoge",icon:"↙",takeTitle:"Confirma el retiro y toma el pedido",takeCopy:"Deja trazado el retiro del cliente y continúa con el soporte correspondiente.",takeCta:"Tomar retiro y continuar",guideTitle:"Registrar soporte del retiro",guideCopy:"Carga el soporte o completa manualmente los datos antes de continuar al cierre.",destination:"Referencia de retiro",closureTitle:"Finalizar retiro del cliente"},
  LOCAL_DISPATCH:{label:"Despacho local",icon:"↗",takeTitle:"Confirma el destino y toma el despacho",takeCopy:"La dirección ya fue registrada por Ventas. Toma el pedido y continúa con el cargue y la liquidación del vehículo.",takeCta:"Tomar despacho y continuar",guideTitle:"Cargue y despacho del vehículo",guideCopy:"Valida factura y peso, registra vehículo y conductor, y liquida automáticamente el costo del viaje.",destination:"Destino",closureTitle:"Finalizar despacho local"},
  NATIONAL_DISPATCH:{label:"Despacho nacional",icon:"↗",takeTitle:"Confirma el destino y toma el despacho",takeCopy:"La dirección ya fue registrada por Ventas. Toma el pedido y continúa con la guía del envío nacional.",takeCta:"Tomar despacho y continuar",guideTitle:"Registrar guía del despacho nacional",guideCopy:"Carga PDF, imagen o CSV, o registra manualmente transportadora, guía, factura y flete.",destination:"Destino",closureTitle:"Finalizar despacho nacional"},
  GENERIC:{label:"Despacho",icon:"↗",takeTitle:"Confirma la información y toma el pedido",takeCopy:"Revisa los datos esenciales y continúa con el soporte del envío.",takeCta:"Tomar pedido y continuar",guideTitle:"Registrar guía o soporte",guideCopy:"Carga el soporte o completa manualmente los datos antes de continuar.",destination:"Destino",closureTitle:"Finalizar despacho"}
};

export function profileFor(order){return ROUTE_PROFILE[order?.delivery_route_code]||ROUTE_PROFILE.GENERIC}

export function destination(delivery,order={}){
  const stored=delivery?.metadata?.destination||{};
  const metadata=order?.metadata||{};
  return {
    department:stored.department||metadata.clientDepartment||order.client_department||"",
    municipality:stored.municipality||metadata.clientCity||order.client_city||"",
    address:stored.address||metadata.clientAddress||order.client_address||"",
    source:stored.source||"SALES_ORDER_ADDRESS"
  };
}
