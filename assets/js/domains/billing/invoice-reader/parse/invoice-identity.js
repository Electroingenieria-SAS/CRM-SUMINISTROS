import { normalizeDate, clean } from "./localized-values.js";

export function detectInvoiceNumber(raw,lines){
  const patterns=[
    /(?:FACTURA(?:\s+ELECTR[ÓO]NICA)?(?:\s+DE\s+VENTA)?|N[ÚU]MERO\s+DE\s+FACTURA)\s*(?:N(?:O|RO|ÚMERO|UMERO)?\.?|N[°º])?\s*[:#-]?\s*([A-Z]{0,6}[- ]?\d[A-Z0-9.-]{1,})/i,
    /(?:FACTURA|INVOICE)\s*(?:NO\.?|N[°º])\s*[:#-]?\s*([A-Z0-9.-]{3,})/i
  ];
  for(const pattern of patterns){const match=raw.match(pattern);if(match?.[1])return clean(match[1]).replace(/\s+/g,"")}
  for(const line of lines){
    if(!/factura/i.test(line)||/nit|dian|resoluci/i.test(line))continue;
    const match=line.match(/\b([A-Z]{1,5}[- ]?\d{3,}[A-Z0-9.-]*)\b/i);if(match?.[1])return clean(match[1]).replace(/\s+/g,"");
  }
  return "";
}

export function detectIssuer(lines){
  const labels=[/^(?:EMISOR|PROVEEDOR|VENDEDOR|RAZ[ÓO]N SOCIAL(?: DEL EMISOR)?)\s*[:\-]\s*(.+)$/i];
  for(const line of lines){for(const re of labels){const m=line.match(re);if(m?.[1])return clean(m[1])}}
  for(let i=0;i<Math.min(lines.length,20);i++){
    const line=lines[i];
    if(/\b(?:S\.?(?:A\.?S\.?|A\.?)|LTDA|LIMITADA|SAS)\b/i.test(line)&&!/cliente|adquirente|factura|dian|nit\s*:/i.test(line))return line;
  }
  return "";
}

export function detectDate(raw,lines){
  const labeled=raw.match(/(?:FECHA(?:\s+DE\s+(?:EMISI[ÓO]N|FACTURA))?)\s*[:\-]?\s*(\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}|\d{4}[\/-]\d{1,2}[\/-]\d{1,2})/i);
  const any=labeled?.[1]||raw.match(/\b(\d{1,2}[\/-]\d{1,2}[\/-]\d{4}|\d{4}[\/-]\d{1,2}[\/-]\d{1,2})\b/)?.[1]||"";
  return normalizeDate(any);
}
