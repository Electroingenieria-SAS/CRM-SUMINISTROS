import { fmt } from "../../../core/format.js";

export const GROUP_LABELS={LOGISTICS:"Operación logística",COMMERCIAL:"Comercial",FINANCE:"Financiera",PURCHASING:"Compras",MANAGEMENT:"Gestión",GENERAL:"General",IMPROVEMENT:"Mejora continua"};

export const PAUSE_REASONS={OTHER:"Otra causa",WAIT_MATERIAL:"Espera de material",WAIT_EQUIPMENT:"Espera de equipo",PRIORITY_CHANGE:"Cambio de prioridad",SUPPORT_OTHER:"Apoyo a otra operación",BREAK:"Pausa programada",INCIDENT:"Novedad / incidente"};

export const DEVIATION_REASONS={"":"Sin causa especial",MATERIAL:"Material no disponible",INTERRUPTION:"Interrupción / prioridad urgente",EQUIPMENT:"Equipo o herramienta",COMPLEXITY:"Mayor complejidad",REWORK:"Corrección o retrabajo",WAITING:"Espera de tercero",OTHER:"Otra causa"};

export function evidenceLabel(policy){return ({NONE:"sin evidencia",FINAL_PHOTO:"foto final",BEFORE_AFTER:"antes + después",FILE:"archivo",LINK:"enlace",ERP_REFERENCE:"referencia del CRM"})[policy]||fmt.label(policy)}

export function activityGlyph(code=""){if(code.includes("CLEAN"))return"✦";if(code.includes("LOADING"))return"↑";if(code.includes("UNLOADING"))return"↓";if(code.includes("COUNT"))return"#";if(code.includes("ORGANIZE")||code.includes("RELOCATION"))return"▦";if(code.includes("TRAIN"))return"△";if(code.includes("IMPROVEMENT"))return"↗";return"●"}
