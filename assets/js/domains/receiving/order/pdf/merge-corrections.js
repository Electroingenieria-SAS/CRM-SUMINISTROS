import { normalizeReceptionLotNumbers } from "../lines/reception-lot-values.js";

function materialKey(line){
  return String(line?.reference||line?.sku||"").trim().toLocaleUpperCase("es-CO");
}

// Corrigir no debe sobrescribir datos revisados. Solo completa lotes vacíos
// si la referencia es única en ambas fuentes; nuevos materiales se agregan
// como pendientes y las referencias duplicadas exigen revisión manual.
export function mergePdfIntoReception(existing,detected){
  const lines=(existing||[]).map(line=>({...line}));
  const occurrences=new Map(),pdfOccurrences=new Map();
  for(const line of lines){
    const key=materialKey(line);
    if(key)occurrences.set(key,(occurrences.get(key)||0)+1);
  }
  for(const line of detected||[]){
    const key=materialKey(line);
    if(key)pdfOccurrences.set(key,(pdfOccurrences.get(key)||0)+1);
  }
  let lotsCompleted=0,newMaterials=0,conflicts=0,ambiguous=0;
  for(const pdfLine of detected||[]){
    const key=materialKey(pdfLine);
    if(!key||occurrences.get(key)>1||pdfOccurrences.get(key)>1){
      ambiguous++;
      continue;
    }
    const index=lines.findIndex(line=>materialKey(line)===key);
    if(index===-1){
      lines.push({...pdfLine,lotReviewed:false,pdfMatchStatus:"UNMATCHED"});
      occurrences.set(key,1);
      newMaterials++;
      continue;
    }
    const current=lines[index];
    const existingLots=normalizeReceptionLotNumbers(current.lotNumbers);
    const pdfLots=normalizeReceptionLotNumbers(pdfLine.lotNumbers);
    if(!existingLots.length&&pdfLots.length){
      lines[index]={...current,lotNumbers:pdfLots,lotSource:"PDF",lotReviewed:false,pdfMatchStatus:"MATCHED"};
      lotsCompleted++;
    }else if(existingLots.length&&pdfLots.length
      &&existingLots.map(value=>value.toUpperCase()).join("|")!==pdfLots.map(value=>value.toUpperCase()).join("|")){
      // El operario conserva lo que escribió; el aviso permite cotejar el PDF.
      lines[index]={...current,pdfSuggestedLotNumbers:pdfLots,pdfLotDiscrepancy:true};
      conflicts++;
    }
  }
  return {lines,summary:{lotsCompleted,newMaterials,conflicts,ambiguous}};
}
