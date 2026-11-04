// Lot identifiers are documentary evidence; they do not replace inventory lot IDs.
// Preserve separators inside a code (e.g. ABC/2026), and split only commas/semicolons/newlines.
export function normalizeReceptionLotNumbers(value){
  const entries=Array.isArray(value)?value.flatMap(item=>String(item??"").split(/[,;\n]+/)):String(value??"").split(/[,;\n]+/);
  const output=[];
  const seen=new Set();
  for(const entry of entries){
    const lot=entry.trim().replace(/\s+/g," ");
    if(!lot)continue;
    const key=lot.toLocaleUpperCase("es-CO");
    if(seen.has(key))continue;
    seen.add(key);
    output.push(lot);
  }
  return output;
}
export function receptionLotNumbersText(value){return normalizeReceptionLotNumbers(value).join(", ")}
export function validateReceptionLineLots(line,index=0){
  const lots=normalizeReceptionLotNumbers(line?.lotNumbers);
  if(!lots.length)throw new Error(`Registra al menos un lote para el material ${index+1} (${line?.reference||line?.description||"sin referencia"}).`);
  if(lots.length>20||lots.some(lot=>lot.length>80||/[<>\x00-\x1f]/.test(lot)))
    throw new Error(`La línea ${index+1} contiene lotes inválidos o demasiado extensos.`);
  if(line?.lotReviewed!==true)
    throw new Error(`Verifica manualmente los lotes del material ${index+1} antes de confirmar la recepción.`);
  return lots;
}
