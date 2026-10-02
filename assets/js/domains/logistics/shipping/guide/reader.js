import { readDocumentText, documentKind } from "../../../../services/document-reader-v11101.js";

export async function readShippingGuideFile(file,{onProgress}={}){
  const result=await readDocumentText(file,{onProgress});
  return {kind:result.kind||documentKind(file),text:result.text,parsed:parseGuideText(result.text)};
}

export function parseGuideText(text){
  const raw=String(text||"").replace(/\r/g,"\n");
  const lines=raw.split(/\n+/).map(clean).filter(Boolean);
  return {
    carrier:detectCarrier(lines,raw),
    trackingNumber:detectTracking(lines,raw),
    carrierInvoiceNumber:detectCarrierInvoice(lines,raw),
    carrierCost:detectFreightCost(lines)
  };
}

export function localizedNumber(value){
  let text=String(value||"").replace(/COP|\$|\s/gi,"").replace(/[^\d,.-]/g,"");
  if(!text)return NaN;
  const comma=text.lastIndexOf(","),dot=text.lastIndexOf(".");
  if(comma>=0&&dot>=0){
    const decimal=comma>dot?",":".";
    const thousand=decimal===","?".":",";
    text=text.split(thousand).join("").replace(decimal,".");
  }else if(comma>=0){
    const decimals=text.length-comma-1;
    text=decimals>0&&decimals<=2?text.replace(/\./g,"").replace(",","."):text.replace(/,/g,"");
  }else if(dot>=0&&/^\d{1,3}(\.\d{3})+$/.test(text)){
    text=text.replace(/\./g,"");
  }
  return Number(text);
}

function detectCarrier(lines,raw){
  for(const line of lines){
    const match=line.match(/(?:TRANSPORTADORA|TRANSPORTADOR|CARRIER|OPERADOR\s+LOG[ÍI]STICO|EMPRESA\s+TRANSPORTADORA)\s*[:=\-]\s*(.+)$/i);
    if(match?.[1])return clean(match[1]).slice(0,100);
  }
  const known=["SERVIENTREGA","COORDINADORA","TCC","INTERRAPIDISIMO","INTER RAPIDISIMO","ENVIA","DEPRISA","DHL","FEDEX","UPS"];
  const upper=raw.toUpperCase();
  return known.find(name=>upper.includes(name))||"";
}

function detectTracking(lines,raw){
  const match=raw.match(/(?:N[ÚU]MERO\s+DE\s+GU[IÍ]A|NRO\.?\s*GU[IÍ]A|GU[IÍ]A|TRACKING(?:\s+NUMBER)?|REMESA|AWB)\s*[:#=\-]?\s*([A-Z0-9-]{5,})/i);
  if(match?.[1])return clean(match[1]).replace(/\s/g,"");
  for(const line of lines){
    if(!/gu[ií]a|tracking|remesa|awb/i.test(line))continue;
    const candidate=line.match(/\b([A-Z0-9-]{6,})\b/i);
    if(candidate?.[1])return candidate[1];
  }
  return "";
}

function detectCarrierInvoice(lines,raw){
  const match=raw.match(/(?:FACTURA(?:\s+(?:TRANSPORTADORA|TRANSPORTADOR|FLETE))?|NRO\.?\s*FACTURA|INVOICE)\s*[:#=\-]?\s*([A-Z0-9.-]{3,})/i);
  if(match?.[1])return clean(match[1]).replace(/\s/g,"");
  for(const line of lines){
    if(!/factura|invoice/i.test(line))continue;
    const candidate=line.match(/\b([A-Z]{0,5}[-.]?\d{3,}[A-Z0-9.-]*)\b/i);
    if(candidate?.[1])return candidate[1];
  }
  return "";
}

function detectFreightCost(lines){
  for(const line of lines){
    if(!/(COSTO|VALOR|TOTAL).*(FLETE|TRANSPORTE)|FLETE.*(COSTO|VALOR|TOTAL)|FREIGHT/i.test(line))continue;
    const values=line.match(/(?:\$|COP\s*)?[\d][\d.,]*/gi)||[];
    for(let index=values.length-1;index>=0;index--){
      const amount=localizedNumber(values[index]);
      if(amount>0)return amount;
    }
  }
  return null;
}

function clean(value){return String(value||"").replace(/\u00a0/g," ").replace(/\s+/g," ").trim()}
