import { fmt } from "../../../core/format.js";

export function moneyCop(value){
  try{return new Intl.NumberFormat("es-CO",{style:"currency",currency:"COP",maximumFractionDigits:0}).format(Number(value||0))}
  catch{return fmt.number(value||0)}
}

export function customerSegmentLabel(segment){
  return ({URGENT:"Urgente",PREMIUM:"Premium",NORMAL:"Normal",BASIC:"Básico"})[String(segment||"NORMAL").toUpperCase()]||"Normal";
}

export function customerConfidenceLabel(value){
  return ({HIGH:"alta",MEDIUM:"media",LOW:"baja",LEARNING:"aprendiendo"})[String(value||"LEARNING").toUpperCase()]||"aprendiendo";
}

export function orderTypeOptions(items=[]){
  return (items||[]).map(item=>({
    ...item,
    name:fmt.label(item?.code)
  }));
}
