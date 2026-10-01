

export const VERSION="11.37.4";

export const STYLE_ID="paco-operational-v11370-style";

export const MONITOR_MS=60000;

export const DIGEST_INTERVAL_MS=30*60*1000;

export const ORDER_WARN_SECONDS=3600;

export const IDLE_WARN_SECONDS=20*60;

export const LONG_ACTIVITY_SECONDS=5400;

export const ALERT_COOLDOWN_MS=30*60*1000;

export const DIGEST_ORDER_LIMIT=12;

export const MANAGER_ROLES=new Set(["super_admin","gerencia","jefe_logistica","lider_logistica","coordinador_logistico"]);

export const AUX_ROLES=new Set(["aux_logistica","auxiliar_corte"]);

export const ACTIVE_ORDER_STATUSES=new Set(["OPEN","QUEUED","ASSIGNED","IN_PROGRESS","WAITING","BLOCKED","READY","PENDING"]);

export const SHIPPING_STEPS=new Set(["CLIENT_POINT","CLIENT_PICKUP","LOCAL_DISPATCH","NATIONAL_DISPATCH","CLOSURE","CLOSED"]);

export const ASSETS=Object.freeze({
  idle:"./assets/img/paco/paco-idle-v11183.svg",
  listening:"./assets/img/paco/paco-listening-v11183.svg",
  thinking:"./assets/img/paco/paco-thinking-v11183.svg",
  talking:"./assets/img/paco/paco-talking-v11183.svg",
  success:"./assets/img/paco/paco-success-v11183.svg"
});

export const MODULES={
  dashboard:"Centro de operaciones",orders:"Pedidos",sales:"Ventas",credit:"Crédito",cartera:"Cartera",caja:"Caja",
  purchasing:"Compras",receiving:"Recepción",picking:"Alistamiento",cutting:"Centro de corte",billing:"Facturación",
  shipping:"Despachos y entregas",inventory:"Inventario",workforce:"Jornada y actividades",approvals:"Excepciones",
  vsm:"Flujo y tiempos",reports:"Analítica",imports:"Histórico",audit:"Auditoría",admin:"Administración"
};

export const STEP_MODULE={
  CARTERA:"cartera",CAJA:"caja",CAJA_FACTURACION:"caja",COMPRAS:"purchasing",RECEPCION_MERCANCIA:"receiving",
  RECEPCION_PEDIDO:"receiving",ALISTAMIENTO:"picking",CORTE:"cutting",FACTURACION:"billing",
  CLIENT_POINT:"shipping",CLIENT_PICKUP:"shipping",LOCAL_DISPATCH:"shipping",NATIONAL_DISPATCH:"shipping",
  CLOSURE:"shipping",CLOSED:"orders"
};
