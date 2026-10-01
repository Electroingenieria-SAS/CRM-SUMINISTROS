import { safeText, numberValue, normalizeUnit, normalize } from "../../shared/formatting/material-values.js";
import { sourceKey } from "./material-import-key.js";
import { loadSheetJs } from "../documents/spreadsheet-runtime.js";
import { findHeaders, cell, dateText } from "./material-import-columns.js";

export async function parseSiesaFile(file){
  if(!file)throw new Error("Selecciona el archivo de Siesa.");
  const buffer=await file.arrayBuffer();
  const digest=await crypto.subtle.digest("SHA-256",buffer);
  const sha256=[...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,"0")).join("");
  const XLSX=await loadSheetJs();
  const book=XLSX.read(buffer,{type:"array",cellDates:false});
  const first=book.Sheets[book.SheetNames[0]];
  if(!first)throw new Error("El archivo no contiene hojas legibles.");
  const rows=XLSX.utils.sheet_to_json(first,{header:1,raw:true,defval:null,blankrows:false});
  const {index,map}=findHeaders(rows);
  const result=[];
  const refs=new Map();
  const sourceKeys=new Set();
  for(let i=index+1;i<rows.length;i++){
    const row=rows[i];
    const reference=safeText(cell(row,map,"Referencia Item"));
    const name=safeText(cell(row,map,"Nombre Item"));
    if(!reference&&!name)continue;
    const unit=normalizeUnit(cell(row,map,"Unidad_inventario Item"));
    const warehouse=safeText(cell(row,map,"Bodega"));
    const location=safeText(cell(row,map,"Ubicacion"));
    const lot=safeText(cell(row,map,"Lote"));
    if(!reference||!name||!unit||!warehouse||!location)throw new Error(`Fila ${i+1}: faltan referencia, nombre, unidad, bodega o ubicación.`);
    const criteria=[];
    for(let n=1;n<=5;n++){
      const code=safeText(cell(row,map,`Criterio_Item${n} Item`))||null;
      const cname=safeText(cell(row,map,`Desc_Item${n} Item`))||null;
      if(code||cname)criteria.push({code,name:cname});
    }
    const normalized={name:normalize(name),unit};
    if(refs.has(reference)){
      const prev=refs.get(reference);
      if(prev.name!==normalized.name||prev.unit!==normalized.unit)throw new Error(`Referencia ${reference}: el archivo trae nombres o unidades diferentes para la misma referencia.`);
    }else refs.set(reference,normalized);
    const item={
      sourceRow:i+1,reference,name,unit,weight:numberValue(cell(row,map,"Peso Item")),
      ext1:safeText(cell(row,map,"Desc_ext1 Item"))||null,ext2:safeText(cell(row,map,"Desc_ext2 Item"))||null,criteria,
      warehouse,location,locationName:safeText(cell(row,map,"Nombre Ubicacion"))||null,lot,
      abcCost:safeText(cell(row,map,"ABC_rotacion_costo"))||null,abcTurns:safeText(cell(row,map,"ABC_rotacion_veces"))||null,
      dates:{
        lastCount:dateText(cell(row,map,"Fecha_ult_conteo")),lastPurchase:dateText(cell(row,map,"Fecha_ult_compra")),
        lastSale:dateText(cell(row,map,"Fecha_ult_venta")),lastEntry:dateText(cell(row,map,"Fecha_ult_entrada")),
        lastExit:dateText(cell(row,map,"Fecha_ult_salida")),lastConsumption:dateText(cell(row,map,"Fecha_ult_consumo_prom"))
      },
      avgCostUnit:numberValue(cell(row,map,"Costo_prom_uni")),avgCostTotal:numberValue(cell(row,map,"Costo_prom_tot")),
      lastCostUnit:numberValue(cell(row,map,"Ultimo_costo_uni")),lastCostTotal:numberValue(cell(row,map,"Ultimo_costo_tot")),
      existence:numberValue(cell(row,map,"Cantidad_existencia_1"))||0,committed:numberValue(cell(row,map,"Cantidad_comprometida_1"))||0,
      available:numberValue(cell(row,map,"Cantidad_disponible_1"))||0,avgConsumption:numberValue(cell(row,map,"Consumo_promedio"))||0
    };
    item.sourceKey=sourceKey(item);
    if(sourceKeys.has(item.sourceKey))throw new Error(`Fila ${i+1}: existe una fila física duplicada para ${reference}.`);
    sourceKeys.add(item.sourceKey);
    result.push(item);
  }
  if(!result.length)throw new Error("El archivo no contiene materiales.");
  return {rows:result,materials:refs.size,sha256,sheetName:book.SheetNames[0],headerRow:index+1};
}
