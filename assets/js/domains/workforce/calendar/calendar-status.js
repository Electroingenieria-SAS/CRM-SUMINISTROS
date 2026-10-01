import { fmt } from "../../../core/format.js";

export const STATUS_META={
  PLANNED:{label:"Programada",tone:"planned"},
  READY:{label:"Lista",tone:"ready"},
  IN_PROGRESS:{label:"En curso",tone:"running"},
  PAUSED:{label:"En pausa",tone:"paused"},
  WAITING_EVIDENCE:{label:"Pendiente evidencia",tone:"evidence"},
  SUBMITTED:{label:"En revisión",tone:"review"},
  COMPLETED:{label:"Realizada",tone:"completed"},
  RETURNED:{label:"Devuelta",tone:"returned"},
  CANCELLED:{label:"Cancelada",tone:"cancelled"}
};

export function personState(person){
  if(person?.specialTreatment)return {label:person.specialTreatmentLabel||"Tratamiento especial",tone:"special"};
  const status=String(person?.activeStatus||"").toUpperCase();
  if(status==="PAUSED")return {label:"En pausa",tone:"paused"};
  if(person?.activeTitle)return {label:"Ocupado",tone:"busy"};
  return {label:"Disponible",tone:"available"};
}

export function eventStatus(item){
  const key=String(item?.memberStatus||item?.status||"PLANNED").toUpperCase();
  return STATUS_META[key]||{label:fmt.label(key),tone:"planned"};
}
