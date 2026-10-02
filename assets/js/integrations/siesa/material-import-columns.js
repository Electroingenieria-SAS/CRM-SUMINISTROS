import { safeText } from "../../shared/formatting/material-values.js";

export function findHeaders(rows){
  const required=["Referencia Item","Nombre Item","Unidad_inventario Item","Bodega","Ubicacion","Lote","Cantidad_existencia_1","Cantidad_comprometida_1","Cantidad_disponible_1"];
  const index=rows.findIndex(row=>required.every(header=>row.map(safeText).includes(header)));
  if(index<0)throw new Error("No encontré la fila de encabezados de Siesa. Deben existir Referencia Item, Nombre Item, Unidad_inventario Item, Bodega, Ubicacion, Lote y cantidades.");
  const map=new Map(rows[index].map((value,i)=>[safeText(value),i]));
  return {index,map,required};
}

export function cell(row,map,name){const i=map.get(name);return i===undefined?null:row[i]}

export function dateText(value){
  if(value===null||value===undefined||value==="")return null;
  if(value instanceof Date)return value.toISOString().slice(0,10);
  if(typeof value==="number"&&value>20000&&value<80000){
    const date=new Date(Date.UTC(1899,11,30)+Math.round(value)*86400000);
    return Number.isNaN(date.getTime())?safeText(value):date.toISOString().slice(0,10);
  }
  const text=safeText(value);
  if(/^\d{8}$/.test(text))return `${text.slice(0,4)}-${text.slice(4,6)}-${text.slice(6,8)}`;
  return text||null;
}
