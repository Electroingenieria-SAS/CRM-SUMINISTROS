

export const TZ="America/Bogota";

export const TABS=[
  ["executive","Resumen ejecutivo"],
  ["operation","Operación y SLA"],
  ["commercial","Comercial"],
  ["logistics","Logística e inventario"],
  ["people","Personas"],
  ["explorer","Explorador BI"],
  ["quality","Calidad del dato"],
  ["saved","Vistas guardadas"]
];

export const DATASETS={
  orders:{
    label:"Pedidos",
    dimensions:{status:"Estado",step:"Etapa",route:"Ruta",type:"Tipo",city:"Ciudad",seller:"Asesor",client:"Cliente",priority:"Prioridad",day:"Día"},
    metrics:{count:"Pedidos",closed:"Pedidos cerrados",invoice_amount:"Valor facturado",avg_cycle_hours:"Ciclo promedio (h)"}
  },
  tasks:{
    label:"Tareas",
    dimensions:{step:"Etapa",status:"Estado",assignee:"Responsable",day:"Día"},
    metrics:{count:"Tareas",completed:"Tareas completadas",avg_hours:"Tiempo promedio (h)",p90_hours:"P90 de tiempo (h)",business_hours:"Horas productivas"}
  },
  invoices:{
    label:"Facturación",
    dimensions:{status:"Estado",currency:"Moneda",seller:"Asesor",client:"Cliente",day:"Día"},
    metrics:{count:"Facturas",amount:"Valor facturado",avg_amount:"Factura promedio"}
  },
  deliveries:{
    label:"Entregas",
    dimensions:{route:"Ruta",carrier:"Transportadora",status:"Estado",day:"Día"},
    metrics:{count:"Entregas",delivered:"Entregas completadas",satisfied:"Entregas con satisfacción",cost:"Costo logístico",avg_transit_hours:"Tránsito promedio (h)",distance_km:"Distancia total (km)",avg_distance_km:"Distancia promedio (km)",avg_satisfaction_hours:"Tiempo hasta satisfacción (h)",avg_post_delivery_confirmation_hours:"Confirmación post-entrega (h)"}
  },
  inventory:{
    label:"Inventario",
    dimensions:{reference:"Referencia",location:"Ubicación",warehouse:"Bodega",item_type:"Tipo de material"},
    metrics:{available:"Disponible",reserved:"Reservado",blocked:"Bloqueado",lots:"Lotes"}
  },
  people:{
    label:"Personas",
    dimensions:{person:"Persona"},
    metrics:{session_hours:"Horas en sesiones ERP",sessions:"Sesiones ERP",tasks:"Tareas asignadas",completed_tasks:"Tareas completadas",work_hours:"Horas en actividades",paused_hours:"Horas en pausa"}
  },
  issues:{
    label:"Incidencias",
    dimensions:{type:"Tipo",source:"Origen",status:"Estado",resolution:"Resolución",day:"Día"},
    metrics:{count:"Incidencias",resolved:"Resueltas",avg_resolution_hours:"Resolución promedio (h)"}
  },
  approvals:{
    label:"Aprobaciones",
    dimensions:{type:"Tipo",status:"Estado",role:"Rol responsable",day:"Día"},
    metrics:{count:"Solicitudes",approved:"Aprobadas",avg_decision_hours:"Decisión promedio (h)"}
  }
};
