import { localizedNumber } from "./localized-values.js";



export function detectWeight(lines){
  for(const line of lines){
    if(!/PESO/i.test(line))continue;
    const match=line.match(/(?:PESO(?:\s+(?:TOTAL|BRUTO|NETO))?)\s*[:=\-]?\s*([\d.,]+)\s*(?:KG|KGS|KILOGRAMOS?)\b/i);
    const value=match?localizedNumber(match[1]):null;
    if(value>0)return value;
  }
  return null;
}

export function detectQuantity(lines){
  for(const line of lines){
    const match=line.match(/(?:CANTIDAD\s+TOTAL|TOTAL\s+(?:PRODUCTOS|UNIDADES|CANTIDAD)|N[ÚU]MERO\s+DE\s+(?:PRODUCTOS|UNIDADES))\s*[:=\-]?\s*([\d.,]+)/i);
    const value=match?localizedNumber(match[1]):null;
    if(value>0)return value;
  }
  return null;
}
