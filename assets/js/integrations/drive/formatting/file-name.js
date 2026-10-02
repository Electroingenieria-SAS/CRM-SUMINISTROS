

export function uploadTitle(category){
  const code=String(category||"").toUpperCase();
  if(code.includes("INVOICE"))return "Subiendo factura";
  if(code.includes("PVP"))return "Subiendo Anexo PVP";
  if(code.includes("SHIPPING_GUIDE"))return "Subiendo guía de transporte";
  if(code.includes("DELIVERY_EVIDENCE"))return "Subiendo evidencia de entrega";
  if(code.includes("WORK_EVIDENCE"))return "Subiendo evidencia de actividad";
  return "Subiendo archivo a Google Drive";
}

export function safeName(value, fallback = "SIN_REFERENCIA") {
  return String(value || fallback)
    .trim()
    .replace(/[\\/:*?"<>|#%{}~&]/g, "-")
    .replace(/\s+/g, " ")
    .slice(0, 120) || fallback;
}
